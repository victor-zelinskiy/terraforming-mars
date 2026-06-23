/*
 * Economy EXPLANATION (rework §13).
 *
 * The old economy text said things like "134 of value fed the tempo" — an internal
 * metric the player can't interpret. This module replaces it with an honest, concrete
 * read: economy is FUEL for a plan, not a strategy by itself. It classifies WHAT the
 * money did (turned into points / funded colonies / bought a metal-building tempo / came
 * from discounts / was left unspent) and emits evidence with REAL numbers only —
 * M€ saved, steel/titanium spent under value bonuses, colony trades, leftover M€.
 *
 * Design contract: PURE (no Vue/DOM/i18n/manifest); texts are English i18n KEYS; numbers
 * are exact where the fact stream is exact, marked `confidence` otherwise.
 */
import type {Color} from '@/common/Color';
import type {EndgameFact, FactType} from '@/common/events/endgameFacts';
import type {InsightContext, EvidenceChip} from '@/client/components/endgame/insightEngine';
import type {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';

export type EconomyCase =
  | 'convertedToPoints' // money became cards / board / points
  | 'fundedColonies' // economy rode the colony engine
  | 'metalEngine' // steel / titanium value drove a building tempo
  | 'discountEngine' // standing discounts made everything cheaper
  | 'richUnspent' // a big economy that never became points
  | 'tempoOnly'; // honest fallback — economy bought tempo, outcome unclear

export type EconomyConfidence = 'high' | 'medium' | 'low';

export type EconomyExplanation = {
  case: EconomyCase;
  /** True when this is the WINNER's economy (drives winner-vs-loser phrasing upstream). */
  isWinner: boolean;
  color: Color;
  savedMegacredits: number;
  steelSpent: number;
  titaniumSpent: number;
  colonyTrades: number;
  leftoverMegacredits: number;
  /** Card + board VP — the visible "did the money become points" signal. */
  scoringVp: number;
  evidence: ReadonlyArray<EvidenceChip>;
  confidence: EconomyConfidence;
};

function pFact(ctx: InsightContext, color: Color, type: FactType): EndgameFact | undefined {
  return (ctx.facts ?? []).find((f) => f.type === type && f.player === color);
}
function m(f: EndgameFact | undefined, k: string): number {
  return f?.metrics[k] ?? 0;
}
function chip(v: string, tone: EvidenceChip['tone'] = 'metric', label?: string): EvidenceChip {
  return {t: 'raw', v, tone, label};
}
function chipL(v: string, tone: EvidenceChip['tone'] = 'neutral'): EvidenceChip {
  return {t: 'i18n', v, tone};
}

/**
 * Explain the strongest economy in the game (or a given player's). Returns undefined when
 * no player banked a meaningful economy (< 12 M€ measured) — economy isn't always a story.
 */
export function explainEconomy(ctx: InsightContext, color: Color): EconomyExplanation | undefined {
  const econ = pFact(ctx, color, 'economy');
  if (econ === undefined) {
    return undefined;
  }
  const saved = m(econ, 'savedMegacredits');
  if (saved < 12) {
    return undefined;
  }
  const p = ctx.players.find((x) => x.color === color);
  if (p === undefined) {
    return undefined;
  }
  const steelSpent = m(econ, 'paymentValueBonusSteel');
  const titaniumSpent = m(econ, 'paymentValueBonusTitanium');
  const valueBonus = m(econ, 'paymentValueBonus');
  const discount = m(econ, 'discountAndPaymentSaved');
  const tradeDisc = m(econ, 'tradeDiscountMegacredits') + m(econ, 'tradeDiscountEnergy') + m(econ, 'tradeDiscountTitanium');
  const colony = pFact(ctx, color, 'colony');
  const colonyTrades = m(colony, 'trades');
  const leftover = spendableMegacredits(p);
  const scoringVp = (p.categories.cards ?? 0) + (p.categories.board ?? 0);
  const isWinner = color === ctx.winner.color;

  // Classify what the money actually did.
  let economyCase: EconomyCase;
  if (leftover >= Math.max(20, saved) && scoringVp < saved) {
    economyCase = 'richUnspent';
  } else if (colonyTrades >= 4 && tradeDisc > 0) {
    economyCase = 'fundedColonies';
  } else if (valueBonus > 0 && (steelSpent + titaniumSpent) >= 8) {
    economyCase = 'metalEngine';
  } else if (discount >= saved * 0.6) {
    economyCase = 'discountEngine';
  } else if (scoringVp >= 22) {
    economyCase = 'convertedToPoints';
  } else {
    economyCase = 'tempoOnly';
  }

  // Evidence — real numbers only.
  const evidence: Array<EvidenceChip> = [chip(`+${saved} M€`, 'good')];
  switch (economyCase) {
  case 'metalEngine':
    if (steelSpent > 0) {
      evidence.push(chip(`${steelSpent}`, 'metric', 'steel spent'));
    }
    if (titaniumSpent > 0) {
      evidence.push(chip(`${titaniumSpent}`, 'metric', 'titanium spent'));
    }
    break;
  case 'fundedColonies':
    evidence.push(chip(`${colonyTrades}`, 'metric', 'Trades'));
    break;
  case 'discountEngine':
    evidence.push(chipL('discounts'));
    break;
  case 'richUnspent':
    evidence.push(chip(`${leftover} M€`, 'bad', 'unspent'));
    break;
  case 'convertedToPoints':
    evidence.push(chip(`+${scoringVp}`, 'good', 'VP'));
    break;
  default:
    break;
  }

  const confidence: EconomyConfidence = (economyCase === 'metalEngine' || economyCase === 'discountEngine') ? 'high' :
    economyCase === 'tempoOnly' ? 'low' : 'medium';

  return {
    case: economyCase, isWinner, color, savedMegacredits: saved, steelSpent, titaniumSpent,
    colonyTrades, leftoverMegacredits: leftover, scoringVp, evidence, confidence,
  };
}

/** Spendable M€ at the finish = stock minus the final production income (already banked). */
function spendableMegacredits(p: EndgamePlayerScore): number {
  const prod = p.production?.megacredits ?? 0;
  return Math.max(0, p.megacredits - Math.max(0, prod));
}

/** The case → i18n text key (winner / loser aware). Used by the economy analyzer. */
export const ECONOMY_CASE_TEXT: Readonly<Record<EconomyCase, {winner: string; loser: string}>> = {
  convertedToPoints: {
    winner: 'Money didn’t sit idle for ${0}: it turned into cards, resources on cards and final points.',
    loser: '${0} turned the economy into points too — just not quite enough of them.',
  },
  fundedColonies: {
    winner: 'For ${0} the economy rode the colonies: trades kept the resources coming right where the plan needed them.',
    loser: '${0} kept the colonies turning, but the resources never quite became the winning score.',
  },
  metalEngine: {
    winner: 'Steel and titanium did the spending for ${0}: a building tempo others had to pay full price for.',
    loser: '${0} leaned on steel and titanium for tempo, but it didn’t close the points gap.',
  },
  discountEngine: {
    winner: 'Everything came cheaper for ${0}: standing discounts freed up the plays that built the win.',
    loser: '${0} played on discounts and kept the tempo, but the points came up short.',
  },
  richUnspent: {
    winner: '${0} had money to spare — the economy was never the problem.',
    loser: 'The resources were there, but the final score never caught up: ${0} finished with money still in the bank.',
  },
  tempoOnly: {
    winner: 'The economy gave ${0} the tempo to keep playing strong cards through to the finish.',
    loser: '${0} had the tempo, but the economy bought options, not the points that decide the game.',
  },
};
