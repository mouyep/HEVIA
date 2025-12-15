export interface RecapEtudiant {
  id: number;
  matricule_etudiant: string;
  annee_acad: string;
  niveau: string;
  moyenne_generale?: number;
  moyenne_ponderee?: number;
  pourcentage_capitalisation?: number;
  ue_capitalisees: number;
  ue_total: number;
  credits_obtenus: number;
  credits_total: number;
  rang?: number;
  is_subject_to_deliberation: boolean;
  can_be_deliberated: boolean;
  has_been_deliberated: boolean;
  decision?: 'admis' | 'echec' | 'delibere';
  mention_generale?: string;
  date_calcul: Date;
  updated_at: Date;
}

export interface CalculRequest {
  matricule_etudiant?: string;
  niveau?: string;
  annee_acad?: string;
  filiere?: string;
}

export interface CalculResult {
  matricule_etudiant: string;
  niveau: string;
  annee_acad: string;
  moyenne_generale: number;
  moyenne_ponderee: number;
  pourcentage_capitalisation: number;
  ue_capitalisees: number;
  ue_total: number;
  credits_obtenus: number;
  credits_total: number;
  details: Array<{
    code_ue: string;
    nom_ue: string;
    note_finale: number;
    est_capitalisee: boolean;
    credits: number;
    mention?: string;
  }>;
}

export interface StatistiquesUE {
  id: number;
  code_ue: string;
  annee_acad: string;
  nb_etudiants: number;
  moyenne_ue?: number;
  ecart_type?: number;
  note_min?: number;
  note_max?: number;
  q1?: number;
  mediane?: number;
  q3?: number;
  nb_reussite: number;
  nb_echec: number;
  taux_reussite?: number;
  date_calcul: Date;
}

export interface ClassementEtudiant {
  rang: number;
  matricule: string;
  nom: string;
  prenom: string;
  moyenne_generale: number;
  pourcentage_capitalisation: number;
  decision?: string;
  mention?: string;
}