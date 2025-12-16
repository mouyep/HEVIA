import { auditLogger } from '@/utils/logger';

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'PERMISSION_GRANTED' 
  | 'PERMISSION_REVOKED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'PASSWORD_CHANGED'
  | 'TOKEN_REFRESHED'
  | 'ACCESS_DENIED'
  | 'SYSTEM_EVENT';

export interface AuditLog {
  timestamp: Date;
  userMatricule: string;
  userRole: string;
  action: AuditAction;
  resource?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditService {
  /**
   * Enregistrer une action d'audit
   */
  static log(auditData: AuditLog): void {
    const logMessage = this.formatLogMessage(auditData);
    
    if (auditData.success) {
      auditLogger.info(logMessage);
    } else {
      auditLogger.warn(logMessage);
    }
  }

  /**
   * Formater le message de log d'audit
   */
  private static formatLogMessage(auditData: AuditLog): string {
    const parts = [
      `User: ${auditData.userMatricule} (${auditData.userRole})`,
      `Action: ${auditData.action}`,
      `Success: ${auditData.success}`,
    ];

    if (auditData.resource) {
      parts.push(`Resource: ${auditData.resource}`);
    }

    if (auditData.ipAddress) {
      parts.push(`IP: ${auditData.ipAddress}`);
    }

    if (auditData.details) {
      parts.push(`Details: ${JSON.stringify(auditData.details)}`);
    }

    if (auditData.errorMessage) {
      parts.push(`Error: ${auditData.errorMessage}`);
    }

    return parts.join(' | ');
  }

  /**
   * Enregistrer une tentative de connexion
   */
  static logLoginAttempt(
    matricule: string,
    role: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: matricule,
      userRole: role,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      success,
      errorMessage,
    });
  }

  /**
   * Enregistrer une déconnexion
   */
  static logLogout(
    matricule: string,
    role: string,
    ipAddress?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: matricule,
      userRole: role,
      action: 'LOGOUT',
      ipAddress,
      success: true,
    });
  }

  /**
   * Enregistrer un changement de permission
   */
  static logPermissionChange(
    actorMatricule: string,
    actorRole: string,
    targetMatricule: string,
    permissionId: string,
    action: 'GRANTED' | 'REVOKED',
    success: boolean,
    errorMessage?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: actorMatricule,
      userRole: actorRole,
      action: action === 'GRANTED' ? 'PERMISSION_GRANTED' : 'PERMISSION_REVOKED',
      resource: permissionId,
      details: { targetUser: targetMatricule },
      success,
      errorMessage,
    });
  }

  /**
   * Enregistrer un accès refusé
   */
  static logAccessDenied(
    matricule: string,
    role: string,
    resource: string,
    action: string,
    ipAddress?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: matricule,
      userRole: role,
      action: 'ACCESS_DENIED',
      resource: `${resource}.${action}`,
      ipAddress,
      success: false,
      errorMessage: 'Insufficient permissions',
    });
  }

  /**
   * Enregistrer un changement de mot de passe
   */
  static logPasswordChange(
    matricule: string,
    role: string,
    success: boolean,
    ipAddress?: string,
    errorMessage?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: matricule,
      userRole: role,
      action: 'PASSWORD_CHANGED',
      ipAddress,
      success,
      errorMessage,
    });
  }

  /**
   * Enregistrer un rafraîchissement de token
   */
  static logTokenRefresh(
    matricule: string,
    role: string,
    success: boolean,
    ipAddress?: string,
    errorMessage?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: matricule,
      userRole: role,
      action: 'TOKEN_REFRESHED',
      ipAddress,
      success,
      errorMessage,
    });
  }

  /**
   * Enregistrer un événement système
   */
  static logSystemEvent(
    event: string,
    details?: any,
    initiatedBy?: string
  ): void {
    this.log({
      timestamp: new Date(),
      userMatricule: initiatedBy || 'SYSTEM',
      userRole: 'SYSTEM',
      action: 'SYSTEM_EVENT',
      resource: event,
      details,
      success: true,
    });
  }
}