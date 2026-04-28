import nodemailer from 'nodemailer';
import { pool } from '../../db';
import { AppError } from '../../middlewares/error.middleware';
import { HTTP_STATUS, EPSILON } from '../../utils/constants';
import type {
  CreateNotificationInput,
  NotificationListFilters,
  NotificationListResult,
  Notification,
} from './notifications.type';

let mailTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  return mailTransporter;
};

const formatAmount = (value: number): string => value.toFixed(2);

const sendEmailNotification = async (userId: string, subject: string, body: string): Promise<void> => {
  const transporter = getTransporter();
  if (!transporter) return;

  const result = await pool.query(
    'SELECT email, name FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!result.rows.length) return;

  const recipient = result.rows[0];
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient.email,
    subject,
    text: `${recipient.name}, ${body}`,
    html: `<p>Hello ${recipient.name},</p><p>${body}</p>`,
  });
};

export const createNotification = async (
  input: CreateNotificationInput
): Promise<Notification> => {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.userId,
      input.type,
      input.title,
      input.body,
      input.metadata ? JSON.stringify(input.metadata) : {},
    ]
  );

  const notification = result.rows[0] as Notification;

  try {
    await sendEmailNotification(input.userId, input.title, input.body);
  } catch {
    // Email delivery is best-effort; the in-app notification still exists.
  }

  return notification;
};

export const listNotifications = async (
  userId: string,
  filters: NotificationListFilters
): Promise<NotificationListResult> => {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;
  const unreadOnly = filters.unreadOnly ?? false;

  const where = ['user_id = $1'];
  const values: unknown[] = [userId];

  if (unreadOnly) {
    where.push('is_read = false');
  }

  const [rows, totalCount, unreadCount] = await Promise.all([
    pool.query(
      `SELECT *
       FROM notifications
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications WHERE ${where.join(' AND ')}`,
      values
    ),
    pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    ),
  ]);

  return {
    notifications: rows.rows as Notification[],
    total: parseInt(totalCount.rows[0].count, 10),
    unreadCount: parseInt(unreadCount.rows[0].count, 10),
  };
};

export const markNotificationRead = async (
  notificationId: string,
  userId: string
): Promise<void> => {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );

  if (!result.rows.length) {
    throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [userId]
  );
};

const loadGroupMembers = async (groupId: string, excludeUserId?: string) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
       AND gm.removed_at IS NULL
       AND u.deleted_at IS NULL
       ${excludeUserId ? 'AND u.id <> $2' : ''}
     ORDER BY u.name`,
    excludeUserId ? [groupId, excludeUserId] : [groupId]
  );

  return result.rows as Array<{ id: string; name: string; email: string }>;
};

export const notifyGroupInvite = async (
  groupId: string,
  actorId: string,
  inviteLink: string
): Promise<void> => {
  const groupResult = await pool.query(
    'SELECT name, currency FROM groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  if (!groupResult.rows.length) return;

  const members = await loadGroupMembers(groupId, actorId);
  await Promise.all(members.map((member) => createNotification({
    userId: member.id,
    type: 'group_invite',
    title: `Invite link created for ${groupResult.rows[0].name}`,
    body: `A new invite link was created for ${groupResult.rows[0].name}. Share this URL: ${inviteLink}`,
    metadata: {
      groupId,
      groupName: groupResult.rows[0].name,
      currency: groupResult.rows[0].currency,
      inviteLink,
      actorId,
    },
  })));
};

export const notifyExpenseEvent = async (
  groupId: string,
  actorId: string,
  action: 'created' | 'updated' | 'deleted',
  expense: { id: string; description: string; amount?: number; currency?: string }
): Promise<void> => {
  const groupResult = await pool.query(
    'SELECT name, currency FROM groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  if (!groupResult.rows.length) return;

  const members = await loadGroupMembers(groupId, actorId);
  const actionLabel = action === 'created' ? 'added' : action === 'updated' ? 'updated' : 'removed';

  await Promise.all(members.map((member) => createNotification({
    userId: member.id,
    type: 'expense_update',
    title: `Expense ${actionLabel} in ${groupResult.rows[0].name}`,
    body: `Expense "${expense.description}" was ${actionLabel} in ${groupResult.rows[0].name}.`,
    metadata: {
      groupId,
      groupName: groupResult.rows[0].name,
      expenseId: expense.id,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency || groupResult.rows[0].currency,
      action,
      actorId,
    },
  })));
};

export const notifySettlementRequired = async (
  groupId: string,
  actorId?: string
): Promise<void> => {
  const groupResult = await pool.query(
    'SELECT name, currency FROM groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  if (!groupResult.rows.length) return;

  const balances = await pool.query(
    `SELECT m.user_id, u.name, u.email,
            ROUND(COALESCE(p.total_paid, 0) - COALESCE(o.total_owed, 0), 2) AS balance
     FROM group_members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN (
       SELECT paid_by AS user_id, SUM(amount) AS total_paid
       FROM expenses
       WHERE group_id = $1 AND deleted_at IS NULL
       GROUP BY paid_by
     ) p ON p.user_id = m.user_id
     LEFT JOIN (
       SELECT es.user_id, SUM(es.amount) AS total_owed
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.group_id = $1 AND e.deleted_at IS NULL
       GROUP BY es.user_id
     ) o ON o.user_id = m.user_id
     WHERE m.group_id = $1
       AND m.removed_at IS NULL
       AND u.deleted_at IS NULL`,
    [groupId]
  );

  const recipients = balances.rows.filter((row) => Math.abs(parseFloat(row.balance)) > EPSILON);
  if (!recipients.length) return;

  await Promise.all(recipients.map((row) => {
    const balance = parseFloat(row.balance);
    const isDebtor = balance < 0;
    const body = isDebtor
      ? `You owe ${groupResult.rows[0].currency} ${formatAmount(Math.abs(balance))} in ${groupResult.rows[0].name}.`
      : `You are owed ${groupResult.rows[0].currency} ${formatAmount(balance)} in ${groupResult.rows[0].name}.`;

    return createNotification({
      userId: row.user_id,
      type: 'settlement_required',
      title: `Settlement required for ${groupResult.rows[0].name}`,
      body,
      metadata: {
        groupId,
        groupName: groupResult.rows[0].name,
        currency: groupResult.rows[0].currency,
        balance,
        actorId: actorId || null,
      },
    });
  }));
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  const result = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
};
