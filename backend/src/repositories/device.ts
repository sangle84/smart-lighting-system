import { Pool } from 'pg';
import { AppError, ErrorCode } from '../errors/AppError.js';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'FAULT';
export type LifecycleStatus =
  | 'REGISTERED'
  | 'PROVISIONED'
  | 'ACTIVE'
  | 'MAINTENANCE'
  | 'DECOMMISSIONED';
export type RoleName = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AdaptiveConfig {
  enabled: boolean;
  motion_timeout_sec: number;
  lux_thresholds: Array<{ min_lux: number; pwm: number }>;
  no_motion_pwm: number;
}

export interface Device {
  device_id: string;
  device_name: string;
  location: string | null;
  assigned_user_id: string | null;
  device_status: DeviceStatus;
  lifecycle_status: LifecycleStatus;
  firmware_version: string;
  adaptive_config: AdaptiveConfig;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceFilters {
  status?: DeviceStatus;
  lifecycle?: LifecycleStatus;
  limit: number;
  offset: number;
}

export interface DeviceInput {
  device_id: string;
  device_name: string;
  location?: string | null;
  assigned_user_id?: string | null;
}

export interface DeviceUpdate {
  device_name?: string;
  location?: string | null;
  assigned_user_id?: string | null;
}

export interface AccessUser {
  user_id: string;
  username: string;
  role_name: 'OPERATOR' | 'VIEWER';
}

export interface Telemetry {
  telemetry_id: number;
  device_id: string;
  timestamp: string;
  lux: number;
  motion: boolean;
  voltage: number;
  current: number;
  power: number;
  pwm: number;
}

function accessClause(role: RoleName, userId: string, deviceParam: string): {
  sql: string;
  values: string[];
} {
  if (role === 'ADMIN') return { sql: '', values: [] };
  return {
    sql: `AND EXISTS (
      SELECT 1 FROM device_access da
      WHERE da.device_id = ${deviceParam} AND da.user_id = $1
    )`,
    values: [userId],
  };
}

export class DeviceRepo {
  constructor(private readonly pool: Pool) {}

  async findAll(
    userId: string,
    role: RoleName,
    filters: DeviceFilters
  ): Promise<{ data: Device[]; total: number }> {
    const client = await this.pool.connect();
    try {
      const values: Array<string | number> = [];
      const clauses: string[] = [];
      const scoped = accessClause(role, userId, 'd.device_id');
      if (scoped.sql) {
        values.push(...scoped.values);
        clauses.push(scoped.sql.replace('$1', `$${values.length}`));
      }
      if (filters.status) {
        values.push(filters.status);
        clauses.push(`d.device_status = $${values.length}`);
      }
      if (filters.lifecycle) {
        values.push(filters.lifecycle);
        clauses.push(`d.lifecycle_status = $${values.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const count = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM device d ${where}`,
        values
      );
      values.push(filters.limit, filters.offset);
      const result = await client.query<Device>(
        `SELECT d.device_id, d.device_name, d.location, d.assigned_user_id,
                d.device_status, d.lifecycle_status, d.firmware_version,
                d.adaptive_config, d.last_seen_at, d.created_at, d.updated_at
         FROM device d ${where}
         ORDER BY d.created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      return { data: result.rows, total: Number(count.rows[0].count) };
    } finally {
      client.release();
    }
  }

  async findById(
    deviceId: string,
    userId: string,
    role: RoleName
  ): Promise<Device | null> {
    const client = await this.pool.connect();
    try {
      const scoped = accessClause(role, userId, '$1');
      const values = [deviceId, ...scoped.values];
      const scopeSql = role === 'ADMIN'
        ? ''
        : `AND EXISTS (
            SELECT 1 FROM device_access da
            WHERE da.device_id = $1 AND da.user_id = $2
          )`;
      const result = await client.query<Device>(
        `SELECT device_id, device_name, location, assigned_user_id,
                device_status, lifecycle_status, firmware_version,
                adaptive_config, last_seen_at, created_at, updated_at
         FROM device
         WHERE device_id = $1 ${scopeSql}`,
        values
      );
      return result.rows[0] ?? null;
    } finally {
      client.release();
    }
  }

  async create(input: DeviceInput, credentialHash: string): Promise<Device> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<Device>(
        `INSERT INTO device
          (device_id, device_name, location, assigned_user_id, credential_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING device_id, device_name, location, assigned_user_id,
                   device_status, lifecycle_status, firmware_version,
                   adaptive_config, last_seen_at, created_at, updated_at`,
        [
          input.device_id,
          input.device_name,
          input.location ?? null,
          input.assigned_user_id ?? null,
          credentialHash,
        ]
      );
      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new AppError(ErrorCode.CONFLICT, 'Thiết bị đã tồn tại');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async update(deviceId: string, input: DeviceUpdate): Promise<Device | null> {
    const fields: string[] = [];
    const values: Array<string | null> = [];
    if (input.device_name !== undefined) {
      fields.push(`device_name = $${values.length + 1}`);
      values.push(input.device_name);
    }
    if (input.location !== undefined) {
      fields.push(`location = $${values.length + 1}`);
      values.push(input.location);
    }
    if (input.assigned_user_id !== undefined) {
      fields.push(`assigned_user_id = $${values.length + 1}`);
      values.push(input.assigned_user_id);
    }
    if (!fields.length) return this.findById(deviceId, '', 'ADMIN');
    values.push(deviceId);
    const result = await this.pool.query<Device>(
      `UPDATE device SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $${values.length}
       RETURNING device_id, device_name, location, assigned_user_id,
                 device_status, lifecycle_status, firmware_version,
                 adaptive_config, last_seen_at, created_at, updated_at`,
      values
    );
    return result.rows[0] ?? null;
  }

  async updateLifecycle(
    deviceId: string,
    lifecycleStatus: LifecycleStatus
  ): Promise<Device | null> {
    const current = await this.findById(deviceId, '', 'ADMIN');
    if (!current) return null;
    if (
      current.lifecycle_status === 'DECOMMISSIONED' ||
      (lifecycleStatus === 'REGISTERED' &&
        current.lifecycle_status !== 'REGISTERED') ||
      (lifecycleStatus === 'PROVISIONED' &&
        current.lifecycle_status !== 'REGISTERED') ||
      (lifecycleStatus === 'ACTIVE' &&
        !['PROVISIONED', 'MAINTENANCE'].includes(current.lifecycle_status)) ||
      (lifecycleStatus === 'MAINTENANCE' &&
        !['ACTIVE', 'PROVISIONED'].includes(current.lifecycle_status))
    ) {
      throw new AppError(
        ErrorCode.INVALID_LIFECYCLE_TRANSITION,
        'Chuyển trạng thái vòng đời không hợp lệ'
      );
    }
    const result = await this.pool.query<Device>(
      `UPDATE device SET lifecycle_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $2
       RETURNING device_id, device_name, location, assigned_user_id,
                 device_status, lifecycle_status, firmware_version,
                 adaptive_config, last_seen_at, created_at, updated_at`,
      [lifecycleStatus, deviceId]
    );
    return result.rows[0] ?? null;
  }

  async updateConfig(
    deviceId: string,
    adaptiveConfig: AdaptiveConfig
  ): Promise<Device | null> {
    const result = await this.pool.query<Device>(
      `UPDATE device
       SET adaptive_config = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $2
       RETURNING device_id, device_name, location, assigned_user_id,
                 device_status, lifecycle_status, firmware_version,
                 adaptive_config, last_seen_at, created_at, updated_at`,
      [JSON.stringify(adaptiveConfig), deviceId]
    );
    return result.rows[0] ?? null;
  }

  async listAccess(deviceId: string): Promise<AccessUser[]> {
    const result = await this.pool.query<AccessUser>(
      `SELECT u.user_id, u.username, r.role_name
       FROM device_access da
       JOIN users u ON u.user_id = da.user_id
       JOIN role r ON r.role_id = u.role_id
       WHERE da.device_id = $1
       ORDER BY u.username`,
      [deviceId]
    );
    return result.rows;
  }

  async replaceAccess(
    deviceId: string,
    userIds: string[],
    grantedBy: string
  ): Promise<AccessUser[]> {
    const client = await this.pool.connect();
    try {
      const validUsers = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM users u
         JOIN role r ON r.role_id = u.role_id
         WHERE u.user_id = ANY($1::uuid[])
           AND r.role_name IN ('OPERATOR', 'VIEWER')`,
        [userIds]
      );
      if (Number(validUsers.rows[0].count) !== userIds.length) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Danh sách user phải chứa Operator/Viewer tồn tại'
        );
      }
      await client.query('BEGIN');
      await client.query('DELETE FROM device_access WHERE device_id = $1', [deviceId]);
      if (userIds.length) {
        await client.query(
          `INSERT INTO device_access (user_id, device_id, granted_by)
           SELECT u.user_id, $1, $2
           FROM users u
           JOIN role r ON r.role_id = u.role_id
           WHERE u.user_id = ANY($3::uuid[])
             AND r.role_name IN ('OPERATOR', 'VIEWER')`,
          [deviceId, grantedBy, userIds]
        );
      }
      await client.query('COMMIT');
      return this.listAccess(deviceId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async latestTelemetry(deviceId: string): Promise<Telemetry | null> {
    const result = await this.pool.query<Telemetry>(
      `SELECT telemetry_id, device_id, timestamp, lux, motion, voltage,
              current, power, pwm
       FROM telemetry WHERE device_id = $1
       ORDER BY timestamp DESC LIMIT 1`,
      [deviceId]
    );
    return result.rows[0] ?? null;
  }

  async telemetryHistory(
    deviceId: string,
    from: string | undefined,
    to: string | undefined,
    limit: number
  ): Promise<{ data: Telemetry[]; total: number }> {
    const values: string[] = [deviceId];
    const clauses = ['device_id = $1'];
    if (from) {
      values.push(from);
      clauses.push(`timestamp >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      clauses.push(`timestamp <= $${values.length}`);
    }
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM telemetry WHERE ${clauses.join(' AND ')}`,
      values
    );
    values.push(String(limit));
    const result = await this.pool.query<Telemetry>(
      `SELECT telemetry_id, device_id, timestamp, lux, motion, voltage,
              current, power, pwm
       FROM telemetry WHERE ${clauses.join(' AND ')}
       ORDER BY timestamp DESC LIMIT $${values.length}`,
      values
    );
    return { data: result.rows, total: Number(count.rows[0].count) };
  }
}
