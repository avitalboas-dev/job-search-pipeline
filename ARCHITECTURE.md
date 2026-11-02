```
┌─────────────────────────────────────────────────────┐
│                     Your Browser                     │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │  Login screen   →  React App (3 pages)       │  │
│   │                     • Board (Kanban)          │  │
│   │                     • Add Role               │  │
│   │                     • Job Detail             │  │
│   └────────────────────┬─────────────────────────┘  │
└────────────────────────│────────────────────────────┘
                         │ /api calls
                         ▼
┌─────────────────────────────────────────────────────┐
│                  Railway (cloud host)                │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │  Python / FastAPI server                     │  │
│   │  • Serves the React app as static files      │  │
│   │  • Handles API routes (/jobs, /extract)      │  │
│   │  • AI extraction: scrapes job URLs           │  │
│   └────────────────────┬─────────────────────────┘  │
│                        │ reads/writes                │
│   ┌────────────────────▼─────────────────────────┐  │
│   │  SQLite database  (/data/jobs.db)            │  │
│   │  Stored on a permanent Railway volume        │  │
│   └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ auto-deploys on merge
┌────────────────────────┴────────────────────────────┐
│              GitHub (avitalboas-dev/job-search-pipeline)  │
│              master branch = what's live             │
└─────────────────────────────────────────────────────┘
```

The flow in plain English:
1. You open the app → login screen appears
2. You log in (the server checks the password) → React loads your board from the API
3. The API reads/writes jobs to the SQLite database on Railway
4. When you want to change the app → merge to master on GitHub → Railway redeploys automatically
