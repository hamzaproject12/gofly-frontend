-- Migration manuelle pour ajouter les champs de soft delete et corriger l'enum Role

-- 1. Ajouter les colonnes isDeleted et deletedAt à la table Program
ALTER TABLE "Program" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Program" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 2. Créer l'enum Role s'il n'existe pas
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'AGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Ajouter la colonne role à la table Agent si elle n'existe pas
DO $$ BEGIN
    ALTER TABLE "Agent" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'AGENT';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 4. Supprimer la table User si elle existe (non utilisée)
DROP TABLE IF EXISTS "User";
