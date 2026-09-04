import { appManifest, getResourceDefinition } from './app-manifest.js';

export { appManifest };

export function requireResourceDefinition(key: string) {
  const resource = getResourceDefinition(String(key || '').trim().toLowerCase());
  if (!resource) throw new Error('RESOURCE_NOT_FOUND');
  return resource;
}
