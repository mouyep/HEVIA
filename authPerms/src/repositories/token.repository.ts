import { Token } from '@/models/Token';
import { AppDataSource } from '@/database/connection';
import { DatabaseError } from '@/utils/errors';
import logger from '@/utils/logger';

export class TokenRepository {
  private repository = AppDataSource.getRepository(Token);

  /**
   * Blacklister un token
   */
  async blacklistToken(token: string, blacklistedBy?: string): Promise<void> {
    try {
      // Vérifier si le token est déjà blacklisté
      const existingToken = await this.repository.findOne({
        where: { token },
      });

      if (existingToken) {
        logger.warn(`Token already blacklisted: ${token.substring(0, 20)}...`);
        return;
      }

      // Calculer la date d'expiration (2 heures pour les access tokens)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const tokenEntity = this.repository.create({
        token,
        expires_at: expiresAt,
        blacklisted_by: blacklistedBy,
      });

      await this.repository.save(tokenEntity);
      
      logger.info(`Token blacklisted successfully: ${token.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      throw new DatabaseError('Failed to blacklist token');
    }
  }

  /**
   * Vérifier si un token est blacklisté
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenEntity = await this.repository.findOne({
        where: { token },
      });

      if (!tokenEntity) {
        return false;
      }

      // Vérifier si le token a expiré
      if (new Date() > tokenEntity.expires_at) {
        // Supprimer le token expiré
        await this.repository.remove(tokenEntity);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check if token is blacklisted:', error);
      return false;
    }
  }

  /**
   * Nettoyer les tokens expirés
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .from(Token)
        .where('expires_at < :now', { now: new Date() })
        .execute();

      const deletedCount = result.affected || 0;
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired tokens`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * Récupérer tous les tokens blacklistés
   */
  async findAllBlacklistedTokens(): Promise<Token[]> {
    try {
      return await this.repository.find({
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      logger.error('Failed to find all blacklisted tokens:', error);
      throw new DatabaseError('Database operation failed');
    }
  }

  /**
   * Supprimer un token de la blacklist
   */
  async removeFromBlacklist(token: string): Promise<void> {
    try {
      await this.repository.delete({ token });
      logger.info(`Token removed from blacklist: ${token.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Failed to remove token from blacklist:', error);
      throw new DatabaseError('Failed to remove token from blacklist');
    }
  }

  /**
   * Obtenir des statistiques sur les tokens blacklistés
   */
  async getStatistics(): Promise<{
    total: number;
    expired: number;
    active: number;
  }> {
    try {
      const total = await this.repository.count();
      
      const expired = await this.repository
        .createQueryBuilder('token')
        .where('token.expires_at < :now', { now: new Date() })
        .getCount();

      const active = total - expired;

      return {
        total,
        expired,
        active,
      };
    } catch (error) {
      logger.error('Failed to get token statistics:', error);
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Blacklister plusieurs tokens
   */
  async bulkBlacklistTokens(
    tokens: string[],
    blacklistedBy?: string
  ): Promise<void> {
    try {
      const tokenEntities = tokens.map(token => {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        return this.repository.create({
          token,
          expires_at: expiresAt,
          blacklisted_by: blacklistedBy,
        });
      });

      await this.repository.save(tokenEntities);
      
      logger.info(`Bulk blacklisted ${tokens.length} tokens`);
    } catch (error) {
      logger.error('Failed to bulk blacklist tokens:', error);
      throw new DatabaseError('Failed to bulk blacklist tokens');
    }
  }

  /**
   * Vérifier si plusieurs tokens sont blacklistés
   */
  async checkTokensBlacklisted(tokens: string[]): Promise<Record<string, boolean>> {
    try {
      const result: Record<string, boolean> = {};
      
      for (const token of tokens) {
        result[token] = await this.isTokenBlacklisted(token);
      }

      return result;
    } catch (error) {
      logger.error('Failed to check multiple tokens:', error);
      throw new DatabaseError('Failed to check tokens');
    }
  }
}