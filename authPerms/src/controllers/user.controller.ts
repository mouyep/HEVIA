import { Request, Response } from 'express';
import { UserService } from '@/services/user.service';
import { UserRepository } from '@/repositories/user.repository';
import { AuthRequest } from '@/middleware/auth.middleware';
import { authSchemas } from '@/utils/validation-schemas';
import { AuditService } from '@/services/audit.service';
import { ResponseBuilder } from '@/utils/response';
import { asyncHandler, validateRequest } from '@/middleware/error.middleware';

// Initialisation des services
const userRepository = new UserRepository();
const userService = new UserService(userRepository);

export class UserController {
  /**
   * Récupérer un utilisateur par matricule
   */
  static getUserByMatricule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { matricule } = req.params;
    const requestingUser = req.user;

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
        ResponseBuilder.error('Insufficient permissions to view this user')
      );
      return;
    }

    try {
      const user = await userService.getUserByMatricule(matricule);
      
      res.status(200).json(
        ResponseBuilder.success(user, 'User retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Récupérer tous les utilisateurs (admin seulement)
   */
  static getAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
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

    const { 
      page = 1, 
      limit = 50,
      role,
      is_active,
      is_connected 
    } = req.query;

    try {
      const filters: any = {};
      
      if (role) filters.role = role as string;
      if (is_active !== undefined) filters.is_active = is_active === 'true';
      if (is_connected !== undefined) filters.is_connected = is_connected === 'true';

      const result = await userService.getAllUsers(
        parseInt(page as string),
        parseInt(limit as string),
        filters
      );

      res.status(200).json(
        ResponseBuilder.success(result, 'Users retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Créer un nouvel utilisateur (admin seulement)
   */
  static createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    await validateRequest(authSchemas.register)(req, res, async () => {
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

      const { matricule, password, role } = req.body;

      try {
        const user = await userService.createUser(
          { matricule, password, role },
          requestingUser.matricule
        );

        // Journaliser la création
        AuditService.logSystemEvent(
          'USER_CREATED',
          { newUser: matricule, role },
          requestingUser.matricule
        );

        res.status(201).json(
          ResponseBuilder.success(user, 'User created successfully')
        );
      } catch (error) {
        throw error;
      }
    });
  });

  /**
   * Mettre à jour un utilisateur
   */
  static updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    await validateRequest(authSchemas.updateUser)(req, res, async () => {
      const { matricule } = req.params;
      const updates = req.body;
      const requestingUser = req.user;

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
          ResponseBuilder.error('Insufficient permissions to update this user')
        );
        return;
      }

      // Restrictions pour les non-admins
      if (!isAdmin) {
        // Les utilisateurs non-admins ne peuvent que mettre à jour leur propre mot de passe
        const allowedUpdates = ['password'];
        const attemptedUpdates = Object.keys(updates);
        
        const unauthorizedUpdates = attemptedUpdates.filter(
          update => !allowedUpdates.includes(update)
        );

        if (unauthorizedUpdates.length > 0) {
          res.status(403).json(
            ResponseBuilder.error(
              `Insufficient permissions to update: ${unauthorizedUpdates.join(', ')}`
            )
          );
          return;
        }
      }

      try {
        await userService.updateUser(
          matricule,
          updates,
          requestingUser.matricule
        );

        // Journaliser la mise à jour
        AuditService.logSystemEvent(
          'USER_UPDATED',
          { targetUser: matricule, updates },
          requestingUser.matricule
        );

        res.status(200).json(
          ResponseBuilder.success(null, 'User updated successfully')
        );
      } catch (error) {
        throw error;
      }
    });
  });

  /**
   * Désactiver un utilisateur (admin seulement)
   */
  static deactivateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { matricule } = req.params;
    const requestingUser = req.user;

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
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    // Empêcher l'auto-désactivation
    if (requestingUser.matricule === matricule) {
      res.status(400).json(
        ResponseBuilder.error('Cannot deactivate your own account')
      );
      return;
    }

    try {
      await userService.deactivateUser(matricule, requestingUser.matricule);

      // Journaliser la désactivation
      AuditService.logSystemEvent(
        'USER_DEACTIVATED',
        { targetUser: matricule },
        requestingUser.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, 'User deactivated successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Activer un utilisateur (admin seulement)
   */
  static activateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { matricule } = req.params;
    const requestingUser = req.user;

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
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    try {
      await userService.activateUser(matricule, requestingUser.matricule);

      // Journaliser l'activation
      AuditService.logSystemEvent(
        'USER_ACTIVATED',
        { targetUser: matricule },
        requestingUser.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, 'User activated successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Supprimer un utilisateur (admin seulement)
   */
  static deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { matricule } = req.params;
    const requestingUser = req.user;

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
    if (!['admin', 'doyen', 'recteur'].includes(requestingUser.role)) {
      res.status(403).json(
        ResponseBuilder.error('Insufficient permissions')
      );
      return;
    }

    // Empêcher l'auto-suppression
    if (requestingUser.matricule === matricule) {
      res.status(400).json(
        ResponseBuilder.error('Cannot delete your own account')
      );
      return;
    }

    try {
      await userService.deleteUser(matricule);

      // Journaliser la suppression
      AuditService.logSystemEvent(
        'USER_DELETED',
        { targetUser: matricule },
        requestingUser.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, 'User marked as inactive')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Rechercher des utilisateurs (admin seulement)
   */
  static searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
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

    const { q: query, page = 1, limit = 50 } = req.query;

    if (!query || query.toString().trim().length < 2) {
      res.status(400).json(
        ResponseBuilder.error('Search query must be at least 2 characters long')
      );
      return;
    }

    try {
      const result = await userService.searchUsers(
        query.toString(),
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.status(200).json(
        ResponseBuilder.success(result, 'Users search completed')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Obtenir les statistiques des utilisateurs (admin seulement)
   */
  static getUserStatistics = asyncHandler(async (req: AuthRequest, res: Response) => {
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
      const statistics = await userService.getUserStatistics();
      
      res.status(200).json(
        ResponseBuilder.success(statistics, 'User statistics retrieved')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Obtenir le profil de l'utilisateur connecté
   */
  static getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    try {
      const userDetails = await userService.getUserByMatricule(user.matricule);
      
      res.status(200).json(
        ResponseBuilder.success(userDetails, 'Profile retrieved successfully')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Mettre à jour le profil de l'utilisateur connecté
   */
  static updateMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    const updates = req.body;

    // Les utilisateurs ne peuvent mettre à jour que certains champs de leur propre profil
    const allowedUpdates = ['password'];
    const attemptedUpdates = Object.keys(updates);
    
    const unauthorizedUpdates = attemptedUpdates.filter(
      update => !allowedUpdates.includes(update)
    );

    if (unauthorizedUpdates.length > 0) {
      res.status(403).json(
        ResponseBuilder.error(
          `Cannot update: ${unauthorizedUpdates.join(', ')}. Contact an administrator.`
        )
      );
      return;
    }

    try {
      await userService.updateUser(
        user.matricule,
        updates,
        user.matricule
      );

      // Journaliser la mise à jour du profil
      AuditService.logSystemEvent(
        'PROFILE_UPDATED',
        { updates: attemptedUpdates },
        user.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, 'Profile updated successfully')
      );
    } catch (error) {
      throw error;
    }
  });
}