# MQTT simulator

This process simulates device `LIGHT-002` for MQTT integration tests. It publishes status and telemetry, accepts commands, and returns ACK messages. A repeated `command_id` is acknowledged from the in-memory cache without applying the command again.

Install and run after starting Mosquitto with credentials from the root `.env`:

```powershell
npm install
$env:MQTT_URL = "mqtt://localhost:1883"
$env:MQTT_USERNAME = "LIGHT-002"
$env:MQTT_PASSWORD = $env:MQTT_LIGHT002_PASSWORD
npm run dev
```

The simulator uses these topics:

- `iot/device/LIGHT-002/status`
- `iot/device/LIGHT-002/telemetry`
- `iot/device/LIGHT-002/command`
- `iot/device/LIGHT-002/ack`

The local broker now requires credentials and contains static per-device ACL rules. Authentication has been verified, but ACL denial for an unrelated topic still needs resolution and runtime evidence with the selected Mosquitto image. This static prototype also does not dynamically validate PostgreSQL `credential_hash` or `lifecycle_status`, so it is not final security evidence for TC10, TC13, or TC14 yet.