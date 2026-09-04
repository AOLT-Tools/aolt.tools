export type SheetLayoutContract = {
  campaignsRange: string;
  leadsRange: string;
  membersRange: string;
  coursesRange: string;
  courseTemplatesRange: string;
  shortUrlsRange: string;
  configRange: string;
  allowedUsersRange: string;
};

export const DEFAULT_SHEET_LAYOUT: Readonly<SheetLayoutContract>;
export const SHEET_HEADERS: Readonly<{
  campaigns: readonly string[];
  leads: readonly string[];
  members: readonly string[];
  courses: readonly string[];
  courseTemplates: readonly string[];
  shortUrls: readonly string[];
  config: readonly string[];
  allowedUsers: readonly string[];
}>;
export const REQUIRED_CONFIG_KEYS: readonly string[];
