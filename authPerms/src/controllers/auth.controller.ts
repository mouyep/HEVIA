import { Request, Response } from 'express';
import { AuthService } from '@/services/auth.service';
import { JWTService } from '@/services/jwt.service';
import { UserRepository } from '@/repositories/user.repository';
import { ExternalAPIService } from '@/services/external-api.service';
import { TokenRepository } from '@/repositories/token.repository';
import { AuthRequest } from '@/middleware/auth.middleware';
import { authSchemas } from '@/utils/validation-schemas';
import { AuditService } from '@/services/audit.service';
import { ResponseBuilder } from '@/utils/response';
import { asyncHandler, validateRequest } from '@/middleware/error.middleware';
import logger from '@/utils/logger';
import { CryptoUtils } from '@/utils/crypto';

// Initialisation des services
const userRepository = new UserRepository();
const jwtService = new JWTService();
const externalApiService = new ExternalAPIService();
const tokenRepository = new TokenRepository();
const authService = new AuthService(
  userRepository,
  jwtService,
  externalApiService
);

export class AuthController {
  /**
   * Authentifier un utilisateur
   */
  static authenticate = asyncHandler(async (req: Request, res: Response) => {
    // Validation
    await validateRequest(authSchemas.login)(req, res, async () => {
      const { matricule, password, role } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      try {
        // Authentifier l'utilisateur
        const result = await authService.authenticate(matricule, password, role);

        // Journaliser la connexion réussie
        AuditService.logLoginAttempt(
          matricule,
          role,
          true,
          ipAddress,
          userAgent
        );

        // Retourner la réponse
        res.status(200).json(
          ResponseBuilder.success({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
            tokenType: 'Bearer',
            expiresIn: 7200, // 2 heures en secondes
          }, 'Authentication successful')
        );
      } catch (error: any) {
        // Journaliser l'échec de connexion
        AuditService.logLoginAttempt(
          matricule,
          role,
          false,
          ipAddress,
          userAgent,
          error.message
        );

        throw error;
      }
    });
  });

  /**
   * Rafraîchir un access token
   */
  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    await validateRequest(authSchemas.refreshToken)(req, res, async () => {
      const { refreshToken } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      try {
        // Rafraîchir le token
        const newAccessToken = await authService.refreshAccessToken(refreshToken);

        // Décoder le token pour obtenir les informations utilisateur
        const decoded = jwtService.decodeToken(newAccessToken);
        
        if (decoded) {
          // Journaliser le rafraîchissement réussi
          AuditService.logTokenRefresh(
            decoded.matricule,
            decoded.role,
            true,
            ipAddress
          );
        }

        // Retourner le nouveau token
        res.status(200).json(
          ResponseBuilder.success({
            accessToken: newAccessToken,
            tokenType: 'Bearer',
            expiresIn: 7200, // 2 heures en secondes
          }, 'Token refreshed successfully')
        );
      } catch (error: any) {
        // Journaliser l'échec du rafraîchissement
        AuditService.logTokenRefresh(
          'unknown',
          'unknown',
          false,
          ipAddress,
          error.message
        );

        throw error;
      }
    });
  });

  /**
   * Déconnecter un utilisateur
   */
  static logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    if (!user) {
      res.status(200).json(
        ResponseBuilder.success(null, 'Logout completed')
      );
      return;
    }

    try {
      // Blacklister le token actuel si disponible
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Vérifier que token n'est pas undefined
        if (token) {
          await tokenRepository.blacklistToken(token, user.matricule);
        }
      }

      // Déconnecter l'utilisateur
      await authService.logout(user.matricule);

      // Journaliser la déconnexion
      AuditService.logLogout(user.matricule, user.role, ipAddress);

      res.status(200).json(
        ResponseBuilder.success(null, 'Logout successful')
      );
    } catch (error) {
      logger.error(`Logout failed for ${user.matricule}:`, error);
      
      // Même en cas d'erreur, retourner une réponse positive
      res.status(200).json(
        ResponseBuilder.success(null, 'Logout completed')
      );
    }
  });

  /**
   * Vérifier la validité d'un token
   */
  static validateToken = asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(
        ResponseBuilder.error('No token provided')
      );
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Vérifier que token n'est pas undefined
    if (!token) {
      res.status(401).json(
        ResponseBuilder.error('Invalid token format')
      );
      return;
    }

    try {
      // Vérifier si le token est blacklisté
      const isBlacklisted = await tokenRepository.isTokenBlacklisted(token);
      
      if (isBlacklisted) {
        res.status(200).json(
          ResponseBuilder.success({ valid: false, reason: 'blacklisted' }, 'Token is blacklisted')
        );
        return;
      }

      // Vérifier la validité du token
      const isValid = await authService.validateToken(token);
      
      if (isValid) {
        const decoded = jwtService.decodeToken(token);
        
        res.status(200).json(
          ResponseBuilder.success({
            valid: true,
            user: decoded,
            expiresIn: jwtService.getTokenTimeRemaining(token),
          }, 'Token is valid')
        );
      } else {
        res.status(200).json(
          ResponseBuilder.success({ valid: false, reason: 'invalid' }, 'Token is invalid')
        );
      }
    } catch (error) {
      res.status(200).json(
        ResponseBuilder.success({ valid: false, reason: 'error' }, 'Token validation failed')
      );
    }
  });

  /**
   * Changer le mot de passe
   */
  static changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    const { oldPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Validation basique
    if (!oldPassword || !newPassword) {
      res.status(400).json(
        ResponseBuilder.error('Old password and new password are required')
      );
      return;
    }

    if (oldPassword === newPassword) {
      res.status(400).json(
        ResponseBuilder.error('New password must be different from old password')
      );
      return;
    }

    try {
      // Changer le mot de passe
      await authService.changePassword(user.matricule, oldPassword, newPassword);

      // Journaliser le changement de mot de passe
      AuditService.logPasswordChange(user.matricule, user.role, true, ipAddress);

      // Blacklister tous les tokens existants
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token) {
          await tokenRepository.blacklistToken(token, user.matricule);
        }
      }

      res.status(200).json(
        ResponseBuilder.success(null, 'Password changed successfully')
      );
    } catch (error: any) {
      // Journaliser l'échec
      AuditService.logPasswordChange(
        user.matricule,
        user.role,
        false,
        ipAddress,
        error.message
      );

      throw error;
    }
  });

  /**
   * Vérifier la santé du service
   */
  static healthCheck = asyncHandler(async (req: Request, res: Response) => {
    // Le paramètre 'req' n'est pas utilisé dans cette méthode, on peut le garder pour la signature
    // ou utiliser '_req' pour indiquer qu'il n'est pas utilisé
    try {
      // Vérifier la connexion à la base de données
      await userRepository.findByMatricule('TEST000000000');
      
      // Vérifier la santé de l'API externe (sans échec si indisponible)
      const externalApiHealth = await externalApiService.checkHealth();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'authperms',
        version: process.env.npm_package_version || '1.0.0',
        database: 'connected',
        externalApi: externalApiHealth.healthy ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        
      };

      res.status(200).json(ResponseBuilder.success(health, 'Service is healthy'));
    } catch (error) {
      const health = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'authperms',
        version: process.env.npm_package_version || '1.0.0',
        database: 'disconnected',
        uptime: process.uptime(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

         // CORRECTION ICI : Créer un tableau d'erreurs avec la structure correcte
    const errorDetails = [
      {
        field: 'database',
        message: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
        details: health // Inclure les détails de santé si nécessaire
      }
    ];

    res.status(503).json(
      ResponseBuilder.error('Service is unhealthy', errorDetails, 503)
    );
    
    }
  });

  /**
   * Obtenir les informations de l'utilisateur connecté
   */
  static getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    
    if (!user) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    try {
      // Récupérer les informations complètes de l'utilisateur
      const userDetails = await userRepository.findByMatricule(user.matricule);
      
      if (!userDetails) {
        res.status(404).json(
          ResponseBuilder.error('User not found')
        );
        return;
      }

      // Ne pas retourner les données sensibles
      const { password, refresh_token_hash, ...safeUserDetails } = userDetails;

      // Récupérer les informations de l'API externe
      const externalUserInfo = await externalApiService.getUserInfo(
        user.matricule,
        user.role
      );

      const response = {
        ...safeUserDetails,
        externalInfo: externalUserInfo,
        permissions: [], // Serait rempli par le service de permissions
      };

      res.status(200).json(
        ResponseBuilder.success(response, 'User information retrieved')
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Forcer la déconnexion d'un utilisateur (admin seulement)
   */
  static forceLogout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const adminUser = req.user;
    
    if (!adminUser) {
      res.status(401).json(
        ResponseBuilder.error('Authentication required')
      );
      return;
    }

    const { matricule } = req.params;

    if (!matricule) {
      res.status(400).json(
        ResponseBuilder.error('Matricule is required')
      );
      return;
    }

    try {
      // Vérifier que l'admin a le droit de forcer la déconnexion
      if (!['admin', 'doyen', 'recteur'].includes(adminUser.role)) {
        res.status(403).json(
          ResponseBuilder.error('Insufficient permissions')
        );
        return;
      }

      // Forcer la déconnexion
      await userRepository.update(matricule, {
        is_connected: false,
        refresh_token_hash: undefined, // Utiliser undefined au lieu de null
        refresh_token_expiry: undefined, // Utiliser undefined au lieu de null
      });

      // Journaliser l'action
      AuditService.logSystemEvent(
        'FORCE_LOGOUT',
        { targetUser: matricule },
        adminUser.matricule
      );

      res.status(200).json(
        ResponseBuilder.success(null, `User ${matricule} forcefully logged out`)
      );
    } catch (error) {
      throw error;
    }
  });
}