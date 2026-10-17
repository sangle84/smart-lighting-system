import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../errors/AppError.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  AdaptiveConfig,
  DeviceRepo,
  DeviceStatus,
  DeviceUpdate,
  LifecycleStatus,
  RoleName,
} from '../repositories/device.js';

const deviceStatuses: DeviceStatus[] = ['ONLINE', 'OFFLINE', 'FAULT'];
const lifecycleStatuses: LifecycleStatus[] = [
  'REGISTERED',
  'PROVISIONED',
  'ACTIVE',
  'MAINTENANCE',
  'DECOMMISSIONED',
];

export class DeviceController {
  constructor(private readonly deviceRepo: DeviceRepo) {}

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        status: this.optionalEnum(req.query.status, deviceStatuses),
        lifecycle: this.optionalEnum(req.query.lifecycle, lifecycleStatuses),
        limit: this.parseNumber(req.query.limit, 20, 1, 100),
        offset: this.parseNumber(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER),
      };
      const result = await this.deviceRepo.findAll(
        req.user!.sub,
        req.user!.role as RoleName,
        filters
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { device_id, device_name, location, assigned_user_id } = req.body as Record<
        string,
        unknown
      >;
      if (
        typeof device_id !== 'string' ||
        !device_id.trim() ||
        typeof device_name !== 'string' ||
        !device_name.trim()
      ) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'device_id và device_name là bắt buộc');
      }
      const deviceKey = `sec_dev_${randomBytes(24).toString('hex')}`;
      const device = await this.deviceRepo.create(
        {
          device_id: device_id.trim(),
          device_name: device_name.trim(),
          location: this.optionalString(location),
          assigned_user_id: this.optionalString(assigned_user_id),
        },
        await bcrypt.hash(deviceKey, 10)
      );
      res.status(201).json({
        device_id: device.device_id,
        device_name: device.device_name,
        lifecycle_status: device.lifecycle_status,
        device_key: deviceKey,
        created_at: device.created_at,
      });
    } catch (error) {
      next(error);
    }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const device = await this.requireDevice(req);
      res.json(device);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Record<string, unknown>;
      const input: DeviceUpdate = {};
      if (body.device_name !== undefined) {
        if (typeof body.device_name !== 'string' || !body.device_name.trim()) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'device_name không hợp lệ');
        }
        input.device_name = body.device_name.trim();
      }
      if (body.location !== undefined) input.location = this.optionalString(body.location);
      if (body.assigned_user_id !== undefined) {
        input.assigned_user_id = this.optionalString(body.assigned_user_id);
      }
      if (!Object.keys(input).length) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Thiếu trường cần cập nhật');
      }
      const device = await this.deviceRepo.update(req.params.id, input);
      if (!device) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
      res.json({
        device_id: device.device_id,
        device_name: device.device_name,
        location: device.location,
        updated_at: device.updated_at,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLifecycle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = (req.body as Record<string, unknown>).lifecycle_status;
      if (!lifecycleStatuses.includes(status as LifecycleStatus)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'lifecycle_status không hợp lệ');
      }
      const device = await this.deviceRepo.updateLifecycle(
        req.params.id,
        status as LifecycleStatus
      );
      if (!device) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
      res.json({
        device_id: device.device_id,
        lifecycle_status: device.lifecycle_status,
        updated_at: device.updated_at,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adaptiveConfig = (req.body as Record<string, unknown>).adaptive_config;
      this.validateConfig(adaptiveConfig);
      const device = await this.deviceRepo.updateConfig(
        req.params.id,
        adaptiveConfig as AdaptiveConfig
      );
      if (!device) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
      res.json({
        device_id: device.device_id,
        adaptive_config: device.adaptive_config,
        updated_at: device.updated_at,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exists = await this.deviceRepo.findById(req.params.id, '', 'ADMIN');
      if (!exists) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
      res.json({ device_id: req.params.id, users: await this.deviceRepo.listAccess(req.params.id) });
    } catch (error) {
      next(error);
    }
  }

  async replaceAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userIds = (req.body as Record<string, unknown>).user_ids;
      if (
        !Array.isArray(userIds) ||
        userIds.some(
          (userId) =>
            typeof userId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              userId
            )
        ) ||
        new Set(userIds).size !== userIds.length
      ) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'user_ids phải là mảng UUID');
      }
      const exists = await this.deviceRepo.findById(req.params.id, '', 'ADMIN');
      if (!exists) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
      const users = await this.deviceRepo.replaceAccess(
        req.params.id,
        userIds as string[],
        req.user!.sub
      );
      if (users.length !== userIds.length) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'Không thể đồng bộ quyền thiết bị');
      }
      res.json({ device_id: req.params.id, users });
    } catch (error) {
      next(error);
    }
  }

  async latestTelemetry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.requireDevice(req);
      const telemetry = await this.deviceRepo.latestTelemetry(req.params.id);
      if (!telemetry) throw new AppError(ErrorCode.NOT_FOUND, 'Chưa có telemetry');
      res.json(telemetry);
    } catch (error) {
      next(error);
    }
  }

  async telemetry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.requireDevice(req);
      const from = this.optionalDate(req.query.from);
      const to = this.optionalDate(req.query.to);
      if (req.query.from && !from) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'from không phải ISO datetime hợp lệ');
      }
      if (req.query.to && !to) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'to không phải ISO datetime hợp lệ');
      }
      const result = await this.deviceRepo.telemetryHistory(
        req.params.id,
        from,
        to,
        this.parseNumber(req.query.limit, 100, 1, 1000)
      );
      res.json({ device_id: req.params.id, ...result });
    } catch (error) {
      next(error);
    }
  }

  private async requireDevice(req: AuthRequest) {
    const device = await this.deviceRepo.findById(
      req.params.id,
      req.user!.sub,
      req.user!.role as RoleName
    );
    if (!device) throw new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy thiết bị');
    return device;
  }

  private optionalEnum<T extends string>(
    value: unknown,
    allowed: T[]
  ): T | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Giá trị bộ lọc không hợp lệ');
    }
    return value as T;
  }

  private parseNumber(value: unknown, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Tham số số không hợp lệ');
    }
    return parsed;
  }

  private optionalString(value: unknown): string | null | undefined {
    if (value === null) return null;
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Giá trị chuỗi không hợp lệ');
    }
    return value.trim();
  }

  private optionalDate(value: unknown): string | undefined {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
    return value;
  }

  private validateConfig(value: unknown): void {
    const config = value as Partial<AdaptiveConfig> | null;
    const motionTimeout = config?.motion_timeout_sec;
    const noMotionPwm = config?.no_motion_pwm;
    if (
      !config ||
      typeof config.enabled !== 'boolean' ||
      typeof motionTimeout !== 'number' ||
      !Number.isInteger(motionTimeout) ||
      motionTimeout < 0 ||
      typeof noMotionPwm !== 'number' ||
      !Number.isInteger(noMotionPwm) ||
      noMotionPwm < 0 ||
      noMotionPwm > 100 ||
      !Array.isArray(config.lux_thresholds) ||
      config.lux_thresholds.some(
        (threshold) =>
          !Number.isFinite(threshold.min_lux) ||
          !Number.isInteger(threshold.pwm) ||
          threshold.min_lux < 0 ||
          threshold.pwm < 0 ||
          threshold.pwm > 100
      )
    ) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'adaptive_config không hợp lệ');
    }
  }
}
