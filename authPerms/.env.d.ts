declare namespace NodeJS {
  interface ProcessEnv {
    // Server Configuration
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    HOST: string;
    
    // Database Configuration
    DB_HOST: string;
    DB_PORT: string;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_SCHEMA: string;
    
    // JWT Configuration
    JWT_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    JWT_ALGORITHM: string;
    
    // External API Configuration
    EXTERNAL_API_URL: string;
    EXTERNAL_API_TIMEOUT: string;
    
    // Redis Configuration
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD?: string;
    REDIS_DB?: string;
    
    // Security
    BCRYPT_SALT_ROUNDS: string;
    RATE_LIMIT_WINDOW_MS: string;
    RATE_LIMIT_MAX_REQUESTS: string;
    
    // Logging
    LOG_LEVEL: string;
    LOG_FILE_PATH: string;
    
    // CORS
    CORS_ORIGIN: string;
    CORS_CREDENTIALS: string;
    
    // Application
    API_PREFIX: string;
    ENABLE_SWAGGER: string;
    
    // Render.com specific
    DATABASE_URL?: string;
    REDIS_URL?: string;
    RENDER?: string;
    RENDER_EXTERNAL_URL?: string;
  }
}declare namespace NodeJS {
  interface ProcessEnv {
    // Server Configuration
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    HOST: string;
    
    // Database Configuration
    DB_HOST: string;
    DB_PORT: string;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_SCHEMA: string;
    
    // JWT Configuration
    JWT_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    JWT_ALGORITHM: string;
    
    // External API Configuration
    EXTERNAL_API_URL: string;
    EXTERNAL_API_TIMEOUT: string;
    
    // Redis Configuration
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD?: string;
    REDIS_DB?: string;
    
    // Security
    BCRYPT_SALT_ROUNDS: string;
    RATE_LIMIT_WINDOW_MS: string;
    RATE_LIMIT_MAX_REQUESTS: string;
    
    // Logging
    LOG_LEVEL: string;
    LOG_FILE_PATH: string;
    
    // CORS
    CORS_ORIGIN: string;
    CORS_CREDENTIALS: string;
    
    // Application
    API_PREFIX: string;
    ENABLE_SWAGGER: string;
    
    // Render.com specific
    DATABASE_URL?: string;
    REDIS_URL?: string;
    RENDER?: string;
    RENDER_EXTERNAL_URL?: string;
  }
}