-- Migration 002: Données initiales pour le schéma authperms
-- Date: $(date)

-- Insérer des permissions de base
INSERT INTO authperms.permissions (nom_objet_bd, type_permission, description, created_by) VALUES
-- Permissions utilisateur
('users', 'read', 'Lire les informations utilisateur', 'system'),
('users', 'write', 'Créer des utilisateurs', 'system'),
('users', 'update', 'Mettre à jour les utilisateurs', 'system'),
('users', 'delete', 'Supprimer des utilisateurs', 'system'),

-- Permissions notes
('notes', 'read', 'Consulter les notes', 'system'),
('notes', 'write', 'Saisir des notes', 'system'),
('notes', 'update', 'Modifier des notes', 'system'),

-- Permissions UE
('ue', 'read', 'Consulter les UE', 'system'),
('ue', 'write', 'Créer des UE', 'system'),
('ue', 'update', 'Modifier des UE', 'system'),
('ue', 'delete', 'Supprimer des UE', 'system'),

-- Permissions PV
('pv', 'read', 'Consulter les PV', 'system'),
('pv', 'write', 'Générer des PV', 'system'),

-- Permissions requêtes
('requetes', 'read', 'Consulter les requêtes', 'system'),
('requetes', 'update', 'Traiter les requêtes', 'system'),

-- Permissions délibération
('deliberation', 'read', 'Consulter les délibérations', 'system'),
('deliberation', 'write', 'Participer aux délibérations', 'system'),

-- Permissions statistiques
('statistiques', 'read', 'Consulter les statistiques', 'system')
ON CONFLICT (nom_objet_bd, type_permission) DO NOTHING;

-- Insérer un administrateur système (pour tests seulement)
-- Mot de passe: Admin123! (à changer en production)
INSERT INTO authperms.users (matricule, role, password, is_active, created_by) VALUES
('ADM000000001', 'admin', '$2b$12$YourHashedPasswordHere', true, 'system')
ON CONFLICT (matricule) DO NOTHING;

-- Assigner toutes les permissions à l'administrateur système
INSERT INTO authperms.userperms (mat, idperm, statut, granted_at, granted_by)
SELECT 
    'ADM000000001',
    p.id_perm,
    'granted',
    CURRENT_TIMESTAMP,
    'system'
FROM authperms.permissions p
ON CONFLICT (mat, idperm) DO NOTHING;

-- Créer des utilisateurs de test pour chaque rôle (pour développement seulement)
INSERT INTO authperms.users (matricule, role, password, is_active, created_by) VALUES
('ETU000000001', 'etudiant', '$2b$12$YourHashedPasswordHere', true, 'system'),
('ENS000000001', 'enseignant', '$2b$12$YourHashedPasswordHere', true, 'system'),
('DOY000000001', 'doyen', '$2b$12$YourHashedPasswordHere', true, 'system'),
('REC000000001', 'recteur', '$2b$12$YourHashedPasswordHere', true, 'system')
ON CONFLICT (matricule) DO NOTHING;

-- Assigner des permissions aux enseignants
INSERT INTO authperms.userperms (mat, idperm, statut, granted_at, granted_by)
SELECT 
    'ENS000000001',
    p.id_perm,
    'granted',
    CURRENT_TIMESTAMP,
    'system'
FROM authperms.permissions p
WHERE p.nom_objet_bd IN ('notes', 'ue', 'pv', 'requetes')
ON CONFLICT (mat, idperm) DO NOTHING;

-- Assigner toutes les permissions aux doyens et recteurs
INSERT INTO authperms.userperms (mat, idperm, statut, granted_at, granted_by)
SELECT 
    u.matricule,
    p.id_perm,
    'granted',
    CURRENT_TIMESTAMP,
    'system'
FROM authperms.users u
CROSS JOIN authperms.permissions p
WHERE u.role IN ('doyen', 'recteur')
ON CONFLICT (mat, idperm) DO NOTHING;

-- Journal de la migration
COMMENT ON TABLE authperms.permissions IS 'Permissions initiales insérées le $(date)';