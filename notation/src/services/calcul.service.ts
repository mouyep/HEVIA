import { ServiceError } from '@shared/types';
import { CalculRepository } from '@repositories/calcul.repository';
import { 
  RecapEtudiant,
  CalculRequest,
  CalculResult,
  StatistiquesUE,
  ClassementEtudiant
} from '@models/Calcul';
import { logger } from '@utils/logger';

export class CalculService {
  private repository: CalculRepository;

  constructor() {
    this.repository = new CalculRepository();
  }

  async calculerMoyennesEtudiant(matriculeEtudiant: string, niveau: string, anneeAcad: string): Promise<CalculResult> {
    try {
      logger.info('Calcul des moyennes étudiant', {
        matricule_etudiant: matriculeEtudiant,
        niveau,
        annee_acad: anneeAcad
      });

      // Vérifier que l'étudiant existe et est inscrit à ce niveau
      const etudiantValide = await this.repository.validateEtudiantNiveau(
        matriculeEtudiant,
        niveau,
        anneeAcad
      );
      
      if (!etudiantValide) {
        throw new ServiceError('Student not found or not enrolled in this level', 404, 'ETUDIANT_INVALIDE');
      }

      // Récupérer toutes les UE du niveau pour l'année académique
      const ues = await this.repository.getUEsByNiveau(niveau, anneeAcad);
      
      if (ues.length === 0) {
        throw new ServiceError('No UE found for this level and academic year', 404, 'NO_UE_FOUND');
      }

      const details: Array<{
        code_ue: string;
        nom_ue: string;
        note_finale: number;
        est_capitalisee: boolean;
        credits: number;
        mention?: string;
      }> = [];

      let totalCredits = 0;
      let creditsObtenus = 0;
      let sommeMoyennes = 0;
      let sommeMoyennesPonderees = 0;
      let ueCapitalisees = 0;

      // Calculer pour chaque UE
      for (const ue of ues) {
        const noteFinale = await this.repository.getNoteFinaleUE(
          matriculeEtudiant,
          ue.code_ue,
          anneeAcad
        );

        const estCapitalisee = noteFinale >= 10;
        const mention = this.calculateMention(noteFinale);

        details.push({
          code_ue: ue.code_ue,
          nom_ue: ue.nom_ue,
          note_finale: noteFinale,
          est_capitalisee: estCapitalisee,
          credits: ue.credits_ects,
          mention
        });

        totalCredits += ue.credits_ects;
        
        if (estCapitalisee) {
          creditsObtenus += ue.credits_ects;
          ueCapitalisees++;
        }

        sommeMoyennes += noteFinale;
        sommeMoyennesPonderees += noteFinale * ue.credits_ects;
      }

      // Calcul des indicateurs
      const moyenneGenerale = ues.length > 0 ? sommeMoyennes / ues.length : 0;
      const moyennePonderee = totalCredits > 0 ? sommeMoyennesPonderees / totalCredits : 0;
      const pourcentageCapitalisation = totalCredits > 0 ? (creditsObtenus / totalCredits) * 100 : 0;

      const result: CalculResult = {
        matricule_etudiant,
        niveau,
        annee_acad: anneeAcad,
        moyenne_generale: Math.round(moyenneGenerale * 100) / 100,
        moyenne_ponderee: Math.round(moyennePonderee * 100) / 100,
        pourcentage_capitalisation: Math.round(pourcentageCapitalisation * 100) / 100,
        ue_capitalisees,
        ue_total: ues.length,
        credits_obtenus,
        credits_total: totalCredits,
        details
      };

      // Mettre à jour le récapitulatif
      await this.repository.updateRecapEtudiant(result);

      logger.info('Calcul des moyennes terminé', {
        matricule_etudiant,
        moyenne_generale: result.moyenne_generale,
        pourcentage_capitalisation: result.pourcentage_capitalisation
      });

      return result;

    } catch (error) {
      logger.error('Erreur calcul moyennes étudiant', {
        matricule_etudiant,
        niveau,
        annee_acad,
        error: error.message
      });
      throw error;
    }
  }

  async calculerStatistiquesUE(codeUE: string, anneeAcad: string): Promise<StatistiquesUE> {
    try {
      logger.info('Calcul des statistiques UE', {
        code_ue: codeUE,
        annee_acad: anneeAcad
      });

      // Récupérer toutes les notes finales pour cette UE
      const notesFinales = await this.repository.getNotesFinalesUE(codeUE, anneeAcad);
      
      if (notesFinales.length === 0) {
        throw new ServiceError('No final grades found for this UE', 404, 'NO_GRADES_FOUND');
      }

      // Calculer les statistiques
      const notes = notesFinales.map(n => n.note_finale);
      const nbEtudiants = notes.length;
      const moyenne = notes.reduce((sum, note) => sum + note, 0) / nbEtudiants;
      const variance = notes.reduce((sum, note) => sum + Math.pow(note - moyenne, 2), 0) / nbEtudiants;
      const ecartType = Math.sqrt(variance);
      
      const noteMin = Math.min(...notes);
      const noteMax = Math.max(...notes);
      
      // Calculer les quartiles
      const sortedNotes = [...notes].sort((a, b) => a - b);
      const q1 = this.calculatePercentile(sortedNotes, 25);
      const mediane = this.calculatePercentile(sortedNotes, 50);
      const q3 = this.calculatePercentile(sortedNotes, 75);
      
      const nbReussite = notes.filter(note => note >= 10).length;
      const nbEchec = nbEtudiants - nbReussite;
      const tauxReussite = (nbReussite / nbEtudiants) * 100;

      const statistiques: StatistiquesUE = {
        id: 0, // Sera généré par la base
        code_ue: codeUE,
        annee_acad: anneeAcad,
        nb_etudiants: nbEtudiants,
        moyenne_ue: Math.round(moyenne * 100) / 100,
        ecart_type: Math.round(ecartType * 100) / 100,
        note_min: Math.round(noteMin * 100) / 100,
        note_max: Math.round(noteMax * 100) / 100,
        q1: Math.round(q1 * 100) / 100,
        mediane: Math.round(mediane * 100) / 100,
        q3: Math.round(q3 * 100) / 100,
        nb_reussite: nbReussite,
        nb_echec: nbEchec,
        taux_reussite: Math.round(tauxReussite * 100) / 100,
        date_calcul: new Date()
      };

      // Sauvegarder les statistiques
      await this.repository.saveStatistiquesUE(statistiques);

      logger.info('Statistiques UE calculées', {
        code_ue: codeUE,
        moyenne: statistiques.moyenne_ue,
        taux_reussite: statistiques.taux_reussite
      });

      return statistiques;

    } catch (error) {
      logger.error('Erreur calcul statistiques UE', {
        code_ue: codeUE,
        annee_acad: anneeAcad,
        error: error.message
      });
      throw error;
    }
  }

  async calculerClassementNiveau(niveau: string, anneeAcad: string): Promise<ClassementEtudiant[]> {
    try {
      logger.info('Calcul du classement par niveau', {
        niveau,
        annee_acad: anneeAcad
      });

      // Récupérer tous les récapitulatifs pour le niveau
      const recaps = await this.repository.getRecapsByNiveau(niveau, anneeAcad);
      
      if (recaps.length === 0) {
        throw new ServiceError('No students found for this level', 404, 'NO_STUDENTS_FOUND');
      }

      // Trier par moyenne générale (décroissante)
      const sortedRecaps = [...recaps].sort((a, b) => {
        if (b.moyenne_generale === a.moyenne_generale) {
          // En cas d'égalité, on utilise la moyenne pondérée
          return (b.moyenne_ponderee || 0) - (a.moyenne_ponderee || 0);
        }
        return (b.moyenne_generale || 0) - (a.moyenne_generale || 0);
      });

      // Ajouter le rang et les informations étudiant
      const classement: ClassementEtudiant[] = [];
      
      for (let i = 0; i < sortedRecaps.length; i++) {
        const recap = sortedRecaps[i];
        const etudiant = await this.repository.getEtudiantInfo(recap.matricule_etudiant);
        
        classement.push({
          rang: i + 1,
          matricule: recap.matricule_etudiant,
          nom: etudiant.nom,
          prenom: etudiant.prenom,
          moyenne_generale: recap.moyenne_generale || 0,
          pourcentage_capitalisation: recap.pourcentage_capitalisation || 0,
          decision: recap.decision,
          mention: this.calculateMentionGenerale(recap.moyenne_generale || 0)
        });
      }

      // Mettre à jour les rangs dans la base
      await this.repository.updateRangs(classement);

      logger.info('Classement calculé', {
        niveau,
        nb_etudiants: classement.length,
        premier: classement[0]?.matricule,
        dernier: classement[classement.length - 1]?.matricule
      });

      return classement;

    } catch (error) {
      logger.error('Erreur calcul classement', {
        niveau,
        annee_acad: anneeAcad,
        error: error.message
      });
      throw error;
    }
  }

  async calculerPourcentageCapitalisation(matriculeEtudiant: string, niveau: string, anneeAcad: string): Promise<number> {
    try {
      const result = await this.calculerMoyennesEtudiant(matriculeEtudiant, niveau, anneeAcad);
      return result.pourcentage_capitalisation;
    } catch (error) {
      logger.error('Erreur calcul pourcentage capitalisation', {
        matricule_etudiant: matriculeEtudiant,
        error: error.message
      });
      throw error;
    }
  }

  async verifierEligibiliteDeliberation(matriculeEtudiant: string, niveau: string, anneeAcad: string): Promise<{
    eligible: boolean;
    raison?: string;
    details: {
      pourcentage_capitalisation: number;
      ue_non_capitalisees: number;
      ue_total: number;
      criteres: Array<{ critere: string; valeur: number; seuil: number; respecte: boolean }>;
    };
  }> {
    try {
      // Récupérer les paramètres de délibération pour le niveau
      const params = await this.repository.getParamsDeliberation(niveau);
      if (!params) {
        throw new ServiceError('Deliberation parameters not found for this level', 404, 'PARAMS_NOT_FOUND');
      }

      // Calculer les statistiques de l'étudiant
      const stats = await this.calculerMoyennesEtudiant(matriculeEtudiant, niveau, anneeAcad);

      // Vérifier les critères
      const criteres: Array<{ critere: string; valeur: number; seuil: number; respecte: boolean }> = [];
      
      // Critère 1: Pourcentage de capitalisation minimum
      const critere1 = {
        critere: 'Pourcentage de capitalisation',
        valeur: stats.pourcentage_capitalisation,
        seuil: params.min_capitalisation,
        respecte: stats.pourcentage_capitalisation >= params.min_capitalisation
      };
      criteres.push(critere1);

      // Critère 2: Nombre maximum d'UE non capitalisées
      const ueNonCapitalisees = stats.ue_total - stats.ue_capitalisees;
      const critere2 = {
        critere: 'UE non capitalisées',
        valeur: ueNonCapitalisees,
        seuil: params.max_ue_non_capitalisees,
        respecte: ueNonCapitalisees <= params.max_ue_non_capitalisees
      };
      criteres.push(critere2);

      // Vérifier l'éligibilité globale
      const eligible = critere1.respecte && critere2.respecte;
      const raison = !eligible 
        ? `Non respect des critères: ${criteres.filter(c => !c.respecte).map(c => c.critere).join(', ')}`
        : undefined;

      return {
        eligible,
        raison,
        details: {
          pourcentage_capitalisation: stats.pourcentage_capitalisation,
          ue_non_capitalisees: ueNonCapitalisees,
          ue_total: stats.ue_total,
          criteres
        }
      };

    } catch (error) {
      logger.error('Erreur vérification éligibilité délibération', {
        matricule_etudiant: matriculeEtudiant,
        error: error.message
      });
      throw error;
    }
  }

  async calculerMoyenneClasse(niveau: string, anneeAcad: string): Promise<{
    moyenne_classe: number;
    ecart_type: number;
    note_min: number;
    note_max: number;
    taux_reussite: number;
    nb_etudiants: number;
  }> {
    try {
      const recaps = await this.repository.getRecapsByNiveau(niveau, anneeAcad);
      
      if (recaps.length === 0) {
        return {
          moyenne_classe: 0,
          ecart_type: 0,
          note_min: 0,
          note_max: 0,
          taux_reussite: 0,
          nb_etudiants: 0
        };
      }

      const moyennes = recaps.map(r => r.moyenne_generale || 0);
      const moyenneClasse = moyennes.reduce((sum, m) => sum + m, 0) / moyennes.length;
      
      const variance = moyennes.reduce((sum, m) => sum + Math.pow(m - moyenneClasse, 2), 0) / moyennes.length;
      const ecartType = Math.sqrt(variance);
      
      const noteMin = Math.min(...moyennes);
      const noteMax = Math.max(...moyennes);
      
      const nbReussite = moyennes.filter(m => m >= 10).length;
      const tauxReussite = (nbReussite / moyennes.length) * 100;

      return {
        moyenne_classe: Math.round(moyenneClasse * 100) / 100,
        ecart_type: Math.round(ecartType * 100) / 100,
        note_min: Math.round(noteMin * 100) / 100,
        note_max: Math.round(noteMax * 100) / 100,
        taux_reussite: Math.round(tauxReussite * 100) / 100,
        nb_etudiants: moyennes.length
      };

    } catch (error) {
      logger.error('Erreur calcul moyenne classe', {
        niveau,
        annee_acad: anneeAcad,
        error: error.message
      });
      throw error;
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private calculateMention(note: number): string {
    if (note >= 18) return 'excellent';
    if (note >= 16) return 'très bien';
    if (note >= 14) return 'bien';
    if (note >= 12) return 'assez bien';
    if (note >= 10) return 'passable';
    if (note >= 5) return 'echec';
    return 'elimine';
  }

  private calculateMentionGenerale(moyenne: number): string {
    if (moyenne >= 16) return 'très bien';
    if (moyenne >= 14) return 'bien';
    if (moyenne >= 12) return 'assez bien';
    if (moyenne >= 10) return 'passable';
    return 'echec';
  }
}