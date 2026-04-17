import type { S3Client } from '@aws-sdk/client-s3';

export function isR2Configured(): boolean;
export function getR2Client(): S3Client | null;
export function getBucketName(): string;
