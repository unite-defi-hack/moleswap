import knex from 'knex';
import { logger } from '../utils/logger';

// Database configuration
const config: Record<string, any> = {
  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/database/migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
  development: {
    client: 'sqlite3',
    connection: {
      filename: './data/relayer.db',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/database/migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
  production: {
    client: 'sqlite3',
    connection: {
      filename: process.env['DATABASE_PATH'] || './data/relayer.db',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/database/migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
};

const environment = process.env['NODE_ENV'] || 'development';
const dbConfig = config[environment];

if (!dbConfig) {
  throw new Error(`Database configuration not found for environment: ${environment}`);
}

export const db = knex(dbConfig);

export async function initializeDatabase(): Promise<void> {
  try {
    // Test the connection
    await db.raw('SELECT 1');
    logger.info('Database connection established successfully');
    
    // Run migrations if not in test environment (tests handle their own setup)
    if (process.env['NODE_ENV'] !== 'test') {
      await db.migrate.latest();
      logger.info('Database migrations completed');
    }
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  try {
    await db.migrate.latest();
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await db.destroy();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
} 