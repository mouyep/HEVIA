import { Permission } from '@/models/Permission';
import { AppDataSource } from '@/database/connection';
import { DatabaseError, NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';
import { FindOptionsWhere, Like, FindOperator } from 'typeorm';

// Type pour les actions de permission
export type PermissionAction = 'read' | 'write' | 'update' | 'delete';

export class PermissionRepository {
  private repository = AppDataSource.getRepository(Permission);

  /**
   * Trouver une permission par ID
   */
  async findById(id: string): Promise<Permission | null> {
    try {
      return await this.repository.findOne({
        where: { id_perm: id },
      });
    } catch (error) {
      logger.error(`Failed to find permission by ID ${id}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver une permission par nom d'objet et action
   */
  async findByNomObjetAndAction(
    nom_objet_bd: string,
    type_permission: PermissionAction
  ): Promise<Permission | null> {
    try {
      return await this.repository.findOne({
        where: { 
          nom_objet_bd, 
          type_permission: type_permission as any 
        },
      });
    } catch (error) {
      logger.error(
        `Failed to find permission by object ${nom_objet_bd} and action ${type_permission}:`,
        error
      );
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver toutes les permissions
   */
  async findAll(): Promise<Permission[]> {
    try {
      return await this.repository.find({
        order: { nom_objet_bd: 'ASC', type_permission: 'ASC' },
      });
    } catch (error) {
      logger.error('Failed to find all permissions:', error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver des permissions par nom d'objet
   */
  async findByNomObjet(nom_objet_bd: string): Promise<Permission[]> {
    try {
      return await this.repository.find({
        where: { nom_objet_bd },
        order: { type_permission: 'ASC' },
      });
    } catch (error) {
      logger.error(`Failed to find permissions by object ${nom_objet_bd}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver des permissions par type
   */
  async findByType(type_permission: PermissionAction): Promise<Permission[]> {
    try {
      return await this.repository.find({
        where: { type_permission: type_permission as any },
        order: { nom_objet_bd: 'ASC' },
      });
    } catch (error) {
      logger.error(`Failed to find permissions by type ${type_permission}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Créer une nouvelle permission
   */
  async create(permissionData: Partial<Permission>): Promise<Permission> {
    try {
      const permission = this.repository.create(permissionData);
      return await this.repository.save(permission);
    } catch (error: any) {
      logger.error('Failed to create permission:', error);
      
      if (error.code === '23505') { // Violation de contrainte d'unicité
        throw new DatabaseError('Permission with this object and action already exists');
      }
      
      throw new DatabaseError('Failed to create permission');
    }
  }


  /**
   * Mettre à jour une permission
   */
  async update(id: string, updates: Partial<Permission>): Promise<void> {
    try {
      const result = await this.repository.update({ id_perm: id }, updates);
      
      if (result.affected === 0) {
        throw new NotFoundError(`Permission ${id} not found`);
      }
    } catch (error) {
      logger.error(`Failed to update permission ${id}:`, error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to update permission');
    }
  }

  /**
   * Supprimer une permission
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.repository.delete({ id_perm: id });
      
      if (result.affected === 0) {
        throw new NotFoundError(`Permission ${id} not found`);
      }
    } catch (error) {
      logger.error(`Failed to delete permission ${id}:`, error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to delete permission');
    }
  }

  /**
   * Rechercher des permissions
   */
  async search(query: string): Promise<Permission[]> {
    try {
      return await this.repository.find({
        where: [
          { nom_objet_bd: Like(`%${query}%`) },
          { description: Like(`%${query}%`) },
        ],
        order: { nom_objet_bd: 'ASC' },
      });
    } catch (error) {
      logger.error(`Failed to search permissions with query "${query}":`, error);
      throw new DatabaseError('Search operation failed');
    }
  }

  /**
   * Vérifier si une permission existe
   */
  async exists(nom_objet_bd: string, type_permission: PermissionAction): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { 
          nom_objet_bd, 
          type_permission: type_permission as any 
        },
      });
      return count > 0;
    } catch (error) {
      logger.error(
        `Failed to check if permission exists for ${nom_objet_bd}.${type_permission}:`,
        error
      );
      return false;
    }
  }

  /**
   * Obtenir des statistiques sur les permissions
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    byObject: Record<string, number>;
  }> {
    try {
      const total = await this.repository.count();
      
      // Compter par type
      const typeCounts = await this.repository
        .createQueryBuilder('permission')
        .select('permission.type_permission, COUNT(*) as count')
        .groupBy('permission.type_permission')
        .getRawMany();

      const byType: Record<string, number> = {};
      typeCounts.forEach(row => {
        byType[row.type_permission] = parseInt(row.count);
      });

      // Compter par objet
      const objectCounts = await this.repository
        .createQueryBuilder('permission')
        .select('permission.nom_objet_bd, COUNT(*) as count')
        .groupBy('permission.nom_objet_bd')
        .getRawMany();

      const byObject: Record<string, number> = {};
      objectCounts.forEach(row => {
        byObject[row.nom_objet_bd] = parseInt(row.count);
      });

      return {
        total,
        byType,
        byObject,
      };
    } catch (error) {
      logger.error('Failed to get permission statistics:', error);
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Récupérer les permissions avec pagination
   */
  async findPaginated(
    page: number = 1,
    limit: number = 50,
    filters?: {
      type_permission?: PermissionAction;
      nom_objet_bd?: string;
    }
  ): Promise<{ permissions: Permission[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const where: FindOptionsWhere<Permission> = {};
      
      if (filters) {
        if (filters.type_permission) {
          where.type_permission = filters.type_permission as any;
        }
        if (filters.nom_objet_bd) where.nom_objet_bd = filters.nom_objet_bd;
      }

      const [permissions, total] = await this.repository.findAndCount({
        where,
        skip,
        take: limit,
        order: { nom_objet_bd: 'ASC', type_permission: 'ASC' },
      });

      return { permissions, total };
    } catch (error) {
      logger.error('Failed to find permissions with pagination:', error);
      throw new DatabaseError('Database operation failed');
    }
  }
}