import { query } from './index.ts';

const checkTableExists = async (tableName: string) => {
  const res = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  return res.rows[0].exists;
};


export const initDb = async () => {
  console.log('[DB] Initializing database schema...');

  const tables = [
    {
      name: 'users',
      query: `
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'Member',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMPTZ
        )
      `
    },
    {
      name: 'groups',
      query: `
        CREATE TABLE groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_by TEXT NOT NULL,
          status TEXT DEFAULT 'Active',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `
    },
    {
      name: 'group_members',
      query: `
        CREATE TABLE group_members (
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT DEFAULT 'Member',
          joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (group_id, user_id),
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `
    },
    {
      name: 'expenses',
      query: `
        CREATE TABLE expenses (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          description TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          payer_id TEXT NOT NULL,
          category TEXT,
          currency TEXT DEFAULT 'INR',
          expense_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (payer_id) REFERENCES users(id)
        )
      `
    },
    {
      name: 'expense_splits',
      query: `
        CREATE TABLE expense_splits (
          id TEXT PRIMARY KEY,
          expense_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          percentage DECIMAL(5,2),
          split_type TEXT NOT NULL,
          FOREIGN KEY (expense_id) REFERENCES expenses(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `
    },
    {
      name: 'settlements',
      query: `
        CREATE TABLE settlements (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          payer_id TEXT NOT NULL,
          payee_id TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          status TEXT DEFAULT 'Pending',
          settled_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (payer_id) REFERENCES users(id),
          FOREIGN KEY (payee_id) REFERENCES users(id)
        )
      `
    },
    {
      name: 'audit_logs',
      query: `
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          metadata TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `
    }
  ];

  try {
    for (const table of tables) {
      const exists = await checkTableExists(table.name);
      if (exists) {
        console.log(`[DB] Table "${table.name}" already exists.`);
      } else {
        console.log(`[DB] Creating table "${table.name}"...`);
        await query(table.query);
        console.log(`[DB] Table "${table.name}" created successfully.`);
      }

    }
    console.log('[DB] Database schema initialization complete.');
  } catch (error) {
    console.error('[DB] Error initializing database schema:', error);
    throw error;
  }
};

