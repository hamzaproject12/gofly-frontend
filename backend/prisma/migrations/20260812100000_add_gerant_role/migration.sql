-- Ajout du rôle GERANT (patron de l'agence), seul habilité à gérer les comptes
-- et à réinitialiser les mots de passe de ses employés.
--
-- Migration purement additive : aucune ligne existante n'est modifiée ici.
-- L'affectation du rôle aux comptes existants est faite dans la migration
-- suivante, car PostgreSQL interdit d'utiliser une valeur d'enum dans la même
-- transaction que celle qui l'ajoute.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GERANT';
