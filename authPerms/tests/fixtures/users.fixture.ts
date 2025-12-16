import { User } from '../../src/models/User';
import { CryptoUtils } from '../../src/utils/crypto';

export interface TestUser extends Partial<User> {
  matricule: string;
  role: string;
  password: string;
}

export const testUsers: TestUser[] = [
  {
    matricule: 'ETU202300001',
    role: 'etudiant',
    password: 'StudentPass123!',
    is_active: true,
    is_connected: false,
  },
  {
    matricule: 'ETU202300002',
    role: 'etudiant',
    password: 'StudentPass456!',
    is_active: true,
    is_connected: false,
  },
  {
    matricule: 'ENS202300001',
    role: 'enseignant',
    password: 'TeacherPass123!',
    is_active: true,
    is_connected: false,
  },
  {
    matricule: 'ADM202300001',
    role: 'admin',
    password: 'AdminPass123!',
    is_active: true,
    is_connected: false,
  },
  {
    matricule: 'DOY202300001',
    role: 'doyen',
    password: 'DeanPass123!',
    is_active: true,
    is_connected: false,
  },
  {
    matricule: 'REC202300001',
    role: 'recteur',
    password: 'RectorPass123!',
    is_active: true,
    is_connected: false,
  },
  {
    matricule: 'ETU202300003',
    role: 'etudiant',
    password: 'InactivePass123!',
    is_active: false,
    is_connected: false,
  },
  {
    matricule: 'ENS202300002',
    role: 'enseignant',
    password: 'ConnectedPass123!',
    is_active: true,
    is_connected: true,
  },
];

// Générer des utilisateurs avec des mots de passe hashés
export const getHashedTestUsers = async (): Promise<Partial<User>[]> => {
  const hashedUsers: Partial<User>[] = [];

  for (const user of testUsers) {
    const hashedPassword = await CryptoUtils.hashPassword(user.password);
    
    hashedUsers.push({
      matricule: user.matricule,
      role: user.role,
      password: hashedPassword,
      is_active: user.is_active,
      is_connected: user.is_connected,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  return hashedUsers;
};

// Données utilisateur pour les tests d'intégration
export const integrationTestUsers = {
  student: {
    matricule: 'ETU202300001',
    password: 'StudentPass123!',
    role: 'etudiant',
  },
  teacher: {
    matricule: 'ENS202300001',
    password: 'TeacherPass123!',
    role: 'enseignant',
  },
  admin: {
    matricule: 'ADM202300001',
    password: 'AdminPass123!',
    role: 'admin',
  },
  dean: {
    matricule: 'DOY202300001',
    password: 'DeanPass123!',
    role: 'doyen',
  },
  rector: {
    matricule: 'REC202300001',
    password: 'RectorPass123!',
    role: 'recteur',
  },
};

// Générer des tokens pour les tests
export const getTestTokens = async (jwtService: any): Promise<Record<string, string>> => {
  const tokens: Record<string, string> = {};

  for (const [role, user] of Object.entries(integrationTestUsers)) {
    tokens[role] = jwtService.generateAccessToken({
      matricule: user.matricule,
      role: user.role,
    });
  }

  return tokens;
};