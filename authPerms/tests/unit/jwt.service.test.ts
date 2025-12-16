import { JWTService, JWTTokenPayload } from '../../src/services/jwt.service';
import { TokenExpiredError, InvalidTokenError } from '../../src/utils/errors';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest';

vi.mock('jsonwebtoken');

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockJWT: Mocked<typeof jwt>;

  beforeEach(() => {
    jwtService = new JWTService();
    mockJWT = jwt as Mocked<typeof jwt>;

    // Configuration des variables d'environnement pour les tests
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_ACCESS_EXPIRY = '2h';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.JWT_ALGORITHM = 'HS256';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', () => {
      // Arrange
      const payload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
      };
      const expectedToken = 'mock-access-token';
      mockJWT.sign.mockReturnValue(expectedToken as any);

      // Act
      const result = jwtService.generateAccessToken(payload);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJWT.sign).toHaveBeenCalledWith(
        payload,
        'test-secret-key',
        {
          expiresIn: '2h',
          algorithm: 'HS256',
        }
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload', () => {
      // Arrange
      const payload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
      };
      const expectedToken = 'mock-refresh-token';
      mockJWT.sign.mockReturnValue(expectedToken as any);

      // Act
      const result = jwtService.generateRefreshToken(payload);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJWT.sign).toHaveBeenCalledWith(
        payload,
        'test-secret-key',
        {
          expiresIn: '7d',
          algorithm: 'HS256',
        }
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      // Arrange
      const token = 'valid-access-token';
      const expectedPayload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        iat: 1234567890,
        exp: 1234567890 + 7200,
      };
      mockJWT.verify.mockReturnValue(expectedPayload as any);

      // Act
      const result = jwtService.verifyAccessToken(token);

      // Assert
      expect(result).toEqual(expectedPayload);
      expect(mockJWT.verify).toHaveBeenCalledWith(
        token,
        'test-secret-key',
        { algorithms: ['HS256'] }
      );
    });

    it('should throw TokenExpiredError for expired token', () => {
      // Arrange
      const token = 'expired-access-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      mockJWT.verify.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => jwtService.verifyAccessToken(token)).toThrow(TokenExpiredError);
    });

    it('should throw InvalidTokenError for invalid token', () => {
      // Arrange
      const token = 'invalid-access-token';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      mockJWT.verify.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => jwtService.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      // Arrange
      const token = 'valid-refresh-token';
      const expectedPayload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        iat: 1234567890,
        exp: 1234567890 + 604800, // 7 jours
      };
      mockJWT.verify.mockReturnValue(expectedPayload as any);

      // Act
      const result = jwtService.verifyRefreshToken(token);

      // Assert
      expect(result).toEqual(expectedPayload);
      expect(mockJWT.verify).toHaveBeenCalledWith(
        token,
        'test-secret-key',
        { algorithms: ['HS256'] }
      );
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Arrange
      const token = 'some-token';
      const expectedPayload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        iat: 1234567890,
        exp: 1234567890 + 7200,
      };
      mockJWT.decode.mockReturnValue(expectedPayload as any);

      // Act
      const result = jwtService.decodeToken(token);

      // Assert
      expect(result).toEqual(expectedPayload);
      expect(mockJWT.decode).toHaveBeenCalledWith(token);
    });

    it('should return null for invalid token', () => {
      // Arrange
      const token = 'invalid-token';
      mockJWT.decode.mockReturnValue(null);

      // Act
      const result = jwtService.decodeToken(token);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      // Arrange
      const token = 'expired-token';
      const payload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expiré il y a 1 heure
      };
      mockJWT.decode.mockReturnValue(payload as any);

      // Act
      const result = jwtService.isTokenExpired(token);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for valid token', () => {
      // Arrange
      const token = 'valid-token';
      const payload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        exp: Math.floor(Date.now() / 1000) + 3600, // Valide pour encore 1 heure
      };
      mockJWT.decode.mockReturnValue(payload as any);

      // Act
      const result = jwtService.isTokenExpired(token);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for token without exp', () => {
      // Arrange
      const token = 'token-without-exp';
      const payload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
      };
      mockJWT.decode.mockReturnValue(payload as any);

      // Act
      const result = jwtService.isTokenExpired(token);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getTokenTimeRemaining', () => {
    it('should return correct time remaining', () => {
      // Arrange
      const token = 'valid-token';
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 1800; // Expire dans 30 minutes
      const payload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        exp,
      };
      mockJWT.decode.mockReturnValue(payload as any);

      // Act
      const result = jwtService.getTokenTimeRemaining(token);

      // Assert
      expect(result).toBeGreaterThan(1790); // Environ 1800 secondes
      expect(result).toBeLessThanOrEqual(1800);
    });

    it('should return 0 for expired token', () => {
      // Arrange
      const token = 'expired-token';
      const payload: JWTTokenPayload = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        exp: Math.floor(Date.now() / 1000) - 3600,
      };
      mockJWT.decode.mockReturnValue(payload as any);

      // Act
      const result = jwtService.getTokenTimeRemaining(token);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token and return hash', () => {
      // Arrange
      const token = 'token-to-blacklist';
      const reason = 'test blacklist';

      // Mock CryptoUtils.hashToken
      const mockCryptoUtils = {
        hashToken: vi.fn().mockReturnValue('hashed-token')
      };
      
      // Utiliser vi.importActual pour mock partiel
      vi.doMock('@/utils/crypto', () => ({
        CryptoUtils: mockCryptoUtils
      }));

      // Re-import pour obtenir le mock
      const { CryptoUtils } = require('@/utils/crypto');

      // Act
      const result = jwtService.blacklistToken(token, reason);

      // Assert
      expect(result).toBe('hashed-token');
      expect(CryptoUtils.hashToken).toHaveBeenCalledWith(token);
    });
  });
});