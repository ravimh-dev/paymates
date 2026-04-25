import app from './app.ts';
import dotenv from 'dotenv';
import { initDb } from './db/tableschema.ts';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000');

async function startServer() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

