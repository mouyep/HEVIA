import request from 'supertest';
import { AppDataSource } from '../../src/database/connection';
import { User } from '../../src/models/User';
import { Permission } from '../../src/models/Permission';
import { UserPermission } from '../../src/models/UserPermission';
import { CryptoUtils } from '../../src/utils/crypto';
import { integrationTestUsers } from '../fixtures/users.fixture';
import { getPermissionTestData } from '../fixtures/permissions.fixture';
import app from '../../src/app';
import { describe, beforeEach, it, afterAll, beforeAll, expect } from 'vitest';

describe('User Routes Integration Tests', () => {
  let adminToken: string;
  let studentToken: string;
  let teacherToken: string;
  let deanToken: string;
  let rectorToken: string;

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
    
    // Obtenir les tokens pour chaque rôle
    const tokens = await getTestTokens();
    adminToken = tokens.admin;
    studentToken = tokens.student;
    teacherToken = tokens.teacher;
    deanToken = tokens.dean;
    rectorToken = tokens.rector;
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
    
    // Insérer quelques utilisateurs supplémentaires pour les tests
    await userRepository.save([
      {
        matricule: 'ETU202300004',
        role: 'etudiant',
        password: await CryptoUtils.hashPassword('StudentPass789!'),
        is_active: true,
        is_connected: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        matricule: 'ETU202300005',
        role: 'etudiant',
        password: await CryptoUtils.hashPassword('InactiveStudentPass!'),
        is_active: false, // Inactif
        is_connected: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    
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

  async function getTestTokens(): Promise<Record<string, string>> {
    const tokens: Record<string, string> = {};
    
    for (const [role, user] of Object.entries(integrationTestUsers)) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: user.matricule,
          password: user.password,
          role: user.role,
        })
        .expect(200);
      
      tokens[role] = response.body.data.accessToken;
    }
    
    return tokens;
  }

  describe('GET /api/users', () => {
    it('should return users list for admin', async () => {
      // Act
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('limit', 50);
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should return 403 for non-admin user', async () => {
      // Act & Assert
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permissions');
    });

    it('should support pagination', async () => {
      // Act
      const response = await request(app)
        .get('/api/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeLessThanOrEqual(2);
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('limit', 2);
    });

    it('should filter by role', async () => {
      // Act
      const response = await request(app)
        .get('/api/users?role=etudiant')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every((u: any) => u.role === 'etudiant')).toBe(true);
    });

    it('should filter by active status', async () => {
      // Act
      const response = await request(app)
        .get('/api/users?is_active=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every((u: any) => u.is_active === true)).toBe(true);
    });
  });

  describe('GET /api/users/:matricule', () => {
    it('should return user by matricule for admin', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      
      // Act
      const response = await request(app)
        .get(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matricule', matricule);
      expect(response.body.data).toHaveProperty('role', 'etudiant');
      expect(response.body.data).not.toHaveProperty('password'); // Le mot de passe ne doit pas être exposé
    });

    it('should allow user to view their own profile', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      
      // Act
      const response = await request(app)
        .get(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${studentToken}`) // Token de l'étudiant lui-même
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.matricule).toBe(matricule);
    });

    it('should return 403 when user tries to view another user', async () => {
      // Arrange
      const otherMatricule = 'ENS202300001'; // Un enseignant
      
      // Act & Assert
      const response = await request(app)
        .get(`/api/users/${otherMatricule}`)
        .set('Authorization', `Bearer ${studentToken}`) // Étudiant essayant de voir un enseignant
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permissions');
    });

    it('should return 404 for non-existent user', async () => {
      // Act & Assert
      const response = await request(app)
        .get('/api/users/NONEXISTENT001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/users', () => {
    it('should create new user as admin', async () => {
      // Arrange
      const newUser = {
        matricule: 'ETU202300099',
        password: 'NewUserPass123!',
        role: 'etudiant',
        confirmPassword: 'NewUserPass123!',
      };
      
      // Act
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect('Content-Type', /json/)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matricule', newUser.matricule);
      expect(response.body.data).toHaveProperty('role', newUser.role);
      expect(response.body.data).toHaveProperty('is_active', true);
      expect(response.body.data).not.toHaveProperty('password');
      
      // Vérifier que l'utilisateur peut se connecter
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule: newUser.matricule,
          password: newUser.password,
          role: newUser.role,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should return 400 for duplicate matricule', async () => {
      // Arrange
      const existingUser = {
        matricule: 'ETU202300001', // Déjà existant
        password: 'AnotherPass123!',
        role: 'etudiant',
        confirmPassword: 'AnotherPass123!',
      };
      
      // Act & Assert
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(existingUser)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should return 403 for non-admin user', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          matricule: 'ETU202300100',
          password: 'TestPass123!',
          role: 'etudiant',
          confirmPassword: 'TestPass123!',
        })
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:matricule', () => {
    it('should update user as admin', async () => {
      // Arrange
      const matricule = 'ETU202300004';
      const updates = {
        is_active: false,
      };
      
      // Act
      const response = await request(app)
        .put(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      
      // Vérifier que l'utilisateur a été mis à jour
      const getUserResponse = await request(app)
        .get(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getUserResponse.body.data.is_active).toBe(false);
    });

    it('should allow user to update their own password', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const updates = {
        password: 'UpdatedPass123!',
      };
      
      // Act
      const response = await request(app)
        .put(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${studentToken}`) // L'étudiant lui-même
        .send(updates)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      
      // Vérifier que le nouveau mot de passe fonctionne
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          matricule,
          password: 'UpdatedPass123!',
          role: 'etudiant',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should return 403 when user tries to update another user', async () => {
      // Arrange
      const otherMatricule = 'ENS202300001';
      const updates = {
        is_active: false,
      };
      
      // Act & Assert
      const response = await request(app)
        .put(`/api/users/${otherMatricule}`)
        .set('Authorization', `Bearer ${studentToken}`) // Étudiant essayant de modifier un enseignant
        .send(updates)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/:matricule', () => {
    it('should soft delete user as admin', async () => {
      // Arrange
      const matricule = 'ETU202300004';
      
      // Act
      const response = await request(app)
        .delete(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('inactive');
      
      // Vérifier que l'utilisateur est marqué comme inactif
      const getUserResponse = await request(app)
        .get(`/api/users/${matricule}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getUserResponse.body.data.is_active).toBe(false);
    });

    it('should return 403 for non-admin user', async () => {
      // Act & Assert
      const response = await request(app)
        .delete('/api/users/ETU202300004')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when admin tries to delete themselves', async () => {
      // Arrange
      const adminMatricule = 'ADM202300001';
      
      // Act & Assert
      const response = await request(app)
        .delete(`/api/users/${adminMatricule}`)
        .set('Authorization', `Bearer ${adminToken}`) // L'admin essaie de se supprimer lui-même
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('own account');
    });
  });

  describe('GET /api/users/profile', () => {
    it('should return current user profile', async () => {
      // Act
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matricule', 'ETU202300001');
      expect(response.body.data).toHaveProperty('role', 'etudiant');
    });

    it('should return 401 without authentication', async () => {
      // Act & Assert
      const response = await request(app)
        .get('/api/users/profile')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/users/search', () => {
    it('should search users as admin', async () => {
      // Act
      const response = await request(app)
        .get('/api/users/search?q=ETU')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      expect(response.body.data.users.every((u: any) => 
        u.matricule.includes('ETU') || u.role.includes('ETU')
      )).toBe(true);
    });

    it('should return 400 for short search query', async () => {
      // Act & Assert
      const response = await request(app)
        .get('/api/users/search?q=E')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('2 characters');
    });
  });

  describe('Role-based access control', () => {
    it('should allow doyen to access all user routes', async () => {
      // Vérifier que le doyen peut accéder aux routes utilisateur
      const responses = await Promise.all([
        request(app).get('/api/users').set('Authorization', `Bearer ${deanToken}`),
        request(app).get('/api/users/ETU202300001').set('Authorization', `Bearer ${deanToken}`),
        request(app).get('/api/users/search?q=ETU').set('Authorization', `Bearer ${deanToken}`),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should allow recteur to access all user routes', async () => {
      // Vérifier que le recteur peut accéder aux routes utilisateur
      const responses = await Promise.all([
        request(app).get('/api/users').set('Authorization', `Bearer ${rectorToken}`),
        request(app).get('/api/users/ETU202300001').set('Authorization', `Bearer ${rectorToken}`),
        request(app).get('/api/users/search?q=ETU').set('Authorization', `Bearer ${rectorToken}`),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});