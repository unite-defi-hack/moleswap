// Set test environment
process.env['NODE_ENV'] = 'test';

// Import database connection
import { initializeDatabase, closeDatabase, runMigrations } from './database/connection';

// Global test setup
beforeAll(async () => {
  try {
    // Initialize database and run migrations
    await initializeDatabase();
    await runMigrations();
    console.log('Test database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  try {
    await closeDatabase();
    console.log('Test database closed successfully');
  } catch (error) {
    console.error('Failed to close test database:', error);
  }
}); 