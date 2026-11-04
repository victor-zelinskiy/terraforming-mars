import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {otherPlayersCardsWithTag, pileCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF7_LOTUS_INNOVATIONS);

/** SETUP — the human card's first action: +2 TR (its own data come with them — «including from this»). */
export const SETUP_TR = 2;
/** EFFECT — data per step of MarsBot's terraform rating. */
export const DATA_PER_TR = 1;
/** BC7 — the data one breakthrough costs. */
export const BREAKTHROUGH_DATA = 4;
/** BC7 — each breakthrough already made raises the next one's price by this much («science gets harder»). */
export const BREAKTHROUGH_ESCALATION = 1;
/** END — 1 VP per this many data left on the card (the human card's printed «1 VP per 4 data»). */
export const DATA_PER_VP = 4;

/**
 * Nested pushes in flight (a science space can open a cascade) — the depth the shared runaway guard reads, kept in the
 * MODULE (the C22 / CF1 law).
 */
let breakthroughDepth = 0;

/**
 * MarsBot Lotus Innovations — CF7, the FORK'S OWN bot card (the owner, 2026-11-04) for the Turmoil Redux corporation
 * TR81. «The Scientific Breakthrough» — the owner chose it over a plain citation index and an open-science variant fed
 * by every seat's rating: the human card's «each TR step → 1 data, 1 VP per 4 data», with a lab that SPENDS its data.
 *
 *   STARTING TAG         Science
 *   DRAFT PRIORITY       Science (the owner, 2026-11-04 — every own card designs its draft plate)
 *   SETUP                MarsBot increases its TR 2 steps (the human card's first action; their data included).
 *   EFFECT               Each step of TR MarsBot gains puts 1 data on this card. At the end of the game: 1 VP per 4
 *                        data left here.
 *   BEFORE ACTION PHASE  Add Lab Breakthrough (BC7) to MarsBot's action deck.
 *
 *   BC7 SCIENTIFIC BREAKTHROUGH  A breakthrough costs 4 data, +1 for each breakthrough already made («science gets
 *                                harder»); while the lab holds the price, MarsBot pays it and advances its science
 *                                track — a finished science track spreads the breakthrough to its least advanced
 *                                track. Recurs every generation.
 *
 * TWO ROADS FOR ONE DATUM — spent now (a breakthrough, a track step with its space's reward) or kept for the end (a
 * quarter of a VP each). The rising price is the refinement the owner asked for: early leaps come quick, late ones are
 * dear, so the data a late game cannot afford stay on the card and score — an arc, not a flat tap.
 *
 * THE BALANCE (measured 2026-11-04, 30 seeded 8-generation games with the RESEARCH DRAFT played — the draft priority
 * acts only there, `draftVariant`; the human drafts the first card and buys none — §20). Reference corporations under
 * the same driver: C38 95.3 / 103.6 · C42 94.8 / 106.9 · CF1 98.1 / 107.1 (base / Venus + Colonies + Prelude). Flat
 * price 4 → 103.1, 5 → 98.9 / 109.9, 6 → 95.4 / 106.1; final 4 +1 a breakthrough → 95.5 / 106.6. The Science draft
 * plate is worth ≈ +4.7 VP over none (power 91.4, plant 93.0, science + plant 99.6 at price 5).
 */
export const MarsBotLotusInnovations: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF7_LOTUS_INNOVATIONS).rates;
    return dividendResult([
      perUnitTerm('Cards with a science tag the other players played', otherPlayersCardsWithTag(game, Tag.SCIENCE), r.each, r.per),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    // «Standing on shoulders» — research built on research: the cards with a TAG requirement in MarsBot's pile.
    return pileCount(game, (card) => card.requirements.some((req) => req.tag !== undefined));
  },

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.increaseTerraformRating(SETUP_TR, {log: true});
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },

  onTerraformRatingRaised(game: IGame, steps: number): void {
    const automa = game.automa;
    if (automa === undefined || steps <= 0) {
      return;
    }
    const count = steps * DATA_PER_TR;
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources += count;
      game.log('${0} put ${1} data on its corporation ${2}', (b) => b.player(bot).number(count).string('Lotus Innovations'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'lotusData', count);
  },

  endgameVictoryPoints(game: IGame): number {
    return Math.floor((game.automa?.corpResources ?? 0) / DATA_PER_VP);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.BC7_LAB_BREAKTHROUGH)) {
      automa.recurringBonusCards.push(BonusCardId.BC7_LAB_BREAKTHROUGH);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC7_LAB_BREAKTHROUGH);
    if (!present) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.BC7_LAB_BREAKTHROUGH});
      game.log('${0} shuffled Lab Breakthrough into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC7_LAB_BREAKTHROUGH) {
      throw new Error(`MarsBot Lotus Innovations does not own bonus card ${id}`);
    }
    return scientificBreakthrough(game);
  },
};

/** The price of the next breakthrough (the escalation knob — 0 = a flat price). */
export function breakthroughPrice(game: IGame): number {
  return BREAKTHROUGH_DATA + BREAKTHROUGH_ESCALATION * (game.automa?.corpStats.breakthroughs ?? 0);
}

/** BC7 Lab Breakthrough. Always ends in the recurring holding (never destroyed). */
function scientificBreakthrough(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    return 'discard';
  }
  bumpCorpStat(game, 'breakthroughPlayed');
  const bot = marsBotOf(game);
  if (automa.corpResources < breakthroughPrice(game)) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Fewer than ${0} data in the lab — no breakthrough this generation', params: [`${breakthroughPrice(game)}`]});
    game.log('${0} has fewer than ${1} data — no breakthrough this generation', (b) => b.player(bot).number(breakthroughPrice(game)));
    return 'discard';
  }
  let leaps = 0;
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  breakthroughDepth++;
  try {
    while (automa.corpResources >= breakthroughPrice(game)) {
      const price = breakthroughPrice(game);
      automa.corpResources -= price;
      bumpCorpStat(game, 'breakthroughData', price);
      const science = automa.board.getTrackIndexForTag(Tag.SCIENCE);
      const spread = science === undefined || !automa.board.tracks[science].canAdvance();
      const trackIndex = spread ? automa.board.getLeastAdvancedTrackIndex() : science;
      if (spread) {
        game.log('${0} spent ${1} data on a breakthrough — the science track is finished, its least advanced track advances', (b) => b.player(bot).number(price));
        bumpCorpStat(game, 'breakthroughSpread');
      } else {
        game.log('${0} spent ${1} data on a breakthrough — its science track advances', (b) => b.player(bot).number(price));
      }
      AutomaResolver.advanceTrack(game, trackIndex, breakthroughDepth);
      leaps++;
      bumpCorpStat(game, 'breakthroughs');
    }
  } finally {
    breakthroughDepth--;
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  AutomaTurnLog.setBonusBranch(game, {key: 'A breakthrough: ${0} track step(s) bought with data', params: [`${leaps}`]});
  return 'discard';
}
