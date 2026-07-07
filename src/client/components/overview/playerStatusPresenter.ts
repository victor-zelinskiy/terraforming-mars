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
 *  - `active`  — server is currently waiting on this player. Pulsing dot,
 *                cyan glow. Most attention-grabbing.
 *  - `next`    — pre-active "you're on deck" hint. Subtle cyan chevron.
 *                ACTION phase only.
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
  | 'next'
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
  | 'dot'       // pulsing cyan dot — active states
  | 'check'     // muted teal checkmark — ready
  | 'pause'     // two-bar pause — passed
  | 'chevron'   // forward chevron — next
  | 'clock'     // hollow clock-dot — waiting
  | 'none';

export interface StatusPresentation {
  /** Drives CSS modifier class on the chip + chip-glyph color tokens. */
  category: StatusCategory;
  /** Drives which SVG/visual the `PlayerStatusGlyph` component renders. */
  glyph: StatusGlyph;
  /** English i18n key — translated via `v-i18n`. Empty string for `none`. */
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
    textKey: 'Player status action',
    showCounter: true,
  },
  // Вынужденная/триггерная реакция — выглядит так же premium-active, как
  // обычное ДЕЙСТВИЕ (cyan dot + glow), но счётчика 1/2 нет: слот хода не
  // тратится. Канонический кейс — Philares: спасовавший Victor отвечает на
  // соседство тайла оппонента (см. playerLabels.ts default-ветка).
  'forcedaction': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status action',
    showCounter: false,
  },
  'researching': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status research buy',
    showCounter: false,
  },
  'drafting': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status draft pick',
    showCounter: false,
  },
  'initialdrafting': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status initial pick',
    showCounter: false,
  },
  'preludes': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status playing prelude',
    showCounter: false,
  },
  'ceos': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status playing ceo',
    showCounter: false,
  },
  'globalsupport': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status global support',
    showCounter: false,
  },
  'delegate': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status delegate pick',
    showCounter: false,
  },
  // MarsBot's turn as the theater replays it — the same premium active look
  // as a human's turn (cyan dot + glow); no 1/2 counter (one card per turn).
  'bottheater': {
    category: 'active',
    glyph: 'dot',
    textKey: 'Player status bot turn',
    showCounter: false,
  },
  // ─── intermediate ────────────────────────────────────────────────
  'next': {
    category: 'next',
    glyph: 'chevron',
    textKey: 'Player status next',
    showCounter: false,
  },
  // ─── positive idle ───────────────────────────────────────────────
  'ready': {
    category: 'ready',
    glyph: 'check',
    textKey: 'Player status ready',
    showCounter: false,
  },
  // ─── neutral idle ────────────────────────────────────────────────
  'waiting': {
    category: 'waiting',
    glyph: 'clock',
    textKey: 'Player status waiting',
    showCounter: false,
  },
  // ─── pass ────────────────────────────────────────────────────────
  // NB: NOT a check — checks belong to `ready`. Spec calls for a "stopped
  // for the generation" feel: pause glyph + warm bronze, not red/error.
  'passed': {
    category: 'passed',
    glyph: 'pause',
    textKey: 'Player status passed',
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

export function presentPlayerStatus(label: ActionLabel): StatusPresentation {
  return PRESENTATIONS[label];
}
