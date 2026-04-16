# StudyFlow — Homework Scheduler

A color-coded homework tracker built with Node.js and vanilla HTML/CSS/JS.
Each class gets its own row and color. Add assignments in two clicks, manage
class details separately under Settings.

## Quick Start

```bash
make install   # install dependencies
make start     # run at http://localhost:3000
make dev       # run with auto-reload (nodemon)
```

Or without Make:

```bash
npm install
npm start
```

## Features

- **Color-coded class rows** — each class has a unique color set in Settings
- **Quick homework entry** — prominent "+ Add Homework" button; asks for class,
  description, optional notes, and optional deadline
- **Deadline urgency badges** — overdue (red), due today (orange), due soon (yellow)
- **Complete / delete** assignments inline
- **Class Settings** — separate panel for adding/editing/removing classes and
  their metadata (teacher, room, period). These details rarely change, so they
  live out of the way
- **Show completed** toggle in the header

## Project Structure

```
StudyFlow/
├── server.js               # Express entry point
├── src/
│   ├── routes/
│   │   ├── classes.js      # REST endpoints for classes
│   │   └── homework.js     # REST endpoints for homework
│   ├── store/
│   │   └── dataStore.js    # File-based JSON storage (swap for DB here)
│   └── middleware/
│       └── errorHandler.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js              # All frontend logic; API calls isolated in `api` object
├── data/
│   └── db.json             # Auto-created on first run (git-ignored)
├── Makefile
└── package.json
```

## API

| Method | Endpoint             | Body / Query               | Description           |
|--------|----------------------|----------------------------|-----------------------|
| GET    | /api/classes         | —                          | List all classes      |
| POST   | /api/classes         | `{name, color, teacher, room, period}` | Create class |
| PUT    | /api/classes/:id     | same fields                | Update class          |
| DELETE | /api/classes/:id     | —                          | Delete class + its HW |
| GET    | /api/homework        | `?classId=` (optional)     | List homework         |
| POST   | /api/homework        | `{classId, description, notes?, deadline?}` | Add homework |
| PUT    | /api/homework/:id    | `{description?, notes?, deadline?, completed?}` | Update |
| DELETE | /api/homework/:id    | —                          | Delete                |

## Adding an External API Later

- **Backend:** Replace `src/store/dataStore.js` with async DB/API calls. Route
  handlers only need `await` keywords added; the URL structure stays the same.
- **Frontend:** The `api` object in `public/app.js` wraps every `fetch()` call.
  To point to an external service, only that object needs updating — the rest
  of the frontend is untouched.
