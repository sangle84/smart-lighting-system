import bcrypt from 'bcryptjs';
import http from 'http';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './index';
import { config } from './config/env';
import { pool } from './db';
import { RealtimeEvent, RealtimeGateway } from './realtime/gateway';

const password = 'RealtimePass123';
const suffix = Date.now();
const operatorUsername = `realtime-operator-${suffix}`;
const viewerUsername = `realtime-viewer-${suffix}`;
const deviceId = `REALTIME-${suffix}`;

function waitForSocketEvent(socket: Socket, event: string, timeoutMs = 1000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForSocketError(socket: Socket): Promise<Error> {
  return new Promise((resolve) => socket.once('connect_error', resolve));
}

describe('Socket.IO realtime authorization', () => {
  let server: http.Server;
  let gateway: RealtimeGateway;
  let baseUrl = '';
  let operatorId = '';
  let viewerId = '';
  let adminToken = '';
  let operatorToken = '';
  let viewerToken = '';
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const roles = await pool.query<{ role_id: number; role_name: string }>(
      "SELECT role_id, role_name FROM role WHERE role_name IN ('OPERATOR', 'VIEWER')"
    );
    const roleIds = new Map(roles.rows.map((role) => [role.role_name, role.role_id]));
    const passwordHash = await bcrypt.hash(password, 10);
    const users = await pool.query<{ user_id: string; username: string }>(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4), ($5, $6, $3, $7)
       RETURNING user_id, username`,
      [
        operatorUsername,
        `${operatorUsername}@example.local`,
        passwordHash,
        roleIds.get('OPERATOR'),
        viewerUsername,
        `${viewerUsername}@example.local`,
        roleIds.get('VIEWER'),
      ]
    );
    operatorId = users.rows.find((user) => user.username === operatorUsername)!.user_id;
    viewerId = users.rows.find((user) => user.username === viewerUsername)!.user_id;

    await pool.query(
      `INSERT INTO device (device_id, device_name, lifecycle_status, credential_hash)
       VALUES ($1, 'Realtime Test Light', 'ACTIVE', $2)`,
      [deviceId, await bcrypt.hash('realtime-device-key', 10)]
    );
    await pool.query(
      'INSERT INTO device_access (user_id, device_id) VALUES ($1, $2)',
      [operatorId, deviceId]
    );

    const app = createApp(pool);
    server = http.createServer(app);
    gateway = new RealtimeGateway(pool, server);
    app.locals.setRealtimeGateway(gateway);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://localhost:${address.port}`;

    const adminLogin = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'AdminPass123' });
    adminToken = adminLogin.body.access_token;
    operatorToken = (
      await request(app).post('/auth/login').send({ username: operatorUsername, password })
    ).body.access_token;
    viewerToken = (
      await request(app).post('/auth/login').send({ username: viewerUsername, password })
    ).body.access_token;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.close();
    await gateway.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query('DELETE FROM device_access WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM device WHERE device_id = $1', [deviceId]);
    await pool.query('DELETE FROM users WHERE user_id = ANY($1::uuid[])', [[operatorId, viewerId]]);
    await pool.end();
  });

  it('rejects missing and expired JWTs during handshake', async () => {
    const missing = io(baseUrl, { transports: ['websocket'], reconnection: false });
    sockets.push(missing);
    await expect(waitForSocketError(missing)).resolves.toMatchObject({ message: 'UNAUTHORIZED' });

    const expiredToken = jwt.sign(
      { sub: operatorId, role: 'OPERATOR' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: -1 }
    );
    const expired = io(baseUrl, {
      auth: { token: expiredToken },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(expired);
    await expect(waitForSocketError(expired)).resolves.toMatchObject({ message: 'UNAUTHORIZED' });
  });

  it('scopes all realtime events and refreshes rooms after access changes', async () => {
    const operator = io(baseUrl, {
      auth: { token: operatorToken },
      transports: ['websocket'],
      reconnection: false,
    });
    const viewer = io(baseUrl, {
      auth: { token: viewerToken },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(operator, viewer);
    await Promise.all([waitForSocketEvent(operator, 'connect'), waitForSocketEvent(viewer, 'connect')]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const events: RealtimeEvent[] = [
      'telemetry:update',
      'device:status',
      'command:update',
      'alert:new',
    ];
    for (const event of events) {
      const received = waitForSocketEvent(operator, event);
      gateway.emitDeviceEvent(event, deviceId, { device_id: deviceId, event });
      await expect(received).resolves.toMatchObject({ device_id: deviceId, event });
    }

    await request(server).put(`/devices/${deviceId}/access`).set('Authorization', `Bearer ${adminToken}`).send({ user_ids: [operatorId, viewerId] }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const viewerReceived = waitForSocketEvent(viewer, 'telemetry:update');
    gateway.emitDeviceEvent('telemetry:update', deviceId, { device_id: deviceId, event: 'granted' });
    await expect(viewerReceived).resolves.toMatchObject({ event: 'granted' });

    await request(server).put(`/devices/${deviceId}/access`).set('Authorization', `Bearer ${adminToken}`).send({ user_ids: [operatorId] }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const revoked = waitForSocketEvent(viewer, 'telemetry:update', 150);
    gateway.emitDeviceEvent('telemetry:update', deviceId, { device_id: deviceId, event: 'revoked' });
    await expect(revoked).rejects.toThrow('Timed out');
  });
});
