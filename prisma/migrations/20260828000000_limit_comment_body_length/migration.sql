-- Abort before altering the column rather than silently truncating legacy data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Comment"
    WHERE char_length("body") > 255
  ) THEN
    RAISE EXCEPTION 'Cannot limit Comment.body to 255 characters: existing rows exceed the limit'
      USING HINT = 'Shorten or delete rows returned by SELECT "id", char_length("body") FROM "Comment" WHERE char_length("body") > 255 before retrying this migration.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "body" SET DATA TYPE VARCHAR(255);
