export type SearchSourceId = 'aol' | 'vvmvp' | 'vds';

export type SearchIntentSource = SearchSourceId | 'all';

export type DeliveryMode = 'online' | 'in_person' | 'any';

export type SearchConfidence = 'high' | 'medium' | 'low';

export type SearchIntent = {
  source?: SearchIntentSource;
  courseCode?: string;
  courseLabel?: string;
  pincode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  language?: string;
  deliveryMode?: DeliveryMode;
  dateFrom?: string;
  dateTo?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  teacher?: string;
  keywords?: string[];
};

export type ResolvedSearchIntent = SearchIntent & {
  rawQuery: string;
  confidence: SearchConfidence;
  courseTypeIds: string[];
  dateLabel?: string;
  eventType?: string;
  ashramMentioned: boolean;
  vdsMentioned: boolean;
  courseMentioned: boolean;
  pincodeResolved: boolean;
  messages: string[];
};

export type OfficialCourseListing = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  city: string;
  address: string;
  pincode: string;
  location: string;
  distanceKm: number | null;
  isOnline: boolean;
  languages: string[];
  teachers: string[];
  schedule: string;
  fee: string;
  registerUrl: string;
  detailUrl: string;
};

export type SourceSearchResult = {
  source: SearchSourceId;
  label: string;
  url: string;
  filters: Record<string, string>;
  confidence: number;
  embeddable?: boolean;
  reason: string;
  unsupportedFilters: string[];
  listings?: OfficialCourseListing[];
  listingTotal?: number;
  listingError?: string;
};

export interface SearchSourceAdapter {
  id: SearchSourceId;
  label: string;
  supports(intent: ResolvedSearchIntent): boolean;
  buildResult(intent: ResolvedSearchIntent, now?: Date): SourceSearchResult;
}
