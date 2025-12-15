import { Pool } from 'pg';
import { 
  UE, 
  CreateUEDto, 
  UpdateUEDto,
  UEWithDetails 
} from '@models/UE';
import { db } from '@config/database';
import { ServiceError } from '@shared/types';
import { logger } from '@utils/logger';

export class UERepository {
  private pool: Pool;

  constructor() {
    this.pool = db.getPool();
  }

  async create(data: CreateUEDto & { statut: string }): Promise<UE> {
    try {
      const query = `
        INSERT INTO notation.unites_enseignement 
        (code_ue, nom_ue, niveau, filiere, credits_ects, enseignant_responsable, 
         volume_horaire, description, objectifs, prerequis, annee_acad, statut)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const values = [
        data.code_ue,
        data.nom_ue,
        data.niveau,
        data.filiere,
        data.credits_ects,
        data.enseignant_responsable,
        data.volume_horaire,
        data.description,
        data.objectifs,
        data.prerequis,
        data.annee_acad,
        data.statut
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Erreur création UE', { data, error: error.message });
      
      if (error.code === '23505') { // Violation de contrainte d'unicité
        if (error.constraint?.includes('code_ue')) {
          throw new ServiceError('UE code already exists', 409, 'UE_CODE_EXISTS');
        }
        if (error.constraint?.includes('uq_ue_nom_niveau')) {
          throw new ServiceError('UE with same name already exists for this level', 409, 'UE_NAME_EXISTS');
        }
      }
      
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async findByCode(codeUE: string): Promise<UE | null> {
    try {
      const query = `
        SELECT * FROM notation.unites_enseignement 
        WHERE code_ue = $1 AND deleted_at IS NULL
      `;
      
      const result = await this.pool.query(query, [codeUE]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Erreur recherche UE par code', { code_ue: codeUE, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async findByCodeWithDetails(codeUE: string): Promise<UEWithDetails | null> {
    try {
      const query = `
        SELECT 
          ue.*,
          u.nom as enseignant_nom,
          u.prenom as enseignant_prenom,
          COUNT(DISTINCT re.matricule_etudiant) as nb_etudiants,
          AVG(nf.note_finale) as moyenne_ue,
          COUNT(CASE WHEN nf.est_capitalisee THEN 1 END) * 100.0 / 
          COUNT(DISTINCT nf.matricule_etudiant) as taux_reussite
        FROM notation.unites_enseignement ue
        LEFT JOIN authperms.users u ON ue.enseignant_responsable = u.matricule
        LEFT JOIN notation.notes_finales_ue nf ON ue.code_ue = nf.code_ue
        LEFT JOIN notation.resultats_evaluation re ON ue.code_ue = (
          SELECT code_ue FROM notation.composantes_evaluation WHERE id = re.composante_id
        )
        WHERE ue.code_ue = $1 AND ue.deleted_at IS NULL
        GROUP BY ue.code_ue, u.nom, u.prenom
      `;
      
      const result = await this.pool.query(query, [codeUE]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Erreur recherche UE avec détails', { code_ue: codeUE, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async update(codeUE: string, data: UpdateUEDto): Promise<UE> {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        return await this.findByCode(codeUE) as UE;
      }

      values.push(codeUE);
      const query = `
        UPDATE notation.unites_enseignement 
        SET ${fields.join(', ')}
        WHERE code_ue = $${paramIndex} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new ServiceError('UE not found', 404, 'UE_NOT_FOUND');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Erreur mise à jour UE', { code_ue: codeUE, error: error.message });
      
      if (error.code === 'UE_NOT_FOUND') {
        throw error;
      }
      
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async findAllWithDetails(filters: {
    niveau?: string;
    filiere?: string;
    annee_acad?: string;
    statut?: string;
    enseignant?: string;
  }, limit: number, offset: number): Promise<UEWithDetails[]> {
    try {
      let query = `
        SELECT 
          ue.*,
          u.nom as enseignant_nom,
          u.prenom as enseignant_prenom,
          COUNT(DISTINCT nf.matricule_etudiant) as nb_etudiants,
          AVG(nf.note_finale) as moyenne_ue,
          COUNT(CASE WHEN nf.est_capitalisee THEN 1 END) * 100.0 / 
          NULLIF(COUNT(DISTINCT nf.matricule_etudiant), 0) as taux_reussite
        FROM notation.unites_enseignement ue
        LEFT JOIN authperms.users u ON ue.enseignant_responsable = u.matricule
        LEFT JOIN notation.notes_finales_ue nf ON ue.code_ue = nf.code_ue
        WHERE ue.deleted_at IS NULL
      `;
      
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.niveau) {
        query += ` AND ue.niveau = $${paramIndex}`;
        values.push(filters.niveau);
        paramIndex++;
      }

      if (filters.filiere) {
        query += ` AND ue.filiere = $${paramIndex}`;
        values.push(filters.filiere);
        paramIndex++;
      }

      if (filters.annee_acad) {
        query += ` AND ue.annee_acad = $${paramIndex}`;
        values.push(filters.annee_acad);
        paramIndex++;
      }

      if (filters.statut) {
        query += ` AND ue.statut = $${paramIndex}`;
        values.push(filters.statut);
        paramIndex++;
      }

      if (filters.enseignant) {
        query += ` AND ue.enseignant_responsable = $${paramIndex}`;
        values.push(filters.enseignant);
        paramIndex++;
      }

      query += ` GROUP BY ue.code_ue, u.nom, u.prenom 
                ORDER BY ue.created_at DESC 
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      
      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Erreur liste UE avec détails', { filters, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async count(filters: {
    niveau?: string;
    filiere?: string;
    annee_acad?: string;
    statut?: string;
    enseignant?: string;
  }): Promise<number> {
    try {
      let query = `SELECT COUNT(*) FROM notation.unites_enseignement WHERE deleted_at IS NULL`;
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.niveau) {
        query += ` AND niveau = $${paramIndex}`;
        values.push(filters.niveau);
        paramIndex++;
      }

      if (filters.filiere) {
        query += ` AND filiere = $${paramIndex}`;
        values.push(filters.filiere);
        paramIndex++;
      }

      if (filters.annee_acad) {
        query += ` AND annee_acad = $${paramIndex}`;
        values.push(filters.annee_acad);
        paramIndex++;
      }

      if (filters.statut) {
        query += ` AND statut = $${paramIndex}`;
        values.push(filters.statut);
        paramIndex++;
      }

      if (filters.enseignant) {
        query += ` AND enseignant_responsable = $${paramIndex}`;
        values.push(filters.enseignant);
        paramIndex++;
      }

      const result = await this.pool.query(query, values);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Erreur comptage UE', { filters, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async validateAnneeAcad(anneeAcad: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM gestacad.annees_academiques 
          WHERE nom = $1 AND etat = 'ouverte'
        )
      `;
      
      const result = await this.pool.query(query, [anneeAcad]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Erreur validation année académique', { annee_acad: anneeAcad, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async validateEnseignant(matricule: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM authperms.users 
          WHERE matricule = $1 AND role = 'enseignant' AND is_active = true
        )
      `;
      
      const result = await this.pool.query(query, [matricule]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Erreur validation enseignant', { matricule, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async hasEvaluations(codeUE: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM notation.resultats_evaluation re
          JOIN notation.composantes_evaluation ce ON re.composante_id = ce.id
          WHERE ce.code_ue = $1
        )
      `;
      
      const result = await this.pool.query(query, [codeUE]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Erreur vérification évaluations UE', { code_ue: codeUE, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }

  async delete(codeUE: string): Promise<void> {
    try {
      const query = `
        UPDATE notation.unites_enseignement 
        SET deleted_at = CURRENT_TIMESTAMP, statut = 'inactif'
        WHERE code_ue = $1 AND deleted_at IS NULL
      `;
      
      await this.pool.query(query, [codeUE]);
    } catch (error) {
      logger.error('Erreur suppression UE', { code_ue: codeUE, error: error.message });
      throw new ServiceError('Database error', 500, 'DB_ERROR');
    }
  }
}