import { ServiceError } from '@shared/types';
import { EvaluationRepository } from '@repositories/evaluation.repository';
import { UERepository } from '@repositories/ue.repository';
import { 
  ResultatEvaluation,
  CreateEvaluationDto,
  UpdateEvaluationDto,
  EvaluationWithDetails,
  BatchEvaluationDto
} from '@models/Evaluation';
import { logger } from '@utils/logger';

export class EvaluationService {
  private evaluationRepository: EvaluationRepository;
  private ueRepository: UERepository;

  constructor() {
    this.evaluationRepository = new EvaluationRepository();
    this.ueRepository = new UERepository();
  }

  async createEvaluation(data: CreateEvaluationDto): Promise<ResultatEvaluation> {
    try {
      logger.info('Création d\'une évaluation', {
        matricule_etudiant: data.matricule_etudiant,
        composante_id: data.composante_id
      });

      // Vérifier que la composante existe
      const composante = await this.evaluationRepository.getComposante(data.composante_id);
      if (!composante) {
        throw new ServiceError('Evaluation component not found', 404, 'COMPOSANTE_NOT_FOUND');
      }

      // Vérifier que l'étudiant existe
      const etudiantValide = await this.evaluationRepository.validateEtudiant(data.matricule_etudiant);
      if (!etudiantValide) {
        throw new ServiceError('Student not found or invalid', 400, 'INVALID_ETUDIANT');
      }

      // Vérifier que l'enseignant a le droit de saisir cette note
      const canSaisir = await this.evaluationRepository.canSaisirNote(
        data.saisie_par,
        composante.code_ue
      );
      
      if (!canSaisir) {
        throw new ServiceError(
          'Teacher not authorized to enter grades for this UE',
          403,
          'NOT_AUTHORIZED'
        );
      }

      // Vérifier la plage de la note
      if (data.note < 0 || data.note > composante.nb_points) {
        throw new ServiceError(
          `Note must be between 0 and ${composante.nb_points}`,
          400,
          'INVALID_NOTE_RANGE'
        );
      }

      // Vérifier s'il existe déjà une évaluation pour cet étudiant et cette composante
      const existing = await this.evaluationRepository.findByEtudiantAndComposante(
        data.matricule_etudiant,
        data.composante_id
      );

      if (existing) {
        // Mettre à jour l'évaluation existante
        const updated = await this.evaluationRepository.update(existing.id, {
          note: data.note,
          date_evaluation: data.date_evaluation,
          commentaire: data.commentaire,
          version: existing.version + 1
        });

        logger.info('Évaluation mise à jour', { evaluation_id: updated.id });

        return updated;
      }

      // Créer une nouvelle évaluation
      const evaluation = await this.evaluationRepository.create({
        ...data,
        statut: 'provisoire',
        mode_saisie: 'manuel'
      });

      logger.info('Évaluation créée', { evaluation_id: evaluation.id });

      return evaluation;

    } catch (error) {
      logger.error('Erreur création évaluation', {
        data,
        error: error.message
      });
      throw error;
    }
  }

  async createBatchEvaluations(data: BatchEvaluationDto): Promise<{
    success: number;
    failed: number;
    errors: Array<{ matricule: string; error: string }>;
  }> {
    try {
      logger.info('Création d\'évaluations par lot', {
        composante_id: data.composante_id,
        nb_evaluations: data.evaluations.length
      });

      // Vérifier que la composante existe
      const composante = await this.evaluationRepository.getComposante(data.composante_id);
      if (!composante) {
        throw new ServiceError('Evaluation component not found', 404, 'COMPOSANTE_NOT_FOUND');
      }

      // Vérifier que l'enseignant a le droit de saisir
      const canSaisir = await this.evaluationRepository.canSaisirNote(
        data.saisie_par,
        composante.code_ue
      );
      
      if (!canSaisir) {
        throw new ServiceError(
          'Teacher not authorized to enter grades for this UE',
          403,
          'NOT_AUTHORIZED'
        );
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ matricule: string; error: string }>
      };

      // Traiter chaque évaluation
      for (const evalData of data.evaluations) {
        try {
          // Vérifier que l'étudiant existe
          const etudiantValide = await this.evaluationRepository.validateEtudiant(
            evalData.matricule_etudiant
          );
          
          if (!etudiantValide) {
            throw new ServiceError('Student not found', 404, 'ETUDIANT_NOT_FOUND');
          }

          // Vérifier la plage de la note
          if (evalData.note < 0 || evalData.note > composante.nb_points) {
            throw new ServiceError(
              `Note must be between 0 and ${composante.nb_points}`,
              400,
              'INVALID_NOTE_RANGE'
            );
          }

          // Vérifier s'il existe déjà une évaluation
          const existing = await this.evaluationRepository.findByEtudiantAndComposante(
            evalData.matricule_etudiant,
            data.composante_id
          );

          if (existing) {
            // Mettre à jour
            await this.evaluationRepository.update(existing.id, {
              note: evalData.note,
              date_evaluation: data.date_evaluation,
              commentaire: evalData.commentaire,
              version: existing.version + 1
            });
          } else {
            // Créer
            await this.evaluationRepository.create({
              matricule_etudiant: evalData.matricule_etudiant,
              composante_id: data.composante_id,
              note: evalData.note,
              date_evaluation: data.date_evaluation,
              saisie_par: data.saisie_par,
              commentaire: evalData.commentaire,
              statut: 'provisoire',
              mode_saisie: 'manuel'
            });
          }

          results.success++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            matricule: evalData.matricule_etudiant,
            error: error.message
          });
        }
      }

      logger.info('Lot d\'évaluations traité', {
        success: results.success,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Erreur création lot d\'évaluations', {
        composante_id: data.composante_id,
        error: error.message
      });
      throw error;
    }
  }

  async validateEvaluation(evaluationId: number, validatedBy: string): Promise<ResultatEvaluation> {
    try {
      logger.info('Validation d\'une évaluation', { evaluation_id: evaluationId });

      const evaluation = await this.evaluationRepository.findById(evaluationId);
      if (!evaluation) {
        throw new ServiceError('Evaluation not found', 404, 'EVALUATION_NOT_FOUND');
      }

      // Vérifier que l'évaluation n'est pas déjà validée
      if (evaluation.statut === 'definitif') {
        throw new ServiceError('Evaluation already validated', 400, 'ALREADY_VALIDATED');
      }

      // Vérifier que la personne qui valide a les droits
      const canValidate = await this.evaluationRepository.canValidateNote(
        validatedBy,
        evaluation.composante_id
      );
      
      if (!canValidate) {
        throw new ServiceError('Not authorized to validate this evaluation', 403, 'NOT_AUTHORIZED');
      }

      const updatedEvaluation = await this.evaluationRepository.update(evaluationId, {
        statut: 'definitif'
      });

      logger.info('Évaluation validée', { evaluation_id: evaluationId });

      return updatedEvaluation;

    } catch (error) {
      logger.error('Erreur validation évaluation', {
        evaluation_id: evaluationId,
        error: error.message
      });
      throw error;
    }
  }

  async getEvaluationsByUE(codeUE: string, filters?: {
    type_composante?: string;
    statut?: string;
    date_debut?: Date;
    date_fin?: Date;
  }): Promise<EvaluationWithDetails[]> {
    try {
      const ue = await this.ueRepository.findByCode(codeUE);
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      return await this.evaluationRepository.findByUEWithDetails(codeUE, filters);
    } catch (error) {
      logger.error('Erreur récupération évaluations par UE', {
        code_ue: codeUE,
        error: error.message
      });
      throw error;
    }
  }

  async getEvaluationsByEtudiant(matriculeEtudiant: string, filters?: {
    annee_acad?: string;
    niveau?: string;
    statut?: string;
  }): Promise<EvaluationWithDetails[]> {
    try {
      // Vérifier que l'étudiant existe
      const etudiantValide = await this.evaluationRepository.validateEtudiant(matriculeEtudiant);
      if (!etudiantValide) {
        throw new ServiceError('Student not found', 404, 'ETUDIANT_NOT_FOUND');
      }

      return await this.evaluationRepository.findByEtudiantWithDetails(matriculeEtudiant, filters);
    } catch (error) {
      logger.error('Erreur récupération évaluations par étudiant', {
        matricule_etudiant: matriculeEtudiant,
        error: error.message
      });
      throw error;
    }
  }

  async getNoteFinaleUE(matriculeEtudiant: string, codeUE: string): Promise<{
    note_finale: number;
    est_capitalisee: boolean;
    mention?: string;
    details: Array<{
      type_composante: string;
      note: number;
      note_sur_20: number;
      pourcentage: number;
      contribution: number;
    }>;
  }> {
    try {
      // Vérifier que l'étudiant et l'UE existent
      const [etudiantValide, ue] = await Promise.all([
        this.evaluationRepository.validateEtudiant(matriculeEtudiant),
        this.ueRepository.findByCode(codeUE)
      ]);

      if (!etudiantValide) {
        throw new ServiceError('Student not found', 404, 'ETUDIANT_NOT_FOUND');
      }
      if (!ue) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      // Récupérer toutes les évaluations définitives pour cette UE
      const evaluations = await this.evaluationRepository.findByEtudiantAndUE(
        matriculeEtudiant,
        codeUE
      );

      // Calculer la note finale
      let noteFinale = 0;
      const details: Array<{
        type_composante: string;
        note: number;
        note_sur_20: number;
        pourcentage: number;
        contribution: number;
      }> = [];

      for (const evalItem of evaluations) {
        if (evalItem.statut === 'definitif' || evalItem.statut === 'rattrapage') {
          const contribution = evalItem.note_sur_20 * (evalItem.pourcentage / 100);
          noteFinale += contribution;

          details.push({
            type_composante: evalItem.type_composante,
            note: evalItem.note,
            note_sur_20: evalItem.note_sur_20,
            pourcentage: evalItem.pourcentage,
            contribution
          });
        }
      }

      const estCapitalisee = noteFinale >= 10;
      const mention = this.calculateMention(noteFinale);

      return {
        note_finale: Math.round(noteFinale * 100) / 100, // Arrondir à 2 décimales
        est_capitalisee,
        mention,
        details
      };

    } catch (error) {
      logger.error('Erreur calcul note finale UE', {
        matricule_etudiant: matriculeEtudiant,
        code_ue: codeUE,
        error: error.message
      });
      throw error;
    }
  }

  async updateEvaluationStatus(
    evaluationId: number, 
    statut: 'provisoire' | 'definitif' | 'annule' | 'en_attente' | 'rattrapage',
    updatedBy: string
  ): Promise<ResultatEvaluation> {
    try {
      logger.info('Mise à jour statut évaluation', {
        evaluation_id: evaluationId,
        new_statut: statut
      });

      const evaluation = await this.evaluationRepository.findById(evaluationId);
      if (!evaluation) {
        throw new ServiceError('Evaluation not found', 404, 'EVALUATION_NOT_FOUND');
      }

      // Vérifier les autorisations
      const canUpdate = await this.evaluationRepository.canUpdateNote(
        updatedBy,
        evaluation.composante_id
      );
      
      if (!canUpdate) {
        throw new ServiceError('Not authorized to update this evaluation', 403, 'NOT_AUTHORIZED');
      }

      // Validation spécifique pour le statut rattrapage
      if (statut === 'rattrapage') {
        const canSetRattrapage = await this.evaluationRepository.canSetRattrapage(
          evaluation.matricule_etudiant,
          evaluation.composante_id
        );
        
        if (!canSetRattrapage) {
          throw new ServiceError('Cannot set evaluation as rattrapage', 400, 'CANNOT_SET_RATTRAPAGE');
        }
      }

      const updatedEvaluation = await this.evaluationRepository.update(evaluationId, {
        statut,
        version: evaluation.version + 1
      });

      logger.info('Statut évaluation mis à jour', {
        evaluation_id: evaluationId,
        old_statut: evaluation.statut,
        new_statut: statut
      });

      return updatedEvaluation;

    } catch (error) {
      logger.error('Erreur mise à jour statut évaluation', {
        evaluation_id: evaluationId,
        error: error.message
      });
      throw error;
    }
  }

  private calculateMention(note: number): string | undefined {
    if (note >= 18) return 'excellent';
    if (note >= 16) return 'tres-bien';
    if (note >= 14) return 'bien';
    if (note >= 12) return 'assez-bien';
    if (note >= 10) return 'passable';
    if (note >= 5) return 'echec';
    return 'elimine';
  }
}