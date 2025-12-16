import { PermissionService } from '../../src/services/permission.service';
import { PermissionRepository } from '../../src/repositories/permission.repository';
import { UserPermissionRepository } from '../../src/repositories/user-permission.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { 
  AuthorizationError, 
  NotFoundError, 
  ValidationError 
} from '../../src/utils/errors';

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest';

// Mocks
vi.mock('../../src/repositories/permission.repository');
vi.mock('../../src/repositories/user-permission.repository');
vi.mock('../../src/repositories/user.repository');

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockPermissionRepository: Mocked<PermissionRepository>;
  let mockUserPermissionRepository: Mocked<UserPermissionRepository>;
  let mockUserRepository: Mocked<UserRepository>;

  beforeEach(() => {
    // Réinitialiser les mocks
    vi.clearAllMocks();

    // Créer les instances mockées
    mockPermissionRepository = new PermissionRepository() as Mocked<PermissionRepository>;
    mockUserPermissionRepository = new UserPermissionRepository() as Mocked<UserPermissionRepository>;
    mockUserRepository = new UserRepository() as Mocked<UserRepository>;
    
    // Créer le service avec les mocks
    permissionService = new PermissionService(
      mockPermissionRepository,
      mockUserPermissionRepository,
      mockUserRepository
    );
  });

  describe('checkPermission', () => {
    it('should return true for user with granted permission', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const nom_objet = 'notes';
      const action = 'read' as const; // Type spécifique
      
      const mockUser = {
        matricule,
        role: 'etudiant',
        is_active: true,
      };
      
      const mockPermission = {
        id_perm: 'perm-id-123',
        nom_objet_bd: nom_objet,
        type_permission: action,
      };
      
      const mockUserPermission = {
        matricule,
        idperm: 'perm-id-123',
        statut: 'granted',
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockPermissionRepository.findByNomObjetAndAction.mockResolvedValue(mockPermission as any);
      mockUserPermissionRepository.findByUserAndPermission.mockResolvedValue(mockUserPermission as any);

      // Act
      const result = await permissionService.checkPermission(matricule, nom_objet, action);

      // Assert
      expect(result).toBe(true);
      expect(mockUserRepository.findByMatricule).toHaveBeenCalledWith(matricule);
      expect(mockPermissionRepository.findByNomObjetAndAction).toHaveBeenCalledWith(nom_objet, action);
      expect(mockUserPermissionRepository.findByUserAndPermission).toHaveBeenCalledWith(
        matricule,
        'perm-id-123'
      );
    });

    it('should return false for user without permission', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const nom_objet = 'notes';
      const action = 'write' as const; // Type spécifique
      
      const mockUser = {
        matricule,
        role: 'etudiant',
        is_active: true,
      };
      
      const mockPermission = {
        id_perm: 'perm-id-456',
        nom_objet_bd: nom_objet,
        type_permission: action,
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockPermissionRepository.findByNomObjetAndAction.mockResolvedValue(mockPermission as any);
      mockUserPermissionRepository.findByUserAndPermission.mockResolvedValue(null);

      // Act
      const result = await permissionService.checkPermission(matricule, nom_objet, action);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for doyen without checking database', async () => {
      // Arrange
      const matricule = 'DOY202300001';
      const nom_objet = 'any-object';
      const action = 'read' as const; // CORRECTION: Utiliser une action valide
      
      const mockUser = {
        matricule,
        role: 'doyen',
        is_active: true,
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act
      const result = await permissionService.checkPermission(matricule, nom_objet, action);

      // Assert
      expect(result).toBe(true);
      expect(mockPermissionRepository.findByNomObjetAndAction).not.toHaveBeenCalled();
      expect(mockUserPermissionRepository.findByUserAndPermission).not.toHaveBeenCalled();
    });

    it('should return true for recteur without checking database', async () => {
      // Arrange
      const matricule = 'REC202300001';
      const nom_objet = 'any-object';
      const action = 'write' as const; // CORRECTION: Utiliser une action valide
      
      const mockUser = {
        matricule,
        role: 'recteur',
        is_active: true,
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act
      const result = await permissionService.checkPermission(matricule, nom_objet, action);

      // Assert
      expect(result).toBe(true);
      expect(mockPermissionRepository.findByNomObjetAndAction).not.toHaveBeenCalled();
      expect(mockUserPermissionRepository.findByUserAndPermission).not.toHaveBeenCalled();
    });

    it('should throw AuthorizationError for inactive user', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const nom_objet = 'notes';
      const action = 'read' as const;
      
      const mockUser = {
        matricule,
        role: 'etudiant',
        is_active: false,
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(
        permissionService.checkPermission(matricule, nom_objet, action)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      // Arrange
      const matricule = 'NONEXISTENT001';
      const nom_objet = 'notes';
      const action = 'read' as const;

      mockUserRepository.findByMatricule.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionService.checkPermission(matricule, nom_objet, action)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignPermission', () => {
    it('should assign permission to user successfully', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const idperm = 'perm-id-123';
      const statut = 'granted';
      const grantedBy = 'ADM202300001';
      
      const mockUser = { matricule };
      const mockPermission = { id_perm: idperm };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockPermissionRepository.findById.mockResolvedValue(mockPermission as any);
      mockUserPermissionRepository.findByUserAndPermission.mockResolvedValue(null);
      mockUserPermissionRepository.create.mockResolvedValue({} as any);

      // Act
      await permissionService.assignPermission(matricule, idperm, statut, grantedBy);

      // Assert
      expect(mockUserRepository.findByMatricule).toHaveBeenCalledWith(matricule);
      expect(mockPermissionRepository.findById).toHaveBeenCalledWith(idperm);
      expect(mockUserPermissionRepository.create).toHaveBeenCalledWith({
        mat: matricule,
        idperm,
        statut,
        granted_at: expect.any(Date),
        granted_by: grantedBy,
      });
    });

    it('should update existing user permission', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const idperm = 'perm-id-123';
      const statut = 'granted';
      const grantedBy = 'ADM202300001';
      
      const mockUser = { matricule };
      const mockPermission = { id_perm: idperm };
      const mockUserPermission = {
        id: 'user-perm-id-456',
        mat: matricule,
        idperm,
        statut: 'waiting',
      };

      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockPermissionRepository.findById.mockResolvedValue(mockPermission as any);
      mockUserPermissionRepository.findByUserAndPermission.mockResolvedValue(mockUserPermission as any);
      mockUserPermissionRepository.update.mockResolvedValue();

      // Act
      await permissionService.assignPermission(matricule, idperm, statut, grantedBy);

      // Assert
      expect(mockUserPermissionRepository.update).toHaveBeenCalledWith(
        'user-perm-id-456',
        {
          statut,
          granted_at: expect.any(Date),
          revoked_at: null,
          granted_by: grantedBy,
        }
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      // Arrange
      const matricule = 'NONEXISTENT001';
      const idperm = 'perm-id-123';
      
      mockUserRepository.findByMatricule.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionService.assignPermission(matricule, idperm, 'granted', 'admin')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent permission', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const idperm = 'NONEXISTENT-PERM';
      
      const mockUser = { matricule };
      
      mockUserRepository.findByMatricule.mockResolvedValue(mockUser as any);
      mockPermissionRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionService.assignPermission(matricule, idperm, 'granted', 'admin')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('createPermission', () => {
    it('should create new permission successfully', async () => {
      // Arrange
      const nom_objet_bd = 'new-object';
      const type_permission = 'read' as const;
      const description = 'New permission for testing';
      const createdBy = 'ADM202300001';
      
      const mockPermission = {
        id_perm: 'new-perm-id',
        nom_objet_bd,
        type_permission,
        description,
      };

      mockPermissionRepository.findByNomObjetAndAction.mockResolvedValue(null);
      mockPermissionRepository.create.mockResolvedValue(mockPermission as any);

      // Act
      const result = await permissionService.createPermission(
        nom_objet_bd,
        type_permission,
        description,
        createdBy
      );

      // Assert
      expect(result).toEqual(mockPermission);
      expect(mockPermissionRepository.create).toHaveBeenCalledWith({
        nom_objet_bd,
        type_permission,
        description,
        created_by: createdBy,
      });
    });

    it('should throw ValidationError when permission already exists', async () => {
      // Arrange
      const nom_objet_bd = 'existing-object';
      const type_permission = 'read' as const;
      
      const mockPermission = {
        id_perm: 'existing-perm-id',
        nom_objet_bd,
        type_permission,
      };

      mockPermissionRepository.findByNomObjetAndAction.mockResolvedValue(mockPermission as any);

      // Act & Assert
      await expect(
        permissionService.createPermission(nom_objet_bd, type_permission)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      // Arrange
      const matricule = 'ETU202300001';
      const mockPermissions = [
        { id: '1', permission: { nom_objet_bd: 'notes', type_permission: 'read' as const } },
        { id: '2', permission: { nom_objet_bd: 'releves', type_permission: 'read' as const } },
      ];

      mockUserPermissionRepository.findByUser.mockResolvedValue(mockPermissions as any);

      // Act
      const result = await permissionService.getUserPermissions(matricule);

      // Assert
      expect(result).toEqual(mockPermissions);
      expect(mockUserPermissionRepository.findByUser).toHaveBeenCalledWith(matricule);
    });
  });

  describe('getAllPermissions', () => {
    it('should return all permissions', async () => {
      // Arrange
      const mockPermissions = [
        { id_perm: '1', nom_objet_bd: 'notes', type_permission: 'read' as const },
        { id_perm: '2', nom_objet_bd: 'notes', type_permission: 'write' as const },
      ];

      mockPermissionRepository.findAll.mockResolvedValue(mockPermissions as any);

      // Act
      const result = await permissionService.getAllPermissions();

      // Assert
      expect(result).toEqual(mockPermissions);
      expect(mockPermissionRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('deletePermission', () => {
    it('should delete permission when not assigned to users', async () => {
      // Arrange
      const idperm = 'perm-id-123';
      
      mockUserPermissionRepository.findByPermission.mockResolvedValue([]);
      mockPermissionRepository.delete.mockResolvedValue();

      // Act
      await permissionService.deletePermission(idperm);

      // Assert
      expect(mockPermissionRepository.delete).toHaveBeenCalledWith(idperm);
    });

    it('should throw ValidationError when permission is assigned to users', async () => {
      // Arrange
      const idperm = 'perm-id-123';
      const mockUserPermissions = [
        { id: '1', mat: 'ETU202300001' },
        { id: '2', mat: 'ENS202300001' },
      ];

      mockUserPermissionRepository.findByPermission.mockResolvedValue(mockUserPermissions as any);

      // Act & Assert
      await expect(
        permissionService.deletePermission(idperm)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updatePermission', () => {
    it('should update permission successfully', async () => {
      // Arrange
      const idperm = 'perm-id-123';
      const updates = {
        description: 'Updated description',
      };

      mockPermissionRepository.update.mockResolvedValue();

      // Act
      await permissionService.updatePermission(idperm, updates);

      // Assert
      expect(mockPermissionRepository.update).toHaveBeenCalledWith(idperm, updates);
    });
  });
});