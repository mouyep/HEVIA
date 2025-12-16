import Redis from 'ioredis';
import { config } from './app.config';
import logger from '@/utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
  maxRetriesPerRequest?: number;
}

export const redisConfig: RedisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB || 0,
  keyPrefix: 'authperms:',
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

// Instance Redis singleton
let redisClient: Redis | null = null;

export const createRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const client = new Redis(redisConfig);

  // Événements Redis
  client.on('connect', () => {
    logger.info('Redis client connected successfully');
  });

  client.on('ready', () => {
    logger.info('Redis client is ready to use');
  });

  client.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  client.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  client.on('end', () => {
    logger.warn('Redis client connection ended');
    redisClient = null;
  });

  redisClient = client;
  return client;
};

// Fonctions utilitaires Redis
export const redisUtils = {
  // Tester la connexion
  async ping(): Promise<boolean> {
    try {
      const client = createRedisClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  },

  // Obtenir des informations sur Redis
  async getInfo(): Promise<Record<string, any>> {
    try {
      const client = createRedisClient();
      const info = await client.info();
      
      const infoMap: Record<string, any> = {};
      info.split('\r\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            infoMap[key] = value;
          }
        }
      });

      return infoMap;
    } catch (error) {
      logger.error('Failed to get Redis info:', error);
      return {};
    }
  },

  // Nettoyer les clés par pattern
  async cleanKeys(pattern: string = 'authperms:*'): Promise<number> {
    try {
      const client = createRedisClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(...keys);
        logger.info(`Cleaned ${keys.length} Redis keys with pattern: ${pattern}`);
        return keys.length;
      }
      
      return 0;
    } catch (error) {
      logger.error('Failed to clean Redis keys:', error);
      return 0;
    }
  },

  // Vérifier la santé de Redis
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const isConnected = await this.ping();
      const latency = Date.now() - startTime;

      if (isConnected) {
        return {
          status: 'healthy',
          latency,
        };
      } else {
        return {
          status: 'unhealthy',
          error: 'Redis ping failed',
        };
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message || 'Redis health check failed',
      };
    }
  },

  // Fermer la connexion
  async disconnect(): Promise<void> {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis client disconnected');
    }
  },
};

// Types pour le cache
export interface CacheOptions {
  ttl?: number; // Time to live en secondes
  prefix?: string;
}

export const defaultCacheOptions: CacheOptions = {
  ttl: 3600, // 1 heure
  prefix: 'cache:',
};

// Gestionnaire de cache simple
export class CacheManager {
  private client: Redis;
  private options: CacheOptions;

  constructor(options: CacheOptions = {}) {
    this.client = createRedisClient();
    this.options = { ...defaultCacheOptions, ...options };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = `${this.options.prefix}${key}`;
      const data = await this.client.get(fullKey);
      
      if (data) {
        return JSON.parse(data) as T;
      }
      
      return null;
    } catch (error) {
      logger.error(`Cache get failed for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = `${this.options.prefix}${key}`;
      const ttlToUse = ttl || this.options.ttl;
      const serialized = JSON.stringify(value);

      if (ttlToUse) {
        await this.client.setex(fullKey, ttlToUse, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }
    } catch (error) {
      logger.error(`Cache set failed for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = `${this.options.prefix}${key}`;
      await this.client.del(fullKey);
    } catch (error) {
      logger.error(`Cache delete failed for key ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      const pattern = `${this.options.prefix}*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.error('Cache clear failed:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const fullKey = `${this.options.prefix}${key}`;
      const exists = await this.client.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache has check failed for key ${key}:`, error);
      return false;
    }
  }
}