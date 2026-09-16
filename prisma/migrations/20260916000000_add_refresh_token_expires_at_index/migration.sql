-- CreateIndex
CREATE INDEX CONCURRENTLY "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
