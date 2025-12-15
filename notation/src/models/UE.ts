export interface UE {
  code_ue: string;
  nom_ue: string;
  niveau: string; // L1, L2, M1, M2, etc.
  filiere: string;
  credits_ects: number;
  enseignant_responsable?: string;
  volume_horaire?: number;
  description?: string;
  objectifs?: string;
  prerequis?: string;
  annee_acad: string;
  statut: 'actif' | 'inactif' | 'archive';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface CreateUEDto {
  code_ue: string;
  nom_ue: string;
  niveau: string;
  filiere: string;
  credits_ects: number;
  enseignant_responsable?: string;
  volume_horaire?: number;
  description?: string;
  objectifs?: string;
  prerequis?: string;
  annee_acad: string;
}

export interface UpdateUEDto {
  nom_ue?: string;
  enseignant_responsable?: string;
  volume_horaire?: number;
  description?: string;
  objectifs?: string;
  prerequis?: string;
  statut?: 'actif' | 'inactif' | 'archive';
}

export interface UEWithDetails extends UE {
  enseignant_nom?: string;
  enseignant_prenom?: string;
  nb_etudiants: number;
  moyenne_ue?: number;
  taux_reussite?: number;
}

export interface ComposanteEvaluation {
  id: number;
  code_ue: string;
  type_composante: 'CC' | 'SN' | 'SR' | 'TP' | 'TPE' | 'PROJET';
  nom_composante: string;
  pourcentage: number;
  nb_points: number;
  date_evaluation?: Date;
  description?: string;
  ordre: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateComposanteDto {
  type_composante: 'CC' | 'SN' | 'SR' | 'TP' | 'TPE' | 'PROJET';
  nom_composante: string;
  pourcentage: number;
  nb_points?: number;
  date_evaluation?: Date;
  description?: string;
  ordre?: number;
}