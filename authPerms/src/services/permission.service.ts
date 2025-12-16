import { PermissionRepository } from '@/repositories/permission.repository';
import { UserPermissionRepository } from '@/repositories/user-permission.repository';
import { UserRepository } from '@/repositories/user.repository';
import { 
  AuthorizationError, 
  NotFoundError, 
  ValidationError 
} from '@/utils/errors';
import logger from '@/utils/logger';

export type PermissionAction = 'read' | 'write' | 'update' | 'delete';

export class PermissionService {
  constructor(
    private permissionRepository: PermissionRepository,
    private userPermissionRepository: UserPermissionRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Vérifier si un utilisateur a une permission
   */
  async checkPermission(
    matricule: string,
    nom_objet: string,
    action: PermissionAction
  ): Promise<boolean> {
    try {
      // 1. Vérifier que l'utilisateur existe
      const user = await this.userRepository.findByMatricule(matricule);
      
      if (!user) {
        throw new NotFoundError(`User ${matricule} not found`);
      }

      // 2. Vérifier si l'utilisateur est actif
      if (!user.is_active) {
        throw new AuthorizationError('User account is deactivated');
      }

      // 3. Les doyens et recteurs ont toutes les permissions
      if (user.role === 'doyen' || user.role === 'recteur') {
        logger.debug(`User ${matricule} (${user.role}) has all permissions`);
        return true;
      }

      // 4. Rechercher la permission spécifique
      const permission = await this.permissionRepository.findByNomObjetAndAction(
        nom_objet,
        action
      );

      if (!permission) {
        logger.warn(`Permission not found for object: ${nom_objet}, action: ${action}`);
        return false;
      }

      // 5. Vérifier si l'utilisateur a cette permission
      const userPermission = await this.userPermissionRepository.findByUserAndPermission(
        matricule,
        permission.id_perm
      );

      if (!userPermission) {
        logger.debug(`No permission found for user ${matricule} on ${nom_objet}.${action}`);
        return false;
      }

      // 6. Vérifier le statut de la permission
      const hasPermission = userPermission.statut === 'granted';
      
      logger.debug(`Permission check for ${matricule} on ${nom_objet}.${action}: ${hasPermission}`);
      return hasPermission;
    } catch (error) {
      logger.error(`Permission check failed for ${matricule}:`, error);
      
      if (error instanceof AuthorizationError || 
          error instanceof NotFoundError) {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Assigner une permission à un utilisateur
   */
  async assignPermission(
    matricule: string,
    idperm: string,
    statut: 'granted' | 'revoked' | 'waiting' = 'waiting',
    grantedBy: string
  ): Promise<void> {
    try {
      // Vérifier que l'utilisateur existe
      const user = await this.userRepository.findByMatricule(matricule);
      if (!user) {
        throw new NotFoundError(`User ${matricule} not found`);
      }

      // Vérifier que la permission existe
      const permission = await this.permissionRepository.findById(idperm);
      if (!permission) {
        throw new NotFoundError(`Permission ${idperm} not found`);
      }

      // Créer ou mettre à jour la permission utilisateur
      const existingPermission = await this.userPermissionRepository.findByUserAndPermission(
        matricule,
        idperm
      );

      if (existingPermission) {
        await this.userPermissionRepository.update(existingPermission.id, {
          statut,
          granted_at: statut === 'granted' ? new Date() : null,
          revoked_at: statut === 'revoked' ? new Date() : null,
          granted_by: grantedBy,
        });
      } else {
        await this.userPermissionRepository.create({
          mat: matricule,
          idperm,
          statut,
          granted_at: statut === 'granted' ? new Date() : null,
          granted_by: grantedBy,
        });
      }

      logger.info(`Permission ${idperm} assigned to ${matricule} with status: ${statut}`);
    } catch (error) {
      logger.error(`Failed to assign permission to ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les permissions d'un utilisateur
   */
  async getUserPermissions(matricule: string): Promise<any[]> {
    try {
      return await this.userPermissionRepository.findByUser(matricule);
    } catch (error) {
      logger.error(`Failed to get permissions for ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer tous les utilisateurs ayant une permission spécifique
   */
  async getUsersWithPermission(nom_objet: string, action: PermissionAction): Promise<any[]> {
    try {
      const permission = await this.permissionRepository.findByNomObjetAndAction(
        nom_objet,
        action
      );

      if (!permission) {
        return [];
      }

      return await this.userPermissionRepository.findByPermission(permission.id_perm);
    } catch (error) {
      logger.error(`Failed to get users with permission ${nom_objet}.${action}:`, error);
      throw error;
    }
  }

  /**
   * Créer une nouvelle permission
   */
  async createPermission(
    nom_objet_bd: string,
    type_permission: PermissionAction,
    description?: string,
    createdBy?: string
  ): Promise<any> {
    try {
      // Vérifier si la permission existe déjà
      const existingPermission = await this.permissionRepository.findByNomObjetAndAction(
        nom_objet_bd,
        type_permission
      );

      if (existingPermission) {
        throw new ValidationError(`Permission already exists for ${nom_objet_bd}.${type_permission}`);
      }

      return await this.permissionRepository.create({
        nom_objet_bd,
        type_permission,
        description,
        created_by: createdBy,
      });
    } catch (error) {
      logger.error(`Failed to create permission ${nom_objet_bd}.${type_permission}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les permissions disponibles
   */
  async getAllPermissions(): Promise<any[]> {
    try {
      return await this.permissionRepository.findAll();
    } catch (error) {
      logger.error('Failed to get all permissions:', error);
      throw error;
    }
  }

  /**
   * Supprimer une permission
   */
  async deletePermission(idperm: string): Promise<void> {
    try {
      // Vérifier si la permission est assignée à des utilisateurs
      const userPermissions = await this.userPermissionRepository.findByPermission(idperm);
      
      if (userPermissions.length > 0) {
        throw new ValidationError(
          'Cannot delete permission that is assigned to users. Revoke all assignments first.'
        );
      }

      await this.permissionRepository.delete(idperm);
      logger.info(`Permission ${idperm} deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete permission ${idperm}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour une permission
   */
  async updatePermission(
    idperm: string,
    updates: Partial<{
      nom_objet_bd: string;
      type_permission: PermissionAction;
      description: string;
    }>
  ): Promise<void> {
    try {
      await this.permissionRepository.update(idperm, updates);
      logger.info(`Permission ${idperm} updated successfully`);
    } catch (error) {
      logger.error(`Failed to update permission ${idperm}:`, error);
      throw error;
    }
  }
}