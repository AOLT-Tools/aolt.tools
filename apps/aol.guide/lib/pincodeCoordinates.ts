import { readFileSync } from 'node:fs';

import {
  isValidLatitude,
  isValidLongitude,
  type PincodeCoordinate,
  type PincodeCoordinateResolver
} from '@aolt/core/geo';
import { normalizePincode } from '@aolt/core/normalization';
import { createMapboxTemporaryPincodeResolver } from '@aolt/integrations/mapbox/geocode';

export type { PincodeCoordinate, PincodeCoordinateResolver };

export type PincodeCoordinatePayload = {
  source?: {
    name?: string;
    url?: string;
    license?: string;
    generated_at?: string;
  };
  records: Array<
    | [string, number, number]
    | [string, number, number, string]
    | [string, number, number, string, string]
  >;
};

export type PincodeCoordinateResolverOptions = {
  accessToken?: string;
  localResolver?: PincodeCoordinateResolver;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

let bundledPincodeResolver: PincodeCoordinateResolver | undefined;

export function createStaticPincodeCoordinateResolver(
  records: readonly PincodeCoordinate[]
): PincodeCoordinateResolver {
  const byPincode = new Map(
    records
      .map((record) => {
        const pincode = normalizePincode(record.pincode);
        return pincode &&
          isValidLatitude(record.latitude) &&
          isValidLongitude(record.longitude)
          ? ([pincode, { ...record, pincode }] as const)
          : null;
      })
      .filter(
        (record): record is readonly [string, PincodeCoordinate] => record !== null
      )
  );

  return {
    async resolve(pincode) {
      return byPincode.get(normalizePincode(pincode)) || null;
    },
    size() {
      return byPincode.size;
    }
  };
}

export function recordsFromPayload(
  payload: PincodeCoordinatePayload
): PincodeCoordinate[] {
  return payload.records
    .map((row) => ({
      pincode: String(row[0]),
      latitude: Number(row[1]),
      longitude: Number(row[2]),
      city: row[3] ? String(row[3]) : undefined,
      state: row[4] ? String(row[4]) : undefined
    }))
    .filter(
      (record) =>
        normalizePincode(record.pincode) &&
        isValidLatitude(record.latitude) &&
        isValidLongitude(record.longitude)
    );
}

export function loadBundledPincodeCoordinateResolver(): PincodeCoordinateResolver {
  bundledPincodeResolver ??= createStaticPincodeCoordinateResolver(
    recordsFromPayload(loadBundledPincodePayload())
  );
  return bundledPincodeResolver;
}

export function createPincodeCoordinateResolver(
  options: PincodeCoordinateResolverOptions = {}
): PincodeCoordinateResolver {
  const token = (options.accessToken || '').trim();
  const mapbox = token
    ? createMapboxTemporaryPincodeResolver({
        accessToken: token,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs
      })
    : undefined;
  const local = options.localResolver;

  return {
    async resolve(pincode) {
      if (mapbox) {
        const live = await mapbox.resolve(pincode);
        if (live) return live;
      }
      return local ? local.resolve(pincode) : null;
    },
    size() {
      return local?.size?.() || 0;
    }
  };
}

function loadBundledPincodePayload(): PincodeCoordinatePayload {
  const url = new URL('../data/pincodes.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as PincodeCoordinatePayload;
}
