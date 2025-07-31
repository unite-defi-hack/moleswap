import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('orders', (table) => {
    // Add extension field for 1inch cross-chain SDK order format
    table.text('extension').nullable();
    
    // Add secretHash field for storing the hash of the secret
    table.string('secret_hash').nullable();
    
    // Add index for secret_hash for better query performance
    table.index(['secret_hash']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('extension');
    table.dropColumn('secret_hash');
    table.dropIndex(['secret_hash']);
  });
} 