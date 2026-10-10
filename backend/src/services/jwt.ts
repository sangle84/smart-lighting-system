import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AccessToken {
  token: string;
  expiresIn: number;
}

export interface RefreshToken {
  token: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
  };
}

/**
 * Tạo access token (HS256)
 * Claims: { sub, role, iat, exp }
 * TTL: JWT_EXPIRES_IN (mặc định 900 giây)
 */
export function createAccessToken(payload: JwtPayload): AccessToken {
  const token = jwt.sign(
    { sub: payload.sub, role: payload.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  return { token, expiresIn: config.JWT_EXPIRES_IN };
}

/**
 * Tạo refresh token (HS256)
 *Claims: { sub, role, iat, exp }
 * TTL: REFRESH_TOKEN_EXPIRES_IN (mặc định 7 ngày)
 * Trả về token + cookie options cho HttpOnly
 */
export function createRefreshToken(payload: JwtPayload): RefreshToken {
  const token = jwt.sign(
    { sub: payload.sub, role: payload.role },
    config.JWT_SECRET,
    { expiresIn: config.REFRESH_TOKEN_EXPIRES_IN }
  );

  return {
    token,
    cookieOptions: {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: config.COOKIE_SAME_SITE,
      maxAge: config.REFRESH_TOKEN_EXPIRES_IN * 1000,
    },
  };
}

/**
 * Verify access/refresh token
 * Trả về decoded payload hoặc throw Error
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}
