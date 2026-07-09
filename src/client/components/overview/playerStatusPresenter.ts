import {ActionLabel} from './ActionLabel';

/**
 * Player-status presentation: ONE place that maps every {@link ActionLabel}
 * to its visual category, glyph, and English i18n key. Both the in-game
 * `LeftPlayerCard` and the initial-draft `InitialDraftStatusRail` consume
 * this presenter so the two contexts feel like one system.
 *
 * Add a NEW ActionLabel (in `ActionLabel.ts`) — extend this presenter at
 * the SAME time. Never put status-text decisions inside a component.
 */

/**
 * Visual category. Drives styling (chip palette, glow, animation) via CSS
 * modifier classes — see `.player-status-chip--<category>` in
 * `player_home.less`.
 *
 *  - `active`  — server is currently waiting on this player (or, for MarsBot,
 *                the server holds it as the active player during its bounded
 *                pending turn). Pulsing dot, cyan glow. Most attention-grabbing.
 *  - `ready`   — simultaneous-pick phase: this player has already submitted
 *                their round and is waiting for the others. Positive,
 *                check-mark, muted teal.
 *  - `waiting` — passive idle. Game is running, server not waiting on this
 *                player, no simultaneous-pick context. Hollow clock-dot.
 *  - `passed`  — player passed for the generation. Pause-icon, warm bronze.
 *                Not red (not an error) and not green/check (not "ready").
 *  - `none`    — render nothing. Status row is rendered invisibly so the
 *                card height stays constant across state transitions.
 */
export type StatusCategory =
  | 'active'
  | 'ready'
  | 'waiting'
  | 'passed'
  | 'none';

/**
 * Glyph shown to the left of the status text. The component-side glyph
 * renderer lives in `PlayerStatusGlyph.vue`; add a new variant there if
 * you add one here.
 */
export type StatusGlyph =
  | 'dot'       // pulsing cyan dot — active states (humans AND MarsBot: the bot
                // reads like just another player at the table)
  | 'check'     // muted teal checkmark — ready
  | 'pause'     // two-bar pause — passed
  | 'clock'     // hollow clock-dot — waiting
  | 'none';

export interface StatusPresentation {
  /** Drives CSS modifier class on the chip + chip-glyph color tokens. */
  category: StatusCategory;
  /** Drives which SVG/visual the `PlayerStatusGlyph` component renders. */
  glyph: StatusGlyph;
  /**
   * The status label as NATURAL ENGLISH display text, doubling as the i18n
   * key (the i18n system keys translations by their English source string —
   * `lang === 'en'` renders the key verbatim). So this MUST read as the
   * final English UI label ("Action", "Waiting", …) — NEVER a namespaced key
   * like "Player status action" (which rendered literally as "PLAYER STATUS
   * ACTION" in English and every locale missing the key). Empty for `none`.
   */
  textKey: string;
  /**
   * Whether to render the `1/2` / `2/2` step counter chip next to the
   * status text. Only `turn` carries the counter — separating this out of
   * the textKey keeps the action count out of the translation surface.
   */
  showCounter: boolean;
}

const PRESENTATIONS: Record<ActionLabel, StatusPresentation> = {
  // ─── active states ────────────────────────────────────────────────
  'turn': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Action',
    showCounter: true,
  },
  // Вынужденная/триггерная реакция — выглядит так же premium-active, как
  // обычное ДЕЙСТВИЕ (cyan dot + glow), но счётчика 1/2 нет: слот хода не
  // тратится. Канонический кейс — Philares: спасовавший Victor отвечает на
  // соседство тайла оппонента (см. playerLabels.ts default-ветка).
  'forcedaction': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Action',
    showCounter: false,
  },
  'researching': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Buying cards',
    showCounter: false,
  },
  'drafting': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Drafting',
    showCounter: false,
  },
  'initialdrafting': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Initial pick',
    showCounter: false,
  },
  'preludes': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Prelude phase',
    showCounter: false,
  },
  'ceos': {
    category: 'active',
    glyph: 'dot',
    textKey: 'CEO phase',
    showCounter: false,
  },
  'globalsupport': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Global support',
    showCounter: false,
  },
  'delegate': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Delegate pick',
    showCounter: false,
  },
  // ─── positive idle ───────────────────────────────────────────────
  'ready': {
    category: 'ready',
    glyph: 'check',
    textKey: 'Done',
    showCounter: false,
  },
  // ─── neutral idle ────────────────────────────────────────────────
  'waiting': {
    category: 'waiting',
    glyph: 'clock',
    textKey: 'Waiting',
    showCounter: false,
  },
  // ─── pass ────────────────────────────────────────────────────────
  // NB: NOT a check — checks belong to `ready`. Spec calls for a "stopped
  // for the generation" feel: pause glyph + warm bronze, not red/error.
  'passed': {
    category: 'passed',
    glyph: 'pause',
    textKey: 'passed',
    showCounter: false,
  },
  // ─── nothing to show ─────────────────────────────────────────────
  'none': {
    category: 'none',
    glyph: 'none',
    textKey: '',
    showCounter: false,
  },
  '': {
    category: 'none',
    glyph: 'none',
    textKey: '',
    showCounter: false,
  },
};

/**
 * Resolve an {@link ActionLabel} to its presentation. `isMarsBot` tweaks the
 * ONE shared decision that differs for the bot: its active turn ('turn') drops
 * the 1/2 counter — the bot plays exactly one automa card per turn, so an
 * action counter would be a lie. EVERYTHING ELSE is identical to a human's
 * active turn (same active category + glow + the SAME pulsing dot), so the bot
 * reads as just another player at the table. Both desktop and console pass the
 * flag, so the two modes can never disagree.
 */
export function presentPlayerStatus(label: ActionLabel, isMarsBot: boolean = false): StatusPresentation {
  const base = PRESENTATIONS[label];
  if (isMarsBot && label === 'turn') {
    return {...base, showCounter: false};
  }
  return base;
}
