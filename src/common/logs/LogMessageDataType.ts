// Do not reorder these.

export enum LogMessageDataType {
  STRING, // 0
  RAW_STRING, // Raw strings are untranslated.  // 1
  PLAYER, // 2
  CARD, // 3
  AWARD, // 4
  MILESTONE, // 5
  COLONY, // 6
  _STANDARD_PROJECT, // 7 // NO LONGER USED
  PARTY, // 8
  TILE_TYPE, // 9
  SPACE_BONUS, // 10
  GLOBAL_EVENT, // 11
  UNDERGROUND_TOKEN, // 12
  SPACE, // 13
  CARDS, // 14
  // A resource / card-resource / global-parameter / TR icon. `value` is an
  // icon KEY understood by the client's shared `iconClassFor` (a `Resource` /
  // `CardResource` / `GlobalParameter` enum value, or 'tr' / 'cards'); it is
  // rendered as a premium inline icon-chip instead of a bare resource word.
  // Icon-only by design — any amount stays a separate RAW_STRING number token,
  // so migrating a log site is a data swap that keeps its i18n template.
  RESOURCE, // 15
}
