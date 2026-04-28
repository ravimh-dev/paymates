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

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const db = require('../../dist/db');
const nodemailer = require('nodemailer');
const {
  createNotification,
  listNotifications,
  markNotificationRead,
  getUnreadNotificationCount,
} = require('../../dist/modules/notifications/notifications.service');

const poolQuery = db.pool.query;

describe('notifications.service', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    nodemailer.createTransport.mockReset();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  test('createNotification stores an in-app notification', async () => {
    poolQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'notification-1',
          user_id: 'user-1',
          type: 'expense_update',
          title: 'Expense updated',
          body: 'Dinner was updated.',
          is_read: false,
          metadata: {},
          created_at: new Date().toISOString(),
        }],
      });

    const result = await createNotification({
      userId: 'user-1',
      type: 'expense_update',
      title: 'Expense updated',
      body: 'Dinner was updated.',
    });

    expect(result.id).toBe('notification-1');
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      [
        'user-1',
        'expense_update',
        'Expense updated',
        'Dinner was updated.',
        {},
      ]
    );
  });

  test('listNotifications returns rows and counts', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'notification-1', user_id: 'user-1', is_read: false }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await listNotifications('user-1', { page: 1, limit: 10, unreadOnly: false });

    expect(result.total).toBe(1);
    expect(result.unreadCount).toBe(2);
    expect(result.notifications[0].id).toBe('notification-1');
  });

  test('markNotificationRead updates a notification and unread count helper works', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'notification-1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] });

    await markNotificationRead('notification-1', 'user-1');
    const count = await getUnreadNotificationCount('user-1');

    expect(count).toBe(3);
  });
});
