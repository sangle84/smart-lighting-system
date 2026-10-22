import { Server as HttpServer } from 'http';
import { Pool } from 'pg';
import { Server, Socket } from 'socket.io';
import { JwtPayload, verifyToken } from '../services/jwt.js';

export type RealtimeEvent =
  | 'telemetry:update'
  | 'device:status'
  | 'command:update'
  | 'alert:new';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export class RealtimeGateway {
  private readonly io: Server;

  constructor(private readonly pool: Pool, httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: true, credentials: true },
    });
    this.io.use((socket, next) => {
      const token = this.extractToken(socket);
      if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      try {
        (socket as AuthenticatedSocket).user = verifyToken(token);
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });
    this.io.on('connection', (socket) => {
      void this.joinAuthorizedRooms(socket as AuthenticatedSocket).catch((error: unknown) => {
        console.error('Socket room authorization failed', error);
        socket.disconnect(true);
      });
    });
  }

  emitDeviceEvent(
    event: RealtimeEvent,
    deviceId: string,
    payload: Record<string, unknown>
  ): void {
    this.io.to(`device:${deviceId}`).emit(event, payload);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.io.close(() => resolve()));
  }

  private extractToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string') return authToken.replace(/^Bearer\s+/i, '');
    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.substring(7);
    }
    return undefined;
  }

  private async joinAuthorizedRooms(socket: AuthenticatedSocket): Promise<void> {
    const user = socket.user;
    if (!user) throw new Error('Missing authenticated user');
    const devices =
      user.role === 'ADMIN'
        ? await this.pool.query<{ device_id: string }>('SELECT device_id FROM device')
        : await this.pool.query<{ device_id: string }>(
            `SELECT device_id FROM device_access WHERE user_id = $1`,
            [user.sub]
          );
    for (const device of devices.rows) {
      await socket.join(`device:${device.device_id}`);
    }
  }
}
