# End-to-End Tests — Dockre Manager

Black-box end-to-end tests for the Go backend in [`../mini-services`](../mini-services).
They talk to a **running** backend over HTTP exactly like the real frontend
does — nothing is mocked. Real router, real MySQL, real JWT, and (for the
container tests) the real Docker engine.

Covered flows:

| File | Flow |
|------|------|
| `login_test.go` | Login: success, wrong password, unknown user, missing fields, token grants access to protected routes, tampered token rejected |
| `password_test.go` | Password reset/change: register → change → old password fails → new password works; wrong-current rejected; missing fields; auth required; duplicate register |
| `container_test.go` | Container creation: compose deploy with auto-allocated port, deploy from template, listing the new container, input validation, unknown template — plus cleanup |

## Prerequisites

1. **Backend running.** From the project root:
   ```bash
   cd mini-services
   go run .
   ```
   It listens on `http://localhost:3030` and auto-creates a default admin
   user (`admin` / `admin123`) on first start.
2. **MySQL** reachable by the backend (the backend handles this; the tests
   don't talk to the DB directly).
3. **Docker** running — only needed for the real container-creation tests.
   They auto-skip if Docker is unavailable.

## Running

```bash
cd e2e-tests
go test -v ./...
```

If the backend is not reachable, every test **skips** (with a clear message)
rather than failing.

To skip the Docker-dependent tests explicitly:

```bash
E2E_SKIP_DOCKER=1 go test -v ./...
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_BASE_URL` | `http://localhost:3030` | Backend base URL |
| `E2E_USERNAME` | `admin` | Admin username for login |
| `E2E_PASSWORD` | `admin123` | Admin password |
| `E2E_TEST_IMAGE` | `alpine:3.20` | Image used by the compose-deploy test |
| `E2E_SKIP_DOCKER` | _(unset)_ | Set to `1` to skip Docker-dependent tests |

## Notes

- The password tests register a unique throwaway user each run (there is no
  delete-user endpoint), so they never mutate the `admin` account.
- The container tests always clean up the projects they create via
  `t.Cleanup`, even when an assertion fails.

---

# Browser E2E (Playwright)

A second, **browser-driven** layer lives in [`ui/`](ui). It opens a real Chromium
window and drives the actual UI — exactly the journey you asked for:

> open the app → **log in** → **change the password** → **create a service from a
> template** → **stop it**.

It is fully self-contained in this folder and does **not** modify the main
project.

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright config (visible browser by default, auto-starts the frontend) |
| `ui/journey.spec.ts` | The full login → change-password → deploy → stop journey |
| `ui/api-helpers.ts` | Setup/cleanup only: keeps the admin password & Docker state repeatable |

## Prerequisites

1. **Backend** running on `:3030` (`cd ../mini-services && go run .`)
2. **Frontend** on `:3000` — Playwright auto-starts it (`npm --prefix .. run dev`)
   and reuses it if already running. The main project must have its deps
   installed (`npm --prefix .. install`).
3. **Docker** running (the journey deploys a real container).

## Install

```bash
cd e2e-tests
npm install
npm run install:browsers   # downloads Chromium
```

## Run

```bash
# visible browser (default — you watch it happen)
npm run test:ui

# headless
E2E_HEADLESS=1 npm run test:ui

# if you start the frontend yourself, skip the auto webServer
E2E_NO_WEBSERVER=1 npm run test:ui
```

## How it stays repeatable

Changing the password really mutates the `admin` account, so:

- `beforeAll` self-heals the password to the original (tries the original,
  falls back to the new one and switches it back) — survives a crashed run.
- The journey changes the password to `NEW_PASSWORD`, then `afterAll` restores
  it to the original and removes the container it created.

### Leaving the traces (E2E_KEEP)

By default the teardown erases everything the run did. To **keep** the changed
password and the deployed container so you can inspect them in the UI
afterwards:

```bash
E2E_KEEP=1 npm run test:ui
# PowerShell:  $env:E2E_KEEP=1; npm run test:ui
```

With `E2E_KEEP=1`, `afterAll` is skipped and prints what was left behind:
the admin password stays `NEW_PASSWORD` and the `e2eui…` project stays
deployed (stopped). This is safe to do — the **next** normal run's `beforeAll`
self-heals the password back to the original automatically. Remove a leftover
container manually with `docker compose -p <project> down -v` (the project name
is printed at the end of the run).

## Browser-test configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_WEB_URL` | `http://localhost:3000` | Frontend URL |
| `E2E_BASE_URL` | `http://localhost:3030` | Backend URL (setup/cleanup) |
| `E2E_USERNAME` | `admin` | Admin username |
| `E2E_PASSWORD` | `admin123` | Original admin password |
| `E2E_NEW_PASSWORD` | `NewE2EPass123!` | Password the journey switches to |
| `E2E_HEADLESS` | _(unset)_ | `1` = run headless |
| `E2E_SLOWMO` | `800` (headed) | ms delay between actions, so the run is watchable; `0` = full speed |
| `E2E_KEEP` | _(unset)_ | `1` = skip teardown; keep the changed password & deployed container for inspection |
| `E2E_NO_WEBSERVER` | _(unset)_ | `1` = don't auto-start the frontend |
