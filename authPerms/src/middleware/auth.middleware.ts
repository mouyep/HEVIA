import { Request, Response, NextFunction } from 'express';
import { JWTService } from '@/services/jwt.service';
import { TokenRepository } from '@/repositories/token.repository';
import { 
  AuthenticationError, 
  TokenExpiredError, 
  InvalidTokenError 
} from '@/utils/errors';
import { ResponseBuilder } from '@/utils/response';
import { AuditService } from '@/services/audit.service';

const jwtService = new JWTService();
const tokenRepository = new TokenRepository();

export interface AuthRequest extends Request {
  user?: {
    matricule: string;
    role: string;
  };
}

/**
 * Middleware d'authentification
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    
    // Vérifier que le token n'est pas undefined
    if (!token) {
      throw new AuthenticationError('Invalid token format');
    }

    // Vérifier si le token est blacklisté
    const isBlacklisted = await tokenRepository.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      throw new InvalidTokenError('Token has been revoked');
    }

    // Vérifier le token
    const decoded = jwtService.verifyAccessToken(token);
    
    // Ajouter les informations utilisateur à la requête
    req.user = {
      matricule: decoded.matricule,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // Journaliser l'accès refusé
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    if (req.headers['x-matricule']) {
      AuditService.logAccessDenied(
        req.headers['x-matricule'] as string,
        req.headers['x-role'] as string || 'unknown',
        req.path,
        req.method,
        ipAddress
      );
    }

    if (error instanceof TokenExpiredError) {
      res.status(401).json(
        ResponseBuilder.error('Access token expired', [
          { code: 'TOKEN_EXPIRED', message: 'Please refresh your token' }
        ])
      );
      return;
    }

    if (error instanceof InvalidTokenError) {
      res.status(401).json(
        ResponseBuilder.error('Invalid token', [
          { code: 'INVALID_TOKEN', message: 'Token is invalid or has been revoked' }
        ])
      );
      return;
    }

    if (error instanceof AuthenticationError) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required', [
          { code: 'AUTH_REQUIRED', message: error.message }
        ])
      );
      return;
    }

    res.status(401).json(
      ResponseBuilder.error('Authentication failed', [
        { code: 'AUTH_FAILED', message: 'Unable to authenticate user' }
      ])
    );
  }
};

/**
 * Middleware pour vérifier les rôles
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const userRole = req.user.role.toLowerCase();
      
      if (!allowedRoles.includes(userRole)) {
        throw new AuthenticationError(`Role ${userRole} not authorized for this resource`);
      }

      next();
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      AuditService.logAccessDenied(
        req.user?.matricule || 'unknown',
        req.user?.role || 'unknown',
        req.path,
        req.method,
        ipAddress
      );

      if (error instanceof AuthenticationError) {
        res.status(403).json(
          ResponseBuilder.error('Insufficient permissions', [
            { code: 'INSUFFICIENT_PERMISSIONS', message: error.message }
          ])
        );
        return;
      }

      res.status(403).json(
        ResponseBuilder.error('Authorization failed', [
          { code: 'AUTHZ_FAILED', message: 'Unable to authorize user' }
        ])
      );
    }
  };
};

/**
 * Middleware pour vérifier si l'utilisateur est connecté
 */
export const requireAuth = [
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }
    next();
  }
];

/**
 * Middleware pour les administrateurs uniquement
 */
export const adminOnly = [
  authenticate,
  authorizeRoles('admin', 'doyen', 'recteur'),
];

/**
 * Middleware pour les enseignants et au-dessus
 */
export const teacherOrAbove = [
  authenticate,
  authorizeRoles('enseignant', 'admin', 'doyen', 'recteur'),
];

/**
 * Middleware pour les doyens et recteurs uniquement
 */
export const deanOrAbove = [
  authenticate,
  authorizeRoles('doyen', 'recteur'),
];

/**
 * Middleware pour le recteur uniquement
 */
export const rectorOnly = [
  authenticate,
  authorizeRoles('recteur'),
];

/**
 * Middleware pour extraire les informations utilisateur même si non authentifié
 */
export const extractUserInfo = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      // Vérifier que le token n'est pas undefined
      if (token) {
        const decoded = jwtService.decodeToken(token);
        
        if (decoded) {
          req.user = {
            matricule: decoded.matricule,
            role: decoded.role,
          };
        }
      }
    }
  } catch (error) {
    // Ignorer les erreurs de décodage
  }

  next();
};

/**
 * Middleware pour vérifier et rafraîchir le token si nécessaire
 */
export const checkAndRefreshToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Vérifier que le token n'est pas undefined
    if (!token) {
      next();
      return;
    }
    
    // Vérifier si le token est sur le point d'expirer (dans les 5 minutes)
    const timeRemaining = jwtService.getTokenTimeRemaining(token);
    
    if (timeRemaining > 0 && timeRemaining < 300) { // 5 minutes = 300 secondes
      // Ajouter un en-tête pour indiquer que le token doit être rafraîchi
      res.set('X-Token-Needs-Refresh', 'true');
      res.set('X-Token-Expires-In', timeRemaining.toString());
    }

    next();
  } catch (error) {
    // Ignorer les erreurs et continuer
    next();
  }
};