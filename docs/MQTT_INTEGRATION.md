# MQTT Integration – Dynamic Authentication & ACL Checklist

This document guides the remaining work needed to bring **Giai đoạn 3 – MQTT Integration** to **Done**.

## 1️⃣ Dynamic authentication (device_key ↔ credential_hash)
- The backend stores a field `credential_hash` (bcrypt‑hashed secret) for each device in `device_access`.
- **Required implementation** (already present in code base but not fully wired):
  1. On MQTT CONNECT, Mosquitto calls the **auth plugin** (see `deployment/mosquitto/auth_plugin.so`). Ensure the plugin reads `credential_hash` from the DB and verifies the password supplied by the device (`MQTT_DEVICE_PASSWORD`).
  2. Update `backend/src/mqtt/auth.ts` (or equivalent) to perform bcrypt verification using `bcryptjs`.
  3. Add unit test `mqtt/auth.integration.test.ts` that:
     - Creates a device with a known password.
     - Connects with the correct password – expect success.
     - Connects with a wrong password – expect failure.

## 2️⃣ Lifecycle‑based ACL validation
The contract requires three lifecycle states:
- **PROVISIONED** – device can publish/subscribe its own topics.
- **MAINTENANCE** – device may publish telemetry but must not receive commands.
- **DECOMMISSIONED** – all access revoked.

### Steps to verify
1. **Prepare three devices** (real or simulated) with passwords set in `.env`.
2. Use the backend API `PUT /devices/:id/lifecycle` to switch the lifecycle.
3. For each state, run the following checks using `mosquitto_pub`/`mosquitto_sub`:
   - **PROVISIONED** – subscribe to `device/<id>/cmd/#` and publish telemetry – both succeed.
   - **MAINTENANCE** – publish telemetry succeeds, subscribe to command topics should be rejected (SUBACK error code `0x80`).
   - **DECOMMISSIONED** – any connect/publish/subscribe should be rejected.
4. Record the results in `tests/RESULTS.md` under a new table "MQTT Integration Checks".

## 3️⃣ QoS alignment for ACK/status
- Firmware currently uses `PubSubClient` with default QoS 0 for telemetry.
- Backend expects **QoS 1** for command ACK/status (see `docs/API_SPEC.md` B.5).
- **Action items**:
  1. In `firmware/src/mqtt.cpp` (or equivalent) change `publish(topic, payload)` to `publish(topic, payload, true)` where the third argument is `retain` flag; this also forces QoS 1 in PubSubClient.
  2. Add a test that publishes a command with QoS 1, then verifies the backend receives an ACK with `messageId` matching the publish.

---
### Checklist (to be ticked off)
- [ ] Auth plugin compiled and configured in `deployment/docker-compose.yml`.
- [ ] Backend bcrypt verification implemented.
- [ ] Unit/Integration test for dynamic auth added and passing.
- [ ] Lifecycle ACL test script written and executed.
- [ ] Firmware QoS 1 publish for ACK/status implemented.
- [ ] All above verified on real hardware **or** on the `tests/mqtt-simulator`.

Once all items are completed and evidence is recorded in `tests/RESULTS.md`, update `PLAN.md` status for stage 3 to **Done**.
