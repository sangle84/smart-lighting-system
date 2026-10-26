export interface User {
  user_id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

export interface Device {
  device_id: string;
  device_name: string;
  location: string | null;
  device_status: 'ONLINE' | 'OFFLINE' | 'FAULT';
  lifecycle_status: string;
  firmware_version: string;
  last_seen_at: string | null;
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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(path: string, init: RequestInit = {}, canRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && canRefresh && path !== '/auth/refresh') {
    const refreshed = await request<{ access_token: string }>('/auth/refresh', { method: 'POST' }, false);
    setAccessToken(refreshed.access_token);
    return request<T>(path, init, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  refresh: () => request<{ access_token: string }>('/auth/refresh', { method: 'POST' }, false),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    }),
  devices: () => request<{ data: Device[]; total: number }>('/devices'),
  latestTelemetry: (deviceId: string) => request<Telemetry>(`/devices/${deviceId}/telemetry/latest`),
  command: (deviceId: string, command_type: 'ON' | 'OFF' | 'PWM', command_value?: number) =>
    request(`/devices/${deviceId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ command_type, ...(command_value === undefined ? {} : { command_value }) }),
    }),
};

export { API_URL };