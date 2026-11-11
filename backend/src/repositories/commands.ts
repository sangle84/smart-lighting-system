import { Pool } from 'pg';
import { AppError, ErrorCode } from '../errors/AppError.js';
import { RoleName } from './device.js';

export type CommandType = 'PWM' | 'ON' | 'OFF' | 'CONFIG_UPDATE';

export interface Command {
  command_id: string;
  device_id: string;
  user_id: string | null;
  command_type: CommandType;
  command_value: number | null;
  result: string | null;
  status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'TIMEOUT' | 'FAILED';
  sent_at: string;
  ack_at: string | null;
  config_version?: number;
}

export interface CommandInput {
  deviceId: string;
  userId: string;
  role: RoleName;
  commandType: CommandType;
  commandValue: number | null;
  configVersion?: number;
  ipAddress: string | null;
}

export interface CommandPublisher {
  publish(command: Command): Promise<void>;
}

export class CommandRepo {
  constructor(private readonly pool: Pool) {}

  async create(input: CommandInput): Promise<Command> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const device = await client.query<{
        device_status: string;
        lifecycle_status: string;
      }>(
        `SELECT d.device_status, d.lifecycle_status
         FROM device d
         WHERE d.device_id = $1
           AND (
             $2 = 'ADMIN'
             OR EXISTS (
               SELECT 1 FROM device_access da
               WHERE da.device_id = d.device_id AND da.user_id = $3
             )
           )
         FOR SHARE`,
        [input.deviceId, input.role, input.userId]
      );
      if (!device.rows[0]) {
        await client.query('ROLLBACK');
        throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
      }
      if (
        device.rows[0].device_status !== 'ONLINE' ||
        device.rows[0].lifecycle_status !== 'ACTIVE'
      ) {
        await client.query('ROLLBACK');
        throw new AppError(
          ErrorCode.DEVICE_NOT_AVAILABLE,
          'Thiết bị không sẵn sàng nhận lệnh'
        );
      }

      const commandResult = await client.query<Command>(
        `INSERT INTO command (device_id, user_id, command_type, command_value, result)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING command_id, device_id, user_id, command_type, command_value,
                   status, sent_at, ack_at, result`,
        [input.deviceId, input.userId, input.commandType, input.commandValue, JSON.stringify({ configVersion: input.configVersion })]
      );
      const command = commandResult.rows[0];

      await client.query(
        `INSERT INTO audit_log (user_id, device_id, action, description, ip_address)
         VALUES ($1, $2, 'SEND_COMMAND', $3, $4)`,
        [
          input.userId,
          input.deviceId,
          `Gửi lệnh ${input.commandType} xuống thiết bị ${input.deviceId}`,
          input.ipAddress,
        ]
      );
      await client.query('COMMIT');
      return command;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  }

  async markSent(commandId: string): Promise<void> {
    await this.pool.query(
      `UPDATE command SET status = 'SENT'
       WHERE command_id = $1 AND status = 'PENDING'`,
      [commandId]
    );
  }

  async findById(commandId: string): Promise<Command | null> {
    const result = await this.pool.query<Command>(
      `SELECT command_id, device_id, user_id, command_type, command_value,
              status, sent_at, ack_at, result
       FROM command WHERE command_id = $1`,
      [commandId]
    );
    const row = result.rows[0] ?? null;
    if (row && row.result) {
      try {
        const r = JSON.parse(row.result);
        row.config_version = r.config_version ?? null;
      } catch (e) {
        // ignore parse error
      }
    }
    return row;
  }

  async updateResult(
    commandId: string,
    status: 'ACKNOWLEDGED' | 'FAILED' | 'TIMEOUT',
    result: string | null
  ): Promise<Command | null> {
    const query = status === 'ACKNOWLEDGED'
      ? `UPDATE command SET status = $1, result = $2, ack_at = CURRENT_TIMESTAMP
         WHERE command_id = $3 AND status IN ('PENDING', 'SENT')
         RETURNING command_id, device_id, user_id, command_type, command_value,
                   status, sent_at, ack_at, result`
      : `UPDATE command SET status = $1, result = $2
         WHERE command_id = $3 AND status IN ('PENDING', 'SENT')
         RETURNING command_id, device_id, user_id, command_type, command_value,
                   status, sent_at, ack_at, result`;
    const updated = await this.pool.query<Command>(query, [status, result, commandId]);
    const row = updated.rows[0];
    if (row && row.result) {
      try {
        const r = JSON.parse(row.result);
        row.config_version = r.config_version ?? null;
      } catch (e) {
        // ignore parse error
      }
    }
    return row ?? null;
  }
}
