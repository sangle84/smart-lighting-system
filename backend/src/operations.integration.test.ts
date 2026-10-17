import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './index.js';
import { pool } from './db/index.js';

describe('alerts, dashboard and audit REST API', () => {
  const app = createApp(pool);
  const deviceId = `OPS-${Date.now()}`;
  const username = `ops-viewer-${Date.now()}`;
  let viewerId = '';
  let adminToken = '';
  let viewerToken = '';
  let alertId = '';

  beforeAll(async () => {
    const role = await pool.query<{ role_id: number }>(
      "SELECT role_id FROM role WHERE role_name = 'VIEWER'"
    );
    const user = await pool.query<{ user_id: string }>(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [
        username,
        `${username}@example.local`,
        await bcrypt.hash('ViewerPass123', 10),
        role.rows[0].role_id,
      ]
    );
    viewerId = user.rows[0].user_id;

    const admin = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'AdminPass123' })
      .expect(200);
    adminToken = admin.body.access_token;
    const viewer = await request(app)
      .post('/auth/login')
      .send({ username, password: 'ViewerPass123' })
      .expect(200);
    viewerToken = viewer.body.access_token;

    await pool.query(
      `INSERT INTO device (device_id, device_name, credential_hash)
       VALUES ($1, 'Operations Test Light', 'test-hash')`,
      [deviceId]
    );
    const alert = await pool.query<{ alert_id: string }>(
      `INSERT INTO alert (device_id, alert_type, severity, message)
       VALUES ($1, 'LAMP_FAULT', 'HIGH', 'test alert') RETURNING alert_id`,
      [deviceId]
    );
    alertId = alert.rows[0].alert_id;
    await pool.query(
      'INSERT INTO device_access (user_id, device_id) VALUES ($1, $2)',
      [viewerId, deviceId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM alert WHERE alert_id = $1', [alertId]);
    await pool.query('DELETE FROM device_access WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM device WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [viewerId]);
  });

  it('lists scoped alerts and updates them for Admin/Operator only', async () => {
    const list = await request(app)
      .get(`/alerts?device_id=${deviceId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ alert_id: alertId, severity: 'HIGH' });

    await request(app)
      .patch(`/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const acknowledged = await request(app)
      .patch(`/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(acknowledged.body).toMatchObject({
      alert_id: alertId,
      status: 'ACKNOWLEDGED',
    });
  });

  it('returns dashboard data and protects audit logs', async () => {
    const summary = await request(app)
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(summary.body.devices.total).toBe(1);
    expect(summary.body.alerts.active_count).toBe(1);

    await request(app)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    await request(app)
      .get('/audit-logs?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
