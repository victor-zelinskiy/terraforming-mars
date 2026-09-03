export type PlayerId = `p${string}`;
export type GameId = `g${string}`;
export type SpectatorId = `s${string}`;
// Campaign mode (docs/CAMPAIGN_MODE_ARCHITECTURE.md): the id of a 4-mission
// campaign document. Derived deterministically from the client's creation
// idempotency key, so a retried create always resolves to the same campaign.
export type CampaignId = `c${string}`;
export type ParticipantId = PlayerId | SpectatorId;
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type TwoDigits = `${Digit}${Digit}`;
export type SpaceId = `${TwoDigits}` | `m${TwoDigits}`;
export type Named<T> = {name: T};

export function isPlayerId(object: any): object is PlayerId {
  return object?.charAt?.(0) === 'p';
}

export function isGameId(object: string): object is GameId {
  return object?.charAt?.(0) === 'g';
}

export function isSpectatorId(object: string): object is SpectatorId {
  return object?.charAt?.(0) === 's';
}

export function isCampaignId(object: string): object is CampaignId {
  return object?.charAt?.(0) === 'c';
}

export function isSpaceId(object: string): object is SpaceId {
  return /^m?[0-9][0-9]$/.test(object);
}

export function safeCast<T>(object: any, tester: (object: any) => object is T) {
  if (tester(object)) {
    return object;
  }
  throw new Error('failed cast: ' + tester.name);
}

/**
 * Very similar to `any` but only contains primitives, arrays of primitives, or dictionaries of primitives.
 *
 * An object of this type is guaranteed safe to serialize and deserialize.
 */
export type JSONValue =
    | undefined
    | string
    | number
    | boolean
    | JSONObject
    | Array<JSONValue>;

export type JSONObject = { [x: string]: JSONValue };

