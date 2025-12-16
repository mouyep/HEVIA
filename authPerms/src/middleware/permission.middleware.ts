import { Request, Response, NextFunction } from 'express';
import { PermissionService } from '@/services/permission.service';
import { PermissionRepository } from '@/repositories/permission.repository';
import { UserPermissionRepository } from '@/repositories/user-permission.repository';
import { UserRepository } from '@/repositories/user.repository';
import { AuthRequest } from './auth.middleware';
import { AuthorizationError } from '@/utils/errors';
import { ResponseBuilder } from '@/utils/response';
import { AuditService } from '@/services/audit.service';
import logger from '@/utils/logger';

const permissionService = new PermissionService(
  new PermissionRepository(),
  new UserPermissionRepository(),
  new UserRepository()
);

/**
 * Vérifier une permission spécifique
 */
export const checkPermission = (nom_objet: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthorizationError('User not authenticated');
      }

      const hasPermission = await permissionService.checkPermission(
        req.user.matricule,
        nom_objet,
        action as any
      );

      if (!hasPermission) {
        throw new AuthorizationError(
          `Insufficient permissions for ${nom_objet}.${action}`
        );
      }

      next();
    } catch (error) {
      logger.error('Permission check failed:', error);
      
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      AuditService.logAccessDenied(
        req.user?.matricule || 'unknown',
        req.user?.role || 'unknown',
        nom_objet,
        action,
        ipAddress
      );

      if (error instanceof AuthorizationError) {
        res.status(403).json(
          ResponseBuilder.error('Access denied', [
            { 
              code: 'PERMISSION_DENIED', 
              message: error.message,
              resource: nom_objet,
              action: action 
            }
          ])
        );
        return;
      }

      res.status(403).json(
        ResponseBuilder.error('Permission check failed')
      );
    }
  };
};

/**
 * Vérifier les permissions dynamiquement basées sur les paramètres de la requête
 */
export const dynamicPermissionCheck = (
  getResource: (req: Request) => string,
  getAction: (req: Request) => string
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthorizationError('User not authenticated');
      }

      const resource = getResource(req);
      const action = getAction(req);

      const hasPermission = await permissionService.checkPermission(
        req.user.matricule,
        resource,
        action as any
      );

      if (!hasPermission) {
        throw new AuthorizationError(
          `Insufficient permissions for ${resource}.${action}`
        );
      }

      next();
    } catch (error) {
      logger.error('Dynamic permission check failed:', error);
      
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      AuditService.logAccessDenied(
        req.user?.matricule || 'unknown',
        req.user?.role || 'unknown',
        getResource(req),
        getAction(req),
        ipAddress
      );

      res.status(403).json(
        ResponseBuilder.error('Access denied', [
          { 
            code: 'DYNAMIC_PERMISSION_DENIED', 
            message: error instanceof Error ? error.message : 'Permission denied'
          }
        ])
      );
    }
  };
};

/**
 * Vérifier les permissions pour les opérations CRUD
 */
export const crudPermissions = {
  read: (resource: string) => checkPermission(resource, 'read'),
  write: (resource: string) => checkPermission(resource, 'write'),
  update: (resource: string) => checkPermission(resource, 'update'),
  delete: (resource: string) => checkPermission(resource, 'delete'),
};

/**
 * Middleware pour vérifier les permissions par défaut selon le rôle
 */
export const roleBasedPermissions = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      throw new AuthorizationError('User not authenticated');
    }

    // Les doyens et recteurs ont toutes les permissions
    if (req.user.role === 'doyen' || req.user.role === 'recteur') {
      next();
      return;
    }

    // Vérification basée sur le chemin et la méthode HTTP
    const path = req.path;
    const method = req.method.toLowerCase();

    // Mappage des chemins aux permissions
    const pathPermissions: Record<string, string> = {
      '/api/auth/login': 'auth.read',
      '/api/auth/refresh': 'auth.read',
      '/api/auth/logout': 'auth.write',
      '/api/users/profile': 'user.read',
      '/api/users/change-password': 'user.update',
    };

    const requiredPermission = pathPermissions[path];
    
    if (!requiredPermission) {
      // Si aucun mappage spécifique, autoriser par défaut (à adapter selon les besoins)
      next();
      return;
    }

    // Pour l'instant, autoriser toutes les routes connues
    // Dans une implémentation réelle, vérifier les permissions dans la base de données
    next();
  } catch (error) {
    logger.error('Role-based permission check failed:', error);
    
    res.status(403).json(
      ResponseBuilder.error('Access denied')
    );
  }
};

/**
 * Middleware pour enregistrer l'utilisation des permissions
 */
export const auditPermissionUsage = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const originalSend = res.send;
  
  res.send = function(body: any): Response {
    // Enregistrer l'utilisation de la permission après que la réponse a été envoyée
    if (req.user && res.statusCode < 400) {
      const resource = req.path.split('/').pop() || 'unknown';
      const action = req.method.toLowerCase();
      
      logger.debug(`Permission used: ${req.user.matricule} performed ${action} on ${resource}`);
    }
    
    return originalSend.call(this, body);
  };

  next();
};