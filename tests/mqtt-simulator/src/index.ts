import mqtt, { MqttClient } from 'mqtt';

const deviceId = process.env.DEVICE_ID ?? 'LIGHT-002';
const mqttUrl = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const mqttUsername = process.env.MQTT_USERNAME ?? deviceId;
const mqttPassword = process.env.MQTT_PASSWORD;
const telemetryIntervalMs = Number(process.env.TELEMETRY_INTERVAL_MS ?? 5000);
const dedupWindowMs = Number(process.env.DEDUP_WINDOW_MS ?? 60000);
const dedupLimit = Number(process.env.DEDUP_LIMIT ?? 50);
const topicPrefix = `iot/device/${deviceId}`;

type CommandType = 'PWM' | 'ON' | 'OFF';
type AckStatus = 'ACKNOWLEDGED' | 'REJECTED' | 'EXECUTION_FAILED';

interface CommandPayload {
  command_id: string;
  command_type: CommandType;
  command_value?: number;
  timestamp: string;
}

interface AckRecord {
  status: AckStatus;
  result: string;
  timestamp: string;
}

const processedCommands = new Map<string, AckRecord>();
let currentPwm = 10;
let motion = false;
let telemetryTimer: NodeJS.Timeout | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCommand(value: unknown): value is CommandPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.command_id === 'string' &&
    (value.command_type === 'PWM' || value.command_type === 'ON' || value.command_type === 'OFF') &&
    typeof value.timestamp === 'string' &&
    !Number.isNaN(Date.parse(value.timestamp)) &&
    (value.command_type !== 'PWM' ||
      (typeof value.command_value === 'number' &&
        Number.isInteger(value.command_value) &&
        value.command_value >= 0 &&
        value.command_value <= 100))
  );
}

function pruneCommandCache(now: number): void {
  for (const [commandId, ack] of processedCommands) {
    if (now - Date.parse(ack.timestamp) > dedupWindowMs) processedCommands.delete(commandId);
  }
  while (processedCommands.size > dedupLimit) {
    const oldest = processedCommands.keys().next().value;
    if (oldest === undefined) break;
    processedCommands.delete(oldest);
  }
}

function publishStatus(client: MqttClient, status: 'ONLINE' | 'OFFLINE'): void {
  client.publish(
    `${topicPrefix}/status`,
    JSON.stringify({
      device_id: deviceId,
      status,
      firmware_version: 'simulator-1.0.0',
      timestamp: new Date().toISOString(),
    }),
    { qos: 1 }
  );
}

function publishTelemetry(client: MqttClient): void {
  motion = !motion;
  client.publish(
    `${topicPrefix}/telemetry`,
    JSON.stringify({
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      lux: motion ? 120 : 480,
      motion,
      voltage: 12.1,
      current: Number((currentPwm / 100 * 0.72).toFixed(3)),
      power: Number((currentPwm / 100 * 8.71).toFixed(3)),
      pwm: currentPwm,
    }),
    { qos: 1 }
  );
}

function publishAck(client: MqttClient, commandId: string, ack: AckRecord): void {
  client.publish(
    `${topicPrefix}/ack`,
    JSON.stringify({
      command_id: commandId,
      status: ack.status,
      result: ack.result,
      timestamp: ack.timestamp,
    }),
    { qos: 1 }
  );
}

function handleCommand(client: MqttClient, rawPayload: string): void {
  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return;
  }
  if (!isCommand(payload)) return;

  const cachedAck = processedCommands.get(payload.command_id);
  if (cachedAck) {
    publishAck(client, payload.command_id, cachedAck);
    return;
  }

  const now = Date.now();
  pruneCommandCache(now);
  const ageMs = now - Date.parse(payload.timestamp);
  let status: AckStatus = 'ACKNOWLEDGED';
  let result = 'APPLIED';
  if (ageMs > 60000) {
    status = 'REJECTED';
    result = 'COMMAND_EXPIRED';
  } else if (payload.command_type === 'PWM') {
    currentPwm = payload.command_value!;
  } else {
    currentPwm = payload.command_type === 'ON' ? Math.max(currentPwm, 10) : 0;
  }

  const ack: AckRecord = { status, result, timestamp: new Date().toISOString() };
  processedCommands.set(payload.command_id, ack);
  pruneCommandCache(now);
  publishAck(client, payload.command_id, ack);
  console.log(`${payload.command_id}: ${status} (${result})`);
}

const client = mqtt.connect(mqttUrl, {
  clientId: `simulator-${deviceId}`,
  username: mqttUsername,
  password: mqttPassword,
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  console.log(`MQTT simulator connected as ${deviceId} to ${mqttUrl}`);
  client.subscribe(`${topicPrefix}/command`, { qos: 1 });
  client.subscribe(`${topicPrefix}/config`, { qos: 1 });
  publishStatus(client, 'ONLINE');
  publishTelemetry(client);
  telemetryTimer = setInterval(() => publishTelemetry(client), telemetryIntervalMs);
});

client.on('message', (topic, payload) => {
  if (topic === `${topicPrefix}/command`) handleCommand(client, payload.toString());
});

client.on('error', (error) => console.error(`MQTT simulator error: ${error.message}`));

function shutdown(): void {
  if (telemetryTimer) clearInterval(telemetryTimer);
  if (client.connected) publishStatus(client, 'OFFLINE');
  client.end(false, {}, () => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);