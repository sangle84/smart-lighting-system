import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AppError, ErrorCode } from '../errors/AppError';
import { config } from '../config/env';
import { createAccessToken, createRefreshToken, verifyToken } from '../services/jwt';
import { UserRepo } from '../repositories/user';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    role: string;
  };
}

/**
 * Controller xử lý authentication
 */
export class AuthController {
  private userRepo: UserRepo;

  constructor(userRepo: UserRepo) {
    this.userRepo = userRepo;
  }

  /**
   * POST /auth/login
   * - Validate username/password
   * - Check account locked
   * - Verify password
   * - Generate access + refresh token
   * - Set refresh token vào HttpOnly cookie
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body as LoginRequest;

      // Validate input
      if (!username || !password) {
        next(new AppError(ErrorCode.VALIDATION_ERROR, 'Thiếu username hoặc password'));
        return;
      }

      // Tìm user
      const user = await this.userRepo.findByUsername(username);
      if (!user) {
        next(new AppError(ErrorCode.INVALID_CREDENTIALS, 'Sai tên đăng nhập hoặc mật khẩu'));
        return;
      }

      // Check account locked
      if (user.status === 'LOCKED') {
        next(new AppError(ErrorCode.ACCOUNT_LOCKED, 'Tài khoản bị khóa'));
        return;
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        next(new AppError(ErrorCode.INVALID_CREDENTIALS, 'Sai tên đăng nhập hoặc mật khẩu'));
        return;
      }

      // Generate tokens
      const accessToken = createAccessToken({ sub: user.user_id, role: user.role_name });
      const refreshToken = createRefreshToken({ sub: user.user_id, role: user.role_name });

      // Set refresh token vào HttpOnly cookie
      res.cookie('refreshToken', refreshToken.token, refreshToken.cookieOptions);

      // Trả response (không trả password_hash)
      res.json({
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: accessToken.expiresIn,
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role_name,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/refresh
   * - Verify refresh token từ cookie
   * - Generate access token mới
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies['refreshToken'];

      if (!token) {
        next(new AppError(ErrorCode.UNAUTHORIZED, 'Thiếu refresh token'));
        return;
      }

      // Verify refresh token
      const payload = verifyToken(token);

      // Generate access token mới
      const accessToken = createAccessToken({ sub: payload.sub, role: payload.role });

      res.json({
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: accessToken.expiresIn,
      });
    } catch (err) {
      next(new AppError(ErrorCode.UNAUTHORIZED, 'Refresh token không hợp lệ hoặc đã hết hạn'));
    }
  }

  /**
   * POST /auth/logout
   * - Xóa refresh token cookie
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE,
      });

      res.json({ message: 'Đăng xuất thành công' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /auth/password
   * - Verify current password
   * - Validate new password complexity
   * - Check new password khác current password
   * - Hash và lưu password mới
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { current_password, new_password } = req.body as ChangePasswordRequest;

      // Validate input
      if (!current_password || !new_password) {
        next(new AppError(ErrorCode.VALIDATION_ERROR, 'Thiếu mật khẩu hiện tại hoặc mới'));
        return;
      }

      // Validate password complexity
      if (!this.isValidPassword(new_password)) {
        next(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm chữ và số'
          )
        );
        return;
      }

      // Lấy user từ context (đã xác thực bởi requireAuth)
      const userId = (req as AuthRequest).user?.sub;
      if (!userId) {
        next(new AppError(ErrorCode.UNAUTHORIZED, 'Chưa xác thực'));
        return;
      }

      // Tìm user để verify password hiện tại
      const user = await this.userRepo.findById(userId);
      if (!user) {
        next(new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy người dùng'));
        return;
      }

      // Verify current password
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        next(new AppError(ErrorCode.UNAUTHORIZED, 'Mật khẩu hiện tại không đúng'));
        return;
      }

      // Check new password khác current password
      if (current_password === new_password) {
        next(
          new AppError(ErrorCode.VALIDATION_ERROR, 'Mật khẩu mới không được trùng với mật khẩu hiện tại')
        );
        return;
      }

      // Hash password mới
      const password_hash = await bcrypt.hash(new_password, 10);

      // Cập nhật password
      await this.userRepo.updatePassword(userId, password_hash);

      res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Validate password complexity
   * Tối thiểu 8 ký tự, gồm ít nhất 1 chữ cái và 1 chữ số
   */
  private isValidPassword(password: string): boolean {
    if (password.length < 8) return false;
    if (!/[a-zA-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
  }
}
