import type { S3Client } from '@aws-sdk/client-s3';

export function computeFileSha256(filePath: string): Promise<string>;

export interface StreamFileToR2Args {
  client: S3Client;
  PutObjectCommand: new (input: unknown) => unknown;
  bucket: string;
  key: string;
  filePath: string;
  contentLength: number;
  contentType?: string;
  metadata?: Record<string, string>;
}

export function streamFileToR2(args: StreamFileToR2Args): Promise<unknown>;

export function safeUnlink(filePath: string | null | undefined): Promise<void>;
