/**
 * Utilitaires de calcul académique
 * Utilisé par les services de calcul et de PV
 */

export interface NotePonderee {
  note: number;
  coefficient: number;
}

export class CalculUtils {

  /**
   * Calcule la moyenne pondérée
   * @param notes tableau de notes avec coefficients
   */
  static calculerMoyenne(notes: NotePonderee[]): number {
    if (notes.length === 0) return 0;

    let sommeNotes = 0;
    let sommeCoef = 0;

    for (const n of notes) {
      sommeNotes += n.note * n.coefficient;
      sommeCoef += n.coefficient;
    }

    return Number((sommeNotes / sommeCoef).toFixed(2));
  }

  /**
   * Décision académique selon la moyenne
   */
  static decision(moyenne: number): 'VALIDE' | 'NON VALIDE' {
    return moyenne >= 10 ? 'VALIDE' : 'NON VALIDE';
  }

  /**
   * Vérifie si une note est valide
   */
  static noteValide(note: number): boolean {
    return note >= 0 && note <= 20;
  }

  /**
   * Vérifie un coefficient
   */
  static coefficientValide(coef: number): boolean {
    return coef > 0;
  }
}
