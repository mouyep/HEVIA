import { User } from '@/models/User';
import { UserRepository } from '@/repositories/user.repository';
import { JWTService } from './jwt.service';
import { CryptoUtils } from '@/utils/crypto';
import { ExternalAPIService } from './external-api.service';
import { 
  AuthenticationError, 
  ValidationError, 
  NotFoundError, 
  ExternalAPIError,
  TokenExpiredError 
} from '@/utils/errors';
import logger from '@/utils/logger';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JWTService,
    private externalApiService: ExternalAPIService
  ) {}

  /**
   * Authentifie un utilisateur
   */
  async authenticate(matricule: string, password: string, role: string): Promise<{ 
    accessToken: string; 
    refreshToken: string;
    user: Partial<User> 
  }> {
    try {
      // 1. Vérifier l'existence de l'utilisateur dans l'API externe
      const userExists = await this.externalApiService.verifyUserExistence(matricule, role);
      
      if (!userExists) {
        throw new NotFoundError(`User with matricule ${matricule} and role ${role} not found`);
      }

      // 2. Rechercher l'utilisateur dans la base locale
      let user = await this.userRepository.findByMatricule(matricule);

      // 3. Si l'utilisateur n'existe pas localement, le créer avec un mot de passe temporaire
      if (!user) {
        user = await this.userRepository.create({
          matricule,
          role: role.toLowerCase(),
          password: await CryptoUtils.hashPassword(password),
          is_active: true,
          is_connected: false,
        });
      } else {
        // Vérifier si le compte est actif
        if (!user.is_active) {
          throw new AuthenticationError('Account is deactivated');
        }

        // Vérifier le mot de passe
        const isPasswordValid = await CryptoUtils.comparePassword(password, user.password);
        if (!isPasswordValid) {
          throw new AuthenticationError('Invalid credentials');
        }
      }

      // 4. Générer les tokens
      const accessToken = this.jwtService.generateAccessToken({
        matricule: user.matricule,
        role: user.role,
      });

      const refreshToken = this.jwtService.generateRefreshToken({
        matricule: user.matricule,
        role: user.role,
      });

      // 5. Mettre à jour l'utilisateur
          // 5. Mettre à jour l'utilisateur
    const refreshTokenHash = CryptoUtils.hashToken(refreshToken);
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 jours

    await this.userRepository.update(user.matricule, {
      is_connected: true,
      last_login_at: new Date(),
      refresh_token_hash: refreshTokenHash,
      refresh_token_expiry: refreshTokenExpiry,
    });

      // 6. Retourner les tokens et les infos utilisateur
      return {
        accessToken,
        refreshToken,
        user: {
          matricule: user.matricule,
          role: user.role,
          is_active: user.is_active,
        },
      };
    } catch (error) {
      logger.error(`Authentication failed for ${matricule}:`, error);
      
      if (error instanceof AuthenticationError || 
          error instanceof NotFoundError || 
          error instanceof ValidationError) {
        throw error;
      }
      
      throw new AuthenticationError('Authentication failed');
    }
  }

  /**
   * Rafraîchir un access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // 1. Vérifier la validité du refresh token
      const decoded = this.jwtService.verifyRefreshToken(refreshToken);
      
      if (!decoded) {
        throw new InvalidTokenError('Invalid refresh token');
      }

      // 2. Récupérer l'utilisateur
      const user = await this.userRepository.findByMatricule(decoded.matricule);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // 3. Vérifier si le refresh token correspond à celui stocké
      const refreshTokenHash = CryptoUtils.hashToken(refreshToken);
      if (user.refresh_token_hash !== refreshTokenHash) {
        throw new InvalidTokenError('Refresh token mismatch');
      }

      // 4. Vérifier l'expiration
      if (user.refresh_token_expiry && new Date() > user.refresh_token_expiry) {
        throw new TokenExpiredError('Refresh token expired');
      }

      // 5. Générer un nouveau access token
      const newAccessToken = this.jwtService.generateAccessToken({
        matricule: user.matricule,
        role: user.role,
      });

      return newAccessToken;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Déconnecter un utilisateur
   */
    /**
   * Déconnecter un utilisateur
   */
  async logout(matricule: string): Promise<void> {
    try {
      await this.userRepository.update(matricule, {
        is_connected: false,
        refresh_token_hash: undefined, // Changer null à undefined
        refresh_token_expiry: undefined, // Changer null à undefined
      });
      
      logger.info(`User ${matricule} logged out successfully`);
    } catch (error) {
      logger.error(`Logout failed for ${matricule}:`, error);
      throw error;
    }
  }

  /**
   * Vérifier la validité d'un token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const decoded = this.jwtService.verifyAccessToken(accessToken);
      return !!decoded;
    } catch (error) {
      return false;
    }
  }

  /**
   * Changer le mot de passe
   */
  async changePassword(matricule: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.userRepository.findByMatricule(matricule);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Vérifier l'ancien mot de passe
      const isPasswordValid = await CryptoUtils.comparePassword(oldPassword, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError('Old password is incorrect');
      }

      // Hash le nouveau mot de passe
      const newPasswordHash = await CryptoUtils.hashPassword(newPassword);

      // Mettre à jour
      await this.userRepository.update(matricule, {
        password: newPasswordHash,
      });

      logger.info(`Password changed successfully for ${matricule}`);
    } catch (error) {
      logger.error(`Password change failed for ${matricule}:`, error);
      throw error;
    }
  }
}