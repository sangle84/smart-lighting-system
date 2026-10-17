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
});
