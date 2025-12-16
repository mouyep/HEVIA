import jwt, { SignOptions, Algorithm } from 'jsonwebtoken';
import { CryptoUtils } from '@/utils/crypto';
import { InvalidTokenError, TokenExpiredError } from '@/utils/errors';
import logger from '@/utils/logger';

export interface JWTTokenPayload {
  matricule: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly algorithm: Algorithm;

  constructor() {
    // IMPORTANT: Utiliser des secrets différents pour access et refresh tokens
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'your_access_secret_change_me';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_me';
    
    // Format de chaîne conforme
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '2h';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    
    this.algorithm = (process.env.JWT_ALGORITHM as Algorithm) || 'HS256';
  }

  /**
   * Générer un access token
   */
  generateAccessToken(payload: Omit<JWTTokenPayload, 'iat' | 'exp'>): string {
    const tokenPayload: JWTTokenPayload = {
      ...payload,
    };

    // jsonwebtoken accepte les chaînes comme '2h', '7d' via la librairie ms interne
    const options = {
      expiresIn: this.accessTokenExpiry,
      algorithm: this.algorithm,
    } as SignOptions;

    return jwt.sign(tokenPayload, this.accessTokenSecret, options);
  }

  /**
   * Générer un refresh token
   */
  generateRefreshToken(payload: Omit<JWTTokenPayload, 'iat' | 'exp'>): string {
    const tokenPayload: JWTTokenPayload = {
      ...payload,
    };

    const options = {
      expiresIn: this.refreshTokenExpiry,
      algorithm: this.algorithm,
    } as SignOptions;

    return jwt.sign(tokenPayload, this.refreshTokenSecret, options);
  }

  /**
   * Vérifier un access token
   */
  verifyAccessToken(token: string): JWTTokenPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        algorithms: [this.algorithm],
      }) as JWTTokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new InvalidTokenError('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Vérifier un refresh token
   */
  verifyRefreshToken(token: string): JWTTokenPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret, {
        algorithms: [this.algorithm],
      }) as JWTTokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new InvalidTokenError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Décoder un token sans vérification
   */
  decodeToken(token: string): JWTTokenPayload | null {
    try {
      return jwt.decode(token) as JWTTokenPayload;
    } catch (error) {
      logger.error('Token decoding failed:', error);
      return null;
    }
  }

  /**
   * Vérifier si un token est expiré
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTTokenPayload;
      
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      return true;
    }
  }

  /**
   * Récupérer le temps restant avant expiration
   */
  getTokenTimeRemaining(token: string): number {
    try {
      const decoded = jwt.decode(token) as JWTTokenPayload;
      
      if (!decoded || !decoded.exp) {
        return 0;
      }

      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, decoded.exp - now);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Blacklister un token
   */
  blacklistToken(token: string, reason?: string): string {
    const tokenHash = CryptoUtils.hashToken(token);
    logger.info(`Token blacklisted: ${tokenHash}, Reason: ${reason || 'manual blacklist'}`);
    return tokenHash;
  }

  /**
   * Générer à la fois access et refresh tokens
   */
  generateTokenPair(payload: Omit<JWTTokenPayload, 'iat' | 'exp'>): {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
  } {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    
    // Décoder pour obtenir les dates d'expiration
    const decodedAccess = this.decodeToken(accessToken);
    const decodedRefresh = this.decodeToken(refreshToken);
    
    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: decodedAccess?.exp || 0,
      refreshTokenExpiry: decodedRefresh?.exp || 0,
    };
  }
}