import rateLimit, { Store, MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import logger from '@/utils/logger';
import { Request, Response, NextFunction } from 'express';

// Types compatibles avec rate-limit-redis
type RedisReply = string | number | Buffer | null | RedisReply[];

let redisClient: Redis | null = null;
let redisAvailable = false;

// Initialiser Redis de manière asynchrone
const initializeRedis = async (): Promise<void> => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
      redisAvailable = true;
    });

    // Tester la connexion
    await redisClient.ping();
    redisAvailable = true;
    logger.info('Redis rate limiting store initialized successfully');
  } catch (error) {
    logger.warn('Redis initialization failed, using MemoryStore for rate limiting');
    redisAvailable = false;
  }
};

// Initialiser Redis au démarrage
initializeRedis().catch(() => {
  logger.info('Using MemoryStore for rate limiting');
});

// Fonction utilitaire pour créer un store avec fallback
const createStoreWithFallback = (): Store => {
  if (redisAvailable && redisClient) {
    try {
      // Créer une fonction sendCommand correctement typée sans spread operator problématique
      const sendCommand = async (...args: [string, ...(string | number)[]]): Promise<RedisReply> => {
        if (!redisClient) {
          throw new Error('Redis client not available');
        }
        
        // Convertir args en un tableau compatible avec redisClient.call
        const command = args[0];
        const commandArgs = args.slice(1);
        
        return redisClient.call(command, ...commandArgs) as Promise<RedisReply>;
      };

      // Utiliser une assertion de type plus spécifique
      const redisStore = new RedisStore({
        sendCommand: sendCommand as any,
        prefix: 'rate-limit:',
      });
      
      return redisStore as unknown as Store;
    } catch (error) {
      logger.warn('Failed to create RedisStore, falling back to MemoryStore:', error);
    }
  }
  
  // Fallback au MemoryStore
  logger.debug('Using MemoryStore for rate limiting');
  return new MemoryStore();
};

// Configuration commune pour tous les rate limiters
const createRateLimiter = (config: {
  windowMs: number;
  max: number;
  message: any;
  skip?: (req: Request) => boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    store: createStoreWithFallback(),
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true,
    legacyHeaders: false,
    skip: config.skip,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    keyGenerator: config.keyGenerator || ((req: Request) => req.ip || req.connection.remoteAddress || 'unknown'),
  });
};

/**
 * Limiteur de taux global pour l'API
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    errors: [{ code: 'RATE_LIMIT_EXCEEDED' }],
  },
});

/**
 * Limiteur de taux pour l'authentification (plus strict)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    errors: [{ code: 'AUTH_RATE_LIMIT_EXCEEDED' }],
  },
  skipSuccessfulRequests: true,
});

/**
 * Limiteur de taux pour les requêtes de rafraîchissement de token
 */
export const refreshTokenRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many token refresh requests, please try again later.',
    errors: [{ code: 'REFRESH_RATE_LIMIT_EXCEEDED' }],
  },
});

/**
 * Limiteur de taux pour les requêtes d'administration
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many admin requests, please try again later.',
    errors: [{ code: 'ADMIN_RATE_LIMIT_EXCEEDED' }],
  },
  skip: (req: Request) => {
    const userRole = (req as any).user?.role;
    return userRole === 'doyen' || userRole === 'recteur';
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user && user.matricule) {
      return `admin:${user.matricule}`;
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * Limiteur de taux pour les étudiants
 */
export const studentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Rate limit exceeded for student accounts.',
    errors: [{ code: 'STUDENT_RATE_LIMIT_EXCEEDED' }],
  },
  skip: (req: Request) => {
    const userRole = (req as any).user?.role;
    return ['enseignant', 'admin', 'doyen', 'recteur'].includes(userRole);
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user && user.matricule) {
      return `student:${user.matricule}`;
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * Version simplifiée sans fallback (pour tests ou dev rapide)
 */
export const simpleGlobalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    errors: [{ code: 'RATE_LIMIT_EXCEEDED' }],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const simpleAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    errors: [{ code: 'AUTH_RATE_LIMIT_EXCEEDED' }],
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Middleware pour désactiver la limitation de taux en développement
 */
export const developmentRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV === 'development') {
    next();
  } else {
    const userRole = (req as any).user?.role;
    
    // Utiliser les rate limiters simplifiés pour éviter les problèmes
    if (req.path.includes('/auth/login')) {
      simpleAuthRateLimiter(req, res, next);
    } else if (req.path.includes('/auth/refresh')) {
      refreshTokenRateLimiter(req, res, next);
    } else if (userRole === 'etudiant') {
      studentRateLimiter(req, res, next);
    } else if (['admin', 'doyen', 'recteur'].includes(userRole)) {
      adminRateLimiter(req, res, next);
    } else {
      simpleGlobalRateLimiter(req, res, next);
    }
  }
};

/**
 * Nettoyage périodique des données Redis
 */
export const cleanupRateLimitData = async (): Promise<void> => {
  try {
    if (redisClient && redisAvailable) {
      try {
        // Nettoyer les anciennes clés de rate limiting
        const keys = await redisClient.keys('rate-limit:*');
        if (keys.length > 0) {
          await redisClient.del(...keys);
          logger.info(`Cleaned up ${keys.length} rate limit keys`);
        }
      } catch (error) {
        logger.error('Error cleaning up rate limit data:', error);
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup rate limit data:', error);
  }
};

// Exporter pour les tests
export const getRedisStatus = () => ({
  available: redisAvailable,
  client: redisClient,
});

// Exporter les instances pour référence
export const rateLimiters = {
  global: globalRateLimiter,
  auth: authRateLimiter,
  refresh: refreshTokenRateLimiter,
  admin: adminRateLimiter,
  student: studentRateLimiter,
  simpleGlobal: simpleGlobalRateLimiter,
  simpleAuth: simpleAuthRateLimiter,
};