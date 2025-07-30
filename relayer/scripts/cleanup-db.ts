#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger';

const DB_PATH = './data/relayer.db';

async function cleanupDatabase() {
  logger.info('Starting database cleanup...');
  
  try {
    // Check if database file exists
    if (fs.existsSync(DB_PATH)) {
      // Remove the database file
      fs.unlinkSync(DB_PATH);
      logger.info('Database file removed successfully');
    } else {
      logger.info('Database file does not exist, nothing to remove');
    }
    
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info('Created data directory');
    }
    
    logger.info('Database cleanup completed successfully!');
    logger.info('Run "yarn migrate" to recreate the database with fresh tables');
    
  } catch (error) {
    logger.error('Failed to cleanup database:', error);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  cleanupDatabase().catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}

export { cleanupDatabase }; 