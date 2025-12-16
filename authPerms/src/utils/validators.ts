import { Request } from 'express';
import { ValidationError } from './errors';

export class Validators {
  static validateMatricule(matricule: string): boolean {
    // Format: 3 lettres + 6 chiffres + 3 chiffres (ex: ETU123456789)
    const matriculeRegex = /^[A-Z]{3}\d{9}$/;
    return matriculeRegex.test(matricule);
  }

  static validateRole(role: string): boolean {
    const allowedRoles = ['etudiant', 'enseignant', 'admin', 'doyen', 'recteur'];
    return allowedRoles.includes(role.toLowerCase());
  }

  static validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/\d/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }

    return { isValid: true };
  }

  static validateJWTToken(token: string): boolean {
    try {
      // Vérification basique du format JWT
      const parts = token.split('.');
      return parts.length === 3;
    } catch {
      return false;
    }
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }
}

export const validateRequest = (req: Request, fields: string[]): void => {
  const missingFields = fields.filter(field => !req.body[field]);
  
  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
  }
};