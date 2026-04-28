import 'dotenv/config';
import pino from 'pino';
import app from './app';
import { connectDB, connectRedis } from '../db';

const logger = pino({
  name: 'server',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const PORT = parseInt(process.env.PORT || '3000');

const bootstrap = async (): Promise<void> => {
  try {
    // Connect to PostgreSQL
    await connectDB();
    logger.info('✓ PostgreSQL connected');

    // Connect to Redis
    await connectRedis();
    logger.info('✓ Redis connected');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`✓ Server running on http://localhost:${PORT}`);
      logger.info(`  Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`  API base    : http://localhost:${PORT}/api`);
      logger.info(`  Health      : http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled promise rejection');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught exception — exiting');
      process.exit(1);
    });

  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
};

bootstrap();
