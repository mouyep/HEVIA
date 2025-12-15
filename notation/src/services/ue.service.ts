import { ServiceError } from '@shared/types';
import { UERepository } from '@repositories/ue.repository';
import { ComposanteRepository } from '@repositories/composante.repository';
import { 
  UE, 
  CreateUEDto, 
  UpdateUEDto,
  UEWithDetails,
  ComposanteEvaluation,
  CreateComposanteDto
} from '@models/UE';
import { logger } from '@utils/logger';

export class UEService {
  private ueRepository: UERepository;
  private composanteRepository: ComposanteRepository;

  constructor() {
    this.ueRepository = new UERepository();
    this.composanteRepository = new ComposanteRepository();
  }

  async createUE(data: CreateUEDto): Promise<UE> {
    try {
      logger.info('Création d\'une UE', { code_ue: data.code_ue, annee_acad: data.annee_acad });

      // Vérifier si l'UE existe déjà
      const existingUE = await this.ueRepository.findByCode(data.code_ue);
      if (existingUE) {
        throw new ServiceError('UE already exists', 409, 'UE_EXISTS');
      }

      // Vérifier que l'année académique existe et est ouverte
      const anneeValide = await this.ueRepository.validateAnneeAcad(data.annee_acad);
      if (!anneeValide) {
        throw new ServiceError('Academic year not found or not open', 400, 'ANNEE_INVALIDE');
      }

      // Vérifier les crédits ECTS
      if (data.credits_ects <= 0 || data.credits_ects > 30) {
        throw new ServiceError('ECTS credits must be between 1 and 30', 400, 'INVALID_CREDITS');
      }

      // Vérifier le niveau
      if (!['L1', 'L2', 'L3', 'M1', 'M2', 'D1', 'D2', 'D3'].includes(data.niveau)) {
        throw new ServiceError('Invalid level', 400, 'INVALID_NIVEAU');
      }

      // Créer l'UE
      const ue = await this.ueRepository.create({
        ...data,
        statut: 'actif'
      });

      logger.info('UE créée avec succès', { code_ue: ue.code_ue });

      return ue;

    } catch (error) {
      logger.error('Erreur création UE', { 
        code_ue: data.code_ue, 
        error: error.message 
      });
      throw error;
    }
  }

  async updateUE(codeUE: string, data: UpdateUEDto): Promise<UE> {
    try {
      logger.info('Mise à jour d\'une UE', { code_ue: codeUE });

      const ue = await this.ueRepository.findByCode(codeUE);
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      // Vérifier que l'UE n'est pas archivée
      if (ue.statut === 'archive') {
        throw new ServiceError('Cannot update archived UE', 400, 'UE_ARCHIVED');
      }

      const updatedUE = await this.ueRepository.update(codeUE, data);
      
      logger.info('UE mise à jour', { code_ue: codeUE });

      return updatedUE;

    } catch (error) {
      logger.error('Erreur mise à jour UE', { 
        code_ue: codeUE, 
        error: error.message 
      });
      throw error;
    }
  }

  async getUEWithDetails(codeUE: string): Promise<UEWithDetails> {
    try {
      const ue = await this.ueRepository.findByCodeWithDetails(codeUE);
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      return ue;
    } catch (error) {
      logger.error('Erreur récupération détails UE', { 
        code_ue: codeUE, 
        error: error.message 
      });
      throw error;
    }
  }

  async listUE(filters: {
    niveau?: string;
    filiere?: string;
    annee_acad?: string;
    statut?: string;
    enseignant?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: UEWithDetails[]; total: number; page: number; pages: number }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      const [ues, total] = await Promise.all([
        this.ueRepository.findAllWithDetails(filters, limit, offset),
        this.ueRepository.count(filters)
      ]);

      return {
        data: ues,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Erreur liste UE', { filters, error: error.message });
      throw error;
    }
  }

  async addComposante(codeUE: string, data: CreateComposanteDto): Promise<ComposanteEvaluation> {
    try {
      logger.info('Ajout d\'une composante à l\'UE', { code_ue: codeUE, type: data.type_composante });

      // Vérifier que l'UE existe
      const ue = await this.ueRepository.findByCode(codeUE);
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      // Vérifier que cette composante n'existe pas déjà pour cette UE
      const existingComposante = await this.composanteRepository.findByUEAndType(
        codeUE, 
        data.type_composante
      );
      
      if (existingComposante) {
        throw new ServiceError(
          `Component ${data.type_composante} already exists for this UE`, 
          409, 
          'COMPOSANTE_EXISTS'
        );
      }

      // Vérifier le pourcentage
      if (data.pourcentage < 0 || data.pourcentage > 100) {
        throw new ServiceError('Percentage must be between 0 and 100', 400, 'INVALID_PERCENTAGE');
      }

      // Vérifier le nombre de points
      const nbPoints = data.nb_points || 20;
      if (nbPoints <= 0 || nbPoints > 100) {
        throw new ServiceError('Points must be between 1 and 100', 400, 'INVALID_POINTS');
      }

      const composante = await this.composanteRepository.create({
        ...data,
        code_ue: codeUE,
        nb_points: nbPoints,
        ordre: data.ordre || 0
      });

      logger.info('Composante ajoutée à l\'UE', { 
        code_ue: codeUE, 
        composante_id: composante.id 
      });

      return composante;

    } catch (error) {
      logger.error('Erreur ajout composante', { 
        code_ue: codeUE, 
        error: error.message 
      });
      throw error;
    }
  }

  async getComposantes(codeUE: string): Promise<ComposanteEvaluation[]> {
    try {
      const ue = await this.ueRepository.findByCode(codeUE);
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      return await this.composanteRepository.findByUE(codeUE);
    } catch (error) {
      logger.error('Erreur récupération composantes', { 
        code_ue: codeUE, 
        error: error.message 
      });
      throw error;
    }
  }

  async updateComposante(composanteId: number, data: Partial<ComposanteEvaluation>): Promise<ComposanteEvaluation> {
    try {
      logger.info('Mise à jour d\'une composante', { composante_id: composanteId });

      const composante = await this.composanteRepository.findById(composanteId);
      if (!composante) {
        throw new ServiceError('Component not found', 404, 'COMPOSANTE_NOT_FOUND');
      }

      // Si on modifie le pourcentage, vérifier que la somme reste à 100%
      if (data.pourcentage !== undefined) {
        if (data.pourcentage < 0 || data.pourcentage > 100) {
          throw new ServiceError('Percentage must be between 0 and 100', 400, 'INVALID_PERCENTAGE');
        }
      }

      // Si on modifie le nombre de points
      if (data.nb_points !== undefined) {
        if (data.nb_points <= 0 || data.nb_points > 100) {
          throw new ServiceError('Points must be between 1 and 100', 400, 'INVALID_POINTS');
        }
      }

      const updatedComposante = await this.composanteRepository.update(composanteId, data);
      
      logger.info('Composante mise à jour', { composante_id: composanteId });

      return updatedComposante;

    } catch (error) {
      logger.error('Erreur mise à jour composante', { 
        composante_id: composanteId, 
        error: error.message 
      });
      throw error;
    }
  }

  async deleteUE(codeUE: string): Promise<void> {
    try {
      logger.info('Suppression d\'une UE', { code_ue: codeUE });

      const ue = await this.ueRepository.findByCode(codeUE);
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      // Vérifier qu'il n'y a pas de notes associées
      const hasEvaluations = await this.ueRepository.hasEvaluations(codeUE);
      if (hasEvaluations) {
        throw new ServiceError(
          'Cannot delete UE with existing evaluations', 
          400, 
          'UE_HAS_EVALUATIONS'
        );
      }

      // Marquer comme supprimé
      await this.ueRepository.delete(codeUE);
      
      logger.info('UE supprimée', { code_ue: codeUE });

    } catch (error) {
      logger.error('Erreur suppression UE', { 
        code_ue: codeUE, 
        error: error.message 
      });
      throw error;
    }
  }

  async validateUEConfiguration(codeUE: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    totalPercentage: number;
  }> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Récupérer l'UE et ses composantes
      const ue = await this.ueRepository.findByCode(codeUE);
      if (!ue) {
        errors.push('UE not found');
        return { isValid: false, errors, warnings, totalPercentage: 0 };
      }

      const composantes = await this.composanteRepository.findByUE(codeUE);

      // Vérifier qu'il y a au moins une composante
      if (composantes.length === 0) {
        errors.push('No evaluation components defined');
      }

      // Calculer le total des pourcentages
      const totalPercentage = composantes.reduce((sum, comp) => sum + comp.pourcentage, 0);
      
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(`Total percentage must be 100%, got ${totalPercentage.toFixed(2)}%`);
      }

      // Vérifier les doublons de type
      const types = composantes.map(c => c.type_composante);
      const uniqueTypes = [...new Set(types)];
      if (types.length !== uniqueTypes.length) {
        warnings.push('Duplicate component types detected');
      }

      // Vérifier les dates d'évaluation
      const now = new Date();
      for (const comp of composantes) {
        if (comp.date_evaluation && comp.date_evaluation < now) {
          warnings.push(`Evaluation date for ${comp.type_composante} is in the past`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        totalPercentage
      };

    } catch (error) {
      logger.error('Erreur validation configuration UE', { 
        code_ue: codeUE, 
        error: error.message 
      });
      throw error;
    }
  }

  async assignEnseignant(codeUE: string, matriculeEnseignant: string): Promise<UE> {
    try {
      logger.info('Assignation d\'un enseignant à l\'UE', { 
        code_ue: codeUE, 
        enseignant: matriculeEnseignant 
      });

      // Vérifier que l'enseignant existe et a le bon rôle
      const enseignantValide = await this.ueRepository.validateEnseignant(matriculeEnseignant);
      if (!enseignantValide) {
        throw new ServiceError('Invalid teacher or teacher not found', 400, 'INVALID_ENSEIGNANT');
      }

      const updatedUE = await this.ueRepository.update(codeUE, {
        enseignant_responsable: matriculeEnseignant
      });

      logger.info('Enseignant assigné à l\'UE', { 
        code_ue: codeUE, 
        enseignant: matriculeEnseignant 
      });

      return updatedUE;

    } catch (error) {
      logger.error('Erreur assignation enseignant', { 
        code_ue: codeUE, 
        enseignant: matriculeEnseignant,
        error: error.message 
      });
      throw error;
    }
  }
}