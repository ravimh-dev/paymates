import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from './index.ts';

async function seed() {
    console.log('[Seed] Starting database seeding process...');
    
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        // Check if data already exists
        const userCountRes = await query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(userCountRes.rows[0].count);
        
        if (userCount > 0) {
            console.log('[Seed] Database already has data. Skipping seeding to prevent duplicates.');
            return;
        }

        console.log('[Seed] Generating sample users...');
        const users = [
            { id: uuidv4(), name: 'Ravi Mahavadiya', email: 'ravi@example.com' },
            { id: uuidv4(), name: 'John Doe', email: 'john@example.com' },
            { id: uuidv4(), name: 'Jane Smith', email: 'jane@example.com' }
        ];

        for (const u of users) {
            await query(
                'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
                [u.id, u.name, u.email, hashedPassword]
            );
        }

        console.log(`[Seed] Inserted ${users.length} users.`);

        console.log('[Seed] Creating a sample group...');
        const groupId = uuidv4();
        await query(
            'INSERT INTO groups (id, name, description, created_by) VALUES ($1, $2, $3, $4)',
            [groupId, 'Manali Trip 2024', 'Splitting hotel and travel costs for our summer trip.', users[0].id]
        );

        console.log('[Seed] Adding members to the group...');
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const role = i === 0 ? 'Admin' : 'Member';
            await query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
                [groupId, u.id, role]
            );
        }

        console.log('[Seed] Adding sample expenses...');
        const expenses = [
            { id: uuidv4(), desc: 'Hotel Booking', amount: 5000, payer: users[0].id, cat: 'Stay' },
            { id: uuidv4(), desc: 'Dinner at Mall Road', amount: 1500, payer: users[1].id, cat: 'Food' }
        ];

        for (const exp of expenses) {
            await query(
                'INSERT INTO expenses (id, group_id, description, amount, payer_id, category) VALUES ($1, $2, $3, $4, $5, $6)',
                [exp.id, groupId, exp.desc, exp.amount, exp.payer, exp.cat]
            );
            
            // Equal split among all 3 members
            const splitAmount = exp.amount / users.length;
            for (const u of users) {
                await query(
                    'INSERT INTO expense_splits (id, expense_id, user_id, amount, split_type) VALUES ($1, $2, $3, $4, $5)',
                    [uuidv4(), exp.id, u.id, splitAmount, 'Equal']
                );
            }
        }


        console.log(`[Seed] Seeded ${expenses.length} expenses with splits.`);
        console.log('[Seed] Seeding process completed successfully!');
        
        // Close the pool after seeding if this is run as a standalone script
        // But since it might be imported elsewhere, we'll let it be.
        // Actually, seed scripts often end with process.exit(0)
        process.exit(0);
        
    } catch (error) {
        console.error('[Seed] Critical error during seeding:', error);
        process.exit(1);
    }
}

seed();

