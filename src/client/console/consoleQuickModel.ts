/**
 * P27 — the console MAIN-BOARD COMMAND MODEL: pure view-models behind the
 * RT / LT quick selectors, the premium Standard-Projects screen and the
 * right home panel's strategic Milestones/Awards summary.
 *
 * Everything here is PURE derivation (no DOM, no Vue) so the whole state
 * matrix is unit-testable: entry availability + honest reasons, the
 * std-project rows (incl. Patent sale as a first-class basic action), the
 * M€ deficits, the claimed-by / leader summaries.
 *
 * The SHELL supplies the live signals (all read from `playerView.waitingFor`
 * via the turnIntents walkers — the server tree stays the ONLY source of
 * truth for "can act right now"); this module only shapes them for the UI.
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {awardLeaders} from '@/common/models/awardDisplay';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {standardProjectVisual} from '@/client/components/overview/standardProjectVisuals';
import {ConsoleMaSource} from '@/client/components/console/consoleMaModel';

// ─── Quick selectors (RT = categories, LT = basic actions) ─────────────────

export type QuickSlot = 'center' | 'up' | 'right' | 'down' | 'left';

export type QuickEntry = {
  /** Stable action id the shell dispatches on. */
  id: string,
  slot: QuickSlot,
  /** English i18n key. */
  label: string,
  /** BarButtonIcon name (preferred) … */
  barIcon?: string,
  /** … or a resource/std icon class … */
  iconClass?: string,
  /** … or a plain text glyph fallback. */
  glyph?: string,
  /** Availability count (playable cards / available actions). */
  badge?: number,
  /** Secondary line (conversion cost etc.), already composed. */
  meta?: string,
  available: boolean,
  /** English i18n key naming the CONCRETE blocker ('' when available). */
  reason: string,
};

/** The glyph each slot answers to (shown on the slot AND in the bar). */
export const QUICK_SLOT_GLYPH: Record<QuickSlot, GlyphControl> = {
  center: 'confirm',
  up: 'dpadU',
  right: 'dpadR',
  down: 'dpadD',
  left: 'dpadL',
};

export type RtQuickContext = {
  cardsPlayable: number,
  cardsTotal: number,
  actionsAvailable: number,
  /** The game has colony tiles in play (Trading is a view too). */
  hasColonies: boolean,
  /** Turmoil is part of this game (the reserved Voting slot's honesty). */
  hasTurmoil: boolean,
  /** The Delta-Project (Hydronetwork) expansion is on. */
  hasHydro: boolean,
};

/** RT — the action-category selector: what KIND of action to take. */
export function buildRtQuickEntries(ctx: RtQuickContext): Array<QuickEntry> {
  return [
    {
      id: 'cards', slot: 'center', label: 'Cards', barIcon: 'cards',
      badge: ctx.cardsPlayable, available: true, reason: '',
    },
    {
      id: 'cardActions', slot: 'up', label: 'Card actions', barIcon: 'actions',
      badge: ctx.actionsAvailable, available: true, reason: '',
    },
    {
      id: 'trading', slot: 'right', label: 'Trading', barIcon: 'colonies',
      available: ctx.hasColonies, reason: 'No colonies in this game',
    },
    {
      id: 'voting', slot: 'down', label: 'Voting', glyph: '⚖',
      available: false,
      reason: ctx.hasTurmoil ? 'Voting arrives with a future update' : 'Not in this game',
    },
    {
      id: 'hydro', slot: 'left', label: 'Hydronetwork', barIcon: 'hydronetwork',
      available: ctx.hasHydro, reason: 'Not in this game',
    },
  ];
}

export type LtQuickContext = {
  myTurn: boolean,
  /** The action menu offers the Standard-projects submenu right now. */
  stdAvailable: boolean,
  /** «End Turn» is offered right now (after the 1st action of the round). */
  endTurnAvailable: boolean,
  /** «Pass for this generation» is offered right now. */
  passAvailable: boolean,
  convertPlantsAvailable: boolean,
  convertHeatAvailable: boolean,
  plantsNeeded: number,
  heatNeeded: number,
};

const NOT_YOUR_TURN = 'Not your turn to take any actions';

/** LT — the basic-actions selector: standard projects / turn control / conversions. */
export function buildLtQuickEntries(ctx: LtQuickContext): Array<QuickEntry> {
  const turnGate = (available: boolean, reason: string): {available: boolean, reason: string} => {
    if (available) {
      return {available: true, reason: ''};
    }
    return {available: false, reason: ctx.myTurn ? reason : NOT_YOUR_TURN};
  };
  return [
    {
      id: 'standardProjects', slot: 'center', label: 'Standard Projects',
      barIcon: 'standard-projects',
      ...turnGate(ctx.stdAvailable, 'Unavailable right now'),
    },
    {
      id: 'skipTurn', slot: 'up', label: 'Skip turn',
      ...turnGate(ctx.endTurnAvailable, 'Available after your first action this round'),
    },
    {
      id: 'pass', slot: 'down', label: 'Pass',
      ...turnGate(ctx.passAvailable, 'Unavailable right now'),
    },
    {
      id: 'convertPlants', slot: 'left', label: 'Plant conversion',
      iconClass: 'resource_icon resource_icon--plants',
      meta: `${ctx.plantsNeeded}`,
      ...turnGate(ctx.convertPlantsAvailable, 'Not enough plants'),
    },
    {
      id: 'convertHeat', slot: 'right', label: 'Heat conversion',
      iconClass: 'resource_icon resource_icon--heat',
      meta: `${ctx.heatNeeded}`,
      ...turnGate(ctx.convertHeatAvailable, 'Not enough heat'),
    },
  ];
}

/** D-pad direction → the quick slot it activates. */
export function quickSlotForDirection(dir: 'up' | 'down' | 'left' | 'right'): QuickSlot {
  return dir;
}

// ─── Standard-Projects premium screen ───────────────────────────────────────

export type StdProjectItem = {
  key: string,
  /** The std-project CardName ('' for the Patent-sale entry). */
  cardName: CardName | undefined,
  /** English i18n key (the card name IS the key). */
  title: string,
  iconClass: string,
  /** English i18n key — the expected result line. */
  description: string,
  /** M€ price (undefined = the Patent-sale entry, which GAINS money). */
  cost?: number,
  /** '+1 M€' style gain marker (Patent sale). */
  gain?: string,
  available: boolean,
  /** English i18n key ('' when available). May carry ${0} (deficit). */
  reason: string,
  reasonParams?: ReadonlyArray<string>,
};

export type StdProjectScreenContext = {
  /** The server's std-project cards (already availability-filtered by isDisabled). */
  cards: ReadonlyArray<{name: CardName, calculatedCost?: number, isDisabled?: boolean}>,
  myTurn: boolean,
  myMegacredits: number,
  /** Patent sale is offered right now (the server's Sell patents SelectCard). */
  sellAvailable: boolean,
  cardsInHand: number,
};

/**
 * The premium screen's rows: every server std project + PATENT SALE as a
 * first-class basic action (Steam-version parity). A disabled row names a
 * CONCRETE reason — the M€ deficit when that is the blocker.
 */
export function buildStdProjectItems(ctx: StdProjectScreenContext): Array<StdProjectItem> {
  const rows: Array<StdProjectItem> = ctx.cards.map((c) => {
    const visual = standardProjectVisual(c.name);
    const cost = c.calculatedCost ?? 0;
    const available = c.isDisabled !== true;
    let reason = '';
    let reasonParams: ReadonlyArray<string> | undefined;
    if (!available) {
      if (!ctx.myTurn) {
        reason = NOT_YOUR_TURN;
      } else if (cost > ctx.myMegacredits) {
        reason = 'Need ${0} more M€';
        reasonParams = [String(cost - ctx.myMegacredits)];
      } else {
        reason = 'Unavailable right now';
      }
    }
    return {
      key: c.name,
      cardName: c.name,
      title: c.name,
      iconClass: visual.iconClass,
      description: visual.description,
      cost,
      available,
      reason,
      reasonParams,
    };
  });
  // Patent sale — part of the basic-actions family (like the Steam version).
  const sellVisual = standardProjectVisual(CardName.SELL_PATENTS_STANDARD_PROJECT);
  const sellAvailable = ctx.sellAvailable && ctx.cardsInHand > 0;
  rows.push({
    key: 'sell-patents',
    cardName: CardName.SELL_PATENTS_STANDARD_PROJECT,
    title: 'Patent sale',
    iconClass: sellVisual.iconClass,
    description: sellVisual.description,
    gain: '+1',
    available: sellAvailable,
    reason: sellAvailable ? '' :
      (!ctx.sellAvailable ? NOT_YOUR_TURN : 'No cards in hand'),
  });
  return rows;
}

// ─── The right home panel — strategic Milestones/Awards summary ────────────

export type HomeMaRow = {
  name: string,
  /** Claimed / funded by (undefined = still open). */
  takenBy?: {color: Color, name: string},
  /** Awards only: the current race leader among the players ('' name = tie shown by color list). */
  leaders?: ReadonlyArray<{color: Color, score: number}>,
  /** Milestones only: the viewer's progress toward the threshold. */
  my?: {score: number, threshold?: number, ready: boolean},
  /** Claimable / fundable RIGHT NOW (server-filtered) — the attention rail. */
  availableNow: boolean,
};

export type HomeMaSummary = {
  rows: ReadonlyArray<HomeMaRow>,
  takenCount: number,
  maxSlots: number,
  /** Claimable / fundable RIGHT NOW (server-filtered). */
  actionable: number,
  /** Slots still open in the 3-slot race (0 = completed). */
  slotsLeft: number,
};

export function buildHomeMaSummary(
  kind: 'milestones' | 'awards',
  models: ReadonlyArray<ConsoleMaSource>,
  opts: {myColor: Color, availableNow: ReadonlySet<string>, maxSlots: number},
): HomeMaSummary {
  const isTaken = (m: ConsoleMaSource) => m.playerName !== undefined && m.playerName !== '';
  const takenCount = models.filter(isTaken).length;
  const slotsLeft = Math.max(0, opts.maxSlots - takenCount);
  const rows: Array<HomeMaRow> = models.map((m) => {
    const row: HomeMaRow = {name: m.name, availableNow: !isTaken(m) && opts.availableNow.has(m.name)};
    if (isTaken(m) && m.color !== undefined) {
      row.takenBy = {color: m.color, name: m.playerName ?? ''};
    }
    if (kind === 'awards') {
      // Awards are a race to game END — the LEADER (who actually scores the VP)
      // stays relevant even AFTER the award is funded, because the funder is not
      // necessarily the scorer. So compute leaders regardless of `takenBy`, via
      // the SHARED `awardLeaders` derivation (ties → every co-leader).
      row.leaders = awardLeaders(m.scores);
    } else if (row.takenBy === undefined) {
      // Milestones lock in on claim — progress only matters while unclaimed.
      const mine = m.scores.find((s) => s.color === opts.myColor);
      row.my = {
        score: mine?.score ?? 0,
        threshold: m.threshold,
        ready: mine?.claimable === true ||
          (m.threshold !== undefined && (mine?.score ?? 0) >= m.threshold),
      };
    }
    return row;
  });
  // Taken rows first (the story of the race), open rows after.
  rows.sort((a, b) => (a.takenBy !== undefined ? 0 : 1) - (b.takenBy !== undefined ? 0 : 1));
  return {
    rows,
    takenCount,
    maxSlots: opts.maxSlots,
    actionable: models.filter((m) => !isTaken(m) && opts.availableNow.has(m.name)).length,
    slotsLeft,
  };
}
