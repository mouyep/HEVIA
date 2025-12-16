import { User } from '@/models/User';
import { AppDataSource } from '@/database/connection';
import { DatabaseError, NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';
import { FindOptionsWhere, Like, Between, In } from 'typeorm';

export class UserRepository {
  private repository = AppDataSource.getRepository(User);

  /**
   * Trouver un utilisateur par matricule
   */
  async findByMatricule(matricule: string): Promise<User | null> {
    try {
      return await this.repository.findOne({
        where: { matricule },
      });
    } catch (error) {
      logger.error(`Failed to find user by matricule ${matricule}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver un utilisateur par matricule avec ses permissions
   */
  async findByMatriculeWithPermissions(matricule: string): Promise<User | null> {
    try {
      return await this.repository.findOne({
        where: { matricule },
        relations: ['userPermissions', 'userPermissions.permission'],
      });
    } catch (error) {
      logger.error(`Failed to find user with permissions by matricule ${matricule}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver des utilisateurs par rôle
   */
  async findByRole(role: string): Promise<User[]> {
    try {
      return await this.repository.find({
        where: { role },
        order: { matricule: 'ASC' },
      });
    } catch (error) {
      logger.error(`Failed to find users by role ${role}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Trouver tous les utilisateurs (paginated)
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 50,
    filters?: {
      role?: string;
      is_active?: boolean;
      is_connected?: boolean;
    }
  ): Promise<{ users: User[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const where: FindOptionsWhere<User> = {};
      
      if (filters) {
        if (filters.role) where.role = filters.role;
        if (filters.is_active !== undefined) where.is_active = filters.is_active;
        if (filters.is_connected !== undefined) where.is_connected = filters.is_connected;
      }

      const [users, total] = await this.repository.findAndCount({
        where,
        skip,
        take: limit,
        order: { created_at: 'DESC' },
      });

      return { users, total };
    } catch (error) {
      logger.error('Failed to find all users:', error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Créer un nouvel utilisateur
   */
  async create(userData: Partial<User>): Promise<User> {
    try {
      const user = this.repository.create(userData);
      return await this.repository.save(user);
    } catch (error: any) {
      logger.error('Failed to create user:', error);
      
      // Vérifier les contraintes d'unicité
      if (error.code === '23505') { // Violation de contrainte d'unicité
        throw new DatabaseError('User with this matricule already exists');
      }
      
      throw new DatabaseError('Failed to create user');
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
  async update(matricule: string, updates: Partial<User>): Promise<void> {
    try {
      const result = await this.repository.update({ matricule }, updates);
      
      if (result.affected === 0) {
        throw new NotFoundError(`User ${matricule} not found`);
      }
    } catch (error) {
      logger.error(`Failed to update user ${matricule}:`, error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to update user');
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async delete(matricule: string): Promise<void> {
    try {
      const result = await this.repository.delete({ matricule });
      
      if (result.affected === 0) {
        throw new NotFoundError(`User ${matricule} not found`);
      }
    } catch (error) {
      logger.error(`Failed to delete user ${matricule}:`, error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to delete user');
    }
  }

  /**
   * Rechercher des utilisateurs
   */
  async search(
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ users: User[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [users, total] = await this.repository.findAndCount({
        where: [
          { matricule: Like(`%${query}%`) },
          { role: Like(`%${query}%`) },
        ],
        skip,
        take: limit,
        order: { matricule: 'ASC' },
      });

      return { users, total };
    } catch (error) {
      logger.error(`Failed to search users with query "${query}":`, error);
      throw new DatabaseError('Search operation failed');
    }
  }

  /**
   * Obtenir des statistiques sur les utilisateurs
   */
  async getStatistics(): Promise<{
    total: number;
    byRole: Record<string, number>;
    active: number;
    connected: number;
  }> {
    try {
      const total = await this.repository.count();
      
      // Compter par rôle
      const roleCounts = await this.repository
        .createQueryBuilder('user')
        .select('user.role, COUNT(*) as count')
        .groupBy('user.role')
        .getRawMany();

      const byRole: Record<string, number> = {};
      roleCounts.forEach(row => {
        byRole[row.role] = parseInt(row.count);
      });

      // Compter les utilisateurs actifs
      const active = await this.repository.count({
        where: { is_active: true },
      });

      // Compter les utilisateurs connectés
      const connected = await this.repository.count({
        where: { is_connected: true },
      });

      return {
        total,
        byRole,
        active,
        connected,
      };
    } catch (error) {
      logger.error('Failed to get user statistics:', error);
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Trouver les utilisateurs connectés
   */
  async findConnectedUsers(): Promise<User[]> {
    try {
      return await this.repository.find({
        where: { is_connected: true },
        order: { last_login_at: 'DESC' },
      });
    } catch (error) {
      logger.error('Failed to find connected users:', error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Mettre à jour la dernière connexion
   */
  async updateLastLogin(matricule: string): Promise<void> {
    try {
      await this.repository.update(
        { matricule },
        { last_login_at: new Date() }
      );
    } catch (error) {
      logger.error(`Failed to update last login for ${matricule}:`, error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Vérifier si un utilisateur existe
   */
  async exists(matricule: string): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { matricule },
      });
      return count > 0;
    } catch (error) {
      logger.error(`Failed to check if user ${matricule} exists:`, error);
      return false;
    }
  }

  /**
   * Compter les utilisateurs par état
   */
  async countByStatus(): Promise<{ active: number; inactive: number }> {
    try {
      const active = await this.repository.count({
        where: { is_active: true },
      });
      
      const inactive = await this.repository.count({
        where: { is_active: false },
      });

      return { active, inactive };
    } catch (error) {
      logger.error('Failed to count users by status:', error);
      throw new DatabaseError('Database operation failed');
    }
  }
}