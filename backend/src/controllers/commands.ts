import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../errors/AppError.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  CommandPublisher,
  CommandRepo,
  CommandType,
} from '../repositories/commands.js';
import { RoleName } from '../repositories/device.js';

const commandTypes: CommandType[] = ['PWM', 'ON', 'OFF'];

export class CommandController {
  constructor(
    private readonly commandRepo: CommandRepo,
    private readonly publisher?: CommandPublisher
  ) {}

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Record<string, unknown>;
      const commandType = body.command_type;
      const commandValue = body.command_value;

      if (
        typeof commandType !== 'string' ||
        !commandTypes.includes(commandType as CommandType)
      ) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'command_type không hợp lệ');
      }

      let normalizedValue: number | null = null;
      if (commandType === 'PWM') {
        if (
          typeof commandValue !== 'number' ||
          !Number.isInteger(commandValue) ||
          commandValue < 0 ||
          commandValue > 100
        ) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'command_value của PWM phải là số nguyên từ 0 đến 100'
          );
        }
        normalizedValue = commandValue;
      } else if (commandValue !== undefined && commandValue !== null) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'command_value phải rỗng với lệnh ON/OFF'
        );
      }

      const command = await this.commandRepo.create({
        deviceId: req.params.id,
        userId: req.user!.sub,
        role: req.user!.role as RoleName,
        commandType: commandType as CommandType,
        commandValue: normalizedValue,
        ipAddress: this.clientIp(req),
      });

      if (this.publisher) {
        try {
          await this.publisher.publish(command);
        } catch (error) {
          next(error);
          return;
        }
      }

      res.status(202).json(command);
    } catch (error) {
      next(error);
    }
  }

  private clientIp(req: Request): string | null {
    return req.ip || null;
  }
}
