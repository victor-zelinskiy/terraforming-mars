/*
 * EXPANDED STARTUP STATUS PREVIEW — the pure model of the summary's status
 * panel (the Game Start Workspace).
 *
 * The panel answers ONE question in the visual language of the future in-game
 * Top HUD / player rail: «вот какой стартовый набор я выбрал и в какое игровое
 * состояние он меня приведёт». After the commit the SAME panel physically
 * transforms into the real HUD (Game State Materialization) — so everything
 * here must be values the game will actually materialize.
 *
 * AUTHORITATIVE ONLY — never an approximation:
 *  - money: the shared `initialDraftMoney` brain (the exact corp × prelude ×
 *    buy-count pairs the desktop start screen and the server agree on);
 *  - production: the cards' own printed `productionBox` (plain units — a card
 *    whose production is conditional simply contributes nothing here);
 *  - tags: the printed tag rows of the cards that DEPLOY at start (the
 *    corporation + the preludes — bought projects go to the HAND, their tags
 *    do not enter play yet).
 * Nothing speculative, nothing per-card re-implemented.
 */
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getCard} from '@/client/cards/ClientCardManifest';
import {afterPreludes, cardCostForCorp, startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';
import type {InitialCardsPicks} from '@/client/console/consoleStartState';

/** One production delta row (printed, unconditional). */
export type StartProductionRow = {
  /** The units key — matches the resource icon set (megacredits/steel/…). */
  resource: 'megacredits' | 'steel' | 'titanium' | 'plants' | 'energy' | 'heat',
  amount: number,
};

export type StartTagRow = {tag: Tag, count: number};

export type StartStatusPreview = {
  corp: CardName | undefined,
  /** ── the financial core ── */
  start: number,
  buys: number,
  cardCost: number,
  /** −buys × cardCost (0 when nothing is bought). */
  projectsCost: number,
  /** The preludes' printed M€ effects (incl. the corp-pair extras). */
  preludeDelta: number,
  /** What the player will actually hold after the purchase resolves. */
  remaining: number,
  /** ── the wider materialization preview ── */
  /** The starting HAND (the bought projects — they go to the hand dock). */
  handSize: number,
  preludeCount: number,
  /** Printed production the deployment will materialize (corp + preludes). */
  production: ReadonlyArray<StartProductionRow>,
  /** Printed tags entering play at deployment (corp + preludes). */
  tags: ReadonlyArray<StartTagRow>,
};

const PRODUCTION_KEYS: ReadonlyArray<StartProductionRow['resource']> =
  ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

type RenderNode = {
  is?: string,
  type?: string,
  amount?: number,
  anyPlayer?: boolean,
  rows?: ReadonlyArray<ReadonlyArray<RenderNode>>,
};

/**
 * The card's PRINTED immediate production, read off its render data's
 * TOP-LEVEL production boxes (the printed brown box — the same source the
 * card face draws). Strictly conservative: only plain numeric self items of
 * the six standard resources count; a box containing ANYTHING else (a
 * per-tag multiplier, an OR, another player's arrow) disqualifies the whole
 * card — an omission is honest, an approximation is not. Boxes nested in
 * effect/action containers are never descended into (those are not on-play).
 */
function printedProduction(renderData: unknown): Map<StartProductionRow['resource'], number> | undefined {
  const out = new Map<StartProductionRow['resource'], number>();
  const root = renderData as RenderNode | undefined;
  const rows = root?.rows;
  if (!Array.isArray(rows)) {
    return out;
  }
  for (const row of rows) {
    if (!Array.isArray(row)) {
      continue;
    }
    for (const node of row) {
      if (node?.is !== 'production-box') {
        continue; // effect/action containers are NOT descended into
      }
      for (const boxRow of node.rows ?? []) {
        for (const item of boxRow) {
          const key = item?.type as StartProductionRow['resource'] | undefined;
          if (item?.is !== 'item' || key === undefined || !PRODUCTION_KEYS.includes(key) ||
              typeof item.amount !== 'number' || item.anyPlayer === true) {
            return undefined; // one exotic node → the whole card abstains
          }
          out.set(key, (out.get(key) ?? 0) + item.amount);
        }
      }
    }
  }
  return out;
}

/** Build the preview from the current picks. Undefined until a corporation
 *  is chosen (there is no start state to preview without an identity). */
export function buildStartStatusPreview(picks: InitialCardsPicks): StartStatusPreview | undefined {
  const corp = picks.corp;
  if (corp === undefined) {
    return undefined;
  }
  const buys = picks.projects.length;
  const start = startingMegacredits(corp, 0) ?? 0;
  const remainingAfterBuys = startingMegacredits(corp, buys) ?? 0;
  const preludeDelta = afterPreludes(corp, picks.preludes, buys);
  const cardCost = cardCostForCorp(corp);

  // Deploying cards: the corporation + the preludes (the CEO plays through
  // its own later beat; bought projects stay in hand — neither enters the
  // tableau at the materialization this panel previews).
  const deploying: Array<CardName> = [corp, ...picks.preludes];
  const production = new Map<StartProductionRow['resource'], number>();
  const tags = new Map<Tag, number>();
  for (const name of deploying) {
    const card = getCard(name);
    if (card === undefined) {
      continue;
    }
    const printed = printedProduction(card.metadata?.renderData);
    if (printed !== undefined) {
      for (const [key, amount] of printed) {
        if (amount !== 0) {
          production.set(key, (production.get(key) ?? 0) + amount);
        }
      }
    }
    for (const tag of card.tags) {
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
  }
  return {
    corp,
    start,
    buys,
    cardCost,
    projectsCost: buys * cardCost,
    preludeDelta,
    remaining: remainingAfterBuys + preludeDelta,
    handSize: buys,
    preludeCount: picks.preludes.length,
    production: PRODUCTION_KEYS
      .filter((key) => production.has(key))
      .map((key) => ({resource: key, amount: production.get(key) ?? 0})),
    tags: [...tags.entries()].map(([tag, count]) => ({tag, count})),
  };
}
