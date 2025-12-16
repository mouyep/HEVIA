import { UserPermission } from '@/models/UserPermission';
import { AppDataSource } from '@/database/connection';
import { DatabaseError, NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';
import { FindOptionsWhere, In } from 'typeorm';

// Type pour le statut de permission utilisateur
export type UserPermissionStatus = 'granted' | 'revoked' | 'waiting';

export class UserPermissionRepository {
  private repository = AppDataSource.getRepository(UserPermission);

  /**
   * Trouver une permission utilisateur par ID
   */
  async findById(id: string): Promise<UserPermission | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['user', 'permission'],
      });
    } catch (error) {
      logger.error(`Failed to find user permission by ID ${id}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver une permission utilisateur par utilisateur et permission
   */
  async findByUserAndPermission(
    mat: string,
    idperm: string
  ): Promise<UserPermission | null> {
    try {
      return await this.repository.findOne({
        where: { mat, idperm },
        relations: ['permission'],
      });
    } catch (error) {
      logger.error(
        `Failed to find user permission for user ${mat} and permission ${idperm}:`,
        error
      );
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver toutes les permissions d'un utilisateur
   */
  async findByUser(mat: string): Promise<UserPermission[]> {
    try {
      return await this.repository.find({
        where: { mat },
        relations: ['permission'],
        order: { permission: { nom_objet_bd: 'ASC' } },
      });
    } catch (error) {
      logger.error(`Failed to find permissions for user ${mat}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver tous les utilisateurs ayant une permission spécifique
   */
  async findByPermission(idperm: string): Promise<UserPermission[]> {
    try {
      return await this.repository.find({
        where: { idperm },
        relations: ['user'],
        order: { user: { matricule: 'ASC' } },
      });
    } catch (error) {
      logger.error(`Failed to find users with permission ${idperm}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver les permissions utilisateur par statut
   */
  async findByStatus(statut: UserPermissionStatus): Promise<UserPermission[]> {
    try {
      return await this.repository.find({
        where: { statut: statut as any },
        relations: ['user', 'permission'],
        order: { user: { matricule: 'ASC' } },
      });
    } catch (error) {
      logger.error(`Failed to find user permissions by status ${statut}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Créer une nouvelle permission utilisateur
   */
  async create(userPermissionData: Partial<UserPermission>): Promise<UserPermission> {
    try {
      const userPermission = this.repository.create(userPermissionData);
      return await this.repository.save(userPermission);
    } catch (error: any) {
      logger.error('Failed to create user permission:', error);
      
      if (error.code === '23505') { // Violation de contrainte d'unicité
        throw new DatabaseError('User permission already exists');
      }
      
      throw new DatabaseError('Failed to create user permission');
    }
  }

  /**
   * Mettre à jour une permission utilisateur
   */
  async update(id: string, updates: Partial<UserPermission>): Promise<void> {
    try {
      // Convertir les dates null en undefined pour TypeORM
      const processedUpdates = { ...updates };
      
      if ('granted_at' in processedUpdates && processedUpdates.granted_at === null) {
        processedUpdates.granted_at = undefined;
      }
      
      if ('revoked_at' in processedUpdates && processedUpdates.revoked_at === null) {
        processedUpdates.revoked_at = undefined;
      }

      const result = await this.repository.update({ id }, processedUpdates);
      
      if (result.affected === 0) {
        throw new NotFoundError(`User permission ${id} not found`);
      }
    } catch (error) {
      logger.error(`Failed to update user permission ${id}:`, error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to update user permission');
    }
  }

  /**
   * Supprimer une permission utilisateur
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.repository.delete({ id });
      
      if (result.affected === 0) {
        throw new NotFoundError(`User permission ${id} not found`);
      }
    } catch (error) {
      logger.error(`Failed to delete user permission ${id}:`, error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to delete user permission');
    }
  }

  /**
   * Supprimer une permission utilisateur par utilisateur et permission
   */
  async deleteByUserAndPermission(mat: string, idperm: string): Promise<void> {
    try {
      const result = await this.repository.delete({ mat, idperm });
      
      if (result.affected === 0) {
        throw new NotFoundError(`User permission not found for user ${mat} and permission ${idperm}`);
      }
    } catch (error) {
      logger.error(
        `Failed to delete user permission for user ${mat} and permission ${idperm}:`,
        error
      );
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to delete user permission');
    }
  }

  /**
   * Obtenir des statistiques sur les permissions utilisateur
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    granted: number;
    revoked: number;
    waiting: number;
  }> {
    try {
      const total = await this.repository.count();
      
      // Compter par statut
      const statusCounts = await this.repository
        .createQueryBuilder('userPermission')
        .select('userPermission.statut, COUNT(*) as count')
        .groupBy('userPermission.statut')
        .getRawMany();

      const byStatus: Record<string, number> = {};
      let granted = 0;
      let revoked = 0;
      let waiting = 0;

      statusCounts.forEach(row => {
        byStatus[row.statut] = parseInt(row.count);
        
        if (row.statut === 'granted') granted = parseInt(row.count);
        if (row.statut === 'revoked') revoked = parseInt(row.count);
        if (row.statut === 'waiting') waiting = parseInt(row.count);
      });

      return {
        total,
        byStatus,
        granted,
        revoked,
        waiting,
      };
    } catch (error) {
      logger.error('Failed to get user permission statistics:', error);
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Vérifier si une permission utilisateur existe
   */
  async exists(mat: string, idperm: string): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { mat, idperm },
      });
      return count > 0;
    } catch (error) {
      logger.error(
        `Failed to check if user permission exists for user ${mat} and permission ${idperm}:`,
        error
      );
      return false;
    }
  }

  /**
   * Récupérer les permissions utilisateur avec pagination
   */
  async findPaginated(
    page: number = 1,
    limit: number = 50,
    filters?: {
      mat?: string;
      idperm?: string;
      statut?: UserPermissionStatus;
    }
  ): Promise<{ userPermissions: UserPermission[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const where: FindOptionsWhere<UserPermission> = {};
      
      if (filters) {
        if (filters.mat) where.mat = filters.mat;
        if (filters.idperm) where.idperm = filters.idperm;
        if (filters.statut) where.statut = filters.statut as any;
      }

      const [userPermissions, total] = await this.repository.findAndCount({
        where,
        skip,
        take: limit,
        relations: ['user', 'permission'],
        order: { created_at: 'DESC' },
      });

      return { userPermissions, total };
    } catch (error) {
      logger.error('Failed to find user permissions with pagination:', error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Mettre à jour le statut de plusieurs permissions utilisateur
   */
  async bulkUpdateStatus(
    ids: string[],
    statut: UserPermissionStatus,
    grantedBy?: string
  ): Promise<void> {
    try {
      const updateData: Partial<UserPermission> = {
        statut,
        updated_at: new Date(),
      };

      // Gérer les dates selon le statut
      if (statut === 'granted') {
        updateData.granted_at = new Date();
        updateData.revoked_at = undefined;
        updateData.granted_by = grantedBy;
      } else if (statut === 'revoked') {
        updateData.revoked_at = new Date();
        updateData.granted_at = undefined;
        updateData.granted_by = undefined;
      } else {
        updateData.granted_at = undefined;
        updateData.revoked_at = undefined;
        updateData.granted_by = undefined;
      }

      await this.repository
        .createQueryBuilder()
        .update(UserPermission)
        .set(updateData)
        .where({ id: In(ids) })
        .execute();
    } catch (error) {
      logger.error(`Failed to bulk update user permission status to ${statut}:`, error);
      throw new DatabaseError('Failed to bulk update');
    }
  }
}