import { v4 as uuidv4 } from 'uuid';
import { pool, withTransaction, cacheGet, cacheSet, cacheDel } from '../../db';
import { AppError } from '../../middlewares/error.middleware';
import { HTTP_STATUS, CACHE_KEYS, EPSILON } from '../../utils/constants';
import { computeSettlementPlan } from './settlements.algorithm';
import { getGroupBalances, getGroupMembership } from '../groups/groups.service';
import { notifySettlementRequired } from '../notifications/notifications.service';
import { buildSimplePdf } from '../../utils/simple-pdf';
import type {
  SettlementPlan, ExecuteSettlementInput,
  SettlementHistory, Settlement,
} from './settlements.type';

// ─── Settlement plan (read-only, cached) ─────────────────────────────────────

export const getSettlementPlan = async (groupId: string, userId?: string): Promise<SettlementPlan> => {
  const cached = await cacheGet<SettlementPlan>(CACHE_KEYS.SETTLEMENT_PLAN(groupId));
  if (cached) return cached;

  // Fetch group currency
  const groupResult = await pool.query(
    'SELECT currency FROM groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  if (!groupResult.rows.length) {
    throw new AppError('Group not found', HTTP_STATUS.NOT_FOUND);
  }

  if (userId) {
    await getGroupMembership(groupId, userId);
  }

  const balances = await getGroupBalances(groupId, userId);

  const rawBalances = balances.map((b) => ({
    userId: b.user_id,
    name: b.name,
    balance: b.balance,
    currency: groupResult.rows[0].currency,
  }));

  const transactions = computeSettlementPlan(rawBalances);
  const plan: SettlementPlan = {
    group_id: groupId,
    transactions,
    total_transactions: transactions.length,
    computed_at: new Date().toISOString(),
  };

  await cacheSet(CACHE_KEYS.SETTLEMENT_PLAN(groupId), plan, 120);
  return plan;
};

// ─── Execute a settlement ─────────────────────────────────────────────────────

export const executeSettlement = async (
  createdBy: string,
  input: ExecuteSettlementInput
): Promise<Settlement> => {
  const {
    group_id, from_user_id, to_user_id, amount,
    settlement_type = 'full', notes,
  } = input;

  // Idempotency: generate key if not provided
  const idempotency_key = input.idempotency_key || uuidv4();

  return withTransaction(async (client) => {
    await getGroupMembership(group_id, createdBy);

    // Check idempotency — prevent duplicate settlement
    const dupCheck = await client.query(
      'SELECT id FROM settlements WHERE idempotency_key = $1',
      [idempotency_key]
    );
    if (dupCheck.rows.length) {
      throw new AppError('Duplicate settlement: already recorded', HTTP_STATUS.CONFLICT);
    }

    // Validate both users are group members
    const memberCheck = await client.query(
      `SELECT user_id FROM group_members
       WHERE group_id = $1 AND user_id = ANY($2::uuid[]) AND removed_at IS NULL`,
      [group_id, [from_user_id, to_user_id]]
    );
    if (memberCheck.rows.length < 2) {
      throw new AppError('One or both users are not members of this group', HTTP_STATUS.BAD_REQUEST);
    }

    // Validate payer actually owes money
    const balances = await getGroupBalances(group_id);
    const payerBalance = balances.find((b) => b.user_id === from_user_id);

    if (!payerBalance || payerBalance.balance > -EPSILON) {
      throw new AppError(
        'Payer has no outstanding debt in this group',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (amount > Math.abs(payerBalance.balance) + EPSILON) {
      throw new AppError(
        `Settlement amount (${amount}) exceeds outstanding debt (${Math.abs(payerBalance.balance)})`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Insert settlement record
    const result = await client.query(
      `INSERT INTO settlements
         (group_id, from_user_id, to_user_id, amount, currency, status, settlement_type, idempotency_key, notes, settled_at, created_by)
       VALUES
         ($1, $2, $3, $4,
          (SELECT currency FROM groups WHERE id = $1),
          'completed', $5, $6, $7, NOW(), $8)
       RETURNING *`,
      [group_id, from_user_id, to_user_id, amount, settlement_type, idempotency_key, notes || null, createdBy]
    );

    // Mark relevant splits as settled
    await client.query(
      `UPDATE expense_splits es SET is_settled = true
       FROM expenses e
       WHERE es.expense_id = e.id
         AND e.group_id = $1
         AND es.user_id = $2
         AND es.is_settled = false`,
      [group_id, from_user_id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, new_values)
       VALUES ('settlement', $1, 'settle', $2, $3)`,
      [result.rows[0].id, createdBy, JSON.stringify(input)]
    );

    // Invalidate balance and plan caches
    await cacheDel(
      CACHE_KEYS.GROUP_BALANCES(group_id),
      CACHE_KEYS.SETTLEMENT_PLAN(group_id),
      CACHE_KEYS.GROUP_SUMMARY(group_id)
    );

    try {
      await notifySettlementRequired(group_id, createdBy);
    } catch {
      // Notification delivery is best-effort.
    }

    return result.rows[0];
  });
};

// ─── Settlement history ───────────────────────────────────────────────────────

export const getSettlementHistory = async (
  groupId: string,
  userId?: string,
  page = 1,
  limit = 20
): Promise<{ settlements: SettlementHistory[]; total: number }> => {
  const offset = (page - 1) * limit;

  if (userId) {
    await getGroupMembership(groupId, userId);
  }

  const [rows, countRow] = await Promise.all([
    pool.query(
      `SELECT
         s.*,
         uf.name as from_name, uf.email as from_email,
         ut.name as to_name,   ut.email as to_email
       FROM settlements s
       JOIN users uf ON uf.id = s.from_user_id
       JOIN users ut ON ut.id = s.to_user_id
       WHERE s.group_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    ),
    pool.query('SELECT COUNT(*) FROM settlements WHERE group_id = $1', [groupId]),
  ]);

  return {
    settlements: rows.rows,
    total: parseInt(countRow.rows[0].count),
  };
};

// ─── Cancel settlement ────────────────────────────────────────────────────────

export const cancelSettlement = async (
  settlementId: string,
  userId: string
): Promise<void> => {
  const result = await pool.query(
    `UPDATE settlements SET status = 'cancelled'
     WHERE id = $1 AND created_by = $2 AND status = 'pending'
     RETURNING group_id`,
    [settlementId, userId]
  );

  if (!result.rows.length) {
    throw new AppError('Settlement not found or cannot be cancelled', HTTP_STATUS.NOT_FOUND);
  }

  await cacheDel(
    CACHE_KEYS.GROUP_BALANCES(result.rows[0].group_id),
    CACHE_KEYS.SETTLEMENT_PLAN(result.rows[0].group_id)
  );
};

export const exportSettlementPdf = async (
  groupId: string,
  userId: string
): Promise<Buffer> => {
  await getGroupMembership(groupId, userId);

  const groupResult = await pool.query(
    'SELECT name, currency FROM groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  if (!groupResult.rows.length) {
    throw new AppError('Group not found', HTTP_STATUS.NOT_FOUND);
  }

  const balances = await getGroupBalances(groupId, userId);
  const plan = await getSettlementPlan(groupId, userId);
  const history = await getSettlementHistory(groupId, userId, 1, 10);

  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    'Expense Splitter Settlement Report',
    `Group: ${groupResult.rows[0].name}`,
    `Currency: ${groupResult.rows[0].currency}`,
    `Generated at: ${generatedAt}`,
    '',
    'Current balances:',
    ...balances.map((balance) => {
      const sign = balance.balance >= 0 ? 'creditor' : 'debtor';
      return `- ${balance.name}: ${groupResult.rows[0].currency} ${Math.abs(balance.balance).toFixed(2)} (${sign})`;
    }),
    '',
    `Settlement plan (${plan.total_transactions} transactions):`,
    ...(plan.transactions.length
      ? plan.transactions.map((transaction, index) =>
          `${index + 1}. ${transaction.from_name} pays ${transaction.to_name} ${transaction.currency} ${transaction.amount.toFixed(2)}`
        )
      : ['- No settlement required']),
    '',
    'Recent settlement history:',
    ...(history.settlements.length
      ? history.settlements.map((settlement, index) =>
          `${index + 1}. ${settlement.from_name} -> ${settlement.to_name} ${settlement.currency} ${Number(settlement.amount).toFixed(2)} (${settlement.status})`
        )
      : ['- No settlement history available']),
  ];

  return buildSimplePdf(lines);
};
