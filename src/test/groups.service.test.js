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
const {
  createGroup,
  getGroupById,
  getGroupBalances,
  getUserGroups,
  addMember,
  removeMember,
  joinByInvite,
  updateGroup,
  deleteGroup,
} = require('../../dist/modules/groups/groups.service');

const poolQuery = db.pool.query;
const cacheGet = db.cacheGet;
const cacheSet = db.cacheSet;
const cacheDel = db.cacheDel;

describe('groups.service', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    cacheGet.mockReset();
    cacheSet.mockReset();
    cacheDel.mockReset();
  });

  test('returns cached groups without querying the database', async () => {
    const cached = [{ id: 'g1', name: 'Cached Group' }];
    cacheGet.mockResolvedValue(cached);

    const result = await getUserGroups('u1');

    expect(result).toEqual(cached);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('creates a group and adds the creator as admin', async () => {
    poolQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'group-1',
          name: 'Goa Trip 2024',
          description: 'Beach vacation expense split',
          currency: 'INR',
          created_by: 'user-1',
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await createGroup('user-1', {
      name: 'Goa Trip 2024',
      description: 'Beach vacation expense split',
      currency: 'INR',
    });

    expect(result.id).toBe('group-1');
    expect(poolQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO groups'),
      ['Goa Trip 2024', 'Beach vacation expense split', 'INR', 'user-1']
    );
    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      ['group-1', 'user-1', 'admin']
    );
    expect(cacheDel).toHaveBeenCalledWith('user:user-1:groups');
  });

  test('returns a cached group summary without hitting the database', async () => {
    const cachedSummary = { id: 'group-1', name: 'Cached Summary', members: [], member_count: 0 };
    cacheGet.mockResolvedValue(cachedSummary);

    const result = await getGroupById('group-1', 'user-1');

    expect(result).toEqual(cachedSummary);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('throws when a non-member requests group details', async () => {
    cacheGet.mockResolvedValue(null);
    poolQuery.mockResolvedValueOnce({ rows: [] });

    const promise = getGroupById('group-1', 'user-1');

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 404,
      message: 'Group not found or access denied',
    });
  });

  test('loads balances for active members', async () => {
    cacheGet.mockResolvedValue(null);
    poolQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'u1', name: 'Alice', email: 'alice@example.com', balance: '250.50' },
        { user_id: 'u2', name: 'Bob', email: 'bob@example.com', balance: '-250.50' },
      ],
    });

    const balances = await getGroupBalances('group-1');

    expect(balances).toEqual([
      { user_id: 'u1', name: 'Alice', email: 'alice@example.com', balance: 250.5 },
      { user_id: 'u2', name: 'Bob', email: 'bob@example.com', balance: -250.5 },
    ]);
    expect(cacheSet).toHaveBeenCalledWith('group:group-1:balances', expect.any(Array), 120);
  });

  test('re-adds a removed member using upsert semantics', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-2' }] })
      .mockResolvedValueOnce({ rows: [] });

    await addMember('group-1', { email: 'bob@example.com', role: 'viewer' });

    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ON CONFLICT (group_id, user_id)'),
      ['group-1', 'user-2', 'viewer']
    );
  });

  test('rejects adding a member when the email does not exist', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await expect(addMember('group-1', { email: 'missing@example.com' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'User with this email not found',
    });
  });

  test('blocks removal when balance is not settled', async () => {
    cacheGet.mockResolvedValue(null);
    poolQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'user-2', name: 'Bob', email: 'bob@example.com', balance: -10 },
      ],
    });

    await expect(removeMember('group-1', 'user-2')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Cannot remove member with outstanding balance',
    });
  });

  test('accepts a valid invite token and adds the user to the group', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'group-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await joinByInvite('invite-token', 'user-2');

    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO group_members'),
      ['group-1', 'user-2']
    );
  });

  test('rejects an expired invite token', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await expect(joinByInvite('expired-token', 'user-2')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired invite link',
    });
  });

  test('rejects updateGroup when no fields are provided', async () => {
    await expect(updateGroup('group-1', {})).rejects.toMatchObject({
      statusCode: 400,
      message: 'No fields to update',
    });
  });

  test('blocks group deletion when balances are outstanding', async () => {
    cacheGet.mockResolvedValue(null);
    poolQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'u1', name: 'Alice', email: 'alice@example.com', balance: '5' },
      ],
    });

    await expect(deleteGroup('group-1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Cannot delete group with outstanding balances. Settle all debts first.',
    });
  });
});
