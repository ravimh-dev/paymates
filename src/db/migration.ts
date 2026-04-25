import { initDb } from './tableschema.ts';

async function runMigration() {
    console.log('[Migration] Starting database migration process...');
    
    try {
        await initDb();
        console.log('[Migration] Migration successful! All tables are up to date.');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] Migration failed:', error);
        process.exit(1);
    }
}

runMigration();

