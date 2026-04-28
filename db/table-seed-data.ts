import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from './index';
import pino from 'pino';

const logger = pino({ name: 'db:seed' });
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── Users ───────────────────────────────────────────────────────────────
    const passwords = await Promise.all([
      bcrypt.hash('Password@123', ROUNDS),
      bcrypt.hash('Password@123', ROUNDS),
      bcrypt.hash('Password@123', ROUNDS),
      bcrypt.hash('Password@123', ROUNDS),
    ]);

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, email_verified, currency)
       VALUES
         ('Alice Sharma', 'alice@example.com', $1, true, 'INR'),
         ('Bob Verma',    'bob@example.com',   $2, true, 'INR'),
         ('Carol Singh',  'carol@example.com', $3, true, 'INR'),
         ('Dave Patel',   'dave@example.com',  $4, true, 'INR')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name`,
      passwords
    );

    const users = userResult.rows;
    if (users.length < 4) {
      logger.info('Seed users already exist, skipping');
      await client.query('ROLLBACK');
      return;
    }

    const [alice, bob, carol, dave] = users;

    // ─── Group ────────────────────────────────────────────────────────────────
    const groupResult = await client.query(
      `INSERT INTO groups (name, description, currency, created_by)
       VALUES ('Goa Trip 2024', 'Beach vacation expense split', 'INR', $1)
       RETURNING id`,
      [alice.id]
    );
    const groupId = groupResult.rows[0].id;

    // ─── Members ─────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES
         ($1, $2, 'admin'),
         ($1, $3, 'member'),
         ($1, $4, 'member'),
         ($1, $5, 'member')`,
      [groupId, alice.id, bob.id, carol.id, dave.id]
    );

    // ─── Expenses ─────────────────────────────────────────────────────────────
    // Expense 1: Alice paid ₹4000 for hotel (equal split among 4)
    const exp1 = await client.query(
      `INSERT INTO expenses (group_id, paid_by, description, amount, category, split_type, created_by)
       VALUES ($1, $2, 'Hotel Booking - 2 nights', 4000, 'accommodation', 'equal', $2)
       RETURNING id`,
      [groupId, alice.id]
    );
    const splitAmt1 = 1000.00;
    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
         ($1, $2, $3), ($1, $4, $3), ($1, $5, $3), ($1, $6, $3)`,
      [exp1.rows[0].id, alice.id, splitAmt1, bob.id, carol.id, dave.id]
    );

    // Expense 2: Bob paid ₹2400 for food (equal split)
    const exp2 = await client.query(
      `INSERT INTO expenses (group_id, paid_by, description, amount, category, split_type, created_by)
       VALUES ($1, $2, 'Beach Shack Dinner', 2400, 'food', 'equal', $2)
       RETURNING id`,
      [groupId, bob.id]
    );
    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
         ($1, $2, 600), ($1, $3, 600), ($1, $4, 600), ($1, $5, 600)`,
      [exp2.rows[0].id, alice.id, bob.id, carol.id, dave.id]
    );

    // Expense 3: Carol paid ₹1500 for transport (custom split)
    const exp3 = await client.query(
      `INSERT INTO expenses (group_id, paid_by, description, amount, category, split_type, created_by)
       VALUES ($1, $2, 'Taxi from Airport', 1500, 'transport', 'custom', $2)
       RETURNING id`,
      [groupId, carol.id]
    );
    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
         ($1, $2, 500), ($1, $3, 500), ($1, $4, 250), ($1, $5, 250)`,
      [exp3.rows[0].id, alice.id, bob.id, carol.id, dave.id]
    );

    await client.query('COMMIT');
    logger.info('Seed data inserted successfully');
    logger.info(`
    ─── Seed Summary ───
    Users: alice, bob, carol, dave (Password@123)
    Group: Goa Trip 2024 (ID: ${groupId})
    Expenses: Hotel ₹4000 | Dinner ₹2400 | Taxi ₹1500
    ────────────────────
    `);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Seed failed');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
