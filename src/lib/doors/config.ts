import raw from "../../../content/doors.json";

/** The house allow list for the three doors. Edit content/doors.json: fill
    `authors` (hex pubkeys) to read only those keys, and `tags` (nostr `t`
    tags) to read only events carrying one of them. Empty = no filter. */
export interface DoorFilter {
  authors: string[];
  tags: string[];
}
export interface DoorsConfig {
  relays: string[];
  calendar: DoorFilter;
  market: DoorFilter;
  rooms: DoorFilter;
}

export const DOORS = raw as DoorsConfig;
