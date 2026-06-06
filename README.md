# Dockre Manager

A lightweight Docker management dashboard. A **Next.js** frontend talks to a small
**Go** backend that drives Docker through the `docker` CLI (command-based, no Docker
SDK). Authentication and the activity log are stored in **MySQL**.

## Features

- **Overview** – live container counts and real system metrics (CPU / memory / disk).
- **Services** – list, start, stop, restart, pause, remove containers (grouped by
  Compose project); view logs and open a command terminal. Create new services two ways:
  - **Custom Compose** – paste a `docker-compose` YAML and deploy it instantly.
  - **Quick Deploy** – pick a ready-made template from the `templates/` folder.
- **Activity Log** – a record of deploy / start / stop / restart / remove events.
- **Settings** – system summary and password change.

## Architecture

```
Next.js frontend (port 3000)
        │  fetch (Bearer token)
        ▼
Go backend  (port 3030)  ──>  docker CLI
        │
        ▼
     MySQL  (users, activity logs, port allocations)
```

- Frontend → backend base URL is set by `NEXT_PUBLIC_API_URL`.
- The backend allocates a free host port for each `${VAR}` placeholder found in a
  template's compose file and writes them to an `.env` before running
  `docker compose up`.

## Project structure

```
src/                         Next.js app (UI, store, lib)
  app/                       pages & layout
  components/                dashboard, modals, ui (shadcn)
  store/                     zustand stores (auth, docker)
  lib/                       api client + utils
mini-services/docker-manager Go backend (handlers, db, docker exec)
templates/                   deployable compose templates
```

## Getting started

Prerequisites: **Node.js**, **Go 1.21+**, **Docker**, and a reachable **MySQL**.

```bash
# one-shot setup (MySQL check, deps, build)
./setup-mysql.sh

# or manually:
cp .env.example .env
npm install

# backend
cd mini-services/docker-manager
go mod tidy && go build -o docker-manager && ./docker-manager

# frontend (in another terminal)
npm run dev
```

Open http://localhost:3000 and sign in with the default account:

```
username: admin
password: admin123
```

## Configuration (`.env`)

| Variable              | Description                                  |
| --------------------- | -------------------------------------------- |
| `JWT_SECRET`          | Secret used to sign auth tokens              |
| `DATABASE_URL`        | MySQL connection (Prisma-style URL accepted) |
| `TEMPLATE_DIR`        | Path to the templates folder                 |
| `PORT`                | Go backend port (default 3030)               |
| `NEXT_PUBLIC_API_URL` | Backend base URL used by the frontend        |
