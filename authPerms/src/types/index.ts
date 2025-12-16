export * from './jwt.types';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ApiError[];
  timestamp: string;
  path?: string;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserContext {
  matricule: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  permissions?: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId: string;
  userRole: string;
  resource: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

export interface PermissionCheck {
  matricule: string;
  resource: string;
  action: 'read' | 'write' | 'update' | 'delete';
  granted: boolean;
  checkedAt: Date;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
    externalApi?: boolean;
    [key: string]: boolean | undefined;
  };
  details: Record<string, any>;
}