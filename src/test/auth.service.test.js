jest.mock('../../dist/db', () => ({
  pool: {
    query: jest.fn(),
  },
  withTransaction: jest.fn(),
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn(),
  cacheInvalidatePattern: jest.fn(),
  redis: {},
  connectDB: jest.fn(),
  connectRedis: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const db = require('../../dist/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { refreshTokens, forgotPassword, resetPassword } = require('../../dist/modules/auth/auth.service');

const poolQuery = db.pool.query;
const jwtSign = jwt.sign;
const jwtVerify = jwt.verify;
const hash = bcrypt.hash;
const transport = nodemailer.createTransport;

describe('auth.service', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    jwtSign.mockReset();
    jwtVerify.mockReset();
    hash.mockReset();
    transport.mockReset();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
  });

  test('refreshTokens rotates access and refresh tokens', async () => {
    jwtVerify.mockReturnValue({ userId: 'user-1', email: 'alice@example.com' });
    jwtSign
      .mockReturnValueOnce('new-access-token')
      .mockReturnValueOnce('new-refresh-token');
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'alice@example.com', refresh_token: 'old-refresh-token' }] })
      .mockResolvedValueOnce({ rows: [] });

    const tokens = await refreshTokens('old-refresh-token');

    expect(tokens).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      ['new-refresh-token', 'user-1']
    );
  });

  test('refreshTokens rejects revoked refresh tokens', async () => {
    jwtVerify.mockReturnValue({ userId: 'user-1', email: 'alice@example.com' });
    poolQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'alice@example.com', refresh_token: 'another-token' }] });

    await expect(refreshTokens('old-refresh-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token revoked',
    });
  });

  test('forgotPassword stores a reset token and returns the dev link', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await forgotPassword({ email: 'alice@example.com' });

    expect(result.resetToken).toEqual(expect.any(String));
    expect(result.resetLink).toBe('http://localhost:3000/reset-password?token=' + result.resetToken);
    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [result.resetToken, expect.any(Date), 'user-1']
    );
  });

  test('forgotPassword sends email when SMTP is configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';
    transport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue(undefined),
    });
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await forgotPassword({ email: 'alice@example.com' });

    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      auth: { user: 'user@example.com', pass: 'secret' },
    }));
  });

  test('resetPassword updates the password hash and clears reset fields', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: [] });
    hash.mockResolvedValue('hashed-password');

    await resetPassword({ token: 'reset-token', password: 'Password@123' });

    expect(hash).toHaveBeenCalledWith('Password@123', expect.any(Number));
    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE users SET'),
      ['hashed-password', 'user-1']
    );
  });
});
