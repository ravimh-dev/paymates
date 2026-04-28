import crypto from 'crypto';
import { pool, withTransaction, cacheGet, cacheSet, cacheDel } from '../../db';
import { AppError } from '../../middlewares/error.middleware';
import { HTTP_STATUS, CACHE_KEYS } from '../../utils/constants';
import { notifyGroupInvite } from '../notifications/notifications.service';
import type {
  Group, CreateGroupInput, UpdateGroupInput, GroupSummary,
  MemberBalance, AddMemberInput,
} from './groups.type';

// ─── Group CRUD ───────────────────────────────────────────────────────────────

export const getGroupMembership = async (groupId: string, userId: string) => {
  const result = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND removed_at IS NULL',
    [groupId, userId]
  );

  if (!result.rows.length) {
    throw new AppError('Group not found or access denied', HTTP_STATUS.NOT_FOUND);
  }

  return result.rows[0] as { role: string };
};

export const createGroup = async (
  userId: string,
  input: CreateGroupInput
): Promise<Group> => {
  const result = await pool.query(
    `INSERT INTO groups (name, description, currency, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.description || null, input.currency || 'INR', userId]
  );

  const group = result.rows[0];

  // Creator becomes admin
  await pool.query(
    'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
    [group.id, userId, 'admin']
  );

  await cacheDel(CACHE_KEYS.USER_GROUPS(userId));
  return group;
};

export const getGroupById = async (groupId: string, userId: string): Promise<GroupSummary> => {
  const cached = await cacheGet<GroupSummary>(CACHE_KEYS.GROUP_SUMMARY(groupId));
  if (cached) return cached;

  await getGroupMembership(groupId, userId);

  const groupResult = await pool.query(
    'SELECT * FROM groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  if (!groupResult.rows.length) {
    throw new AppError('Group not found', HTTP_STATUS.NOT_FOUND);
  }

  const membersResult = await pool.query(
    `SELECT u.id as user_id, u.name, u.email, u.avatar_url, gm.role, gm.joined_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND gm.removed_at IS NULL
     ORDER BY gm.joined_at`,
    [groupId]
  );

  const totalResult = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE group_id = $1 AND deleted_at IS NULL',
    [groupId]
  );

  const summary: GroupSummary = {
    ...groupResult.rows[0],
    members: membersResult.rows,
    member_count: membersResult.rows.length,
    total_expenses: parseFloat(totalResult.rows[0].total),
    settlement_status: 'pending',
  };

  await cacheSet(CACHE_KEYS.GROUP_SUMMARY(groupId), summary, 300); // 5 min TTL
  return summary;
};

export const getUserGroups = async (userId: string): Promise<Group[]> => {
  const cached = await cacheGet<Group[]>(CACHE_KEYS.USER_GROUPS(userId));
  if (cached) return cached;

  const result = await pool.query(
    `SELECT g.*, gm.role as user_role,
            COUNT(DISTINCT gm2.user_id) FILTER (WHERE gm2.removed_at IS NULL) as member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1 AND gm.removed_at IS NULL
     LEFT JOIN group_members gm2 ON gm2.group_id = g.id
     WHERE g.deleted_at IS NULL
     GROUP BY g.id, gm.role
     ORDER BY g.created_at DESC`,
    [userId]
  );

  await cacheSet(CACHE_KEYS.USER_GROUPS(userId), result.rows, 300);
  return result.rows;
};

export const updateGroup = async (
  groupId: string,
  input: UpdateGroupInput
): Promise<Group> => {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
  if (input.description !== undefined) { fields.push(`description = $${idx++}`); values.push(input.description); }
  if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

  if (!fields.length) throw new AppError('No fields to update', HTTP_STATUS.BAD_REQUEST);

  values.push(groupId);
  const result = await pool.query(
    `UPDATE groups SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
    values
  );

  if (!result.rows.length) throw new AppError('Group not found', HTTP_STATUS.NOT_FOUND);

  await cacheDel(CACHE_KEYS.GROUP_SUMMARY(groupId));
  return result.rows[0];
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  // Check for unsettled balances
  const balances = await getGroupBalances(groupId);
  const hasBalance = balances.some((b) => Math.abs(b.balance) > 0.01);
  if (hasBalance) {
    throw new AppError(
      'Cannot delete group with outstanding balances. Settle all debts first.',
      HTTP_STATUS.CONFLICT
    );
  }

  await pool.query('UPDATE groups SET deleted_at = NOW() WHERE id = $1', [groupId]);
  await cacheDel(
    CACHE_KEYS.GROUP_SUMMARY(groupId),
    CACHE_KEYS.GROUP_BALANCES(groupId),
    CACHE_KEYS.SETTLEMENT_PLAN(groupId)
  );
};

// ─── Member management ────────────────────────────────────────────────────────

export const addMember = async (groupId: string, input: AddMemberInput): Promise<void> => {
  const userResult = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [input.email]
  );
  if (!userResult.rows.length) {
    throw new AppError('User with this email not found', HTTP_STATUS.NOT_FOUND);
  }

  const userId = userResult.rows[0].id;

  // Re-add if previously removed
  await pool.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id)
     DO UPDATE SET removed_at = NULL, role = $3`,
    [groupId, userId, input.role || 'member']
  );

  await cacheDel(CACHE_KEYS.GROUP_SUMMARY(groupId), CACHE_KEYS.USER_GROUPS(userId));
};

export const removeMember = async (
  groupId: string,
  targetUserId: string
): Promise<void> => {
  // Check for outstanding balances for this user
  const balances = await getGroupBalances(groupId);
  const userBalance = balances.find((b) => b.user_id === targetUserId);
  if (userBalance && Math.abs(userBalance.balance) > 0.01) {
    throw new AppError('Cannot remove member with outstanding balance', HTTP_STATUS.CONFLICT);
  }

  await pool.query(
    'UPDATE group_members SET removed_at = NOW() WHERE group_id = $1 AND user_id = $2',
    [groupId, targetUserId]
  );

  await cacheDel(
    CACHE_KEYS.GROUP_SUMMARY(groupId),
    CACHE_KEYS.USER_GROUPS(targetUserId),
    CACHE_KEYS.GROUP_BALANCES(groupId)
  );
};

// ─── Balance computation ──────────────────────────────────────────────────────

export const getGroupBalances = async (groupId: string, userId?: string): Promise<MemberBalance[]> => {
  const cached = await cacheGet<MemberBalance[]>(CACHE_KEYS.GROUP_BALANCES(groupId));
  if (cached) return cached;

  if (userId) {
    await getGroupMembership(groupId, userId);
  }

  /**
   * Balance = total_paid - total_owed
   * total_paid = sum of expenses paid by this user
   * total_owed = sum of their splits across all group expenses
   */
  const result = await pool.query(
    `WITH paid AS (
       SELECT paid_by as user_id, COALESCE(SUM(amount), 0) as total_paid
       FROM expenses
       WHERE group_id = $1 AND deleted_at IS NULL
       GROUP BY paid_by
     ),
     owed AS (
       SELECT es.user_id, COALESCE(SUM(es.amount), 0) as total_owed
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.group_id = $1 AND e.deleted_at IS NULL
       GROUP BY es.user_id
     ),
     members AS (
       SELECT u.id as user_id, u.name, u.email
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.removed_at IS NULL
     )
     SELECT
       m.user_id,
       m.name,
       m.email,
       ROUND(
         COALESCE(p.total_paid, 0) - COALESCE(o.total_owed, 0),
         2
       ) as balance
     FROM members m
     LEFT JOIN paid p ON p.user_id = m.user_id
     LEFT JOIN owed o ON o.user_id = m.user_id
     ORDER BY balance DESC`,
    [groupId]
  );

  const balances: MemberBalance[] = result.rows.map((r) => ({
    ...r,
    balance: parseFloat(r.balance),
  }));

  await cacheSet(CACHE_KEYS.GROUP_BALANCES(groupId), balances, 120);
  return balances;
};

// ─── Invite token ─────────────────────────────────────────────────────────────

export const generateInviteLink = async (groupId: string, generatedBy?: string): Promise<string> => {
  const token = crypto.randomBytes(16).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await pool.query(
    'UPDATE groups SET invite_token = $1, invite_expires = $2 WHERE id = $3',
    [token, expires, groupId]
  );

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const link = `${baseUrl}/groups/join/${token}`;

  if (generatedBy) {
    try {
      await notifyGroupInvite(groupId, generatedBy, link);
    } catch {
      // Invite notification is best-effort.
    }
  }

  return link;
};

export const joinByInvite = async (token: string, userId: string): Promise<void> => {
  const result = await pool.query(
    `SELECT id FROM groups
     WHERE invite_token = $1 AND invite_expires > NOW() AND deleted_at IS NULL`,
    [token]
  );

  if (!result.rows.length) {
    throw new AppError('Invalid or expired invite link', HTTP_STATUS.BAD_REQUEST);
  }

  const groupId = result.rows[0].id;

  await pool.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (group_id, user_id) DO UPDATE SET removed_at = NULL`,
    [groupId, userId]
  );

  await cacheDel(CACHE_KEYS.GROUP_SUMMARY(groupId), CACHE_KEYS.USER_GROUPS(userId));
};
