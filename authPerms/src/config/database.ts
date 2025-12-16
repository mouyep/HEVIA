import { DataSourceOptions } from 'typeorm';
import { config } from './app.config';
import { User } from '@/models/User';
import { Permission } from '@/models/Permission';
import { UserPermission } from '@/models/UserPermission';
import { Token } from '@/models/Token';

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  schema: config.DB_SCHEMA,
  
  // Entities
  entities: [User, Permission, UserPermission, Token],
  
  // Migrations
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
  
  // Synchronization (seulement en développement)
  synchronize: config.NODE_ENV === 'development',
  
  // Logging
  logging: config.NODE_ENV === 'development',
  
  // Connection pool
  poolSize: 10,
  extra: {
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  },
  
  // SSL
  ssl: config.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
  } : false,
};

// Configuration pour les tests
export const testDatabaseConfig: DataSourceOptions = {
  ...databaseConfig,
  database: `${config.DB_NAME}_test`,
  synchronize: true,
  dropSchema: true,
  logging: false,
};

// Fonction pour générer l'URL de connexion
export const getDatabaseUrl = (): string => {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SCHEMA } = config;
  return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}`;
};

// Validation de la configuration
export const validateDatabaseConfig = (): string[] => {
  const errors: string[] = [];
  
  if (!config.DB_HOST) errors.push('DB_HOST is required');
  if (!config.DB_NAME) errors.push('DB_NAME is required');
  if (!config.DB_USER) errors.push('DB_USER is required');
  if (!config.DB_PASSWORD) errors.push('DB_PASSWORD is required');
  
  return errors;
};