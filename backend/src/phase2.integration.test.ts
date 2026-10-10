import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './index';
import { config } from './config/env';
import { pool } from './db';

const adminPassword = 'AdminPass123';
const viewerUsername = `viewer-${Date.now()}`;
const viewerPassword = 'ViewerPass123';

describe('phase 2 authentication and RBAC', () => {
  const app = createApp(pool);
  let adminAccessToken = '';
  let viewerAccessToken = '';
  let viewerId = '';

  beforeAll(async () => {
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const viewerHash = await bcrypt.hash(viewerPassword, 10);
    const roleResult = await pool.query<{ role_id: number }>(
      "SELECT role_id FROM role WHERE role_name = 'VIEWER'"
    );
    const viewerRoleId = roleResult.rows[0].role_id;

    await pool.query(
      "UPDATE users SET password_hash = $1, status = 'ACTIVE' WHERE username = 'admin'",
      [adminHash]
    );
    const viewerResult = await pool.query<{ user_id: string }>(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id`,
      [viewerUsername, `${viewerUsername}@example.local`, viewerHash, viewerRoleId]
    );
    viewerId = viewerResult.rows[0].user_id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE user_id = $1', [viewerId]);
    await pool.end();
  });

  it('logs in and returns an HS256 access token with required claims', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: adminPassword })
      .expect(200);

    adminAccessToken = response.body.access_token;
    expect(response.headers['set-cookie'][0]).toContain('refreshToken=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.body.user.role).toBe('ADMIN');

    const header = JSON.parse(
      Buffer.from(adminAccessToken.split('.')[0], 'base64url').toString('utf8')
    );
    const payload = jwt.decode(adminAccessToken) as Record<string, unknown>;
    expect(header.alg).toBe('HS256');
    expect(payload).toEqual(
      expect.objectContaining({
        sub: expect.any(String),
        role: 'ADMIN',
        iat: expect.any(Number),
        exp: expect.any(Number),
      })
    );
  });

  it('refreshes from the HttpOnly cookie and logs out', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: adminPassword })
      .expect(200);

    const refresh = await request(app)
      .post('/auth/refresh')
      .set('Cookie', login.headers['set-cookie'])
      .expect(200);

    expect(refresh.body.access_token).toEqual(expect.any(String));

    const logout = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refresh.body.access_token}`)
      .set('Cookie', login.headers['set-cookie'])
      .expect(200);

    expect(logout.body.message).toBe('Đăng xuất thành công');
    expect(logout.headers['set-cookie'][0]).toContain('refreshToken=');
  });

  it('changes the authenticated user password', async () => {
    await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: adminPassword })
      .expect(200);

    const login = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: adminPassword })
      .expect(200);

    await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({
        current_password: adminPassword,
        new_password: 'AdminPass456',
      })
      .expect(200);

    await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'AdminPass456' })
      .expect(200);

    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE username = 'admin'",
      [await bcrypt.hash(adminPassword, 10)]
    );
  });

  it('rejects invalid and expired access tokens with 401', async () => {
    await request(app)
      .get('/users')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'UNAUTHORIZED',
          details: null,
        });
      });

    const expired = jwt.sign(
      { sub: 'expired-user', role: 'ADMIN' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: -1 }
    );
    await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('enforces Admin-only user administration with 403 for Viewer', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ username: viewerUsername, password: viewerPassword })
      .expect(200);
    viewerAccessToken = login.body.access_token;

    await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${viewerAccessToken}`)
      .send({
        username: 'should-not-exist',
        email: 'should-not-exist@example.local',
        password: 'Password123',
        role_id: 3,
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'FORBIDDEN',
          details: null,
        });
      });
  });

  it('covers validation, not-found and conflict error formats', async () => {
    await request(app)
      .post('/auth/login')
      .send({ username: 'admin' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'VALIDATION_ERROR',
          details: null,
        });
      });

    await request(app).get('/route-that-does-not-exist').expect(404).expect(({ body }) => {
      expect(body).toEqual({
        code: 'NOT_FOUND',
        message: expect.any(String),
        details: null,
      });
    });

    await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        username: viewerUsername,
        email: 'duplicate@example.local',
        password: 'Password123',
        role_id: 3,
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('CONFLICT');
      });
  });
});
