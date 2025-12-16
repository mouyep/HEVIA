import request from 'supertest';
import { AppDataSource } from '../../src/database/connection';
import { User } from '../../src/models/User';
import { Permission } from '../../src/models/Permission';
import { UserPermission } from '../../src/models/UserPermission';
import { CryptoUtils } from '../../src/utils/crypto';
import { integrationTestUsers } from '../fixtures/users.fixture';
import { getPermissionTestData } from '../fixtures/permissions.fixture';
import app from '../../src/app';
import { describe, beforeEach, it, afterAll, beforeAll, expect} from 'vitest';

describe('Auth Routes Integration Tests', () => {
  beforeAll(async () => {
    // Initialiser la base de données de test
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    
    // Synchroniser les tables (vider et recréer)
    await AppDataSource.synchronize(true);
  });

  beforeEach(async () => {
    // Nettoyer les tables avant chaque test
    await AppDataSource.getRepository(UserPermission).delete({});
    await AppDataSource.getRepository(Permission).delete({});
    await AppDataSource.getRepository(User).delete({});
    
    // Insérer les données de test
    await seedTestData();
  });

  afterAll(async () => {
    // Fermer la connexion à la base de données
    await AppDataSource.destroy();
  });

  async function seedTestData() {
    // Insérer les utilisateurs de test
    const userRepository = AppDataSource.getRepository(User);
    
    for (const user of Object.values(integrationTestUsers)) {
      const hashedPassword = await CryptoUtils.hashPassword(user.password);
      
      await userRepository.save({
        matricule: user.matricule,
        role: user.role,
        password: hashedPassword,
        is_active: true,
        is_connected: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    
    // Insérer les permissions de test
    const permissionRepository = AppDataSource.getRepository(Permission);
    const userPermissionRepository = AppDataSource.getRepository(UserPermission);
    
    const { permissions, userPermissions } = await getPermissionTestData();
    
    for (const permission of permissions) {
      await permissionRepository.save(permission);
    }
    
    for (const userPermission of userPermissions) {
      await userPermissionRepository.save(userPermission);
    }
  }

  describe('POST /api/auth/login', () => {
    it('should authenticate user successfully and return tokens', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: student.password,
          role: student.role,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Authentication successful');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.matricule).toBe(student.matricule);
      expect(response.body.data.user.role).toBe(student.role);
    });

    it('should return 401 for invalid credentials', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: 'WrongPassword123!',
          role: student.role,
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication failed');
    });

    it('should return 400 for missing required fields', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: 'ETU202300001',
          // password manquant
          role: 'etudiant',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: 'NONEXISTENT001',
          password: 'SomePassword123!',
          role: 'etudiant',
        })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token successfully', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // D'abord, obtenir un refresh token via login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: student.password,
          role: student.role,
        })
        .expect(200);

      const refreshToken = loginResponse.body.data.refreshToken;
      
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.accessToken).not.toBe(loginResponse.body.data.accessToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    it('should return 400 for missing refresh token', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // D'abord, obtenir un token via login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: student.password,
          role: student.role,
        })
        .expect(200);

      const accessToken = loginResponse.body.data.accessToken;
      
      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 401 without authentication', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/logout')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // Obtenir un token via login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: student.password,
          role: student.role,
        })
        .expect(200);

      const accessToken = loginResponse.body.data.accessToken;
      const newPassword = 'NewPassword123!';
      
      // Act
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: student.password,
          newPassword,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
      
      // Vérifier que le nouveau mot de passe fonctionne
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: newPassword,
          role: student.role,
        })
        .expect(200);

      expect(newLoginResponse.body.success).toBe(true);
    });

    it('should return 401 for incorrect old password', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // Obtenir un token via login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: student.password,
          role: student.role,
        })
        .expect(200);

      const accessToken = loginResponse.body.data.accessToken;
      
      // Act & Assert
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: 'WrongOldPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('incorrect');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      // Arrange
      const { student } = integrationTestUsers;
      
      // Obtenir un token via login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: student.matricule,
          password: student.password,
          role: student.role,
        })
        .expect(200);

      const accessToken = loginResponse.body.data.accessToken;
      
      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matricule', student.matricule);
      expect(response.body.data).toHaveProperty('role', student.role);
      expect(response.body.data).toHaveProperty('is_active', true);
    });

    it('should return 401 without authentication', async () => {
      // Act & Assert
      const response = await request(app)
        .get('/api/auth/me')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return service health status', async () => {
      // Act & Assert
      const response = await request(app)
        .get('/api/auth/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('service', 'authperms');
    });
  });

  describe('Rate limiting', () => {
    it('should limit login attempts', async () => {
      // Essayer plusieurs fois avec de mauvais identifiants
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            matricule: 'ETU202300001',
            password: 'WrongPassword123!',
            role: 'etudiant',
          });

        if (i < 5) {
          // Les 5 premières tentatives devraient échouer avec 401
          expect(response.status).toBe(401);
        } else {
          // La 6ème tentative devrait être limitée avec 429
          expect(response.status).toBe(429);
          expect(response.body.message).toContain('Too many');
        }
      }
    });
  });
});