export class ValidationService {

  static verifierNote(note: number): boolean {
    return note >= 0 && note <= 20;
  }

  static verifierCoefficient(coef: number): boolean {
    return coef > 0;
  }

  static verifierDecision(moyenne: number): 'VALIDE' | 'NON VALIDE' {
    return moyenne >= 10 ? 'VALIDE' : 'NON VALIDE';
  }
}
