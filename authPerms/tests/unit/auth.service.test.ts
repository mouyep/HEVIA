import { AuthService } from '../../src/services/auth.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { JWTService } from '../../src/services/jwt.service';
import { ExternalAPIService } from '../../src/services/external-api.service';
import { CryptoUtils } from '../../src/utils/crypto';
import { testUsers, integrationTestUsers } from '../fixtures/users.fixture';
import { 
  AuthenticationError, 
  NotFoundError,
  TokenExpiredError 
} from '../../src/utils/errors';
import {beforeEach, describe, expect, it, vi} from 'vitest'
// Mocks
vi.mock('../../src/repositories/user.repository');
vi.mock('../../src/services/jwt.service');
vi.mock('../../src/services/external-api.service');
vi.mock('../../src/utils/crypto');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: vi.Mocked<UserRepository>;
  let mockJWTService: vi.Mocked<JWTService>;
  let mockExternalAPIService: vi.Mocked<ExternalAPIService>;

  beforeEach(() => {
    // Réinitialiser les mocks
    vi.clearAllMocks();
    
    // Créer les instances mockées
    mockUserRepository = new UserRepository() as vi.Mocked<UserRepository>;
    mockJWTService = new JWTService() as vi.Mocked<JWTService>;
    mockExternalAPIService = new ExternalAPIService() as vi.Mocked<ExternalAPIService>;
    
    // Créer le service avec les mocks
    authService = new AuthService(
      mockUserRepository,
      mockJWTService,
      mockExternalAPIService
    );
  });

  describe('authenticate', () => {
    it('should authenticate user successfully', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      const mockUser = {
        matricule: student.matricule,
        role: student.role,
        password: await CryptoUtils.hashPassword(student.password),
        is_active: true,
        is_connected: false,
      };

      mockExternalAPIService.verifyUserExistence.mockResolvedValue(true);
      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockJWTService.generateAccessToken.mockReturnValue('mock-access-token');
      mockJWTService.generateRefreshToken.mockReturnValue('mock-refresh-token');
      mockUserRepository.update.mockResolvedValue();

      // Act
      const result = await authService.authenticate(
        student.matricule,
        student.password,
        student.role
      );

      // Assert
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken', 'mock-refresh-token');
      expect(result.user).toHaveProperty('matricule', student.matricule);
      expect(result.user).toHaveProperty('role', student.role);
      
      expect(mockExternalAPIService.verifyUserExistence).toHaveBeenCalledWith(
        student.matricule,
        student.role
      );
      expect(mockUserRepository.findByMatricule).toHaveBeenCalledWith(student.matricule);
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError when user does not exist in external API', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      mockExternalAPIService.verifyUserExistence.mockResolvedValue(false);

      // Act & Assert
      await expect(
        authService.authenticate(student.matricule, student.password, student.role)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError when user is inactive', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      const mockUser = {
        matricule: student.matricule,
        role: student.role,
        password: await CryptoUtils.hashPassword(student.password),
        is_active: false,
        is_connected: false,
      };

      mockExternalAPIService.verifyUserExistence.mockResolvedValue(true);
      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(
        authService.authenticate(student.matricule, student.password, student.role)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when password is incorrect', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      const mockUser = {
        matricule: student.matricule,
        role: student.role,
        password: await CryptoUtils.hashPassword('wrong-password'), // Mot de passe différent
        is_active: true,
        is_connected: false,
      };

      mockExternalAPIService.verifyUserExistence.mockResolvedValue(true);
      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(
        authService.authenticate(student.matricule, student.password, student.role)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should create new user if not found locally', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      mockExternalAPIService.verifyUserExistence.mockResolvedValue(true);
      mockUserRepository.findByMatricule.mockResolvedValue(null); // Utilisateur non trouvé localement
      mockUserRepository.create.mockResolvedValue({
        matricule: student.matricule,
        role: student.role,
        password: await CryptoUtils.hashPassword(student.password),
        is_active: true,
        is_connected: false,
      } as any);
      mockJWTService.generateAccessToken.mockReturnValue('mock-access-token');
      mockJWTService.generateRefreshToken.mockReturnValue('mock-refresh-token');

      // Act
      const result = await authService.authenticate(
        student.matricule,
        student.password,
        student.role
      );

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedToken = {
        matricule: 'ETU202300001',
        role: 'etudiant',
      };
      const mockUser = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        refresh_token_hash: 'hashed-refresh-token',
        refresh_token_expiry: new Date(Date.now() + 1000000), // Future date
      };

      mockJWTService.verifyRefreshToken.mockReturnValue(decodedToken as any);
      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockJWTService.generateAccessToken.mockReturnValue('new-access-token');

      // Mock CryptoUtils.hashToken
      (CryptoUtils.hashToken as vi.Mock).mockReturnValue('hashed-refresh-token');

      // Act
      const result = await authService.refreshAccessToken(refreshToken);

      // Assert
      expect(result).toBe('new-access-token');
      expect(mockJWTService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserRepository.findByMatricule).toHaveBeenCalledWith('ETU202300001');
    });

    it('should throw InvalidTokenError when refresh token is invalid', async () => {
      // Arrange
      const refreshToken = 'invalid-refresh-token';
      mockJWTService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(
        authService.refreshAccessToken(refreshToken)
      ).rejects.toThrow('Invalid token');
    });

    it('should throw TokenExpiredError when refresh token has expired', async () => {
      // Arrange
      const refreshToken = 'expired-refresh-token';
      const mockUser = {
        matricule: 'ETU202300001',
        role: 'etudiant',
        refresh_token_hash: 'hashed-refresh-token',
        refresh_token_expiry: new Date(Date.now() - 1000000), // Past date
      };

      mockJWTService.verifyRefreshToken.mockReturnValue({ matricule: 'ETU202300001' } as any);
      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(
        authService.refreshAccessToken(refreshToken)
      ).rejects.toThrow(TokenExpiredError);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      mockUserRepository.update.mockResolvedValue();

      // Act
      await authService.logout(matricule);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(matricule, {
        is_connected: false,
        refresh_token_hash: null,
        refresh_token_expiry: null,
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const oldPassword = 'OldPass123!';
      const newPassword = 'NewPass123!';
      
      const mockUser = {
        matricule,
        password: await CryptoUtils.hashPassword(oldPassword),
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockUserRepository.update.mockResolvedValue();

      // Act
      await authService.changePassword(matricule, oldPassword, newPassword);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(matricule, {
        password: expect.any(String), // Nouveau mot de passe hashé
      });
    });

    it('should throw AuthenticationError when old password is incorrect', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const oldPassword = 'WrongOldPass123!';
      const newPassword = 'NewPass123!';
      
      const mockUser = {
        matricule,
        password: await CryptoUtils.hashPassword('CorrectOldPass123!'), // Mot de passe différent
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(
        authService.changePassword(matricule, oldPassword, newPassword)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      // Arrange
      const validToken = 'valid-access-token';
      mockJWTService.verifyAccessToken.mockReturnValue({
        matricule: 'ETU202300001',
        role: 'etudiant',
      });

      // Act
      const result = await authService.validateToken(validToken);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid-access-token';
      mockJWTService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await authService.validateToken(invalidToken);

      // Assert
      expect(result).toBe(false);
    });
  });
});