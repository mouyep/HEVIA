export interface PV {
  id: number;
  codeUE: string;
  anneeAcademique: string;
  session: 'NORMALE' | 'RATTRAPAGE';
  filiere: string;
  niveau: string;
  moyenneUE: number;
  decision: 'VALIDE' | 'NON VALIDE';
  genereLe: Date;
}

export interface CreatePVDto {
  codeUE: string;
  anneeAcademique: string;
  session: 'NORMALE' | 'RATTRAPAGE';
  filiere: string;
  niveau: string;
}
