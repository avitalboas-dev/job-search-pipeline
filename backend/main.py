import os
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import database as db
import auth
from routes import jobs, extract

app = FastAPI(title="Job Search Pipeline API")

# Allow the Vite dev server to call our API in local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB on startup
@app.on_event("startup")
def startup():
    db.init_db()

@app.get("/health")
def health():
    return {"status": "ok"}

# API routes — registered first so they take precedence over the SPA catch-all
app.include_router(auth.router)
app.include_router(jobs.router, dependencies=[Depends(auth.require_auth)])
app.include_router(extract.router, dependencies=[Depends(auth.require_auth)])

# Serve the built React frontend in production
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

if os.path.exists(STATIC_DIR):
    # Serve static assets (JS bundles, CSS, images)
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Serve the file directly if it exists (favicon.ico, etc.)
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve the SPA entry point for client-side routing
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    @app.get("/")
    def root():
        return {"status": "ok", "message": "Job Search Pipeline API"}
