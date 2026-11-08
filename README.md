# Smart Lighting System

Prototype IoT system for monitoring and controlling a smart LED lighting node.
The system collects sensor telemetry from ESP32 devices over MQTT, stores data
in PostgreSQL, exposes REST and Socket.IO APIs, and provides a React dashboard.

## Features

- JWT authentication with HttpOnly refresh-token cookie.
- RBAC roles: `ADMIN`, `OPERATOR`, and `VIEWER`.
- Device-scoped access through `device_access`.
- MQTT telemetry, device status, command, retry, and heartbeat handling.
- REST API for devices, telemetry, commands, alerts, dashboard data, and audit logs.
- Socket.IO events scoped to authorized device rooms.
- React/Vite dashboard with realtime telemetry and ON/OFF/PWM controls.

## Project Structure

```text
backend/      Express + TypeScript REST, MQTT, Socket.IO, PostgreSQL access
frontend/     React + TypeScript + Vite dashboard
database/     Versioned migration and seed scripts
deployment/   Full Docker Compose stack for backend, frontend, PostgreSQL, and Mosquitto
firmware/     ESP32 firmware area (currently deferred)
docs/         Requirements, API, database, architecture, and UI contracts
tests/        Simulator and end-to-end test area
```

## Requirements

- Node.js 20+ and npm
- Docker Desktop with Docker Compose
- PostgreSQL 18 and Mosquitto are provided by Docker Compose

## Configuration

Create a root `.env` file. Do not commit it. The minimum values are:

```dotenv
POSTGRES_DB=smartlighting
POSTGRES_USER=smartlighting
POSTGRES_PASSWORD=replace-with-a-local-password
POSTGRES_PORT=55432
MQTT_PORT=1883
BACKEND_PORT=3100
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:3100

DATABASE_URL=postgresql://smartlighting:replace-with-a-local-password@localhost:55432/smartlighting
JWT_SECRET=replace-with-a-long-local-secret
JWT_EXPIRES_IN=900
REFRESH_TOKEN_EXPIRES_IN=604800
COOKIE_SECURE=false
COOKIE_SAME_SITE=strict
PORT=3100
MQTT_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart-lighting-backend
```

For database seeding, set `SEED_ADMIN_PASSWORD` in the shell. Never put the
admin password in this file or in SQL.

## Start Full Stack

Run from the repository root:

```powershell
docker compose --env-file .env -f deployment/docker-compose.yml up -d --build
```

The stack exposes the following local endpoints:

```powershell
Frontend:   http://localhost:5173
Backend:    http://localhost:3100
Health:     http://localhost:3100/health
PostgreSQL: localhost:55432
Mosquitto:  localhost:1883
```

On a new PostgreSQL volume, Compose automatically applies the migration and
seed scripts. Existing volumes are not initialized again.

## Run Backend

```powershell
cd backend
npm install
npm run dev
```

The backend listens on `PORT` from `.env` and exposes `GET /health`.

Useful checks:

```powershell
npm run typecheck
npm run build
npm test
```

## Run Frontend

Use the same hostname for the frontend and API during local development when
`COOKIE_SAME_SITE=strict` is enabled. For the backend port above:

```powershell
cd frontend
npm install
$env:VITE_API_URL = "http://127.0.0.1:3100"
npm run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173/>. The frontend keeps the access token in memory
and uses the HttpOnly refresh cookie when an access token expires.

Frontend checks:

```powershell
npm run typecheck
npm run build
```

## API and Realtime

REST contract: [`docs/API_SPEC.md`](docs/API_SPEC.md)

Common endpoints include:

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /devices
GET    /devices/:id/telemetry/latest
GET    /devices/:id/telemetry
POST   /devices/:id/commands
GET    /alerts
GET    /dashboard/summary
GET    /audit-logs
```

Socket.IO events:

```text
telemetry:update
device:status
command:update
alert:new
```

MQTT device topics use this form:

```text
iot/device/{device_id}/telemetry
iot/device/{device_id}/status
iot/device/{device_id}/command
iot/device/{device_id}/ack
iot/device/{device_id}/config
```

## Testing

Start PostgreSQL and Mosquitto before running backend integration tests:

```powershell
docker compose --env-file .env -f deployment/docker-compose.yml up -d postgres mosquitto
cd backend
npm test
```

The current backend suite covers authentication, RBAC, device access,
commands, operations, MQTT-backed behavior, and Socket.IO authorization.

## Scope and Limitations

This is a course prototype, not a production deployment. The current scope is
one physical ESP32 node (`LIGHT-001`) plus simulator support for testing. The
following are deferred unless explicitly approved: AI/ML, OTA updates, RGB
lighting, fire/security alarms, camera support, and a separate mobile app.

See [`AGENTS.md`](AGENTS.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
and [`docs/PROJECT-RULES.md`](docs/PROJECT-RULES.md) for project constraints
and implementation rules.
