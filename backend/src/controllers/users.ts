import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AppError, ErrorCode } from '../errors/AppError';
import { UserRepo, CreateUserParams, UpdateUserInput } from '../repositories/user';

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role_id: number;
}

export interface UpdateUserRequest {
  email?: string;
  role_id?: number;
}

export interface UpdateUserStatusRequest {
  status: 'ACTIVE' | 'LOCKED';
}

export interface UpdateUserOutput {
  user_id: string;
  username: string;
  email: string;
  role_id: number;
  updated_at?: string;
}

/**
 * Controller xử lý user administration
 */
export class UserController {
  private userRepo: UserRepo;

  constructor(userRepo: UserRepo) {
    this.userRepo = userRepo;
  }

  /**
   * GET /users
   * - Admin only
   * - Pagination: limit, offset
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await this.userRepo.findAll(limit, offset);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /users
   * - Admin only
   * - Tạo user mới
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password, role_id } = req.body as CreateUserRequest;

      // Validate input
      if (!username || !email || !password || !role_id) {
        next(new AppError(ErrorCode.VALIDATION_ERROR, 'Thiếu trường bắt buộc'));
        return;
      }

      // Validate role_id
      const role = await this.userRepo.findRoleById(role_id);
      if (!role) {
        next(new AppError(ErrorCode.VALIDATION_ERROR, 'role_id không hợp lệ'));
        return;
      }

      // Validate password complexity
      if (!this.isValidPassword(password)) {
        next(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Mật khẩu phải có tối thiểu 8 ký tự, gồm chữ và số'
          )
        );
        return;
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Tạo user
      const user = await this.userRepo.create({
        username,
        email,
        password_hash,
        role_id,
        status: 'ACTIVE',
      });

      // Trả response (không trả password_hash)
      res.status(201).json({
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        status: user.status,
        created_at: user.created_at,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /users/:id
   * - Admin only
   * - Cập nhật email, role_id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const { email, role_id } = req.body as UpdateUserRequest;

      // Validate ít nhất 1 field
      if (email === undefined && role_id === undefined) {
        next(new AppError(ErrorCode.VALIDATION_ERROR, 'Thiếu trường cần cập nhật'));
        return;
      }

      // Validate role_id nếu có
      if (role_id !== undefined) {
        const role = await this.userRepo.findRoleById(role_id);
        if (!role) {
          next(new AppError(ErrorCode.VALIDATION_ERROR, 'role_id không hợp lệ'));
          return;
        }
      }

      const input: UpdateUserInput = {};
      if (email !== undefined) input.email = email;
      if (role_id !== undefined) input.role_id = role_id;

      const user = await this.userRepo.update(userId, input);

      if (!user) {
        next(new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy người dùng'));
        return;
      }

      res.json({
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        updated_at: user.updated_at,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /users/:id/status
   * - Admin only
   * - Khóa/mở user
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const { status } = req.body as UpdateUserStatusRequest;

      // Validate status
      if (status !== 'ACTIVE' && status !== 'LOCKED') {
        next(new AppError(ErrorCode.VALIDATION_ERROR, 'status phải là ACTIVE hoặc LOCKED'));
        return;
      }

      const user = await this.userRepo.updateStatus(userId, status);

      if (!user) {
        next(new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy người dùng'));
        return;
      }

      res.json({
        user_id: user.user_id,
        status: user.status,
        updated_at: user.updated_at,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Validate password complexity
   */
  private isValidPassword(password: string): boolean {
    if (password.length < 8) return false;
    if (!/[a-zA-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
  }
}
