export type LatLng = {
  latitude: number;
  longitude: number;
};

export type PincodeCoordinate = LatLng & {
  pincode: string;
  city?: string;
  state?: string;
};

export type PincodeCoordinateResolver = {
  resolve(pincode: string): Promise<PincodeCoordinate | null>;
  size?(): number;
};

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}
