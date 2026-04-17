import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';

export const QUARANTINE_PREFIX: string;
export const PUBLISHED_PREFIX: string;

export function isQuarantineKey(key: string | null | undefined): boolean;
export function isPublishedKey(key: string | null | undefined): boolean;
export function quarantineKeyFor(productId: string, version: string, ext: string): string;
export function publishedKeyFromQuarantine(quarantineKey: string): string;
export function moveFromQuarantine(quarantineKey: string): Promise<string>;
export function deleteQuarantined(quarantineKey: string): Promise<void>;
export function headQuarantined(quarantineKey: string): Promise<HeadObjectCommandOutput>;
