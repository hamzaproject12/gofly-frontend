-- Ajout de la valeur BONUS à l'enum LedgerType (crédits de bienvenue).
-- Migration additive : aucune donnée existante n'est modifiée.
ALTER TYPE "LedgerType" ADD VALUE 'BONUS';
