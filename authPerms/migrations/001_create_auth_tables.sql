-- Migration 001: Création des tables du schéma authperms
-- Date: $(date)

-- Activer les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Créer le schéma si nécessaire
CREATE SCHEMA IF NOT EXISTS authperms;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS authperms.users (
    matricule VARCHAR(50) PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_connected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    created_by VARCHAR(50),
    refresh_token_hash VARCHAR(255),
    refresh_token_expiry TIMESTAMP,
    CONSTRAINT chk_role CHECK (role IN ('etudiant', 'enseignant', 'admin', 'doyen', 'recteur'))
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_role ON authperms.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON authperms.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_connected ON authperms.users(is_connected);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON authperms.users(created_at);

-- Table des permissions
CREATE TABLE IF NOT EXISTS authperms.permissions (
    id_perm UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom_objet_bd VARCHAR(100) NOT NULL,
    type_permission VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    CONSTRAINT uq_permission_object_action UNIQUE (nom_objet_bd, type_permission),
    CONSTRAINT chk_type_permission CHECK (type_permission IN ('read', 'write', 'update', 'delete'))
);

-- Index pour les permissions
CREATE INDEX IF NOT EXISTS idx_permissions_nom_objet ON authperms.permissions(nom_objet_bd);
CREATE INDEX IF NOT EXISTS idx_permissions_type ON authperms.permissions(type_permission);

-- Table des permissions utilisateur
CREATE TABLE IF NOT EXISTS authperms.userperms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mat VARCHAR(50) NOT NULL REFERENCES authperms.users(matricule) ON DELETE CASCADE,
    idperm UUID NOT NULL REFERENCES authperms.permissions(id_perm) ON DELETE CASCADE,
    statut VARCHAR(20) DEFAULT 'waiting',
    granted_at TIMESTAMP,
    revoked_at TIMESTAMP,
    granted_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_permission UNIQUE (mat, idperm),
    CONSTRAINT chk_statut CHECK (statut IN ('granted', 'revoked', 'waiting'))
);

-- Index pour les permissions utilisateur
CREATE INDEX IF NOT EXISTS idx_userperms_mat ON authperms.userperms(mat);
CREATE INDEX IF NOT EXISTS idx_userperms_idperm ON authperms.userperms(idperm);
CREATE INDEX IF NOT EXISTS idx_userperms_statut ON authperms.userperms(statut);

-- Table des tokens blacklistés
CREATE TABLE IF NOT EXISTS authperms.token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    blacklisted_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_token UNIQUE (token)
);

-- Index pour les tokens blacklistés
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON authperms.token_blacklist(token);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON authperms.token_blacklist(expires_at);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION authperms.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON authperms.users 
    FOR EACH ROW EXECUTE FUNCTION authperms.update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON authperms.permissions 
    FOR EACH ROW EXECUTE FUNCTION authperms.update_updated_at_column();

CREATE TRIGGER update_userperms_updated_at 
    BEFORE UPDATE ON authperms.userperms 
    FOR EACH ROW EXECUTE FUNCTION authperms.update_updated_at_column();

-- Commentaires
COMMENT ON SCHEMA authperms IS 'Schéma pour l''authentification et les permissions';
COMMENT ON TABLE authperms.users IS 'Table des utilisateurs du système';
COMMENT ON TABLE authperms.permissions IS 'Table des permissions disponibles';
COMMENT ON TABLE authperms.userperms IS 'Table d''association utilisateurs-permissions';
COMMENT ON TABLE authperms.token_blacklist IS 'Table des tokens JWT révoqués';