const RUN_ID_PATTERN = /^[a-f0-9]{12}$/u;
const DATABASE_NAME_LIMIT = 63;
const BUCKET_NAME_LIMIT = 63;

export function assertRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error('E2E run ID must be exactly 12 lowercase hex characters');
  }
}

export function normalizeSuiteLabel(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');

  if (!normalized) {
    throw new Error('E2E suite label must contain a letter or digit');
  }

  return normalized;
}

export function templateDatabaseName(runId: string): string {
  assertRunId(runId);
  return `e2e_${runId}_tpl`;
}

export function suiteDatabaseName(runId: string, label: string): string {
  assertRunId(runId);
  const name = `e2e_${runId}_${normalizeSuiteLabel(label)}`;

  if (name.length > DATABASE_NAME_LIMIT) {
    throw new Error('E2E suite label is too long for a PostgreSQL database');
  }

  return name;
}

export function suiteBucketName(runId: string, label: string): string {
  assertRunId(runId);
  const bucketLabel = normalizeSuiteLabel(label).replace(/_/gu, '-');
  const name = `e2e-${runId}-${bucketLabel}`;

  if (name.length > BUCKET_NAME_LIMIT) {
    throw new Error('E2E suite label is too long for a MinIO bucket');
  }

  return name;
}

export function assertSafeDatabaseName(name: string, runId: string): void {
  assertRunId(runId);
  const prefix = `e2e_${runId}_`;

  if (
    name.length > DATABASE_NAME_LIMIT ||
    !name.startsWith(prefix) ||
    !/^[a-z0-9_]+$/u.test(name.slice(prefix.length))
  ) {
    throw new Error(
      `Refusing to operate on a database outside run ${runId}: ${name}`,
    );
  }
}

export function assertSafeBucketName(name: string, runId: string): void {
  assertRunId(runId);
  const prefix = `e2e-${runId}-`;

  if (
    name.length > BUCKET_NAME_LIMIT ||
    !name.startsWith(prefix) ||
    !/^[a-z0-9-]+$/u.test(name.slice(prefix.length))
  ) {
    throw new Error(
      `Refusing to operate on a bucket outside run ${runId}: ${name}`,
    );
  }
}
