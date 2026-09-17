-- Refuse rather than half-apply: two rows differing only by case would violate
-- "User_email_key", and choosing which one survives is a data decision, not a code one.
DO $$
DECLARE
  colliding INTEGER;
BEGIN
  SELECT COUNT(*) INTO colliding
  FROM (
    SELECT lower(email)
    FROM "User"
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF colliding > 0 THEN
    RAISE EXCEPTION
      'Refusing to normalize emails: % address(es) collide when lowercased. Resolve them manually first.',
      colliding;
  END IF;
END $$;

UPDATE "User" SET email = lower(email) WHERE email <> lower(email);
