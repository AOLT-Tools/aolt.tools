import type { z } from 'zod';
import type { ResourceRecord, ResourceValue, User } from '@aolt/shared/contracts';

export type Actor = User & { csrfToken: string };

export type ResourcePolicy = 'authenticated' | 'owner';

export type ResourceDefinition = {
  key: string;
  sheet: string;
  headers: readonly string[];
  aliases?: Readonly<Record<string, readonly string[]>>;
  idColumn: string;
  versionColumn: string;
  ownerColumn?: string;
  policy: ResourcePolicy;
  schema: z.ZodType<ResourceValue>;
  createSchema: z.ZodType<ResourceValue>;
  editableFields: readonly string[];
  seedRows?: readonly ResourceValue[];
};

export interface DataRepository {
  isUserAllowed(email: string): Promise<boolean>;
  list(resource: ResourceDefinition, actor: Actor): Promise<ResourceRecord[]>;
  get(
    resource: ResourceDefinition,
    id: string,
    actor: Actor
  ): Promise<ResourceRecord | null>;
  create(
    resource: ResourceDefinition,
    value: ResourceValue,
    actor: Actor
  ): Promise<ResourceRecord>;
  update(
    resource: ResourceDefinition,
    id: string,
    value: ResourceValue,
    expectedVersion: string,
    actor: Actor
  ): Promise<ResourceRecord>;
  remove(
    resource: ResourceDefinition,
    id: string,
    expectedVersion: string,
    actor: Actor
  ): Promise<void>;
}

export type StoredBlob = {
  pathname: string;
  url: string;
  contentType: string;
  size: number;
};

export interface BlobStore {
  put(pathname: string, bytes: Uint8Array, contentType: string): Promise<StoredBlob>;
  delete(pathnameOrUrl: string): Promise<void>;
  list(prefix: string): Promise<StoredBlob[]>;
}

export interface IdempotencyStore {
  begin(key: string, ttlSeconds: number): Promise<boolean>;
  complete(key: string, ttlSeconds: number): Promise<void>;
  release(key: string): Promise<void>;
}

export interface MessageProvider {
  sendText(to: string, text: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(event: string, details?: Record<string, unknown>): void;
  error(event: string, details?: Record<string, unknown>): void;
}
