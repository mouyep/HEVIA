export const ROLES = {
  ETUDIANT: 'etudiant',
  ENSEIGNANT: 'enseignant',
  ADMIN: 'admin',
  DOYEN: 'doyen',
  RECTEUR: 'recteur',
} as const;

export const PERMISSION_ACTIONS = {
  READ: 'read',
  WRITE: 'write',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export const USER_STATUS = {
  ACTIVE: true,
  INACTIVE: false,
} as const;

export const CONNECTION_STATUS = {
  CONNECTED: true,
  DISCONNECTED: false,
} as const;

export const PERMISSION_STATUS = {
  GRANTED: 'granted',
  REVOKED: 'revoked',
  WAITING: 'waiting',
} as const;

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

export const ERROR_CODES = {
  // Erreurs d'authentification
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  
  // Erreurs d'autorisation
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Erreurs de validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Erreurs de ressources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Erreurs de taux
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  AUTH_RATE_LIMIT_EXCEEDED: 'AUTH_RATE_LIMIT_EXCEEDED',
  
  // Erreurs système
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const API_PATHS = {
  // Chemins d'authentification
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REFRESH: '/api/auth/refresh',
  VALIDATE: '/api/auth/validate',
  
  // Chemins utilisateur
  USERS: '/api/users',
  USER_PROFILE: '/api/users/profile',
  USER_BY_MATRICULE: '/api/users/:matricule',
  
  // Chemins permissions
  PERMISSIONS: '/api/permissions',
  CHECK_PERMISSION: '/api/permissions/check',
  MY_PERMISSIONS: '/api/permissions/my-permissions',
  
  // Health check
  HEALTH: '/api/health',
} as const;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 50,
  MAX_LIMIT: 100,
} as const;

export const TOKEN_CONFIG = {
  ACCESS_EXPIRY: '2h',
  REFRESH_EXPIRY: '7d',
  ALGORITHM: 'HS256' as const,
} as const;

export const SECURITY_CONFIG = {
  BCRYPT_SALT_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15, // minutes
} as const;

export const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_ATTEMPTS: 5,
  REFRESH_WINDOW_MS: 60 * 60 * 1000,
  REFRESH_MAX_REQUESTS: 10,
} as const;