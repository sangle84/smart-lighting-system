import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordComplexity(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 8 ký tự' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất một chữ hoa' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất một chữ thường' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất một chữ số' };
  }
  return { valid: true };
}
