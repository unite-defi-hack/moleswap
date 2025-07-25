import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('escrow_validations', (table) => {
    table.increments('id').primary();
    table.string('order_hash').notNullable();
    table.string('chain').notNullable();
    table.string('escrow_address').notNullable();
    table.string('validation_type').notNullable(); // 'source' or 'destination'
    table.boolean('is_valid').notNullable();
    table.json('validation_details').nullable();
    table.timestamp('validated_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Foreign key reference to orders table
    table.foreign('order_hash').references('order_hash').inTable('orders').onDelete('CASCADE');
    
    // Indexes for better query performance
    table.index(['order_hash']);
    table.index(['chain']);
    table.index(['validation_type']);
    table.index(['is_valid']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('escrow_validations');
} 