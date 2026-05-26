// Labels describing what the player is currently doing in the game flow.
// The label maps directly to a Russian/English status string shown on the
// left-panel player card and drives the spinning-cube animation (any of the
// "waiting" labels makes the cube spin).
export type ActionLabel =
  | 'turn'          // taking their action turn (ACTION phase). Renamed from 'active'
                    // to avoid collision with the unrelated `"active"` card-type
                    // translation in UI_cards.json.
  | 'researching'   // picking research cards (RESEARCH phase)
  | 'drafting'      // drafting cards (DRAFTING / INITIALDRAFTING / PRELUDES / CEOS)
  | 'globalsupport' // World Government Terraforming — raising a global parameter
                    // as the "world government" (Solar phase, base-game feature,
                    // not Turmoil-dependent).
  | 'delegate'      // Turmoil-only: placing a delegate or picking the ruling party.
  | 'passed'        // passed this action phase, waiting for next generation
  | 'next'          // the next player to act after the current one
  | 'none'          // not waiting on this player
  | '';
