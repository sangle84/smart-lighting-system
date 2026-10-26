import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../.env'),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
}
dotenv.config();

export interface Config {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: number;
  REFRESH_TOKEN_EXPIRES_IN: number;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: 'strict' | 'lax' | 'none';
  MQTT_URL: string;
  MQTT_CLIENT_ID: string;
  MQTT_USERNAME?: string;
  MQTT_PASSWORD?: string;
  MQTT_COMMAND_TIMEOUT_MS: number;
  MQTT_RETRY_DELAYS_MS: number[];
  MQTT_HEARTBEAT_TIMEOUT_MS: number;
  MQTT_HEARTBEAT_CHECK_INTERVAL_MS: number;
}

function parseExpiresIn(val: string | undefined, defaultVal: number): number {
  if (!val) return defaultVal;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

export function loadConfig(): Config {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET missing in production');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL missing');
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret || 'dev-secret-key-change-me-in-prod-1234567890',
    JWT_EXPIRES_IN: parseExpiresIn(process.env.JWT_EXPIRES_IN, 900),
    REFRESH_TOKEN_EXPIRES_IN: parseExpiresIn(process.env.REFRESH_TOKEN_EXPIRES_IN, 604800),
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    COOKIE_SAME_SITE: (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict',
    MQTT_URL: process.env.MQTT_URL || 'mqtt://localhost:1883',
    MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'smart-lighting-backend',
    MQTT_USERNAME: process.env.MQTT_USERNAME || undefined,
    MQTT_PASSWORD: process.env.MQTT_PASSWORD || undefined,
    MQTT_COMMAND_TIMEOUT_MS: parseExpiresIn(process.env.MQTT_COMMAND_TIMEOUT_MS, 5000),
    MQTT_RETRY_DELAYS_MS: [1000, 2000],
    MQTT_HEARTBEAT_TIMEOUT_MS: parseExpiresIn(
      process.env.MQTT_HEARTBEAT_TIMEOUT_MS,
      30000
    ),
    MQTT_HEARTBEAT_CHECK_INTERVAL_MS: parseExpiresIn(
      process.env.MQTT_HEARTBEAT_CHECK_INTERVAL_MS,
      10000
    ),
  };
}

export const config = loadConfig();
