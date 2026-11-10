export interface User {
  user_id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

export interface ManagedUser {
  user_id: string;
  username: string;
  email: string;
  role_id: number;
  role_name: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  status: 'ACTIVE' | 'LOCKED';
  created_at: string;
  updated_at?: string;
}

export interface Device {
  device_id: string;
  device_name: string;
  location: string | null;
  device_status: 'ONLINE' | 'OFFLINE' | 'FAULT';
  lifecycle_status: string;
  firmware_version: string;
  last_seen_at: string | null;
  assigned_user_id?: string | null;
  adaptive_config?: AdaptiveConfig;
  created_at?: string;
  updated_at?: string;
}

export interface AdaptiveConfig {
  enabled: boolean;
  motion_timeout_sec: number;
  lux_thresholds: Array<{ min_lux: number; pwm: number }>;
  no_motion_pwm: number;
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

export interface DashboardSummary {
  devices: { total: number; online: number; offline: number; fault: number };
  alerts: { active_count: number; resolved_today: number };
  avg_power_watts: number;
  system_status: string;
  updated_at: string;
}

export interface DashboardDevice {
  device_id: string;
  device_name: string;
  device_status: 'ONLINE' | 'OFFLINE' | 'FAULT';
  lux: number | null;
  motion: boolean | null;
  pwm: number | null;
  power: number | null;
  last_seen_at: string | null;
}

export interface Alert {
  alert_id: string;
  device_id: string;
  alert_type: 'LAMP_FAULT' | 'DEVICE_OFFLINE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
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

  if (response.status === 401 && canRefresh && path !== '/auth/refresh' && path !== '/auth/login') {
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
    request<{ access_token: string; user: User }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      false
    ),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  refresh: () => request<{ access_token: string; user: User }>('/auth/refresh', { method: 'POST' }, false),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    }),
  users: (limit = 100, offset = 0) => request<{ data: ManagedUser[]; total: number }>(`/users?limit=${limit}&offset=${offset}`),
  createUser: (input: { username: string; email: string; password: string; role_id: number }) =>
    request<ManagedUser>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateUser: (userId: string, input: { email?: string; role_id?: number }) =>
    request<ManagedUser>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  updateUserStatus: (userId: string, status: ManagedUser['status']) =>
    request<Pick<ManagedUser, 'user_id' | 'status' | 'updated_at'>>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  devices: () => request<{ data: Device[]; total: number }>('/devices'),
  device: (deviceId: string) => request<Device>(`/devices/${deviceId}`),
  devicesFiltered: (params: { status?: string; lifecycle?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return request<{ data: Device[]; total: number }>(`/devices${query.toString() ? `?${query}` : ''}`);
  },
  latestTelemetry: (deviceId: string) => request<Telemetry>(`/devices/${deviceId}/telemetry/latest`),
  telemetry: (deviceId: string, limit = 200) => request<{ device_id: string; data: Telemetry[]; total: number }>(`/devices/${deviceId}/telemetry?limit=${limit}`),
  dashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),
  dashboardDevices: () => request<{ data: DashboardDevice[] }>('/dashboard/devices'),
  alerts: (params: { status?: string; severity?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return request<{ data: Alert[]; total: number }>(`/alerts${query.toString() ? `?${query}` : ''}`);
  },
  acknowledgeAlert: (alertId: string) => request(`/alerts/${alertId}/acknowledge`, { method: 'PATCH' }),
  resolveAlert: (alertId: string) => request(`/alerts/${alertId}/resolve`, { method: 'PATCH' }),
  auditLogs: (limit = 50, offset = 0) => request<{ data: AuditLog[]; total: number }>(`/audit-logs?limit=${limit}&offset=${offset}`),
  command: (deviceId: string, command_type: 'ON' | 'OFF' | 'PWM', command_value?: number) =>
    request(`/devices/${deviceId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ command_type, ...(command_value === undefined ? {} : { command_value }) }),
    }),
};

export { API_URL };