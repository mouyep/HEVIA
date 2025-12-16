import { Permission } from '../../src/models/Permission';
import { UserPermission } from '../../src/models/UserPermission';

// Définir le type exact pour type_permission
type PermissionType = 'read' | 'write' | 'update' | 'delete';

export interface TestPermission extends Partial<Permission> {
  nom_objet_bd: string;
  type_permission: PermissionType; // Utiliser le type spécifique
  description?: string;
}

export const testPermissions: TestPermission[] = [
  // Permissions pour les étudiants
  {
    nom_objet_bd: 'notes',
    type_permission: 'read',
    description: 'Lire ses propres notes',
  },
  {
    nom_objet_bd: 'releves',
    type_permission: 'read',
    description: 'Consulter ses relevés de notes',
  },
  
  // Permissions pour les enseignants
  {
    nom_objet_bd: 'notes',
    type_permission: 'write',
    description: 'Saisir des notes',
  },
  {
    nom_objet_bd: 'notes',
    type_permission: 'update',
    description: 'Modifier des notes',
  },
  {
    nom_objet_bd: 'pv',
    type_permission: 'read',
    description: 'Consulter les PV',
  },
  {
    nom_objet_bd: 'pv',
    type_permission: 'write',
    description: 'Générer des PV',
  },
  
  // Permissions pour les administrateurs
  {
    nom_objet_bd: 'users',
    type_permission: 'read',
    description: 'Lire les utilisateurs',
  },
  {
    nom_objet_bd: 'users',
    type_permission: 'write',
    description: 'Créer des utilisateurs',
  },
  {
    nom_objet_bd: 'users',
    type_permission: 'update',
    description: 'Modifier des utilisateurs',
  },
  {
    nom_objet_bd: 'users',
    type_permission: 'delete',
    description: 'Supprimer des utilisateurs',
  },
  {
    nom_objet_bd: 'requetes',
    type_permission: 'read',
    description: 'Lire les requêtes',
  },
  {
    nom_objet_bd: 'requetes',
    type_permission: 'update',
    description: 'Traiter les requêtes',
  },
  
  // Permissions pour les doyens
  {
    nom_objet_bd: 'ue',
    type_permission: 'read',
    description: 'Lire les UE',
  },
  {
    nom_objet_bd: 'ue',
    type_permission: 'write',
    description: 'Créer des UE',
  },
  {
    nom_objet_bd: 'ue',
    type_permission: 'update',
    description: 'Modifier des UE',
  },
  {
    nom_objet_bd: 'ue',
    type_permission: 'delete',
    description: 'Supprimer des UE',
  },
  {
    nom_objet_bd: 'statistiques',
    type_permission: 'read',
    description: 'Consulter les statistiques',
  },
  
  // Permissions pour le recteur
  {
    nom_objet_bd: 'deliberation',
    type_permission: 'read',
    description: 'Consulter les délibérations',
  },
  {
    nom_objet_bd: 'deliberation',
    type_permission: 'write',
    description: 'Participer aux délibérations',
  },
];

// Type pour les associations utilisateur-permission
export interface TestUserPermission {
  matricule: string;
  permissions: string[]; // Format: 'nom_objet_bd.type_permission'
}

// Associations utilisateur-permission pour les tests
export const testUserPermissions: TestUserPermission[] = [
  {
    matricule: 'ETU202300001',
    permissions: ['notes.read', 'releves.read'],
  },
  {
    matricule: 'ENS202300001',
    permissions: [
      'notes.read',
      'notes.write',
      'notes.update',
      'pv.read',
      'pv.write',
    ],
  },
  {
    matricule: 'ADM202300001',
    permissions: [
      'users.read',
      'users.write',
      'users.update',
      'users.delete',
      'requetes.read',
      'requetes.update',
    ],
  },
  {
    matricule: 'DOY202300001',
    permissions: [
      'ue.read',
      'ue.write',
      'ue.update',
      'ue.delete',
      'statistiques.read',
    ],
  },
];

// Interface pour les permissions de test d'intégration
export interface IntegrationTestPermissions {
  student: string[];
  teacher: string[];
  admin: string[];
  dean: string[];
  rector: string[];
}

// Permissions pour les tests d'intégration
export const integrationTestPermissions: IntegrationTestPermissions = {
  student: ['notes.read', 'releves.read'],
  teacher: ['notes.read', 'notes.write', 'notes.update', 'pv.read', 'pv.write'],
  admin: [
    'users.read',
    'users.write',
    'users.update',
    'users.delete',
    'requetes.read',
    'requetes.update',
  ],
  dean: [
    'ue.read',
    'ue.write',
    'ue.update',
    'ue.delete',
    'statistiques.read',
  ],
  rector: [
    'deliberation.read',
    'deliberation.write',
  ],
};

// Vérifier si un rôle a une permission spécifique
export const hasPermission = (role: keyof IntegrationTestPermissions, permission: string): boolean => {
  const permissions = integrationTestPermissions[role];
  
  if (!permissions) return false;
  
  // Le recteur a toutes les permissions
  if (role === 'rector') return true;
  
  return permissions.includes(permission);
};

// Helper pour parser les permissions string en objet
export const parsePermissionString = (permissionString: string): { nom_objet_bd: string; type_permission: PermissionType } | null => {
  const [nom_objet_bd, type_permission] = permissionString.split('.') as [string, PermissionType];
  
  // Vérifier que le type_permission est valide
  const validTypes: PermissionType[] = ['read', 'write', 'update', 'delete'];
  if (!validTypes.includes(type_permission)) {
    return null;
  }
  
  return { nom_objet_bd, type_permission };
};

// Générer des données de test pour la base de données
export const getPermissionTestData = async (): Promise<{
  permissions: Partial<Permission>[];
  userPermissions: Partial<UserPermission>[];
}> => {
  const permissions: Partial<Permission>[] = testPermissions.map(perm => ({
    ...perm,
    id_perm: perm.id_perm || `perm_${perm.nom_objet_bd}_${perm.type_permission}`,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'test_fixture',
  }));

  const userPermissions: Partial<UserPermission>[] = [];
  
  // Pour chaque association utilisateur-permission
  for (const userPerm of testUserPermissions) {
    for (const permString of userPerm.permissions) {
      const parsedPermission = parsePermissionString(permString);
      
      if (!parsedPermission) {
        console.warn(`Permission invalide: ${permString}`);
        continue;
      }
      
      const { nom_objet_bd, type_permission } = parsedPermission;
      
      // Trouver la permission correspondante
      const permission = permissions.find(
        p => p.nom_objet_bd === nom_objet_bd && p.type_permission === type_permission
      );

      if (permission && permission.id_perm) {
        userPermissions.push({
          mat: userPerm.matricule,
          idperm: permission.id_perm,
          statut: 'granted',
          granted_at: new Date(),
          granted_by: 'test_fixture',
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }
  }

  return { permissions, userPermissions };
};

// Fonction utilitaire pour créer des permissions spécifiques
export const createPermissionFixture = (
  nom_objet_bd: string, 
  type_permission: PermissionType, 
  description?: string
): TestPermission => ({
  nom_objet_bd,
  type_permission,
  description,
});

// Fonction pour générer toutes les permissions pour un objet donné
export const generateAllPermissionsForObject = (
  nom_objet_bd: string,
  descriptionPrefix?: string
): TestPermission[] => {
  const types: PermissionType[] = ['read', 'write', 'update', 'delete'];
  
  return types.map(type => ({
    nom_objet_bd,
    type_permission: type,
    description: descriptionPrefix 
      ? `${descriptionPrefix} - ${type}`
      : `Permission ${type} pour ${nom_objet_bd}`,
  }));
};

// Exemple d'utilisation
export const examplePermissions = generateAllPermissionsForObject(
  'notes',
  'Gestion des notes'
);