# Job Search Pipeline - Requirements Brief

> Status: v1 built and deployed. This is the original brief, kept for context; the README describes what exists today.

## Problem

I'm tracking my job search across a markdown list - companies, roles, application statuses, notes on fit. As the list grows, it's hard to see where things stand at a glance, know what needs my attention next, and keep details consistent. I need a structured tool that lets me manage my pipeline visually and add new opportunities quickly.

## Users

Just me (for now).

## Core workflow

1. **Research** - Find open positions on company career pages, LinkedIn, and job boards
2. **Add** - Add the opportunity to the app, either manually or by pasting a job posting URL (auto-fill)
3. **Assess** - LLM compares the job posting against my CV and auto-generates a fit level (High/Medium/Low) and a "why it fits" summary. User can review and override both
4. **Track** - Move opportunities through pipeline stages as things progress
5. **Review** - Use the board view to see where everything stands and decide what to act on next

## Pipeline stages

1. Watching - No open role yet, monitoring the company
2. Shortlisted - Open role identified, haven't applied yet
3. Applied - Application submitted
4. Screen - Initial recruiter/phone screen
5. Interviewing - In active interview rounds
6. Offer - Received an offer
7. Rejected - Got a rejection at any stage
8. Auto Rejected - Rejected automatically, without a human review
9. Ghosted - No response after a reasonable wait (set automatically after 6 weeks in Applied or Screen)

## Key features - v1

### 1. Add a job from a link

Paste a job posting URL from a company's career page and the app auto-extracts structured data.

**Flow:**
1. User pastes a career page URL
2. Backend fetches the page HTML
3. HTML (or cleaned text) is sent to an LLM along with the user's CV. The LLM extracts: company name, job title, location, company size, salary (if listed), and role requirements. It also assesses fit level (High/Medium/Low) and generates a "why it fits" summary by comparing the role against the CV
4. Extracted fields + fit assessment pre-fill a form for the user to review, edit, and save

**Assumptions:**
- The URL is a public company career page (no auth required)
- If extraction misses fields, the user fills them in manually
- The CV is stored in the app and included as context in every LLM extraction call
- Fit level and "why it fits" are suggestions - user can always override

### 2. Pipeline board (Kanban)

A Kanban-style board view showing all opportunities organized by pipeline stage. Each card displays the company name, job title, and fit level. Cards can be dragged between stages to update status.

### 3. Role detail view

A detail page for each opportunity. Title format: `{Company} - {Job Title}`.

**Fields displayed:**
- Pipeline status (editable)
- Fit level: High / Medium / Low (editable)
- Why it fits (editable text)
- Details: product, company size, office/location, salary
- Careers page link
- Source

### 4. Manual add

Option to add a role manually without a URL - fill in all fields by hand. Useful for roles found through networking or referrals where there's no public posting.

## Out of scope for v1

- Contact tracking (people at each company, recruiters)
- Calendar integration (interview scheduling)
- Notifications or reminders
- Multi-user / sharing
- Analytics or reporting (e.g., funnel conversion)
- Research refresh - automatically discovering and adding new roles from web searches
- "My Details" settings page with CV upload (v1 reads from local file; future version adds in-app upload so CV can be updated without editing the file)

## Seed data

The first 23 roles were imported once from a personal markdown list. That data and the import script are not part of this repo.

## Tech decisions

- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Python + FastAPI. Fetches and parses job pages, calls Claude, serves the built frontend
- **Database:** SQLite (single file, zero setup)
- **LLM API:** Claude API, used for job page extraction and fit assessment
- **Auto-fill approach:** Fetch public career page HTML, send cleaned text + the user's CV to Claude for structured extraction and fit assessment
- **CV storage:** Read from a local file set by `CV_PATH`, or from `CV_CONTENT` when hosted. Never stored in the repo. Used as context for all LLM calls
- **Hosting:** Railway, with a volume for the SQLite file
- **Data model:** Flat - each role is its own entry, even if multiple roles exist at the same company
