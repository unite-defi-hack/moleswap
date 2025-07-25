import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.string('order_hash').unique().notNullable();
    table.string('maker').notNullable();
    table.string('taker').notNullable();
    table.string('maker_token').notNullable();
    table.string('taker_token').notNullable();
    table.string('maker_amount').notNullable();
    table.string('taker_amount').notNullable();
    table.string('source_chain').notNullable();
    table.string('destination_chain').notNullable();
    table.string('source_escrow').notNullable();
    table.string('destination_escrow').notNullable();
    table.string('hashlock').notNullable();
    table.string('secret').nullable();
    table.string('status').defaultTo('pending').notNullable();
    table.json('order_data').notNullable();
    table.json('signed_data').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for better query performance
    table.index(['order_hash']);
    table.index(['maker']);
    table.index(['status']);
    table.index(['source_chain', 'destination_chain']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('orders');
} 