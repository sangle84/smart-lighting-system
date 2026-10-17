import { Pool } from 'pg';
import { AppError, ErrorCode } from '../errors/AppError.js';
import { RoleName } from './device.js';

export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Alert {
  alert_id: string;
  device_id: string;
  alert_type: 'LAMP_FAULT' | 'DEVICE_OFFLINE';
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  acknowledged_by: string | null;
  resolved_by: string | null;
}

export interface AlertFilters {
  status?: AlertStatus;
  device_id?: string;
  severity?: AlertSeverity;
  limit: number;
  offset: number;
}

export interface DashboardDevice {
  device_id: string;
  device_name: string;
  device_status: string;
  lux: number | null;
  motion: boolean | null;
  pwm: number | null;
  power: number | null;
  last_seen_at: string | null;
}

export interface AuditLog {
  log_id: number;
  user_id: string | null;
  device_id: string | null;
  action: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

function deviceScope(role: RoleName, userId: string, deviceAlias = 'd'): {
  sql: string;
  values: string[];
} {
  if (role === 'ADMIN') return { sql: '', values: [] };
  return {
    sql: `EXISTS (
      SELECT 1 FROM device_access da
      WHERE da.device_id = ${deviceAlias}.device_id AND da.user_id = $1
    )`,
    values: [userId],
  };
}

export class OperationsRepo {
  constructor(private readonly pool: Pool) {}

  async listAlerts(
    userId: string,
    role: RoleName,
    filters: AlertFilters
  ): Promise<{ data: Alert[]; total: number }> {
    const values: Array<string | number> = [];
    const clauses: string[] = [];
    const scope = deviceScope(role, userId);
    if (scope.sql) {
      values.push(...scope.values);
      clauses.push(scope.sql.replace('$1', `$${values.length}`));
    }
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`a.status = $${values.length}`);
    }
    if (filters.device_id) {
      values.push(filters.device_id);
      clauses.push(`a.device_id = $${values.length}`);
    }
    if (filters.severity) {
      values.push(filters.severity);
      clauses.push(`a.severity = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM alert a JOIN device d ON d.device_id = a.device_id ${where}`,
      values
    );
    values.push(filters.limit, filters.offset);
    const result = await this.pool.query<Alert>(
      `SELECT a.alert_id, a.device_id, a.alert_type, a.severity, a.message,
              a.status, a.created_at, a.acknowledged_at, a.resolved_at,
              a.acknowledged_by, a.resolved_by
       FROM alert a JOIN device d ON d.device_id = a.device_id ${where}
       ORDER BY a.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    return { data: result.rows, total: Number(count.rows[0].count) };
  }

  async updateAlert(
    alertId: string,
    userId: string,
    role: RoleName,
    action: 'ACKNOWLEDGED' | 'RESOLVED'
  ): Promise<Alert | null> {
    const scope = deviceScope(role, userId);
    const values: string[] = [alertId];
    const scopeSql = role === 'ADMIN'
      ? ''
      : `AND ${scope.sql.replace('$1', '$2')}`;
    if (role !== 'ADMIN') values.push(userId);
    const actorParam = role === 'ADMIN' ? '$2' : '$3';
    const fields =
      action === 'ACKNOWLEDGED'
        ? `status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = ${actorParam}`
        : `status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolved_by = ${actorParam}`;
    values.push(userId);
    const result = await this.pool.query<Alert>(
      `UPDATE alert a SET ${fields}
       FROM device d
       WHERE a.device_id = d.device_id
         AND a.alert_id = $1
         AND a.status <> 'RESOLVED'
         ${scopeSql}
       RETURNING a.alert_id, a.device_id, a.alert_type, a.severity, a.message,
                 a.status, a.created_at, a.acknowledged_at, a.resolved_at,
                 a.acknowledged_by, a.resolved_by`,
      values
    );
    return result.rows[0] ?? null;
  }

  async dashboardDevices(userId: string, role: RoleName): Promise<DashboardDevice[]> {
    const scope = deviceScope(role, userId);
    const values = scope.values;
    const where = scope.sql ? `WHERE ${scope.sql}` : '';
    const result = await this.pool.query<DashboardDevice>(
      `SELECT d.device_id, d.device_name, d.device_status,
              t.lux, t.motion, t.pwm, t.power, d.last_seen_at
       FROM device d
       LEFT JOIN LATERAL (
         SELECT lux, motion, pwm, power
         FROM telemetry WHERE device_id = d.device_id
         ORDER BY timestamp DESC LIMIT 1
       ) t ON TRUE
       ${where}
       ORDER BY d.created_at DESC`,
      values
    );
    return result.rows;
  }

  async dashboardSummary(userId: string, role: RoleName): Promise<Record<string, unknown>> {
    const scope = deviceScope(role, userId);
    const values = scope.values;
    const where = scope.sql ? `WHERE ${scope.sql}` : '';
    const [devices, alerts, power] = await Promise.all([
      this.pool.query<{ total: string; online: string; offline: string; fault: string }>(
        `SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE d.device_status = 'ONLINE') AS online,
          COUNT(*) FILTER (WHERE d.device_status = 'OFFLINE') AS offline,
          COUNT(*) FILTER (WHERE d.device_status = 'FAULT') AS fault
         FROM device d ${where}`,
        values
      ),
      this.pool.query<{ active_count: string; resolved_today: string }>(
        `SELECT
          COUNT(*) FILTER (WHERE a.status <> 'RESOLVED') AS active_count,
          COUNT(*) FILTER (
            WHERE a.status = 'RESOLVED' AND a.resolved_at >= CURRENT_DATE
          ) AS resolved_today
         FROM alert a JOIN device d ON d.device_id = a.device_id ${where}`,
        values
      ),
      this.pool.query<{ avg_power: string | null }>(
        `SELECT AVG(t.power)::numeric AS avg_power
         FROM telemetry t JOIN device d ON d.device_id = t.device_id
         ${where.replaceAll('d.device_id', 'd.device_id')}`,
        values
      ),
    ]);
    const deviceStats = devices.rows[0];
    const alertStats = alerts.rows[0];
    const avgPower = power.rows[0].avg_power === null ? 0 : Number(power.rows[0].avg_power);
    const hasFault = Number(deviceStats.fault) > 0 || Number(alertStats.active_count) > 0;
    return {
      devices: {
        total: Number(deviceStats.total),
        online: Number(deviceStats.online),
        offline: Number(deviceStats.offline),
        fault: Number(deviceStats.fault),
      },
      alerts: {
        active_count: Number(alertStats.active_count),
        resolved_today: Number(alertStats.resolved_today),
      },
      avg_power_watts: avgPower,
      system_status: hasFault ? 'DEGRADED' : 'HEALTHY',
      updated_at: new Date().toISOString(),
    };
  }

  async listAuditLogs(
    userId?: string,
    action?: string,
    limit = 50,
    offset = 0
  ): Promise<{ data: AuditLog[]; total: number }> {
    const values: Array<string | number> = [];
    const clauses: string[] = [];
    if (userId) {
      values.push(userId);
      clauses.push(`user_id = $${values.length}`);
    }
    if (action) {
      values.push(action);
      clauses.push(`action = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_log ${where}`,
      values
    );
    values.push(limit, offset);
    const result = await this.pool.query<AuditLog>(
      `SELECT log_id, user_id, device_id, action, description, ip_address, created_at
       FROM audit_log ${where}
       ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    return { data: result.rows, total: Number(count.rows[0].count) };
  }
}
