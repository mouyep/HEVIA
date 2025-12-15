-- migrations/001_create_notation_tables.sql
-- Migration pour créer toutes les tables du schéma notation

BEGIN;

-- Table des Unités d'Enseignement (UE)
CREATE TABLE IF NOT EXISTS notation.unites_enseignement (
    code_ue VARCHAR(10) PRIMARY KEY,
    nom_ue VARCHAR(200) NOT NULL,
    niveau VARCHAR(5) NOT NULL CHECK (niveau IN ('L1', 'L2', 'L3', 'M1', 'M2', 'D1', 'D2', 'D3')),
    filiere VARCHAR(10) NOT NULL,
    credits_ects INTEGER NOT NULL CHECK (credits_ects > 0 AND credits_ects <= 30),
    enseignant_responsable VARCHAR(20) REFERENCES authperms.users(matricule),
    volume_horaire INTEGER CHECK (volume_horaire > 0),
    description TEXT,
    objectifs TEXT,
    prerequis TEXT,
    annee_acad VARCHAR(9) NOT NULL REFERENCES gestacad.annees_academiques(nom),
    statut VARCHAR(10) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'archive')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT uq_ue_nom_niveau UNIQUE (nom_ue, niveau, filiere, annee_acad)
);

-- Index pour performances
CREATE INDEX idx_ue_niveau_filiere ON notation.unites_enseignement(niveau, filiere, annee_acad) 
WHERE deleted_at IS NULL AND statut = 'actif';
CREATE INDEX idx_ue_enseignant ON notation.unites_enseignement(enseignant_responsable) 
WHERE deleted_at IS NULL;
CREATE INDEX idx_ue_annee ON notation.unites_enseignement(annee_acad) WHERE deleted_at IS NULL;

-- Table des composantes d'évaluation par UE
CREATE TABLE IF NOT EXISTS notation.composantes_evaluation (
    id SERIAL PRIMARY KEY,
    code_ue VARCHAR(10) NOT NULL REFERENCES notation.unites_enseignement(code_ue) ON DELETE CASCADE,
    type_composante VARCHAR(10) NOT NULL CHECK (type_composante IN ('CC', 'SN', 'SR', 'TP', 'TPE', 'PROJET')),
    nom_composante VARCHAR(100) NOT NULL,
    pourcentage DECIMAL(5,2) NOT NULL CHECK (pourcentage >= 0 AND pourcentage <= 100),
    nb_points INTEGER NOT NULL DEFAULT 20 CHECK (nb_points > 0 AND nb_points <= 100),
    date_evaluation DATE,
    description TEXT,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_ue_composante UNIQUE (code_ue, type_composante)
);

-- Index pour performances
CREATE INDEX idx_composantes_ue ON notation.composantes_evaluation(code_ue);
CREATE INDEX idx_composantes_type ON notation.composantes_evaluation(type_composante);

-- Table des résultats d'évaluation
CREATE TABLE IF NOT EXISTS notation.resultats_evaluation (
    id SERIAL PRIMARY KEY,
    matricule_etudiant VARCHAR(20) NOT NULL,
    composante_id INTEGER NOT NULL REFERENCES notation.composantes_evaluation(id) ON DELETE CASCADE,
    note DECIMAL(5,2) NOT NULL CHECK (note >= 0),
    note_sur_20 DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN (SELECT nb_points FROM notation.composantes_evaluation WHERE id = composante_id) = 0 THEN 0
            ELSE (note * 20.0) / (SELECT nb_points FROM notation.composantes_evaluation WHERE id = composante_id)
        END
    ) STORED,
    date_evaluation DATE NOT NULL,
    saisie_par VARCHAR(20) NOT NULL REFERENCES authperms.users(matricule),
    statut VARCHAR(20) NOT NULL DEFAULT 'provisoire' 
        CHECK (statut IN ('provisoire', 'definitif', 'annule', 'en_attente', 'rattrapage')),
    mode_saisie VARCHAR(20) DEFAULT 'manuel' 
        CHECK (mode_saisie IN ('manuel', 'import', 'systeme', 'compensation')),
    commentaire TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_evaluation_etudiant_composante UNIQUE (matricule_etudiant, composante_id)
);

-- Index pour performances
CREATE INDEX idx_resultats_etudiant ON notation.resultats_evaluation(matricule_etudiant);
CREATE INDEX idx_resultats_composante ON notation.resultats_evaluation(composante_id);
CREATE INDEX idx_resultats_statut ON notation.resultats_evaluation(statut);
CREATE INDEX idx_resultats_date ON notation.resultats_evaluation(date_evaluation);
CREATE INDEX idx_resultats_ue_etudiant ON notation.resultats_evaluation(matricule_etudiant, composante_id) 
WHERE statut IN ('definitif', 'rattrapage');

-- Table des notes finales par UE (matérialisée pour performances)
CREATE TABLE IF NOT EXISTS notation.notes_finales_ue (
    id SERIAL PRIMARY KEY,
    matricule_etudiant VARCHAR(20) NOT NULL,
    code_ue VARCHAR(10) NOT NULL REFERENCES notation.unites_enseignement(code_ue),
    annee_acad VARCHAR(9) NOT NULL,
    note_finale DECIMAL(5,2) NOT NULL CHECK (note_finale >= 0 AND note_finale <= 20),
    est_capitalisee BOOLEAN NOT NULL DEFAULT FALSE,
    mention VARCHAR(50) CHECK (mention IN ('elimine', 'echec', 'passable', 'assez-bien', 'tres-bien', 'excellent')),
    date_calcul TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version_calcul INTEGER NOT NULL DEFAULT 1,
    
    UNIQUE(matricule_etudiant, code_ue, annee_acad)
);

CREATE INDEX idx_notes_finales_etudiant ON notation.notes_finales_ue(matricule_etudiant);
CREATE INDEX idx_notes_finales_ue ON notation.notes_finales_ue(code_ue);
CREATE INDEX idx_notes_finales_capitalise ON notation.notes_finales_ue(est_capitalisee);

-- Table des récapitulatifs étudiants par année/niveau
CREATE TABLE IF NOT EXISTS notation.recap_etudiants (
    id SERIAL PRIMARY KEY,
    matricule_etudiant VARCHAR(20) NOT NULL,
    annee_acad VARCHAR(9) NOT NULL,
    niveau VARCHAR(5) NOT NULL,
    moyenne_generale DECIMAL(5,2) CHECK (moyenne_generale >= 0 AND moyenne_generale <= 20),
    moyenne_ponderee DECIMAL(5,2) CHECK (moyenne_ponderee >= 0 AND moyenne_ponderee <= 20),
    pourcentage_capitalisation DECIMAL(5,2) CHECK (pourcentage_capitalisation >= 0 AND pourcentage_capitalisation <= 100),
    ue_capitalisees INTEGER DEFAULT 0,
    ue_total INTEGER DEFAULT 0,
    credits_obtenus INTEGER DEFAULT 0,
    credits_total INTEGER DEFAULT 0,
    rang INTEGER,
    is_subject_to_deliberation BOOLEAN DEFAULT FALSE,
    can_be_deliberated BOOLEAN DEFAULT FALSE,
    has_been_deliberated BOOLEAN DEFAULT FALSE,
    decision VARCHAR(20) CHECK (decision IN ('admis', 'echec', 'delibere')),
    mention_generale VARCHAR(50),
    date_calcul TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(matricule_etudiant, annee_acad, niveau)
);

CREATE INDEX idx_recap_annee_niveau ON notation.recap_etudiants(annee_acad, niveau);
CREATE INDEX idx_recap_decision ON notation.recap_etudiants(decision);
CREATE INDEX idx_recap_moyenne ON notation.recap_etudiants(moyenne_generale DESC);

-- Table des statistiques par UE
CREATE TABLE IF NOT EXISTS notation.statistiques_ue (
    id SERIAL PRIMARY KEY,
    code_ue VARCHAR(10) NOT NULL REFERENCES notation.unites_enseignement(code_ue),
    annee_acad VARCHAR(9) NOT NULL,
    nb_etudiants INTEGER NOT NULL DEFAULT 0,
    moyenne_ue DECIMAL(5,2),
    ecart_type DECIMAL(5,2),
    note_min DECIMAL(5,2),
    note_max DECIMAL(5,2),
    q1 DECIMAL(5,2),
    mediane DECIMAL(5,2),
    q3 DECIMAL(5,2),
    nb_reussite INTEGER DEFAULT 0,
    nb_echec INTEGER DEFAULT 0,
    taux_reussite DECIMAL(5,2),
    date_calcul TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(code_ue, annee_acad)
);

-- Table des PV (Procès-Verbaux)
CREATE TABLE IF NOT EXISTS notation.pv_generes (
    id SERIAL PRIMARY KEY,
    type_pv VARCHAR(50) NOT NULL CHECK (type_pv IN ('notes_ue', 'admission_niveau', 'deliberation', 'releve_etudiant')),
    reference VARCHAR(100) NOT NULL UNIQUE,
    annee_acad VARCHAR(9) NOT NULL,
    niveau VARCHAR(5),
    code_ue VARCHAR(10),
    matricule_etudiant VARCHAR(20),
    contenu JSONB NOT NULL,
    chemin_fichier VARCHAR(500),
    generated_by VARCHAR(20) NOT NULL REFERENCES authperms.users(matricule),
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    est_valide BOOLEAN DEFAULT TRUE,
    date_validation TIMESTAMP,
    valide_par VARCHAR(20) REFERENCES authperms.users(matricule)
);

CREATE INDEX idx_pv_type ON notation.pv_generes(type_pv);
CREATE INDEX idx_pv_reference ON notation.pv_generes(reference);
CREATE INDEX idx_pv_annee_niveau ON notation.pv_generes(annee_acad, niveau);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION notation.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_ue_updated_at 
    BEFORE UPDATE ON notation.unites_enseignement 
    FOR EACH ROW 
    EXECUTE FUNCTION notation.update_updated_at_column();

CREATE TRIGGER update_composantes_updated_at 
    BEFORE UPDATE ON notation.composantes_evaluation 
    FOR EACH ROW 
    EXECUTE FUNCTION notation.update_updated_at_column();

CREATE TRIGGER update_resultats_updated_at 
    BEFORE UPDATE ON notation.resultats_evaluation 
    FOR EACH ROW 
    EXECUTE FUNCTION notation.update_updated_at_column();

CREATE TRIGGER update_recap_updated_at 
    BEFORE UPDATE ON notation.recap_etudiants 
    FOR EACH ROW 
    EXECUTE FUNCTION notation.update_updated_at_column();

-- Trigger pour vérifier la somme des pourcentages = 100%
CREATE OR REPLACE FUNCTION notation.check_ue_percentage_total()
RETURNS TRIGGER AS $$
DECLARE
    total_percentage DECIMAL;
    ue_code VARCHAR(10);
BEGIN
    IF TG_OP = 'INSERT' THEN
        ue_code := NEW.code_ue;
    ELSE
        ue_code := OLD.code_ue;
    END IF;
    
    SELECT SUM(pourcentage) INTO total_percentage
    FROM notation.composantes_evaluation
    WHERE code_ue = ue_code;
    
    IF total_percentage IS NOT NULL AND ABS(total_percentage - 100) > 0.01 THEN
        RAISE EXCEPTION 'Total percentage for UE % must be 100%%, got %%', 
            ue_code, total_percentage;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_ue_percentage
    AFTER INSERT OR UPDATE OR DELETE ON notation.composantes_evaluation
    FOR EACH ROW
    EXECUTE FUNCTION notation.check_ue_percentage_total();

-- Trigger pour mettre à jour les notes finales
CREATE OR REPLACE FUNCTION notation.update_note_finale_ue()
RETURNS TRIGGER AS $$
DECLARE
    v_note_finale DECIMAL(5,2);
    v_est_capitalisee BOOLEAN;
    v_mention VARCHAR(50);
    v_code_ue VARCHAR(10);
    v_annee_acad VARCHAR(9);
BEGIN
    -- Récupérer le code UE et l'année académique
    SELECT ce.code_ue, ue.annee_acad INTO v_code_ue, v_annee_acad
    FROM notation.composantes_evaluation ce
    JOIN notation.unites_enseignement ue ON ce.code_ue = ue.code_ue
    WHERE ce.id = NEW.composante_id;
    
    -- Calculer la note finale
    SELECT 
        SUM(re.note_sur_20 * ce.pourcentage / 100.0),
        CASE WHEN SUM(re.note_sur_20 * ce.pourcentage / 100.0) >= 10 THEN TRUE ELSE FALSE END,
        CASE 
            WHEN SUM(re.note_sur_20 * ce.pourcentage / 100.0) >= 18 THEN 'excellent'
            WHEN SUM(re.note_sur_20 * ce.pourcentage / 100.0) >= 16 THEN 'tres-bien'
            WHEN SUM(re.note_sur_20 * ce.pourcentage / 100.0) >= 14 THEN 'bien'
            WHEN SUM(re.note_sur_20 * ce.pourcentage / 100.0) >= 12 THEN 'assez-bien'
            WHEN SUM(re.note_sur_20 * ce.pourcentage / 100.0) >= 10 THEN 'passable'
            ELSE 'echec'
        END
    INTO v_note_finale, v_est_capitalisee, v_mention
    FROM notation.resultats_evaluation re
    JOIN notation.composantes_evaluation ce ON re.composante_id = ce.id
    WHERE re.matricule_etudiant = NEW.matricule_etudiant
    AND ce.code_ue = v_code_ue
    AND re.statut IN ('definitif', 'rattrapage');
    
    -- Mettre à jour ou insérer la note finale
    INSERT INTO notation.notes_finales_ue 
        (matricule_etudiant, code_ue, annee_acad, note_finale, est_capitalisee, mention, version_calcul)
    VALUES 
        (NEW.matricule_etudiant, v_code_ue, v_annee_acad, v_note_finale, v_est_capitalisee, v_mention, 1)
    ON CONFLICT (matricule_etudiant, code_ue, annee_acad) 
    DO UPDATE SET
        note_finale = EXCLUDED.note_finale,
        est_capitalisee = EXCLUDED.est_capitalisee,
        mention = EXCLUDED.mention,
        version_calcul = notes_finales_ue.version_calcul + 1,
        date_calcul = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_note_finale
    AFTER INSERT OR UPDATE ON notation.resultats_evaluation
    FOR EACH ROW
    WHEN (NEW.statut IN ('definitif', 'rattrapage'))
    EXECUTE FUNCTION notation.update_note_finale_ue();

-- Insertion des données de test
INSERT INTO notation.unites_enseignement 
    (code_ue, nom_ue, niveau, filiere, credits_ects, enseignant_responsable, annee_acad) 
VALUES
    ('INF201', 'Algorithmique Avancée', 'L2', 'GL', 5, 'ENS20230001', '2023-2024'),
    ('INF202', 'Bases de Données', 'L2', 'GL', 6, 'ENS20230001', '2023-2024'),
    ('INF203', 'Réseaux Informatiques', 'L2', 'GL', 4, NULL, '2023-2024'),
    ('MAT201', 'Mathématiques Discrètes', 'L2', 'GL', 5, NULL, '2023-2024')
ON CONFLICT (code_ue) DO NOTHING;

-- Insertion des composantes d'évaluation
INSERT INTO notation.composantes_evaluation 
    (code_ue, type_composante, nom_composante, pourcentage, nb_points) 
VALUES
    ('INF201', 'CC', 'Contrôle Continu', 30, 20),
    ('INF201', 'SN', 'Session Normale', 50, 20),
    ('INF201', 'TP', 'Travaux Pratiques', 20, 20),
    
    ('INF202', 'CC', 'Contrôle Continu', 40, 20),
    ('INF202', 'SN', 'Session Normale', 60, 20),
    
    ('INF203', 'CC', 'Contrôle Continu', 30, 20),
    ('INF203', 'SN', 'Session Normale', 40, 20),
    ('INF203', 'TP', 'Travaux Pratiques', 30, 20)
ON CONFLICT (code_ue, type_composante) DO NOTHING;

COMMIT;

-- Afficher un récapitulatif
DO $$ 
DECLARE
    v_ue_count INTEGER;
    v_composantes_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_ue_count FROM notation.unites_enseignement;
    SELECT COUNT(*) INTO v_composantes_count FROM notation.composantes_evaluation;
    
    RAISE NOTICE '✅ Migration notation terminée avec succès!';
    RAISE NOTICE '📊 Statistiques:';
    RAISE NOTICE '   Unités d''enseignement: %', v_ue_count;
    RAISE NOTICE '   Composantes d''évaluation: %', v_composantes_count;
    RAISE NOTICE '   Triggers créés: validation pourcentages, mise à jour notes finales';
END $$;