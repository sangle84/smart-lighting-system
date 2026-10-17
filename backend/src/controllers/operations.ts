import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../errors/AppError.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  AlertSeverity,
  AlertStatus,
  OperationsRepo,
} from '../repositories/operations.js';
import { RoleName } from '../repositories/device.js';

const statuses: AlertStatus[] = ['NEW', 'ACKNOWLEDGED', 'RESOLVED'];
const severities: AlertSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class OperationsController {
  constructor(private readonly repo: OperationsRepo) {}

  async alerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.repo.listAlerts(req.user!.sub, req.user!.role as RoleName, {
        status: this.enumQuery(req.query.status, statuses),
        device_id: this.stringQuery(req.query.device_id),
        severity: this.enumQuery(req.query.severity, severities),
        limit: this.numberQuery(req.query.limit, 50, 1, 100),
        offset: this.numberQuery(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async acknowledge(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.changeAlert(req, res, next, 'ACKNOWLEDGED');
  }

  async resolve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.changeAlert(req, res, next, 'RESOLVED');
  }

  async summary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await this.repo.dashboardSummary(req.user!.sub, req.user!.role as RoleName));
    } catch (error) {
      next(error);
    }
  }

  async dashboardDevices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        data: await this.repo.dashboardDevices(req.user!.sub, req.user!.role as RoleName),
      });
    } catch (error) {
      next(error);
    }
  }

  async auditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(
        await this.repo.listAuditLogs(
          this.stringQuery(req.query.user_id),
          this.stringQuery(req.query.action),
          this.numberQuery(req.query.limit, 50, 1, 100),
          this.numberQuery(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER)
        )
      );
    } catch (error) {
      next(error);
    }
  }

  private async changeAlert(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
    action: 'ACKNOWLEDGED' | 'RESOLVED'
  ): Promise<void> {
    try {
      const alert = await this.repo.updateAlert(
        req.params.id,
        req.user!.sub,
        req.user!.role as RoleName,
        action
      );
      if (!alert) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy cảnh báo');
      res.json({
        alert_id: alert.alert_id,
        status: alert.status,
        ...(action === 'ACKNOWLEDGED'
          ? {
              acknowledged_at: alert.acknowledged_at,
              acknowledged_by: alert.acknowledged_by,
            }
          : { resolved_at: alert.resolved_at, resolved_by: alert.resolved_by }),
      });
    } catch (error) {
      next(error);
    }
  }

  private enumQuery<T extends string>(value: unknown, allowed: T[]): T | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Giá trị lọc không hợp lệ');
    }
    return value as T;
  }

  private stringQuery(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Giá trị query không hợp lệ');
    }
    return value;
  }

  private numberQuery(value: unknown, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Giá trị số không hợp lệ');
    }
    return parsed;
  }
}
