import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppError, ErrorCode } from '../errors/AppError';

export interface User {
  user_id: string;
  username: string;
  email: string;
  role_id: number;
  role_name: string;
  status: 'ACTIVE' | 'LOCKED';
  created_at: string;
  updated_at?: string;
  password_hash: string;
}

export interface UserRole {
  role_id: number;
  role_name: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  description?: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password_hash: string;
  role_id: number;
  status?: 'ACTIVE' | 'LOCKED';
}

export interface CreateUserParams {
  username: string;
  email: string;
  password_hash: string;
  role_id: number;
  status?: 'ACTIVE' | 'LOCKED';
}

export interface UpdateUserInput {
  email?: string;
  role_id?: number;
}

/**
 * Repository cho users và roles
 * Dùng parameterized SQL để tránh SQL injection
 */
export class UserRepo {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Tìm user theo username
   * Trả về password_hash để verify tại service auth
   * Không trả password_hash ra ngoài API
   */
  async findByUsername(username: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          u.role_id,
          r.role_name,
          u.status,
          u.created_at
        FROM users u
        JOIN role r ON u.role_id = r.role_id
        WHERE u.username = $1
      `;
      const result = await client.query<User>(query, [username]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Tìm user theo ID
   */
  async findById(user_id: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          u.role_id,
          r.role_name,
          u.status,
          u.created_at
        FROM users u
        JOIN role r ON u.role_id = r.role_id
        WHERE u.user_id = $1
      `;
      const result = await client.query<User>(query, [user_id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Lấy danh sách user (pagination)
   */
  async findAll(limit: number, offset: number): Promise<{ data: User[]; total: number }> {
    const client = await this.pool.connect();
    try {
      const queryCount = 'SELECT COUNT(*) FROM users';
      const queryList = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          u.role_id,
          r.role_name,
          u.status,
          u.created_at
        FROM users u
        JOIN role r ON u.role_id = r.role_id
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const [countRes, listRes] = await Promise.all([
        client.query<{ count: string }>(queryCount),
        client.query<User>(queryList, [limit, offset]),
      ]);

      return {
        data: listRes.rows,
        total: parseInt(countRes.rows[0].count, 10),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Tạo user mới
   * Throws CONFLICT nếu username/email đã tồn tại
   */
  async create(input: CreateUserParams): Promise<User> {
    const client = await this.pool.connect();
    try {
      const user_id = randomUUID();
      const query = `
        INSERT INTO users (user_id, username, email, password_hash, role_id, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          user_id,
          username,
          email,
          role_id,
          (SELECT role_name FROM role WHERE role_id = $5) AS role_name,
          status,
          created_at
      `;
      const values = [
        user_id,
        input.username,
        input.email,
        input.password_hash,
        input.role_id,
        input.status || 'ACTIVE',
      ];

      const result = await client.query<User>(query, values);
      return result.rows[0];
    } catch (err: unknown) {
      if (err instanceof Error && (err as any).code === '23505') {
        // PostgreSQL unique violation
        throw new AppError(ErrorCode.CONFLICT, 'Username hoặc email đã tồn tại');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cập nhật user (email, role_id)
   */
  async update(user_id: string, input: UpdateUserInput): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (input.email !== undefined) {
        fields.push('email = $' + (values.length + 1));
        values.push(input.email);
      }
      if (input.role_id !== undefined) {
        fields.push('role_id = $' + (values.length + 1));
        values.push(input.role_id);
      }

      if (fields.length === 0) {
        // Không có gì để update
        return this.findById(user_id);
      }

      values.push(user_id);

      const query = `
        UPDATE users
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${values.length}
        RETURNING 
          user_id,
          username,
          email,
          role_id,
          (SELECT role_name FROM role WHERE role_id = $1) AS role_name,
          status,
          created_at,
          updated_at
      `;

      const result = await client.query<User>(query, values);
      return result.rows[0] || null;
    } catch (err: unknown) {
      if (err instanceof Error && (err as any).code === '23505') {
        throw new AppError(ErrorCode.CONFLICT, 'Username hoặc email đã tồn tại');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cập nhật password
   */
  async updatePassword(user_id: string, password_hash: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `;
      await client.query(query, [password_hash, user_id]);
    } finally {
      client.release();
    }
  }

  /**
   * Cập nhật status (ACTIVE/LOCKED)
   */
  async updateStatus(user_id: string, status: 'ACTIVE' | 'LOCKED'): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
        RETURNING 
          user_id,
          username,
          email,
          role_id,
          (SELECT role_name FROM role WHERE role_id = (SELECT role_id FROM users WHERE user_id = $2)) AS role_name,
          status,
          created_at,
          updated_at
      `;
      const result = await client.query<User>(query, [status, user_id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Lấy danh sách role
   */
  async findRoles(): Promise<UserRole[]> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT role_id, role_name, description FROM role ORDER BY role_id';
      const result = await client.query<UserRole>(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Tìm role theo ID
   */
  async findRoleById(role_id: number): Promise<UserRole | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT role_id, role_name, description FROM role WHERE role_id = $1';
      const result = await client.query<UserRole>(query, [role_id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }
}
