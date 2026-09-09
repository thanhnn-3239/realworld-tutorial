-- The column now stores an object key, and the old default was a URL.
ALTER TABLE "User" ALTER COLUMN "image" DROP DEFAULT;
