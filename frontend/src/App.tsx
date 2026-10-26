import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, API_URL, getAccessToken, type Device, type Telemetry } from './api';
import { AuthProvider, useAuth } from './auth';

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">SL</div>
        <p className="eyebrow">SMART LIGHTING SYSTEM</p>
        <h1>Điều khiển ánh sáng, rõ từng nhịp.</h1>
        <p className="muted">Đăng nhập để theo dõi thiết bị và dữ liệu cảm biến theo thời gian thực.</p>
        <form onSubmit={submit} className="login-form">
          <label>Tên đăng nhập<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
          <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Đang xác thực...' : 'Đăng nhập'}</button>
        </form>
      </section>
      <aside className="login-aside"><span>LIVE MONITORING</span><strong>Ánh sáng<br />đúng lúc.</strong><p>Telemetry, trạng thái và quyền điều khiển trong một mặt phẳng vận hành.</p></aside>
    </main>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPwm, setNewPwm] = useState(60);

  const selected = useMemo(() => devices.find((device) => device.device_id === selectedId), [devices, selectedId]);

  useEffect(() => {
    if (!user) return;
    api.devices()
      .then((result) => {
        setDevices(result.data);
        setSelectedId(result.data[0]?.device_id ?? '');
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Không tải được thiết bị'));
  }, [user]);

  useEffect(() => {
    if (!selectedId) return;
    api.latestTelemetry(selectedId)
      .then((value) => {
        setTelemetry(value);
        setHistory([value]);
      })
      .catch(() => {
        setTelemetry(null);
        setHistory([]);
      });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const socket: Socket = io(API_URL, { auth: { token: getAccessToken() }, withCredentials: true });
    socket.on('telemetry:update', (value: Telemetry) => {
      if (value.device_id === selectedId) {
        setTelemetry(value);
        setHistory((previous) => [...previous.slice(-19), value]);
      }
    });
    socket.on('device:status', (value: Partial<Device> & { device_id: string }) => {
      setDevices((previous) => previous.map((device) => device.device_id === value.device_id ? { ...device, ...value } : device));
    });
    socket.on('connect_error', () => setError('Realtime chưa kết nối. Dữ liệu REST vẫn hoạt động.'));
    return () => {
      socket.close();
    };
  }, [selectedId]);

  async function sendCommand(command_type: 'ON' | 'OFF' | 'PWM', command_value?: number) {
    if (!selectedId) return;
    try {
      await api.command(selectedId, command_type, command_value);
      setNotice(command_type === 'PWM' ? `Đã gửi PWM ${command_value}%` : `Đã gửi lệnh ${command_type}`);
      setTimeout(() => setNotice(''), 3000);
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : 'Không gửi được lệnh');
    }
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">SL</div><div><strong>Smart Light</strong><span>Control room</span></div></div>
        <nav><a className="nav-item active" href="#dashboard"><span>◈</span> Tổng quan</a><a className="nav-item" href="#devices"><span>⌘</span> Thiết bị</a><a className="nav-item" href="#alerts"><span>!</span> Cảnh báo</a>{user.role === 'ADMIN' && <a className="nav-item" href="#users"><span>♙</span> Người dùng</a>}</nav>
        <div className="sidebar-footer"><div className="connection-dot"><i /> Hệ thống đang trực tuyến</div><button className="text-button" onClick={() => void logout()}>Đăng xuất</button></div>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">CONTROL ROOM / OVERVIEW</p><h2>Chào {user.username}</h2></div><div className="top-actions"><span className="role-pill">{user.role}</span><button className="icon-button" title="Đổi mật khẩu" onClick={() => setPasswordOpen(true)}>•••</button></div></header>
        {error && <div className="notice error-text">{error}</div>}
        {notice && <div className="notice success-text">{notice}</div>}
        <section className="hero-row"><div><span className="section-kicker">LIVE OVERVIEW</span><h1>Không gian sáng<br /><em>theo cách của bạn.</em></h1></div><div className="hero-stat"><span>Thiết bị đang quản lý</span><strong>{devices.length.toString().padStart(2, '0')}</strong><small>{devices.filter((device) => device.device_status === 'ONLINE').length} online hiện tại</small></div></section>
        <section className="dashboard-grid">
          <div className="panel device-panel"><div className="panel-heading"><div><span className="section-kicker">DEVICES</span><h3>Thiết bị</h3></div><span className="count-label">{devices.length} total</span></div><div className="device-list">{devices.map((device) => <button key={device.device_id} className={`device-row ${device.device_id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(device.device_id)}><span className={`status-dot ${device.device_status.toLowerCase()}`} /><span className="device-copy"><strong>{device.device_name}</strong><small>{device.device_id} · {device.location ?? 'Chưa gán vị trí'}</small></span><span className="device-state">{device.device_status}</span></button>)}{devices.length === 0 && <p className="empty">Chưa có thiết bị được cấp quyền.</p>}</div></div>
          <div className="panel telemetry-panel"><div className="panel-heading"><div><span className="section-kicker">SELECTED DEVICE</span><h3>{selected?.device_name ?? 'Chưa chọn thiết bị'}</h3></div>{selected && <span className={`status-badge ${selected.device_status.toLowerCase()}`}><i /> {selected.device_status}</span>}</div><div className="metric-grid"><Metric label="Độ sáng" value={telemetry ? `${Number(telemetry.lux).toFixed(1)} lx` : '--'} /><Metric label="Công suất" value={telemetry ? `${Number(telemetry.power).toFixed(2)} W` : '--'} /><Metric label="Điện áp" value={telemetry ? `${Number(telemetry.voltage).toFixed(1)} V` : '--'} /><Metric label="Chuyển động" value={telemetry ? (telemetry.motion ? 'Phát hiện' : 'Ổn định') : '--'} /></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><XAxis dataKey="timestamp" hide /><YAxis hide domain={[0, 'auto']} /><Tooltip contentStyle={{ background: '#18211e', border: 0, borderRadius: 8 }} formatter={(value: number) => [`${value} lx`, 'Lux']} /><Line type="monotone" dataKey="lux" stroke="#d5f36b" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer>{history.length < 2 && <span className="chart-placeholder">Đang chờ telemetry realtime</span>}</div></div>
          <div className="panel control-panel"><div className="panel-heading"><div><span className="section-kicker">CONTROL</span><h3>Điều khiển ánh sáng</h3></div><span className="lock-label">{user.role === 'VIEWER' ? 'Chỉ xem' : 'Cho phép'}</span></div>{user.role === 'VIEWER' ? <div className="viewer-message">Bạn có quyền giám sát thiết bị, nhưng không có quyền gửi lệnh.</div> : <><div className="control-buttons"><button onClick={() => void sendCommand('ON')}>Bật đèn</button><button onClick={() => void sendCommand('OFF')}>Tắt đèn</button></div><label className="range-label">Độ sáng <strong>{newPwm}%</strong><input type="range" min="0" max="100" value={newPwm} onChange={(event) => setNewPwm(Number(event.target.value))} /></label><button className="primary-button full" onClick={() => void sendCommand('PWM', newPwm)}>Gửi mức PWM</button></>}</div>
        </section>
        <footer className="page-footer"><span>SMART LIGHTING SYSTEM · PROTOTYPE</span><span>REST SOURCE OF TRUTH · SOCKET.IO LIVE</span></footer>
      </main>
      {passwordOpen && <ChangePassword onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); try { await api.changePassword(current, next); setMessage('Đã đổi mật khẩu'); setCurrent(''); setNext(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu'); } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="panel-heading"><h3>Đổi mật khẩu</h3><button type="button" className="icon-button" onClick={onClose}>×</button></div><label>Mật khẩu hiện tại<input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required /></label><label>Mật khẩu mới<input type="password" value={next} onChange={(event) => setNext(event.target.value)} minLength={8} required /></label>{message && <p className="muted">{message}</p>}<button className="primary-button full">Cập nhật</button></form></div>;
}

export function App() { return <AuthProvider><Dashboard /></AuthProvider>; }
