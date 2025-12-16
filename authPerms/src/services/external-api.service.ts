import axios, { AxiosInstance, AxiosError } from 'axios';
import { ExternalAPIError, NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';

export interface ExternalUser {
  matricule: string;
  nom: string;
  prenom: string;
  role: string;
  etat: string;
}

export class ExternalAPIService {
  private readonly client: AxiosInstance;
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = process.env.EXTERNAL_API_URL || 'http://localhost:3005/api';
    
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '5000'),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur pour la journalisation
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error('External API error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Vérifier l'existence d'un utilisateur dans l'API externe
   */
  async verifyUserExistence(matricule: string, role: string): Promise<boolean> {
    try {
      const endpoint = this.getEndpointForRole(role);
      
      const response = await this.client.get(`${endpoint}/${matricule}`, {
        validateStatus: (status) => status === 200 || status === 404,
      });

      if (response.status === 200) {
        logger.debug(`User ${matricule} (${role}) verified in external API`);
        return true;
      }

      if (response.status === 404) {
        logger.warn(`User ${matricule} (${role}) not found in external API`);
        return false;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to verify user ${matricule} in external API:`, error);
      
      // Pour le développement, simuler une réponse positive si l'API externe n'est pas disponible
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`Development mode: simulating user ${matricule} existence`);
        return this.simulateUserExistence(matricule, role);
      }

      throw new ExternalAPIError('Unable to verify user with external system');
    }
  }

  /**
   * Récupérer les informations d'un utilisateur depuis l'API externe
   */
  async getUserInfo(matricule: string, role: string): Promise<ExternalUser | null> {
    try {
      const endpoint = this.getEndpointForRole(role);
      
      const response = await this.client.get(`${endpoint}/${matricule}`);
      
      if (response.status === 200 && response.data) {
        return {
          matricule: response.data.matricule || matricule,
          nom: response.data.nom || 'Unknown',
          prenom: response.data.prenom || 'Unknown',
          role: role,
          etat: response.data.etat || 'actif',
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get user info for ${matricule}:`, error);
      
      // Pour le développement, simuler des données utilisateur
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`Development mode: simulating user info for ${matricule}`);
        return this.simulateUserInfo(matricule, role);
      }

      return null;
    }
  }

  /**
   * Vérifier plusieurs utilisateurs en batch
   */
  async verifyUsersBatch(
    users: Array<{ matricule: string; role: string }>
  ): Promise<Array<{ matricule: string; role: string; exists: boolean }>> {
    try {
      // Pour l'instant, vérifier chaque utilisateur individuellement
      // Dans une version future, implémenter un endpoint batch dans l'API externe
      const results = await Promise.all(
        users.map(async (user) => {
          try {
            const exists = await this.verifyUserExistence(user.matricule, user.role);
            return { ...user, exists };
          } catch (error) {
            logger.error(`Batch verification failed for ${user.matricule}:`, error);
            return { ...user, exists: false };
          }
        })
      );

      return results;
    } catch (error) {
      logger.error('Batch user verification failed:', error);
      throw new ExternalAPIError('Batch verification failed');
    }
  }

  /**
   * Obtenir le endpoint API pour un rôle donné
   */
  private getEndpointForRole(role: string): string {
    const roleEndpoints: Record<string, string> = {
      etudiant: '/etudiants',
      enseignant: '/enseignants',
      admin: '/admins',
      doyen: '/doyens',
      recteur: '/recteurs',
    };

    const endpoint = roleEndpoints[role.toLowerCase()];
    
    if (!endpoint) {
      throw new NotFoundError(`No API endpoint defined for role: ${role}`);
    }

    return endpoint;
  }

  /**
   * Simuler l'existence d'un utilisateur (pour le développement)
   */
  private simulateUserExistence(matricule: string, role: string): boolean {
    // Logique simple de simulation pour le développement
    const rolePrefixes: Record<string, string> = {
      etudiant: 'ETU',
      enseignant: 'ENS',
      admin: 'ADM',
      doyen: 'DOY',
      recteur: 'REC',
    };

    const prefix = rolePrefixes[role.toLowerCase()];
    
    if (!prefix) {
      return false;
    }

    return matricule.startsWith(prefix);
  }

  /**
   * Simuler les informations d'un utilisateur (pour le développement)
   */
  private simulateUserInfo(matricule: string, role: string): ExternalUser {
    const names: Record<string, { nom: string; prenom: string }> = {
      ETU: { nom: 'Etudiant', prenom: 'Test' },
      ENS: { nom: 'Enseignant', prenom: 'Professeur' },
      ADM: { nom: 'Administrateur', prenom: 'Systeme' },
      DOY: { nom: 'Doyen', prenom: 'Faculte' },
      REC: { nom: 'Recteur', prenom: 'Universite' },
    };

    const prefix = matricule.substring(0, 3);
    const defaultName = names[prefix] || { nom: 'Utilisateur', prenom: 'Test' };

    return {
      matricule,
      nom: defaultName.nom,
      prenom: defaultName.prenom,
      role,
      etat: 'actif',
    };
  }

  /**
   * Vérifier la santé de l'API externe
   */
  async checkHealth(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    try {
      const startTime = Date.now();
      
      const response = await this.client.get('/health', {
        timeout: 3000,
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        return {
          healthy: true,
          responseTime,
        };
      }

      return {
        healthy: false,
        responseTime,
        error: `API returned status ${response.status}`,
      };
    } catch (error) {
      logger.error('External API health check failed:', error);
      
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}