import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './index.js';
import { pool } from './db/index.js';

describe('command REST API', () => {
  const app = createApp(pool);
  const deviceId = `CMD-${Date.now()}`;
  const username = `operator-${Date.now()}`;
  let userId = '';
  let viewerId = '';
  let adminToken = '';
  let operatorToken = '';
  let viewerToken = '';
  let commandId = '';

  beforeAll(async () => {
    const role = await pool.query<{ role_id: number }>(
      "SELECT role_id FROM role WHERE role_name = 'OPERATOR'"
    );
    const viewerRole = await pool.query<{ role_id: number }>(
      "SELECT role_id FROM role WHERE role_name = 'VIEWER'"
    );
    const user = await pool.query<{ user_id: string }>(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [
        username,
        `${username}@example.local`,
        await bcrypt.hash('OperatorPass123', 10),
        role.rows[0].role_id,
      ]
    );
    userId = user.rows[0].user_id;

    const viewerUsername = `cmd-viewer-${Date.now()}`;
    const viewerUser = await pool.query<{ user_id: string }>(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [
        viewerUsername,
        `${viewerUsername}@example.local`,
        await bcrypt.hash('ViewerPass123', 10),
        viewerRole.rows[0].role_id,
      ]
    );
    viewerId = viewerUser.rows[0].user_id;

    const admin = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'AdminPass123' })
      .expect(200);
    adminToken = admin.body.access_token;
    const operator = await request(app)
      .post('/auth/login')
      .send({ username, password: 'OperatorPass123' })
      .expect(200);
    operatorToken = operator.body.access_token;
    const viewer = await request(app)
      .post('/auth/login')
      .send({ username: viewerUsername, password: 'ViewerPass123' })
      .expect(200);
    viewerToken = viewer.body.access_token;

    await pool.query(
      `INSERT INTO device (device_id, device_name, device_status, lifecycle_status, credential_hash)
       VALUES ($1, 'Command Test Light', 'ONLINE', 'ACTIVE', 'test-hash')`,
      [deviceId]
    );
    await pool.query(
      'INSERT INTO device_access (user_id, device_id) VALUES ($1, $2)',
      [userId, deviceId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM command WHERE command_id = $1', [commandId]);
    await pool.query('DELETE FROM audit_log WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM device_access WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM device WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [viewerId]);
  });

  it('creates a PWM command for an allowed Operator and writes audit log', async () => {
    const response = await request(app)
      .post(`/devices/${deviceId}/commands`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ command_type: 'PWM', command_value: 70 })
      .expect(202);

    commandId = response.body.command_id;
    expect(response.body).toMatchObject({
      device_id: deviceId,
      command_type: 'PWM',
      command_value: 70,
      status: 'PENDING',
    });

    const audit = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE device_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [deviceId]
    );
    expect(audit.rows[0].action).toBe('SEND_COMMAND');
  });

  it('rejects invalid command values', async () => {
    await request(app)
      .post(`/devices/${deviceId}/commands`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ command_type: 'PWM', command_value: null })
      .expect(400);

    await request(app)
      .post(`/devices/${deviceId}/commands`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ command_type: 'ON', command_value: 1 })
      .expect(400);
  });

  it('rejects commands when the device is not available', async () => {
    await pool.query(
      `UPDATE device SET device_status = 'OFFLINE' WHERE device_id = $1`,
      [deviceId]
    );
    await request(app)
      .post(`/devices/${deviceId}/commands`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ command_type: 'OFF' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('DEVICE_NOT_AVAILABLE');
      });
  });

  it('rejects commands with 403 for Viewer (TC09)', async () => {
    await request(app)
      .post(`/devices/${deviceId}/commands`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ command_type: 'ON' })
      .expect(403);
  });

  it('rejects commands with 404 when Operator lacks DEVICE_ACCESS (TC11)', async () => {
    const unassignedDeviceId = `OTHER-${Date.now()}`;
    await pool.query(
      `INSERT INTO device (device_id, device_name, device_status, lifecycle_status, credential_hash)
       VALUES ($1, 'Other Light', 'ONLINE', 'ACTIVE', 'test-hash')`,
      [unassignedDeviceId]
    );
    try {
      await request(app)
        .post(`/devices/${unassignedDeviceId}/commands`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ command_type: 'ON' })
        .expect(404);
    } finally {
      await pool.query('DELETE FROM device WHERE device_id = $1', [unassignedDeviceId]);
    }
  });
});
