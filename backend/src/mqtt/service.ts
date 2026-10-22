import mqtt, { MqttClient } from 'mqtt';
import { Pool } from 'pg';
import { config } from '../config/env.js';
import { Command, CommandPublisher, CommandRepo } from '../repositories/commands.js';

const TOPIC_PREFIX = 'iot/device/';
const ACK_STATUS = new Set(['ACKNOWLEDGED', 'REJECTED', 'EXECUTION_FAILED']);

interface TelemetryPayload {
  [key: string]: unknown;
  device_id: string;
  timestamp: string;
  lux: number;
  motion: boolean;
  voltage: number;
  current: number;
  power: number;
  pwm: number;
}

interface StatusPayload {
  [key: string]: unknown;
  device_id: string;
  status: 'ONLINE' | 'OFFLINE' | 'FAULT';
  firmware_version?: string;
  timestamp: string;
}

interface AckPayload {
  [key: string]: unknown;
  command_id: string;
  status: 'ACKNOWLEDGED' | 'REJECTED' | 'EXECUTION_FAILED';
  timestamp: string;
  result?: string;
}

interface PendingCommand {
  command: Command;
  resolve: (ack: AckPayload) => void;
  reject: (error: Error) => void;
}

export class MqttService implements CommandPublisher {
  private client: MqttClient | null = null;
  private readonly pending = new Map<string, PendingCommand>();

  constructor(
    private readonly pool: Pool,
    private readonly commandRepo: CommandRepo
  ) {}

  connect(): void {
    this.client = mqtt.connect(config.MQTT_URL, {
      clientId: config.MQTT_CLIENT_ID,
      username: config.MQTT_USERNAME,
      password: config.MQTT_PASSWORD,
      protocolVersion: 4,
      reconnectPeriod: 2000,
    });
    this.client.on('connect', () => {
      console.log(`MQTT connected: ${config.MQTT_URL}`);
      void this.client?.subscribe(
        [`${TOPIC_PREFIX}+/telemetry`, `${TOPIC_PREFIX}+/status`, `${TOPIC_PREFIX}+/ack`],
        { qos: 1 },
        (error) => {
          if (error) console.error('MQTT subscription failed', error);
        }
      );
    });
    this.client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload.toString()).catch((error: unknown) => {
        console.error('MQTT message handling failed', error);
      });
    });
    this.client.on('error', (error) => {
      console.error('MQTT client error', error);
    });
  }

  async publish(command: Command): Promise<void> {
    if (!this.client?.connected) {
      await this.commandRepo.updateResult(command.command_id, 'FAILED', 'MQTT_NOT_CONNECTED');
      throw new Error('MQTT client is not connected');
    }

    const pending = this.waitForAck(command);
    const payload = JSON.stringify({
      command_id: command.command_id,
      command_type: command.command_type,
      command_value: command.command_value,
      timestamp: new Date().toISOString(),
    });
    const topic = `${TOPIC_PREFIX}${command.device_id}/command`;

    try {
      for (let attempt = 0; attempt <= config.MQTT_RETRY_DELAYS_MS.length; attempt += 1) {
        await this.publishMessage(topic, payload);
        if (attempt === 0) await this.commandRepo.markSent(command.command_id);
        const ack = await this.waitForAckAttempt(pending, command.command_id);
        if (ack) {
          await this.commandRepo.updateResult(
            command.command_id,
            ack.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'FAILED',
            ack.result ?? ack.status
          );
          this.pending.delete(command.command_id);
          return;
        }
        const delay = config.MQTT_RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) await this.sleep(delay);
      }
      await this.commandRepo.updateResult(command.command_id, 'TIMEOUT', 'ACK_TIMEOUT');
    } catch (error) {
      this.pending.delete(command.command_id);
      await this.commandRepo.updateResult(
        command.command_id,
        'FAILED',
        error instanceof Error ? error.message : 'MQTT_PUBLISH_FAILED'
      );
      throw error;
    } finally {
      this.pending.delete(command.command_id);
    }
  }

  close(): void {
    this.client?.end();
    this.client = null;
  }

  private async handleMessage(topic: string, rawPayload: string): Promise<void> {
    const match = topic.match(/^iot\/device\/([^/]+)\/(telemetry|status|ack)$/);
    if (!match) return;
    const [, topicDeviceId, kind] = match;
    const payload: unknown = JSON.parse(rawPayload);
    if (!this.isRecord(payload) || payload.device_id !== topicDeviceId) return;

    if (kind === 'telemetry' && this.isTelemetry(payload)) {
      await this.pool.query(
        `INSERT INTO telemetry
          (device_id, timestamp, lux, motion, voltage, current, power, pwm)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          payload.device_id,
          payload.timestamp,
          payload.lux,
          payload.motion,
          payload.voltage,
          payload.current,
          payload.power,
          payload.pwm,
        ]
      );
      await this.markSeen(payload.device_id, 'ONLINE');
      return;
    }
    if (kind === 'status' && this.isStatus(payload)) {
      await this.markSeen(payload.device_id, payload.status, payload.firmware_version);
      return;
    }
    if (kind === 'ack' && this.isAck(payload)) {
      const waiting = this.pending.get(payload.command_id);
      if (waiting) waiting.resolve(payload);
    }
  }

  private async markSeen(
    deviceId: string,
    status: StatusPayload['status'],
    firmwareVersion?: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE device
       SET device_status = $1,
           firmware_version = COALESCE($2, firmware_version),
           last_seen_at = CURRENT_TIMESTAMP,
           lifecycle_status = CASE
             WHEN lifecycle_status = 'PROVISIONED' AND $1 = 'ONLINE' THEN 'ACTIVE'
             ELSE lifecycle_status
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $3`,
      [status, firmwareVersion ?? null, deviceId]
    );
  }

  private waitForAck(command: Command): Promise<AckPayload> {
    return new Promise((resolve, reject) => {
      this.pending.set(command.command_id, { command, resolve, reject });
    });
  }

  private waitForAckAttempt(
    pendingPromise: Promise<AckPayload>,
    commandId: string
  ): Promise<AckPayload | null> {
    return Promise.race([
      pendingPromise,
      this.sleep(config.MQTT_COMMAND_TIMEOUT_MS).then(() => null),
    ]).then((ack) => {
      if (ack) return ack;
      return this.pending.has(commandId) ? null : null;
    });
  }

  private publishMessage(topic: string, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client is not initialized'));
        return;
      }
      this.client.publish(topic, payload, { qos: 1, retain: false }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isTelemetry(value: Record<string, unknown>): value is TelemetryPayload {
    return (
      typeof value.timestamp === 'string' &&
      typeof value.lux === 'number' &&
      typeof value.motion === 'boolean' &&
      typeof value.voltage === 'number' &&
      typeof value.current === 'number' &&
      typeof value.power === 'number' &&
      Number.isInteger(value.pwm) &&
      Number(value.pwm) >= 0 &&
      Number(value.pwm) <= 100
    );
  }

  private isStatus(value: Record<string, unknown>): value is StatusPayload {
    return (
      typeof value.timestamp === 'string' &&
      (value.status === 'ONLINE' || value.status === 'OFFLINE' || value.status === 'FAULT')
    );
  }

  private isAck(value: Record<string, unknown>): value is AckPayload {
    return (
      typeof value.command_id === 'string' &&
      typeof value.timestamp === 'string' &&
      typeof value.status === 'string' &&
      ACK_STATUS.has(value.status)
    );
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
