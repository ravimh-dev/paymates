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

const db = require('../../dist/db');
const bcrypt = require('bcrypt');
const { AppError } = require('../../dist/middlewares/error.middleware');
const {
  getProfile,
  updateProfile,
  changePassword,
  softDeleteUser,
} = require('../../dist/modules/user/user.service');

const poolQuery = db.pool.query;

describe('user.service', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    bcrypt.compare.mockReset();
    bcrypt.hash.mockReset();
  });

  test('getProfile returns the current user profile', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        avatar_url: null,
        timezone: 'Asia/Calcutta',
        currency: 'INR',
        email_verified: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    });

    const result = await getProfile('user-1');

    expect(result.email).toBe('alice@example.com');
  });

  test('updateProfile rejects empty updates', async () => {
    await expect(updateProfile('user-1', {})).rejects.toMatchObject({
      statusCode: 400,
      message: 'No fields to update',
    });
  });

  test('changePassword rejects wrong current password', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'old-hash' }] });
    bcrypt.compare.mockResolvedValue(false);

    await expect(changePassword('user-1', {
      currentPassword: 'wrong',
      newPassword: 'Password@123',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Current password is incorrect',
    });
  });

  test('changePassword updates the hash and clears refresh tokens', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'old-hash' }] });
    poolQuery.mockResolvedValueOnce({ rows: [] });
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('new-hash');

    await changePassword('user-1', {
      currentPassword: 'Password@123',
      newPassword: 'NewPassword@123',
    });

    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET password_hash = $1, refresh_token = NULL WHERE id = $2',
      ['new-hash', 'user-1']
    );
  });

  test('softDeleteUser marks the account inactive', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await softDeleteUser('user-1');

    expect(poolQuery).toHaveBeenCalledWith(
      'UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1',
      ['user-1']
    );
  });
});
