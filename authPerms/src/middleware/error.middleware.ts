import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { ResponseBuilder } from '@/utils/response';
import logger from '@/utils/logger';

/**
 * Middleware de gestion des erreurs
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  if (error instanceof AppError) {
    res.status(error.statusCode).json(
      ResponseBuilder.fromError(error, req.path)
    );
    return;
  }

  // Erreurs de validation Joi
  if (error.name === 'ValidationError') {
    res.status(400).json(
      ResponseBuilder.error('Validation failed', [
        { code: 'VALIDATION_ERROR', message: error.message }
      ])
    );
    return;
  }

  // Erreurs de base de données
  if (error.name === 'QueryFailedError') {
    res.status(500).json(
      ResponseBuilder.error('Database error', [
        { code: 'DATABASE_ERROR', message: 'A database error occurred' }
      ])
    );
    return;
  }

  // Erreurs JWT
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json(
      ResponseBuilder.error('Token error', [
        { code: 'TOKEN_ERROR', message: error.message }
      ])
    );
    return;
  }

  // Erreur générique
  res.status(500).json(
    ResponseBuilder.error('Internal server error', [
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    ])
  );
};

/**
 * Middleware pour les routes non trouvées
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json(
    ResponseBuilder.error('Resource not found', [
      { 
        code: 'NOT_FOUND', 
        message: `Cannot ${req.method} ${req.path}` 
      }
    ])
  );
};

/**
 * Middleware pour valider les entrées
 */
export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        code: 'VALIDATION_ERROR',
      }));

      res.status(400).json(
        ResponseBuilder.error('Validation failed', errors)
      );
      return;
    }

    next();
  };
};

/**
 * Middleware pour wrapper les contrôleurs async/await
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware pour le logging des requêtes
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  
  // Log de la requête entrante
  logger.info('Request received:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
  });

  // Hook pour logguer la réponse
  const originalSend = res.send;
  
  res.send = function(body: any): Response {
    const responseTime = Date.now() - startTime;
    
    // Log de la réponse
    logger.info('Response sent:', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
    });

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Middleware pour la sécurité des en-têtes
 */
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Headers de sécurité
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
};