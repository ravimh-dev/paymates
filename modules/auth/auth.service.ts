import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../../db';
import { AppError } from '../../middlewares/error.middleware';
import { HTTP_STATUS } from '../../utils/constants';
import type {
  RegisterInput, LoginInput, AuthResponse, AuthTokens,
  ForgotPasswordInput, ResetPasswordInput,
} from './auth.type';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const ACCESS_SECRET = () => {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET not set');
  return s;
};
const REFRESH_SECRET = () => {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET not set');
  return s;
};

// ─── Token helpers ────────────────────────────────────────────────────────────

const signTokens = (userId: string, email: string): AuthTokens => {
  const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES || '15m') as SignOptions['expiresIn'];
  const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES || '7d') as SignOptions['expiresIn'];
  const accessToken = jwt.sign(
    { userId, email },
    ACCESS_SECRET(),
    { expiresIn: accessExpiresIn }
  );
  const refreshToken = jwt.sign(
    { userId, email },
    REFRESH_SECRET(),
    { expiresIn: refreshExpiresIn }
  );
  return { accessToken, refreshToken };
};

// ─── Service methods ──────────────────────────────────────────────────────────

export const registerUser = async (input: RegisterInput): Promise<AuthResponse> => {
  const { name, email, password, currency = 'INR' } = input;

  const exists = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );
  if (exists.rows.length) {
    throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);
  }

  const password_hash = await bcrypt.hash(password, ROUNDS);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, currency, email_verified)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id, name, email, currency, created_at`,
    [name, email, password_hash, currency]
  );

  const user = result.rows[0];
  const tokens = signTokens(user.id, user.email);

  await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken, user.id,
  ]);

  return { user, tokens };
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  const { email, password } = input;

  const result = await pool.query(
    `SELECT id, name, email, currency, password_hash, is_active, created_at
     FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );

  const user = result.rows[0];

  // Constant-time comparison even if user not found (prevent timing attacks)
  const dummyHash = '$2b$12$invalidhashforcomparison000000000000';
  const isMatch = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, dummyHash);

  if (!user || !isMatch) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!user.is_active) {
    throw new AppError('Account is deactivated', HTTP_STATUS.FORBIDDEN);
  }

  const tokens = signTokens(user.id, user.email);

  await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken, user.id,
  ]);

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, tokens };
};

export const refreshTokens = async (refreshToken: string): Promise<AuthTokens> => {
  let payload: { userId: string; email: string };
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET()) as typeof payload;
  } catch {
    throw new AppError('Invalid or expired refresh token', HTTP_STATUS.UNAUTHORIZED);
  }

  const result = await pool.query(
    'SELECT id, email, refresh_token FROM users WHERE id = $1 AND deleted_at IS NULL',
    [payload.userId]
  );

  const user = result.rows[0];
  if (!user || user.refresh_token !== refreshToken) {
    throw new AppError('Refresh token revoked', HTTP_STATUS.UNAUTHORIZED);
  }

  const tokens = signTokens(user.id, user.email);
  await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken, user.id,
  ]);

  return tokens;
};

export const logoutUser = async (userId: string): Promise<void> => {
  await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [userId]);
};

export const forgotPassword = async (input: ForgotPasswordInput): Promise<{ resetToken?: string; resetLink?: string }> => {
  const { email } = input;
  console.log("input: ", input);
  const result = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );

  // Don't reveal whether the email exists
  console.log("result: ", result.rows);
  if (!result.rows.length) return {};

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
    [token, expires, result.rows[0].id]
  );

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    console.log("innn");

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: email,
      subject: 'Reset your Expense Splitter password',
      text: `Reset your password using this link: ${resetLink}`,
      html: `<p>Reset your password using this link:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });
    console.log("innn1111111111");

    console.log("resetLink: ", resetLink);
    return { resetLink };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
  }

  return { resetToken: token, resetLink };
};

export const resetPassword = async (input: ResetPasswordInput): Promise<void> => {
  const { token, password } = input;

  const result = await pool.query(
    `SELECT id FROM users
     WHERE password_reset_token = $1
       AND password_reset_expires > NOW()
       AND deleted_at IS NULL`,
    [token]
  );

  if (!result.rows.length) {
    throw new AppError('Invalid or expired reset token', HTTP_STATUS.BAD_REQUEST);
  }

  const password_hash = await bcrypt.hash(password, ROUNDS);
  await pool.query(
    `UPDATE users SET
       password_hash = $1,
       password_reset_token = NULL,
       password_reset_expires = NULL,
       refresh_token = NULL
     WHERE id = $2`,
    [password_hash, result.rows[0].id]
  );
};
