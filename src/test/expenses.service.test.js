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

const db = require('../../dist/db');
const { AppError } = require('../../dist/middlewares/error.middleware');
const { createExpense } = require('../../dist/modules/expenses/expenses.service');

const poolQuery = db.pool.query;
const withTransaction = db.withTransaction;
const cacheDel = db.cacheDel;

describe('expenses.service', () => {
  const mockPostTransactionQueries = (expenseRow, splitRows) => {
    poolQuery.mockImplementation((sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT name, currency FROM groups WHERE id = $1 AND deleted_at IS NULL')) {
        return Promise.resolve({ rows: [{ name: 'Trip', currency: 'INR' }] });
      }

      if (typeof sql === 'string' && sql.includes('FROM group_members gm JOIN users u ON u.id = gm.user_id')) {
        return Promise.resolve({
          rows: [
            { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
            { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
          ],
        });
      }

      if (typeof sql === 'string' && sql.includes('ROUND(COALESCE(p.total_paid, 0) - COALESCE(o.total_owed, 0), 2) AS balance')) {
        return Promise.resolve({
          rows: [
            { user_id: 'user-1', name: 'Alice', email: 'alice@example.com', balance: '500' },
            { user_id: 'user-2', name: 'Bob', email: 'bob@example.com', balance: '-500' },
          ],
        });
      }

      if (typeof sql === 'string' && sql.includes('INSERT INTO notifications')) {
        return Promise.resolve({ rows: [] });
      }

      if (typeof sql === 'string' && sql.includes('SELECT e.*, u.name as payer_name')) {
        return Promise.resolve({
          rows: [expenseRow],
        });
      }

      if (typeof sql === 'string' && sql.includes('FROM expense_splits es JOIN users u ON u.id = es.user_id')) {
        return Promise.resolve({
          rows: splitRows,
        });
      }

      return Promise.resolve({ rows: [] });
    });
  };

  beforeEach(() => {
    poolQuery.mockReset();
    withTransaction.mockReset();
    cacheDel.mockReset();
  });

  test('creates an equal split expense and returns the saved record', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }, { user_id: 'u2' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'expense-1', group_id: 'group-1', paid_by: 'paid-by-user' }],
        }),
    };

    mockPostTransactionQueries(
      {
        id: 'expense-1',
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Hotel Booking',
        amount: 2000,
        currency: 'INR',
        category: 'accommodation',
        split_type: 'equal',
        expense_date: new Date().toISOString(),
        notes: null,
        receipt_url: null,
        payer_name: 'Bob',
      },
      [
        {
          user_id: 'u1',
          name: 'Alice',
          email: 'alice@example.com',
          amount: '1000',
          percentage: null,
          is_settled: false,
        },
      ]
    );

    withTransaction.mockImplementation(async (fn) => fn(client));

    const result = await createExpense('creator-1', {
      group_id: 'group-1',
      paid_by: 'paid-by-user',
      description: 'Hotel Booking',
      amount: 2000,
      split_type: 'equal',
      participants: ['u1', 'u2'],
    });

    expect(result.id).toBe('expense-1');
    expect(client.query).toHaveBeenCalledWith(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = $2 AND removed_at IS NULL',
      ['group-1', 'paid-by-user']
    );
    expect(cacheDel).toHaveBeenCalledWith(
      'group:group-1:balances',
      'group:group-1:settlement',
      'group:group-1:summary'
    );
  });

  test('rejects a payer who is not a group member', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    withTransaction.mockImplementation(async (fn) => fn(client));

    await expect(
      createExpense('creator-1', {
        group_id: 'group-1',
        paid_by: 'outsider-user',
        description: 'Dinner',
        amount: 500,
        split_type: 'equal',
        participants: ['u1', 'u2'],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Payer is not a member of this group',
    });
  });

  test('rejects percentage splits that do not sum to 100', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] }),
    };

    withTransaction.mockImplementation(async (fn) => fn(client));

    await expect(
      createExpense('creator-1', {
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Taxi',
        amount: 1000,
        split_type: 'percentage',
        splits: [
          { user_id: 'u1', percentage: 40 },
          { user_id: 'u2', percentage: 40 },
        ],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Percentages must sum to 100'),
    });
  });

  test('rejects custom splits that do not equal the expense amount', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] }),
    };

    withTransaction.mockImplementation(async (fn) => fn(client));

    await expect(
      createExpense('creator-1', {
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Shared ride',
        amount: 1000,
        split_type: 'custom',
        splits: [
          { user_id: 'u1', amount: 400 },
          { user_id: 'u2', amount: 400 },
        ],
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  test('rejects an invalid split type immediately', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] }),
    };

    withTransaction.mockImplementation(async (fn) => fn(client));

    await expect(
      createExpense('creator-1', {
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Mystery charge',
        amount: 500,
        split_type: 'something-else',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid split type',
    });
  });

  test('rejects percentage splits when no split rows are provided', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] }),
    };

    withTransaction.mockImplementation(async (fn) => fn(client));

    await expect(
      createExpense('creator-1', {
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Percentage missing',
        amount: 1000,
        split_type: 'percentage',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Splits required for percentage type',
    });
  });

  test('rejects custom splits when no split rows are provided', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] }),
    };

    withTransaction.mockImplementation(async (fn) => fn(client));

    await expect(
      createExpense('creator-1', {
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Custom missing',
        amount: 1000,
        split_type: 'custom',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Splits required for custom type',
    });
  });

  test('uses all members when equal split has no participants', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'paid-by-user' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'expense-2', group_id: 'group-1', paid_by: 'paid-by-user' }],
        }),
    };

    mockPostTransactionQueries(
      {
        id: 'expense-2',
        group_id: 'group-1',
        paid_by: 'paid-by-user',
        description: 'Hotel',
        amount: 1000,
        currency: 'INR',
        category: 'other',
        split_type: 'equal',
        expense_date: new Date().toISOString(),
        notes: null,
        receipt_url: null,
        payer_name: 'Bob',
      },
      [
        {
          user_id: 'u1',
          name: 'Alice',
          email: 'alice@example.com',
          amount: '333.33',
          percentage: null,
          is_settled: false,
        },
      ]
    );

    withTransaction.mockImplementation(async (fn) => fn(client));

    const result = await createExpense('creator-1', {
      group_id: 'group-1',
      paid_by: 'paid-by-user',
      description: 'Hotel',
      amount: 1000,
      split_type: 'equal',
    });

    expect(result.id).toBe('expense-2');
    expect(client.query).toHaveBeenCalledWith(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND removed_at IS NULL',
      ['group-1']
    );
  });
});
