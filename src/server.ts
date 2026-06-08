import 'dotenv/config';
import { env } from './config/env';
import { buildContainer } from './config/container';
import { createApp } from './app';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  const container = buildContainer();
  const app = createApp(container);

  const server = app.listen(env.PORT, () => {
    logger.info(`Сервер запущено: http://localhost:${env.PORT}`);
    logger.info(`Health-check:    http://localhost:${env.PORT}/healthz`);
    logger.info(`API префікс:     http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Отримано ${signal} — graceful shutdown...`);
    server.close(() => {
      logger.info('Сервер закрито.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Помилка запуску');
  process.exit(1);
});
