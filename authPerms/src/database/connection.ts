import { DataSource } from 'typeorm';
import { config } from '@/config/app.config';
import { User } from '@/models/User';
import { Permission } from '@/models/Permission';
import { UserPermission } from '@/models/UserPermission';
import { Token } from '@/models/Token';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  schema: config.DB_SCHEMA,
  synchronize: config.NODE_ENV === 'development',
  logging: config.NODE_ENV === 'development',
  entities: [User, Permission, UserPermission, Token],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
  poolSize: 10,
  extra: {
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  },
});

// Fonction pour tester la connexion
export const testConnection = async (): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    
    await AppDataSource.query('SELECT 1');
    console.log('✅ Database connection test passed');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

// Fonction pour fermer la connexion
export const closeConnection = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};