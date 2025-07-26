"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
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
exports.default = config;
//# sourceMappingURL=knexfile.js.map