export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export const GROUP_STATUS = {
  ACTIVE: 'active',
  SETTLING: 'settling',
  ARCHIVED: 'archived',
} as const;

export const SPLIT_TYPE = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  CUSTOM: 'custom',
} as const;

export const SETTLEMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const EXPENSE_CATEGORY = {
  FOOD: 'food',
  TRANSPORT: 'transport',
  ACCOMMODATION: 'accommodation',
  ENTERTAINMENT: 'entertainment',
  UTILITIES: 'utilities',
  SHOPPING: 'shopping',
  HEALTHCARE: 'healthcare',
  OTHER: 'other',
} as const;

export const CACHE_KEYS = {
  GROUP_BALANCES: (groupId: string) => `group:${groupId}:balances`,
  SETTLEMENT_PLAN: (groupId: string) => `group:${groupId}:settlement`,
  USER_GROUPS: (userId: string) => `user:${userId}:groups`,
  GROUP_SUMMARY: (groupId: string) => `group:${groupId}:summary`,
} as const;

export const EPSILON = 0.01; // Floating point tolerance for settlement
