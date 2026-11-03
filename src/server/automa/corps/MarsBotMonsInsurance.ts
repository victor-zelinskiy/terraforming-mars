import {Resource} from '../../../common/Resource';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {Board} from '../../boards/Board';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {pileCount} from './MarsBotDividendReads';
import {hasRequirement} from '../../cards/requirements/CardsWithRequirementsRequirement';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF4_MONS_INSURANCE);

/** SETUP — the fund the corporation opens with (the human card's 48 M€ start, in the bot's scale). */
export const OPENING_FUND = 10;
/** BEFORE ACTION PHASE — the premiums the clients pay into the fund (the human card's +4 M€ production, in the bot's scale). */
export const PREMIUM_MC = 6;
/** BEFORE ACTION PHASE — the interest: +1 M€ for every full `INTEREST_PER` M€ in the fund. */
export const INTEREST_PER = 4;
/** BC4 — what one payout costs the fund. */
export const PAYOUT_MC = 8;
/** EFFECT — the printed 3 M€ the human card pays the victim, on top of the M€ the attack took. */
export const CLAIM_MC = 3;

/**
 * Nested pushes in flight (a payout's track space can open a cascade) — the depth the shared runaway guard reads,
 * kept in the MODULE (the C22 / CF1 law).
 */
let payoutDepth = 0;

/**
 * MarsBot Mons Insurance — CF4, the FORK'S OWN bot card (the owner, 2026-11-03) for the promo corporation R46.
 * «The Reserve Fund» — the owner chose the cold financier over a disaster underwriter and a hybrid: capital that
 * compounds, payouts on schedule, attacks covered.
 *
 *   STARTING TAG         none (the human card prints none)
 *   SETUP                Place 10 M€ on this card — the reserve fund.
 *   EFFECT               Policy: when a player makes MarsBot lose resources or production, the fund repays the M€ it
 *                        lost plus 3 M€, or as much as possible (the human card's «pay 3 M€ to the victim» — the
 *                        insurer IS the victim here, so the fund covers its own client).
 *   BEFORE ACTION PHASE  Premiums: 6 M€ go into the fund. Interest: then the fund grows by 1 M€ for every 4 M€ in
 *                        it. Add Insurance Payout (BC4) to MarsBot's action deck.
 *
 *   BC4 INSURANCE PAYOUT For every full 8 M€ in the fund, MarsBot spends them to advance its least advanced track
 *                        (topmost if tied); with less in the fund nothing happens — the fund keeps growing. Recurs
 *                        every generation.
 *
 * THE FUND IS NOT THE BOT'S MONEY. It lives in the ordinary on-card socket (`corpResources`, the C20 till), so an
 * attack on MarsBot's M€ never reaches it — the reserve is what pays the claims. The premiums are the clients'
 * money (the human card's +4 M€ production): taken from MarsBot's own M€ the fund starved — the bot is poor, and its
 * M€ buys its milestones. The capital works on a delay the table can SEE: the capsule grows, and every player knows
 * the payout is coming; a generation whose card comes late pays out twice.
 *
 * THE BALANCE (measured 2026-11-03, 30 seeded 8-generation games, the human passing — §20): no payouts 73.1 VP (no
 * starting tag, nothing else on the card); premiums out of MarsBot's own M€ 82.9; from the bank, 4 M€ and one payout
 * a card 88.5; final — 6 M€, interest per 4, every full 8 M€ paid out — 94.8 (C38 94.1 · CF1 96.4 · C42 96.3), with
 * Venus + Colonies + Prelude 103.8 (C38 105.3 · C42 107.8). The policy adds what the measure cannot see — the human
 * passes, nobody attacks.
 *
 * THE POLICY makes an attack on MarsBot nearly pointless while the fund is full: an Asteroid that takes 3 M€ off the
 * bot returns them and 3 more. The fund is finite, so a determined attacker drains the reserve first — a real
 * decision for the human, and the insurer's whole vibe.
 */
export const MarsBotMonsInsurance: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF4_MONS_INSURANCE).rates;
    return dividendResult([
      perUnitTerm('Cities of the other players', insuredCities(game), r.each, r.per),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    // «Fine print» — a policy is its conditions: the cards with a requirement in MarsBot's pile (not the formula's
    // axis: r ≈ 0 against the other players' cities on the owner's real games).
    return pileCount(game, (card) => hasRequirement(card));
  },

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    automa.corpResources += OPENING_FUND;
    game.log('${0} opened the reserve fund of its corporation ${1}: ${2} M€', (b) =>
      b.player(bot).string('Mons Insurance').number(OPENING_FUND));
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    // PREMIUMS — the clients' money (the human card's M€ production), never MarsBot's own M€.
    automa.corpResources += PREMIUM_MC;
    game.log('${0}\'s reserve fund collected ${1} M€ of premiums', (b) => b.player(bot).number(PREMIUM_MC));
    bumpCorpStat(game, 'insurancePremiumMc', PREMIUM_MC);
    // INTEREST — after the premium: the capital works on what it holds now.
    const interest = Math.floor(automa.corpResources / INTEREST_PER);
    if (interest > 0) {
      automa.corpResources += interest;
      game.log('${0}\'s reserve fund earned ${1} M€ of interest', (b) => b.player(bot).number(interest));
      bumpCorpStat(game, 'insuranceInterestMc', interest);
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.BC4_INSURANCE_PAYOUT)) {
      automa.recurringBonusCards.push(BonusCardId.BC4_INSURANCE_PAYOUT);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC4_INSURANCE_PAYOUT);
    if (!present) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.BC4_INSURANCE_PAYOUT});
      game.log('${0} shuffled Insurance Payout into its action deck', (b) => b.player(bot));
    }
  },

  onHarmedByOpponent(game: IGame, lostMc: number): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const owed = lostMc + CLAIM_MC;
    const paid = Math.min(owed, automa.corpResources);
    bumpCorpStat(game, 'insuranceClaims');
    if (paid === 0) {
      game.log('${0}\'s reserve fund is empty — the claim goes unpaid', (b) => b.player(marsBotOf(game)));
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources -= paid;
      bot.stock.add(Resource.MEGACREDITS, paid, {log: false});
      game.log('${0}\'s policy paid the claim: ${1} M€ out of the reserve fund', (b) => b.player(bot).number(paid));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'insuranceClaimMc', paid);
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC4_INSURANCE_PAYOUT) {
      throw new Error(`MarsBot Mons Insurance does not own bonus card ${id}`);
    }
    return insurancePayout(game);
  },
};

/** The insured property — every city tile of the other players (the dividend's operand). */
export function insuredCities(game: IGame): number {
  return game.board.spaces.filter((space) => Board.isCitySpace(space) && space.player !== undefined && space.player.isMarsBot !== true).length;
}

/** BC4 Insurance Payout. Always ends in the recurring holding (never destroyed). */
function insurancePayout(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    return 'discard';
  }
  bumpCorpStat(game, 'insurancePayoutPlayed');
  const bot = marsBotOf(game);
  if (automa.corpResources < PAYOUT_MC) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Less than ${0} M€ in the fund — no payout this generation', params: [`${PAYOUT_MC}`]});
    game.log('${0}\'s reserve fund holds less than ${1} M€ — no payout this generation', (b) => b.player(bot).number(PAYOUT_MC));
    return 'discard';
  }
  let paidOut = 0;
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  payoutDepth++;
  try {
    while (automa.corpResources >= PAYOUT_MC) {
      automa.corpResources -= PAYOUT_MC;
      paidOut++;
      bumpCorpStat(game, 'insurancePayoutMc', PAYOUT_MC);
      const trackIndex = automa.board.getLeastAdvancedTrackIndex();
      const before = automa.board.tracks[trackIndex].position;
      game.log('${0} paid out ${1} M€ from its reserve fund: its least advanced track advances', (b) => b.player(bot).number(PAYOUT_MC));
      AutomaResolver.advanceTrack(game, trackIndex, payoutDepth);
      if (automa.board.tracks[trackIndex].position > before) {
        bumpCorpStat(game, 'insurancePayouts');
      }
    }
  } finally {
    payoutDepth--;
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  AutomaTurnLog.setBonusBranch(game, {key: 'The fund paid out ${0} × ${1} M€ — the least advanced track advances', params: [`${paidOut}`, `${PAYOUT_MC}`]});
  return 'discard';
}
