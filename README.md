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

Prerequisites: **Node.js**, **Go 1.21+**, **Docker**, and a running **MySQL**.

### 1. Create the database

Connect to MySQL (`mysql -u root`) and run the following. This creates the
database, all tables, and the default `admin` user.

```sql
CREATE DATABASE IF NOT EXISTS docker_manager
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE docker_manager;

-- Users (login + password change)
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(255) PRIMARY KEY,
  username      VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Host-port allocations for deployed services
CREATE TABLE IF NOT EXISTS port_allocations (
  id           INTEGER PRIMARY KEY AUTO_INCREMENT,
  project_name VARCHAR(255) NOT NULL,
  port_var     VARCHAR(255) NOT NULL,
  port_number  INTEGER NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_name),
  INDEX idx_port (port_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log
CREATE TABLE IF NOT EXISTS logs (
  id         VARCHAR(255) PRIMARY KEY,
  project    VARCHAR(255) NOT NULL DEFAULT '',
  level      VARCHAR(50)  NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default account → username: admin   password: admin123
-- (password_hash is the bcrypt hash of "admin123")
INSERT INTO users (id, username, password_hash) VALUES (
  'admin-001',
  'admin',
  '$2b$10$UxwGXzXvHhmD5hbYUxwcpunqmbUuVRGBgDh0B0myIzDPPXKg6.A56'
);
```

> The backend also auto-creates the database, tables, and default user on first
> run if they don't exist — so this step is optional when the MySQL user has
> `CREATE` privileges. Run it manually if you prefer full control.

### 2. Run the app

```bash
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET if needed

# backend
cd mini-services/docker-manager
go mod tidy && go build -o docker-manager && ./docker-manager

# frontend (in another terminal)
npm install
npm run dev
```

Open http://localhost:3000 and sign in:

```
username: admin
password: admin123
```

> **Important:** both processes must be running. The frontend (port 3000) talks
> to the Go backend (port 3030); if the backend isn't up you'll see
> `Failed to fetch` errors in the dashboard.

## Configuration (`.env`)

| Variable              | Description                                  |
| --------------------- | -------------------------------------------- |
| `JWT_SECRET`          | Secret used to sign auth tokens              |
| `DATABASE_URL`        | MySQL connection (Prisma-style URL accepted) |
| `TEMPLATE_DIR`        | Path to the templates folder                 |
| `PORT`                | Go backend port (default 3030)               |
| `NEXT_PUBLIC_API_URL` | Backend base URL used by the frontend        |
