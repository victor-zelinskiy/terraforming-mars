import {CardName} from '../../common/cards/CardName';
import {Expansion} from '../../common/cards/GameModule';
import {MARS_BOT_CORP_IDS, MarsBotCorpId, marsBotCorpInfo} from '../../common/automa/MarsBotCorpData';
import {SeededRandom} from '../../common/utils/Random';
import {AutomaCorporations} from '../automa/corps/AutomaCorporations';

/**
 * THE BOT'S CAMPAIGN PORTFOLIO (docs/claude/prompts/marsbot-portfolio-dividends.md §3).
 *
 * The humans acquire a corporation on missions 2 and 3; the bot does too —
 * but its new corporations are HOLDINGS: their printed boxes stay switched
 * off and each pays only an end-game dividend, so the bot catches up in
 * points without terraforming one step faster. The primary is the mission-1
 * corporation (`progression.botCorporation`), unchanged.
 *
 * Pure: the campaign manager hands in everything, so the rule is tested row
 * by row without a campaign.
 */

/** How many holdings the bot owns when mission `slot` (0-based) starts — the humans' rhythm (the owner's D1). */
export function holdingsForSlot(slot: number): number {
  return Math.min(Math.max(slot, 0), 2);
}

export type DrawHoldingsInput = {
  /** The mission being launched (0-based). */
  slot: number;
  /** The bot's primary corporation (fixed after mission 1). */
  primary: MarsBotCorpId;
  /** The holdings already acquired, in acquisition order — never redrawn. */
  holdings: ReadonlyArray<MarsBotCorpId>;
  /** The campaign's expansions, frozen for its whole life. */
  expansions: Partial<Record<Expansion, boolean>>;
  /** Corporations a human already holds (every lineage) — a holding never shares a card with a human. */
  humanCorporations: ReadonlySet<CardName>;
  /** The campaign's own seed — the draw is reproducible per campaign and mission. */
  seed: number;
};

/**
 * The holdings after this launch: the acquired ones kept as they are, plus
 * new draws until the slot's count is reached. A candidate is any
 * corporation the bot could legally use this campaign — its printed module
 * condition met (stable: the campaign's expansions are frozen), not the
 * primary, not already a holding, not a human's lineage corporation. A
 * relaunch of the same slot draws nothing new (the count is already there).
 */
export function drawBotHoldings(input: DrawHoldingsInput): Array<MarsBotCorpId> {
  const holdings = [...input.holdings];
  const target = holdingsForSlot(input.slot);
  if (holdings.length >= target) {
    return holdings;
  }
  const rng = new SeededRandom(seedFor(input.seed, input.slot));
  while (holdings.length < target) {
    const pool = MARS_BOT_CORP_IDS.filter((id) => {
      const info = marsBotCorpInfo(id);
      return id !== input.primary && !holdings.includes(id) &&
        AutomaCorporations.hasRequiredModules(info, input.expansions) &&
        !input.humanCorporations.has(info.original);
    });
    if (pool.length === 0) {
      break; // Unreachable with the implemented 45 — an honest stop, never a corpless crash.
    }
    holdings.push(pool[rng.nextInt(pool.length)]);
  }
  return holdings;
}

/** A float seed per (campaign, mission) — SeededRandom wants a fraction, never an integer. */
function seedFor(campaignSeed: number, slot: number): number {
  const mixed = (campaignSeed + 0.6180339887 * (slot + 1)) % 1;
  return mixed < 0 ? mixed + 1 : mixed;
}
