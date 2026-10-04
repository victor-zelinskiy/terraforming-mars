import {Tag} from './Tag';

// An intentionally reduced version of Countable,
// which means this can be passed to Counter and also sent to the client to render.
export type CountableVictoryPoints = {
  tag?: Tag,
  resourcesHere?: {},
  /**
   * VP per city. `where` narrows WHICH cities (the `Counter`'s own reading):
   * absent / `everywhere` — every city; `onmars`; `offmars` — the SPACE
   * cities (Turmoil Redux TR22 Nova City: «2 VP per space city you own» —
   * with `all: false`, or the count is every player's).
   */
  cities?: {where?: 'onmars' | 'offmars' | 'everywhere'},
  oceans?: {},
  moon?: {
    mine?: {},
    road?: {},
  }
  colonies?: {
    colonies?: {},
  }
  /** Only count tiles adjacent to this card's placed tile. */
  nextToThis?: {},
  all?: boolean,
  each?: number,
  per?: number,
}
