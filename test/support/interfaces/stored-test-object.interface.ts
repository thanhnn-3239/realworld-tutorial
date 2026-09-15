/**
 * Test-only view of an object read straight back out of MinIO, used to assert
 * on exactly what `FileStorageService` wrote (body bytes + the metadata S3
 * recorded), without widening the production `StorageDriver` interface.
 */
export interface StoredTestObject {
  readonly body: Buffer;
  readonly contentType: string | undefined;
  readonly contentLength: number | undefined;
}
