import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config();

// Déterminer le chemin du fichier .env en fonction de l'environnement
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : process.env.NODE_ENV === 'test' 
    ? '.env.test' 
    : '.env';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export const config = {
  // Configuration du serveur
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001'),
  HOST: process.env.HOST || 'localhost',
  
  // Configuration de la base de données
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432'),
  DB_NAME: process.env.DB_NAME || 'authperms_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_SCHEMA: process.env.DB_SCHEMA || 'authperms',
  
  // Configuration JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '2h',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  
  // Configuration API externe
  EXTERNAL_API_URL: process.env.EXTERNAL_API_URL || 'http://localhost:3005/api',
  EXTERNAL_API_TIMEOUT: parseInt(process.env.EXTERNAL_API_TIMEOUT || '5000'),
  
  // Configuration Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
  
  // Sécurité
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs/authperms.log',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',
  
  // Autres
  API_PREFIX: process.env.API_PREFIX || '/api',
  ENABLE_SWAGGER: process.env.ENABLE_SWAGGER === 'true',
};

// Validation de la configuration
export const validateConfig = (): void => {
  const required = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validation des valeurs
  if (config.PORT < 1 || config.PORT > 65535) {
    throw new Error(`Invalid PORT: ${config.PORT}`);
  }

  if (config.BCRYPT_SALT_ROUNDS < 10 || config.BCRYPT_SALT_ROUNDS > 15) {
    throw new Error(`BCRYPT_SALT_ROUNDS must be between 10 and 15`);
  }

  console.log('Configuration loaded successfully for environment:', config.NODE_ENV);
};

export default config;