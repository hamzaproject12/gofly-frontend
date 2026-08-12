-- Promotion du compte administrateur le plus ancien en GERANT.
--
-- Sans cette étape, une agence déjà en production se retrouverait sans aucun
-- compte capable de créer des utilisateurs ni de réinitialiser un mot de passe :
-- ce droit passe des ADMIN au seul GERANT.
--
-- Le compte retenu est le premier administrateur actif créé, qui correspond en
-- pratique au compte du patron. Rien n'est fait si un GERANT existe déjà, ou si
-- l'agence n'a aucun administrateur actif.

UPDATE "Agent"
SET role = 'GERANT'
WHERE id = (
  SELECT id
  FROM "Agent"
  WHERE role = 'ADMIN'
    AND "isActive" = true
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM "Agent" WHERE role = 'GERANT'
);
