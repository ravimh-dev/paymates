import bcrypt from 'bcrypt';
import { pool } from '../../db';
import { AppError } from '../../middlewares/error.middleware';
import { HTTP_STATUS } from '../../utils/constants';
import type { User, UpdateProfileInput, ChangePasswordInput } from './user.type';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const getProfile = async (userId: string): Promise<User> => {
  const result = await pool.query(
    `SELECT id, name, email, avatar_url, timezone, currency,
            email_verified, is_active, created_at, updated_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  if (!result.rows[0]) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  return result.rows[0];
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<User> => {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
  if (input.avatar_url !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(input.avatar_url); }
  if (input.timezone !== undefined) { fields.push(`timezone = $${idx++}`); values.push(input.timezone); }
  if (input.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(input.currency); }

  if (!fields.length) {
    throw new AppError('No fields to update', HTTP_STATUS.BAD_REQUEST);
  }

  values.push(userId);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, name, email, avatar_url, timezone, currency, email_verified, is_active, created_at, updated_at`,
    values
  );

  if (!result.rows[0]) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  return result.rows[0];
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput
): Promise<void> => {
  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId]
  );

  if (!result.rows[0]) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const isMatch = await bcrypt.compare(input.currentPassword, result.rows[0].password_hash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', HTTP_STATUS.BAD_REQUEST);
  }

  const newHash = await bcrypt.hash(input.newPassword, ROUNDS);
  await pool.query(
    'UPDATE users SET password_hash = $1, refresh_token = NULL WHERE id = $2',
    [newHash, userId]
  );
};

export const softDeleteUser = async (userId: string): Promise<void> => {
  await pool.query(
    'UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1',
    [userId]
  );
};
