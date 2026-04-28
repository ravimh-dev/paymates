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

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const db = require('../../dist/db');
const { AppError, errorHandler } = require('../../dist/middlewares/error.middleware');
const { authenticate, requireGroupRole } = require('../../dist/middlewares/auth.middleware');

const poolQuery = db.pool.query;
const jwtVerify = jwt.verify;

describe('middlewares', () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
  });

  beforeEach(() => {
    poolQuery.mockReset();
    jwtVerify.mockReset();
  });

  test('authenticates a valid bearer token', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      cookies: {},
    };
    const res = {};
    const next = jest.fn();

    jwtVerify.mockReturnValue({ userId: 'user-1', email: 'alice@example.com' });
    poolQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'alice@example.com', name: 'Alice' }] });

    await authenticate(req, res, next);

    expect(req.user).toEqual({ id: 'user-1', email: 'alice@example.com', name: 'Alice' });
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects an invalid token during authentication', async () => {
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
      cookies: {},
    };
    const res = {};
    const next = jest.fn();

    jwtVerify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test('rejects a missing authentication token', async () => {
    const req = {
      headers: {},
      cookies: {},
    };
    const res = {};
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 401,
      message: 'Authentication token required',
    });
  });

  test('rejects an inactive user even with a valid token', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      cookies: {},
    };
    const res = {};
    const next = jest.fn();

    jwtVerify.mockReturnValue({ userId: 'user-1', email: 'alice@example.com' });
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await authenticate(req, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 401,
      message: 'User not found or inactive',
    });
  });

  test('allows an admin to pass group-role guard', async () => {
    const req = {
      params: { groupId: 'group-1' },
      body: {},
      user: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
    };
    const res = {};
    const next = jest.fn();

    poolQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });

    await requireGroupRole('admin')(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('blocks group access when the user is not a member', async () => {
    const req = {
      params: { groupId: 'group-1' },
      body: {},
      user: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
    };
    const res = {};
    const next = jest.fn();

    poolQuery.mockResolvedValueOnce({ rows: [] });

    await requireGroupRole('admin')(req, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      message: 'You are not a member of this group',
    });
  });

  test('blocks access when the member role is insufficient', async () => {
    const req = {
      params: { groupId: 'group-1' },
      body: {},
      user: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
    };
    const res = {};
    const next = jest.fn();

    poolQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] });

    await requireGroupRole('admin')(req, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });

  test('formats AppError responses in the error handler', () => {
    const req = { originalUrl: '/api/groups', method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(new AppError('Group not found', 404), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Group not found',
    });
  });

  test('formats duplicate-entry database errors', () => {
    const req = { originalUrl: '/api/groups', method: 'POST' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(Object.assign(new Error('duplicate'), { code: '23505', constraint: 'users_email_key' }), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Duplicate entry: resource already exists',
      constraint: 'users_email_key',
    });
  });

  test('formats expired token errors', () => {
    const req = { originalUrl: '/api/groups', method: 'GET' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const err = new Error('expired');
    err.name = 'TokenExpiredError';

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token expired',
    });
  });
});
