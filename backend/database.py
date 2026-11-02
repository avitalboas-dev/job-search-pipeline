import sqlite3
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IRISH_TZ = ZoneInfo("Europe/Dublin")

STALE_STAGES = ("Applied", "Screen")
STALE_THRESHOLD_DAYS = 42

def _default_db_path():
    if os.path.isdir("/data"):
        return "/data/jobs.db"
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "jobs.db")

DB_PATH = os.environ.get("DB_PATH", _default_db_path())


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT NOT NULL,
            job_title TEXT NOT NULL,
            location TEXT,
            company_size TEXT,
            salary TEXT,
            role_requirements TEXT,
            pipeline_stage TEXT NOT NULL DEFAULT 'Shortlisted',
            fit_level TEXT NOT NULL DEFAULT 'Unknown',
            why_it_fits TEXT,
            careers_page_url TEXT,
            source TEXT,
            notes TEXT,
            product_description TEXT,
            logo_url TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status_changed_at TEXT
        )
    """)
    # Migration for existing databases that predate logo_url
    try:
        conn.execute("ALTER TABLE jobs ADD COLUMN logo_url TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    # Migration for existing databases that predate status_changed_at
    try:
        conn.execute("ALTER TABLE jobs ADD COLUMN status_changed_at TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    conn.execute("UPDATE jobs SET status_changed_at = updated_at WHERE status_changed_at IS NULL")
    conn.commit()
    _migrate_timestamps_to_irish_time(conn)
    conn.close()


def _migrate_timestamps_to_irish_time(conn):
    """One-time conversion of any pre-existing timestamps to Europe/Dublin time."""
    rows = conn.execute("SELECT id, created_at, updated_at, status_changed_at FROM jobs").fetchall()
    for row in rows:
        updates = {}
        for col in ("created_at", "updated_at", "status_changed_at"):
            value = row[col]
            if not value:
                continue
            converted = datetime.fromisoformat(value).astimezone(IRISH_TZ).isoformat()
            if converted != value:
                updates[col] = converted
        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", (*updates.values(), row["id"]))
    conn.commit()


def row_to_dict(row):
    return dict(row)


def now_iso():
    return datetime.now(IRISH_TZ).isoformat()


def _auto_ghost_stale_jobs(conn):
    """Move jobs untouched for STALE_THRESHOLD_DAYS in an active stage to Ghosted."""
    cutoff = (datetime.now(IRISH_TZ) - timedelta(days=STALE_THRESHOLD_DAYS)).isoformat()
    now = now_iso()
    placeholders = ", ".join("?" for _ in STALE_STAGES)
    conn.execute(
        f"""UPDATE jobs SET pipeline_stage = 'Ghosted', status_changed_at = ?, updated_at = ?
            WHERE pipeline_stage IN ({placeholders}) AND status_changed_at < ?""",
        (now, now, *STALE_STAGES, cutoff),
    )
    conn.commit()


# --- CRUD ---

def get_all_jobs():
    conn = get_connection()
    _auto_ghost_stale_jobs(conn)
    rows = conn.execute("SELECT * FROM jobs ORDER BY updated_at DESC").fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


def get_job(job_id: int):
    conn = get_connection()
    _auto_ghost_stale_jobs(conn)
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return row_to_dict(row) if row else None


def create_job(data: dict):
    conn = get_connection()
    now = now_iso()
    cursor = conn.execute("""
        INSERT INTO jobs (company, job_title, location, company_size, salary,
            role_requirements, pipeline_stage, fit_level, why_it_fits,
            careers_page_url, source, notes, product_description, logo_url,
            created_at, updated_at, status_changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("company"),
        data.get("job_title"),
        data.get("location"),
        data.get("company_size"),
        data.get("salary"),
        data.get("role_requirements"),
        data.get("pipeline_stage", "Shortlisted"),
        data.get("fit_level", "Unknown"),
        data.get("why_it_fits"),
        data.get("careers_page_url"),
        data.get("source"),
        data.get("notes"),
        data.get("product_description"),
        data.get("logo_url"),
        now,
        now,
        now,
    ))
    conn.commit()
    job_id = cursor.lastrowid
    conn.close()
    return get_job(job_id)


def update_job(job_id: int, data: dict):
    # Only update fields that are explicitly provided (not None)
    fields = {k: v for k, v in data.items() if v is not None}
    if not fields:
        return get_job(job_id)
    fields["updated_at"] = now_iso()
    if "pipeline_stage" in fields:
        current = get_job(job_id)
        if current and current["pipeline_stage"] != fields["pipeline_stage"]:
            fields["status_changed_at"] = fields["updated_at"]
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [job_id]
    conn = get_connection()
    conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return get_job(job_id)


def delete_job(job_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
