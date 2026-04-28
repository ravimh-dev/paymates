import { pool, withTransaction, cacheDel } from '../../db';
import { AppError } from '../../middlewares/error.middleware';
import { HTTP_STATUS, EPSILON, CACHE_KEYS } from '../../utils/constants';
import { getGroupMembership } from '../groups/groups.service';
import { notifyExpenseEvent, notifySettlementRequired } from '../notifications/notifications.service';
import type {
  CreateExpenseInput, UpdateExpenseInput, ExpenseFilters,
  ExpenseWithSplits, SplitInput,
} from './expenses.type';

// ─── Split computation ────────────────────────────────────────────────────────

interface ComputedSplit {
  user_id: string;
  amount: number;
  percentage?: number;
}

const computeSplits = (
  splitType: string,
  totalAmount: number,
  participants: string[],
  splits?: SplitInput[]
): ComputedSplit[] => {

  if (splitType === 'equal') {
    const base = Math.floor((totalAmount / participants.length) * 100) / 100;
    const remainder = Math.round((totalAmount - base * participants.length) * 100) / 100;
    return participants.map((uid, i) => ({
      user_id: uid,
      amount: i === participants.length - 1 ? base + remainder : base,
    }));
  }

  if (splitType === 'percentage') {
    if (!splits?.length) throw new AppError('Splits required for percentage type', HTTP_STATUS.BAD_REQUEST);
    const totalPct = splits.reduce((s, x) => s + (x.percentage || 0), 0);
    if (Math.abs(totalPct - 100) > EPSILON) {
      throw new AppError(`Percentages must sum to 100 (got ${totalPct})`, HTTP_STATUS.BAD_REQUEST);
    }
    const computed: ComputedSplit[] = splits.map((s, i) => ({
      user_id: s.user_id,
      percentage: s.percentage,
      amount: Math.floor(((s.percentage! / 100) * totalAmount) * 100) / 100,
    }));
    // Rounding: adjust last entry
    const computed_sum = computed.reduce((s, x) => s + x.amount, 0);
    computed[computed.length - 1].amount += Math.round((totalAmount - computed_sum) * 100) / 100;
    return computed;
  }

  if (splitType === 'custom') {
    if (!splits?.length) throw new AppError('Splits required for custom type', HTTP_STATUS.BAD_REQUEST);
    const totalSplit = splits.reduce((s, x) => s + (x.amount || 0), 0);
    if (Math.abs(totalSplit - totalAmount) > EPSILON) {
      throw new AppError(
        `Custom split total (${totalSplit}) must equal expense amount (${totalAmount})`,
        HTTP_STATUS.BAD_REQUEST
      );
    }
    return splits.map((s) => ({ user_id: s.user_id, amount: s.amount! }));
  }

  throw new AppError('Invalid split type', HTTP_STATUS.BAD_REQUEST);
};

// ─── Service methods ──────────────────────────────────────────────────────────

export const createExpense = async (
  createdBy: string,
  input: CreateExpenseInput
): Promise<ExpenseWithSplits> => {
  return withTransaction(async (client) => {
    const creatorMembership = await client.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = $2 AND removed_at IS NULL',
      [input.group_id, createdBy]
    );
    if (!creatorMembership.rows.length) {
      throw new AppError('You are not a member of this group', HTTP_STATUS.FORBIDDEN);
    }

    // Validate payer is a group member
    const memberCheck = await client.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = $2 AND removed_at IS NULL',
      [input.group_id, input.paid_by]
    );
    if (!memberCheck.rows.length) {
      throw new AppError('Payer is not a member of this group', HTTP_STATUS.BAD_REQUEST);
    }

    // Determine participants for equal split
    let participants = input.participants;
    if (input.split_type === 'equal' && !participants?.length) {
      const allMembers = await client.query(
        'SELECT user_id FROM group_members WHERE group_id = $1 AND removed_at IS NULL',
        [input.group_id]
      );
      participants = allMembers.rows.map((r: { user_id: string }) => r.user_id);
    }

    const computedSplits = computeSplits(
      input.split_type,
      input.amount,
      participants || [],
      input.splits
    );

    // Insert expense
    const expResult = await client.query(
      `INSERT INTO expenses
         (group_id, paid_by, description, amount, currency, category, split_type, expense_date, notes, receipt_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        input.group_id, input.paid_by, input.description, input.amount,
        input.currency || 'INR', input.category || 'other', input.split_type,
        input.expense_date || new Date(), input.notes || null, input.receipt_url || null, createdBy,
      ]
    );

    const expense = expResult.rows[0];

    // Insert splits
    for (const split of computedSplits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1,$2,$3,$4)',
        [expense.id, split.user_id, split.amount, split.percentage || null]
      );
    }

    // Invalidate relevant caches
    await cacheDel(
      CACHE_KEYS.GROUP_BALANCES(input.group_id),
      CACHE_KEYS.SETTLEMENT_PLAN(input.group_id),
      CACHE_KEYS.GROUP_SUMMARY(input.group_id)
    );

    try {
      await Promise.all([
        notifyExpenseEvent(input.group_id, createdBy, 'created', {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency,
        }),
        notifySettlementRequired(input.group_id, createdBy),
      ]);
    } catch {
      // Notifications are best-effort and should not block the expense write.
    }

    return getExpenseById(expense.id);
  });
};

export const getExpenseById = async (expenseId: string, requesterId?: string): Promise<ExpenseWithSplits> => {
  const expResult = await pool.query(
    `SELECT e.*, u.name as payer_name
     FROM expenses e JOIN users u ON u.id = e.paid_by
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [expenseId]
  );
  if (!expResult.rows.length) throw new AppError('Expense not found', HTTP_STATUS.NOT_FOUND);

  if (requesterId) {
    await getGroupMembership(expResult.rows[0].group_id, requesterId);
  }

  const splitsResult = await pool.query(
    `SELECT es.user_id, u.name, u.email, es.amount, es.percentage, es.is_settled
     FROM expense_splits es JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = $1 ORDER BY u.name`,
    [expenseId]
  );

  return { ...expResult.rows[0], splits: splitsResult.rows };
};

export const listExpenses = async (
  filters: ExpenseFilters,
  requesterId?: string
): Promise<{ expenses: ExpenseWithSplits[]; total: number }> => {
  const { groupId, category, paidBy, dateFrom, dateTo } = filters;
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  if (requesterId) {
    await getGroupMembership(groupId, requesterId);
  }

  const conditions: string[] = ['e.group_id = $1', 'e.deleted_at IS NULL'];
  const values: unknown[] = [groupId];
  let idx = 2;

  if (category) { conditions.push(`e.category = $${idx++}`); values.push(category); }
  if (paidBy) { conditions.push(`e.paid_by = $${idx++}`); values.push(paidBy); }
  if (dateFrom) { conditions.push(`e.expense_date >= $${idx++}`); values.push(dateFrom); }
  if (dateTo) { conditions.push(`e.expense_date <= $${idx++}`); values.push(dateTo); }

  const where = conditions.join(' AND ');

  const [expRows, countRow] = await Promise.all([
    pool.query(
      `SELECT e.*, u.name as payer_name
       FROM expenses e JOIN users u ON u.id = e.paid_by
       WHERE ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM expenses e WHERE ${where}`, values),
  ]);

  // Attach splits for each expense
  const expenses = await Promise.all(
    expRows.rows.map((e: { id: string }) => getExpenseById(e.id, requesterId))
  );

  return { expenses, total: parseInt(countRow.rows[0].count) };
};

export const updateExpense = async (
  expenseId: string,
  input: UpdateExpenseInput,
  requesterId?: string
): Promise<ExpenseWithSplits> => {
  const current = await getExpenseById(expenseId, requesterId);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.description !== undefined) { fields.push(`description = $${idx++}`); values.push(input.description); }
  if (input.category !== undefined) { fields.push(`category = $${idx++}`); values.push(input.category); }
  if (input.expense_date !== undefined) { fields.push(`expense_date = $${idx++}`); values.push(input.expense_date); }
  if (input.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(input.notes); }

  if (fields.length) {
    values.push(expenseId);
    await pool.query(
      `UPDATE expenses SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
  }

  await cacheDel(
    CACHE_KEYS.GROUP_BALANCES(current.group_id),
    CACHE_KEYS.SETTLEMENT_PLAN(current.group_id)
  );

  try {
    await Promise.all([
      notifyExpenseEvent(current.group_id, requesterId || '', 'updated', {
        id: expenseId,
        description: current.description,
        currency: current.currency,
      }),
      notifySettlementRequired(current.group_id, requesterId),
    ]);
  } catch {
    // Best-effort notifications only.
  }

  return getExpenseById(expenseId);
};

export const deleteExpense = async (expenseId: string, requesterId?: string): Promise<void> => {
  const expense = await getExpenseById(expenseId, requesterId);

  await pool.query(
    'UPDATE expenses SET deleted_at = NOW() WHERE id = $1',
    [expenseId]
  );

  await cacheDel(
    CACHE_KEYS.GROUP_BALANCES(expense.group_id),
    CACHE_KEYS.SETTLEMENT_PLAN(expense.group_id),
    CACHE_KEYS.GROUP_SUMMARY(expense.group_id)
  );

  try {
    await Promise.all([
      notifyExpenseEvent(expense.group_id, requesterId || '', 'deleted', {
        id: expense.id,
        description: expense.description,
        currency: expense.currency,
      }),
      notifySettlementRequired(expense.group_id, requesterId),
    ]);
  } catch {
    // Best-effort notifications only.
  }
};
