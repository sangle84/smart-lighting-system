import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../errors/AppError';
import { verifyToken, JwtPayload } from '../services/jwt';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware xác thực JWT
 * Trích xuất Bearer token từ header Authorization
 * Verify token, gắn user vào request
 */
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError(ErrorCode.UNAUTHORIZED, 'Thiếu hoặc sai định dạng token'));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(new AppError(ErrorCode.UNAUTHORIZED, 'Token không hợp lệ hoặc đã hết hạn'));
  }
}

/**
 * Middleware kiểm tra role
 * @param allowedRoles Danh sách role được phép
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(ErrorCode.UNAUTHORIZED, 'Chưa xác thực'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError(ErrorCode.FORBIDDEN, 'Không đủ quyền truy cập'));
      return;
    }

    next();
  };
}
