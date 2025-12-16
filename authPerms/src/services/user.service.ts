import { UserRepository } from '@/repositories/user.repository';
import { CryptoUtils } from '@/utils/crypto';
import { NotFoundError, ValidationError, AuthorizationError } from '@/utils/errors';
import logger from '@/utils/logger';

export class UserService {
  constructor(private userRepository: UserRepository) {}

  /**
   * Récupérer un utilisateur par matricule
   */
  async getUserByMatricule(matricule: string): Promise<any> {
    try {
      const user = await this.userRepository.findByMatricule(matricule);
      
      if (!user) {
        throw new NotFoundError(`User ${matricule} not found`);
      }

      // Ne pas retourner le mot de passe
      const { password, refresh_token_hash, ...userWithoutSensitiveData } = user;
      return userWithoutSensitiveData;
    } catch (error) {
      logger.error(`Failed to get user ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer tous les utilisateurs
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 50,
    filters?: {
      role?: string;
      is_active?: boolean;
      is_connected?: boolean;
    }
  ): Promise<{ users: any[]; total: number; page: number; limit: number }> {
    try {
      const { users, total } = await this.userRepository.findAllPaginated(
        page,
        limit,
        filters
      );

      // Supprimer les données sensibles
      const usersWithoutSensitiveData = users.map(user => {
        const { password, refresh_token_hash, ...userData } = user;
        return userData;
      });

      return {
        users: usersWithoutSensitiveData,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get all users:', error);
      throw error;
    }
  }

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(
    data: {
      matricule: string;
      role: string;
      password: string;
    },
    createdBy?: string
  ): Promise<any> {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.userRepository.findByMatricule(data.matricule);
      
      if (existingUser) {
        throw new ValidationError(`User with matricule ${data.matricule} already exists`);
      }

      // Hasher le mot de passe
      const hashedPassword = await CryptoUtils.hashPassword(data.password);

      // Créer l'utilisateur
      const user = await this.userRepository.create({
        matricule: data.matricule,
        role: data.role.toLowerCase(),
        password: hashedPassword,
        is_active: true,
        is_connected: false,
        created_by: createdBy,
      });

      // Ne pas retourner le mot de passe
      const { password, refresh_token_hash, ...userWithoutSensitiveData } = user;
      return userWithoutSensitiveData;
    } catch (error) {
      logger.error(`Failed to create user ${data.matricule}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(
    matricule: string,
    updates: Partial<{
      is_active: boolean;
      is_connected: boolean;
      role: string;
      password: string;
    }>,
    updatedBy?: string
  ): Promise<void> {
    try {
      // Vérifier si l'utilisateur existe
      const user = await this.userRepository.findByMatricule(matricule);
      
      if (!user) {
        throw new NotFoundError(`User ${matricule} not found`);
      }

      // Si un nouveau mot de passe est fourni, le hasher
      if (updates.password) {
        updates.password = await CryptoUtils.hashPassword(updates.password);
      }

      // Mettre à jour l'utilisateur
      await this.userRepository.update(matricule, {
        ...updates,
        updated_at: new Date(),
      });

      logger.info(`User ${matricule} updated successfully`);
    } catch (error) {
      logger.error(`Failed to update user ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Désactiver un utilisateur
   */
  async deactivateUser(matricule: string, deactivatedBy?: string): Promise<void> {
    try {
      await this.updateUser(matricule, {
        is_active: false,
        is_connected: false,
      }, deactivatedBy);
      
      logger.info(`User ${matricule} deactivated`);
    } catch (error) {
      logger.error(`Failed to deactivate user ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Activer un utilisateur
   */
  async activateUser(matricule: string, activatedBy?: string): Promise<void> {
    try {
      await this.updateUser(matricule, {
        is_active: true,
      }, activatedBy);
      
      logger.info(`User ${matricule} activated`);
    } catch (error) {
      logger.error(`Failed to activate user ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(matricule: string): Promise<void> {
    try {
      // Vérifier si l'utilisateur existe
      const user = await this.userRepository.findByMatricule(matricule);
      
      if (!user) {
        throw new NotFoundError(`User ${matricule} not found`);
      }

      // Soft delete: désactiver l'utilisateur
      await this.userRepository.update(matricule, {
        is_active: false,
        is_connected: false,
        refresh_token_hash: null,
        refresh_token_expiry: null,
      });

      logger.info(`User ${matricule} marked as inactive`);
    } catch (error) {
      logger.error(`Failed to delete user ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Rechercher des utilisateurs
   */
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ users: any[]; total: number; page: number; limit: number }> {
    try {
      const { users, total } = await this.userRepository.search(
        query,
        page,
        limit
      );

      // Supprimer les données sensibles
      const usersWithoutSensitiveData = users.map(user => {
        const { password, refresh_token_hash, ...userData } = user;
        return userData;
      });

      return {
        users: usersWithoutSensitiveData,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Failed to search users with query "${query}":`, error);
      throw error;
    }
  }

  /**
   * Récupérer les statistiques des utilisateurs
   */
  async getUserStatistics(): Promise<{
    total: number;
    byRole: Record<string, number>;
    active: number;
    connected: number;
  }> {
    try {
      const statistics = await this.userRepository.getStatistics();
      return statistics;
    } catch (error) {
      logger.error('Failed to get user statistics:', error);
      throw error;
    }
  }

  /**
   * Forcer la déconnexion d'un utilisateur
   */
  async forceLogout(matricule: string, forcedBy: string): Promise<void> {
    try {
      const user = await this.userRepository.findByMatricule(matricule);
      
      if (!user) {
        throw new NotFoundError(`User ${matricule} not found`);
      }

      await this.userRepository.update(matricule, {
        is_connected: false,
        refresh_token_hash: null,
        refresh_token_expiry: null,
      });

      logger.info(`User ${matricule} forcefully logged out by ${forcedBy}`);
    } catch (error) {
      logger.error(`Failed to force logout for ${matricule}:`, error);
      throw error;
    }
  }
}