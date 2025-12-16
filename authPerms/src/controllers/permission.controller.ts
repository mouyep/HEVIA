import { Request, Response } from 'express';
import { PermissionService } from '@/services/permission.service';
import { PermissionRepository } from '@/repositories/permission.repository';
import { UserPermissionRepository } from '@/repositories/user-permission.repository';
import { UserRepository } from '@/repositories/user.repository';
import { AuthRequest } from '@/middleware/auth.middleware';
import { authSchemas } from '@/utils/validation-schemas';
import { AuditService } from '@/services/audit.service';
import { ResponseBuilder } from '@/utils/response';
import { asyncHandler, validateRequest } from '@/middleware/error.middleware';
// Import de logger retiré car non utilisé dans ce fichier

// Initialisation des services
const permissionRepository = new PermissionRepository();
const userPermissionRepository = new UserPermissionRepository();
const userRepository = new UserRepository();
const permissionService = new PermissionService(
  permissionRepository,
  userPermissionRepository,
  userRepository
);

export class PermissionController {
  /**
   * Vérifier une permission
   */
  static checkPermission = asyncHandler(async (req: AuthRequest, res: Response) => {
    await validateRequest(authSchemas.checkPermission)(req, res, async () => {
      const user = req.user;
      const { nom_objet, action } = req.body;

      if (!user) {
        res.status(401).json(
          ResponseBuilder.error('Authentication required')
        );
        return;
      }

      try {
        const hasPermission = await permissionService.checkPermission(
          user.matricule,
          nom_objet,
          action
        );

        res.status(200).json(
          ResponseBuilder.success(
            { hasPermission },
            hasPermission ? 'Permission granted' : 'Permission denied'
          )
        );
      } catch (error) {
        throw error;
      }
    });
  });

  /**
   * Assigner une permission à un utilisateur (admin seulement)
   */
  static assignPermission = asyncHandler(async (req: AuthRequest, res: Response) => {
    await validateRequest(authSchemas.assignPermission)(req, res, async () => {
      const requestingUser = req.user;
      const { mat, idperm, statut } = req.body;

      if (!requestingUser) {
        res.status(401).json(
          ResponseBuilder.error('Authentication required')
        );
        return;
      }

      // Vérifier les permissions
      if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
        res.status(403).json(
          ResponseBuilder.error('Insufficient permissions')
        );
        return;
      }

      try {
        await permissionService.assignPermission(
          mat,
          idperm,
          statut,
          requestingUser.matricule
        );

        // Journaliser l'assignation
        const action = statut === 'granted' ? 'GRANTED' : 'REVOKED';
        AuditService.logPermissionChange(
          requestingUser.matricule,
          requestingUser.role,
          mat,
          idperm,
          action,
          true
        );

        res.status(200).json(
          ResponseBuilder.success(null, `Permission ${statut} successfully`)
        );
      } catch (error) {
        // Journaliser l'échec
        AuditService.logPermissionChange(
          requestingUser.matricule,
          requestingUser.role,
          mat,
          idperm,
          'GRANTED',
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );

        throw error;
      }
    });
  });

  /**
   * Récupérer toutes les permissions d'un utilisateur
   */
  static getUserPermissions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    const { matricule } = req.params;

    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier que matricule est défini
    if (!matricule) {
      res.status(400).json(
        ResponseBuilder.error('Matricule parameter is required')
      );
      return;
    }

    // Vérifier les permissions
    const isSelf = requestingUser.matricule === matricule;
    const isAdmin = ['admin', 'doyen', 'recteur'].includes(requestingUser.role);

    if (!isSelf && !isAdmin) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions to view this user\'s permissions')
      );
      return;
    }

    try {
      const permissions = await permissionService.getUserPermissions(matricule);
      
      res.status(200).json(
        ResponseBuilder.success(permissions, 'User permissions retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Créer une nouvelle permission (admin seulement)
   */
  static createPermission = asyncHandler(async (req: AuthRequest, res: Response) => {
    await validateRequest(authSchemas.createPermission)(req, res, async () => {
      const requestingUser = req.user;
      const { nom_objet_bd, type_permission, description } = req.body;

      if (!requestingUser) {
        res.status(401).json(
          ResponseBuilder.error('Authentication required')
        );
        return;
      }

      // Vérifier les permissions
      if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
        res.status(403).json(
          ResponseBuilder.error('Insufficient permissions')
        );
        return;
      }

      try {
        const permission = await permissionService.createPermission(
          nom_objet_bd,
          type_permission,
          description,
          requestingUser.matricule
        );

        // Journaliser la création
        AuditService.logSystemEvent(
          'PERMISSION_CREATED',
          { permission: `${nom_objet_bd}.${type_permission}` },
          requestingUser.matricule
        );

        res.status(201).json(
          ResponseBuilder.success(permission, 'Permission created successfully')
        );
      } catch (error) {
        throw error;
      }
    });
  });

  /**
   * Récupérer toutes les permissions disponibles (admin seulement)
   */
  static getAllPermissions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    
    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier les permissions
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    try {
      const permissions = await permissionService.getAllPermissions();
      
      res.status(200).json(
        ResponseBuilder.success(permissions, 'Permissions retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Supprimer une permission (admin seulement)
   */
  static deletePermission = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    const { id } = req.params;

    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier que l'ID est défini
    if (!id) {
      res.status(400).json(
        ResponseBuilder.error('Permission ID parameter is required')
      );
      return;
    }

    // Vérifier les permissions
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    try {
      await permissionService.deletePermission(id);

      // Journaliser la suppression
      AuditService.logSystemEvent(
        'PERMISSION_DELETED',
        { permissionId: id },
        requestingUser.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, 'Permission deleted successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Mettre à jour une permission (admin seulement)
   */
  static updatePermission = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    const { id } = req.params;
    const updates = req.body;

    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier que l'ID est défini
    if (!id) {
      res.status(400).json(
        ResponseBuilder.error('Permission ID parameter is required')
      );
      return;
    }

    // Vérifier les permissions
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    try {
      await permissionService.updatePermission(id, updates);

      // Journaliser la mise à jour
      AuditService.logSystemEvent(
        'PERMISSION_UPDATED',
        { permissionId: id, updates },
        requestingUser.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, 'Permission updated successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Récupérer les utilisateurs ayant une permission spécifique (admin seulement)
   */
  static getUsersWithPermission = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    const { nom_objet, action } = req.query;

    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier les permissions
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    if (!nom_objet || !action) {
      res.status(400).json(
        ResponseBuilder.error('nom_objet and action query parameters are required')
      );
      return;
    }

    try {
      const users = await permissionService.getUsersWithPermission(
        nom_objet as string,
        action as any
      );
      
      res.status(200).json(
        ResponseBuilder.success(users, 'Users with permission retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Récupérer les permissions de l'utilisateur connecté
   */
  static getMyPermissions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    try {
      const permissions = await permissionService.getUserPermissions(user.matricule);
      
      res.status(200).json(
        ResponseBuilder.success(permissions, 'Your permissions retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Rechercher des permissions (admin seulement)
   */
  static searchPermissions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    const { q: query } = req.query;

    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier les permissions
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    if (!query || query.toString().trim().length < 2) {
      res.status(400).json(
        ResponseBuilder.error('Search query must be at least 2 characters long')
      );
      return;
    }

    try {
      const permissions = await permissionRepository.search(query.toString());
      
      res.status(200).json(
        ResponseBuilder.success(permissions, 'Permissions search completed')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Récupérer les statistiques des permissions (admin seulement)
   */
  static getPermissionStatistics = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requestingUser = req.user;
    
    if (!requestingUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    // Vérifier les permissions
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    try {
      const permissionStats = await permissionRepository.getStatistics();
      const userPermissionStats = await userPermissionRepository.getStatistics();

      const statistics = {
        permissions: permissionStats,
        userPermissions: userPermissionStats,
      };

      res.status(200).json(
        ResponseBuilder.success(statistics, 'Permission statistics retrieved')
      );
    } catch (error) {
      throw error;
    }
  });
}