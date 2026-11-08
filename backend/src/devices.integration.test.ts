import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './index.js';
import { pool } from './db/index.js';

describe('devices REST API', () => {
  const app = createApp(pool);
  const deviceId = `TEST-${Date.now()}`;
  const username = `device-viewer-${Date.now()}`;
  const password = 'ViewerPass123';
  let viewerId = '';
  let adminToken = '';
  let viewerToken = '';

  beforeAll(async () => {
    const role = await pool.query<{ role_id: number }>(
      "SELECT role_id FROM role WHERE role_name = 'VIEWER'"
    );
    const user = await pool.query<{ user_id: string }>(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [username, `${username}@example.local`, await bcrypt.hash(password, 10), role.rows[0].role_id]
    );
    viewerId = user.rows[0].user_id;

    const adminLogin = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'AdminPass123' })
      .expect(200);
    adminToken = adminLogin.body.access_token;

    const viewerLogin = await request(app)
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    viewerToken = viewerLogin.body.access_token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM telemetry WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM device_access WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM device WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [viewerId]);
  });

  it('onboards a device and returns its key only once', async () => {
    const response = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ device_id: deviceId, device_name: 'Test Light' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        device_id: deviceId,
        lifecycle_status: 'REGISTERED',
        device_key: expect.stringMatching(/^sec_dev_/),
      })
    );
    expect(response.body.credential_hash).toBeUndefined();

    // Duplicate device_id returns 409 Conflict
    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ device_id: deviceId, device_name: 'Duplicate Light' })
      .expect(409);

    // Missing required fields returns 400 Validation Error
    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ device_id: '' })
      .expect(400);

    // Viewer cannot onboard devices (403)
    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ device_id: `VIEWER-${Date.now()}`, device_name: 'Light' })
      .expect(403);
  });

  it('scopes non-admin device access and supports telemetry reads', async () => {
    await request(app)
      .get(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app)
      .put(`/devices/${deviceId}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_ids: [viewerId] })
      .expect(200);

    await pool.query(
      `INSERT INTO telemetry (device_id, lux, motion, voltage, current, power, pwm)
       VALUES ($1, 185.2, TRUE, 12.1, 0.72, 8.71, 65)`,
      [deviceId]
    );

    const latest = await request(app)
      .get(`/devices/${deviceId}/telemetry/latest`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(latest.body).toMatchObject({ device_id: deviceId, pwm: 65, motion: true });

    const history = await request(app)
      .get(`/devices/${deviceId}/telemetry?limit=10`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(history.body.device_id).toBe(deviceId);
    expect(history.body.total).toBe(1);
  });

  it('rejects invalid adaptive config and viewer writes', async () => {
    await request(app)
      .put(`/devices/${deviceId}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_ids: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);

    await request(app)
      .get(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    await request(app)
      .patch(`/devices/${deviceId}/config`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ adaptive_config: {} })
      .expect(403);

    await request(app)
      .patch(`/devices/${deviceId}/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        adaptive_config: {
          enabled: true,
          motion_timeout_sec: 30,
          lux_thresholds: [{ min_lux: 0, pwm: 101 }],
          no_motion_pwm: 10,
        },
      })
      .expect(400);
  });

  it('lists devices scoped by access, reads access list, updates device and lifecycle (TC10, TC11)', async () => {
    // GET /devices: Admin sees all devices, Viewer sees only assigned
    const adminList = await request(app)
      .get('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.data.some((d: { device_id: string }) => d.device_id === deviceId)).toBe(true);

    const viewerList = await request(app)
      .get('/devices')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(viewerList.body.data.some((d: { device_id: string }) => d.device_id === deviceId)).toBe(true);

    // GET /devices/:id/access: Admin 200, Viewer 403
    await request(app)
      .get(`/devices/${deviceId}/access`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const accessList = await request(app)
      .get(`/devices/${deviceId}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(accessList.body.users.some((u: { user_id: string }) => u.user_id === viewerId)).toBe(true);

    // PUT /devices/:id: Admin 200, Viewer 403
    await request(app)
      .put(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ device_name: 'Renamed Light' })
      .expect(403);

    const updated = await request(app)
      .put(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ device_name: 'Updated Light Name', location: 'Lab 101' })
      .expect(200);
    expect(updated.body.device_name).toBe('Updated Light Name');

    // PATCH /devices/:id/lifecycle: Admin 200, Viewer 403, invalid status 400 (TC10)
    await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ lifecycle_status: 'PROVISIONED' })
      .expect(403);

    // Invalid status string returns 400
    await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lifecycle_status: 'INVALID_STATUS' })
      .expect(400);

    // Invalid transition directly from REGISTERED to MAINTENANCE returns 400
    await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lifecycle_status: 'MAINTENANCE' })
      .expect(400);

    // Valid state transitions: REGISTERED -> PROVISIONED -> ACTIVE -> MAINTENANCE -> DECOMMISSIONED
    await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lifecycle_status: 'PROVISIONED' })
      .expect(200);

    await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lifecycle_status: 'ACTIVE' })
      .expect(200);

    const maintenance = await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lifecycle_status: 'MAINTENANCE' })
      .expect(200);
    expect(maintenance.body.lifecycle_status).toBe('MAINTENANCE');

    const decommissioned = await request(app)
      .patch(`/devices/${deviceId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lifecycle_status: 'DECOMMISSIONED' })
      .expect(200);
    expect(decommissioned.body.lifecycle_status).toBe('DECOMMISSIONED');
  });
});
