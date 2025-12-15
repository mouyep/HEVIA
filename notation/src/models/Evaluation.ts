export interface ResultatEvaluation {
  id: number;
  matricule_etudiant: string;
  composante_id: number;
  note: number;
  note_sur_20: number;
  date_evaluation: Date;
  saisie_par: string;
  statut: 'provisoire' | 'definitif' | 'annule' | 'en_attente' | 'rattrapage';
  mode_saisie: 'manuel' | 'import' | 'systeme' | 'compensation';
  commentaire?: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEvaluationDto {
  matricule_etudiant: string;
  composante_id: number;
  note: number;
  date_evaluation: Date;
  saisie_par: string;
  commentaire?: string;
}

export interface UpdateEvaluationDto {
  note?: number;
  statut?: 'provisoire' | 'definitif' | 'annule' | 'en_attente' | 'rattrapage';
  commentaire?: string;
}

export interface EvaluationWithDetails extends ResultatEvaluation {
  etudiant_nom: string;
  etudiant_prenom: string;
  code_ue: string;
  nom_ue: string;
  type_composante: string;
  nom_composante: string;
  pourcentage: number;
  nb_points: number;
}

export interface NoteFinaleUE {
  id: number;
  matricule_etudiant: string;
  code_ue: string;
  annee_acad: string;
  note_finale: number;
  est_capitalisee: boolean;
  mention?: 'elimine' | 'echec' | 'passable' | 'assez-bien' | 'tres-bien' | 'excellent';
  date_calcul: Date;
  version_calcul: number;
}

export interface BatchEvaluationDto {
  composante_id: number;
  date_evaluation: Date;
  saisie_par: string;
  evaluations: Array<{
    matricule_etudiant: string;
    note: number;
    commentaire?: string;
  }>;
}