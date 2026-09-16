-- CreateTable
CREATE TABLE "PendingAuthProviderLink" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingAuthProviderLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingAuthProviderLink_tokenHash_key" ON "PendingAuthProviderLink"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PendingAuthProviderLink_provider_providerAccountId_key" ON "PendingAuthProviderLink"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingAuthProviderLink_userId_provider_key" ON "PendingAuthProviderLink"("userId", "provider");

-- CreateIndex
CREATE INDEX "PendingAuthProviderLink_expiresAt_idx" ON "PendingAuthProviderLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingAuthProviderLink" ADD CONSTRAINT "PendingAuthProviderLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
