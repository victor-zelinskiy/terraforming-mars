import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {resolveProjectCardForBot} from '../AutomaCardDraw';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {otherPlayersCardsWithTag, pileCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF5_ARWIND_INC);

/** BC5 — the fighters one launch costs. */
export const LAUNCH_FIGHTERS = 3;
/** What puts a fighter on the card: every space tag MarsBot resolves; every step of its Agenda marker (Redux). */
export const FIGHTERS_PER_SPACE_TAG = 1;
export const FIGHTERS_PER_AGENDA_STEP = 1;

/**
 * MarsBot Arwind Inc. — CF5, the FORK'S OWN bot card (the owner, 2026-11-03) for the Turmoil Redux corporation TR78.
 * «The Orbital Shipyard» — the owner chose it over a fleet parade (fighters → Agenda steps) and interceptors (fighters
 * absorbing attacks): fighters are the currency of space, the way the human card pays 4 M€ a fighter for a Space tag.
 *
 *   MODULE               Turmoil Redux — the Mars Parliament (like the human card: its Agenda clause is half the hangar).
 *   STARTING TAG         Space (resolved like every starting tag — its own fighter: «including this»)
 *   EFFECT               Each space tag MarsBot resolves puts a fighter on this card; each step of MarsBot's Agenda
 *                        marker puts one too (the human card's «Agenda step → a fighter»).
 *   BEFORE ACTION PHASE  Add Off the Slipway (BC5) to MarsBot's action deck.
 *
 *   BC5 OFF THE SLIPWAY  MarsBot spends 3 fighters, if able (else nothing). Then it reveals project cards until one
 *                        with a space tag and resolves it — every tag of it advances a track; the other revealed cards
 *                        are discarded. Recurs every generation.
 *
 * THE LAUNCH IS A WHOLE EXTRA CARD — the one corporation effect that buys the bot a turn rather than a step, so its
 * price is fighters, and fighters come back from the very space tag the launch resolves: a launch nets −2, a hangar
 * fed by the space track runs one a generation, a quiet space track waits.
 *
 * THE BALANCE (measured 2026-11-03, 30 seeded 8-generation games, the human passing — §20). The sim's political phase
 * is not driven, so the Agenda's fighters are EMULATED at the owner's real rate (the bot walks 4 steps a game —
 * p50 4, max 6 over 17 real Redux games: one fighter in generations 3…6). A launch is worth ≈ 3.6 VP. Cost 3 with the
 * Agenda: 95.0 VP, Venus + Colonies + Prelude 106.6 (C38 94.1 / 105.3 · C42 96.3 / 107.8); cost 2 ran 103.9 / 112.6.
 * WITHOUT the Parliament the same card measured 87.3 / 99.1 — half its fighters gone — so it is a Redux corporation,
 * like the card it plays.
 */
export const MarsBotArwindInc: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF5_ARWIND_INC).rates;
    return dividendResult([
      perUnitTerm('Cards with a space tag the other players played', otherPlayersCardsWithTag(game, Tag.SPACE), r.each, r.per),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return pileCount(game, (card) => card.type === CardType.EVENT && AutomaResolver.printedTags(card).includes(Tag.SPACE));
  },

  onTagResolved(game: IGame, tag: Tag): void {
    if (tag !== Tag.SPACE) {
      return;
    }
    hangar(game, FIGHTERS_PER_SPACE_TAG, 'arwindSpaceFighters');
  },

  onAgendaWalked(game: IGame, steps: number): void {
    hangar(game, steps * FIGHTERS_PER_AGENDA_STEP, 'arwindAgendaFighters');
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.BC5_OFF_THE_SLIPWAY)) {
      automa.recurringBonusCards.push(BonusCardId.BC5_OFF_THE_SLIPWAY);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC5_OFF_THE_SLIPWAY);
    if (!present) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.BC5_OFF_THE_SLIPWAY});
      game.log('${0} shuffled Off the Slipway into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC5_OFF_THE_SLIPWAY) {
      throw new Error(`MarsBot Arwind Inc. does not own bonus card ${id}`);
    }
    return offTheSlipway(game);
  },
};

/** Fighters into the hangar — a corporation effect, attributed and logged once per arrival. */
function hangar(game: IGame, count: number, stat: string): void {
  const automa = game.automa;
  if (automa === undefined || count <= 0) {
    return;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    automa.corpResources += count;
    game.log('${0} put ${1} fighter(s) on its corporation ${2}', (b) => b.player(bot).number(count).string('Arwind Inc.'));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, stat, count);
}

/** BC5 Off the Slipway. Always ends in the recurring holding (never destroyed). */
function offTheSlipway(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    return 'discard';
  }
  bumpCorpStat(game, 'slipwayPlayed');
  const bot = marsBotOf(game);
  // «Spends 3 fighters, if able» — all or nothing, and no Failed Action: the card prints its own empty branch.
  if (automa.corpResources < LAUNCH_FIGHTERS) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Fewer than ${0} fighters in the hangar — no launch this generation', params: [`${LAUNCH_FIGHTERS}`]});
    game.log('${0} has fewer than ${1} fighters — no launch this generation', (b) => b.player(bot).number(LAUNCH_FIGHTERS));
    return 'discard';
  }
  automa.corpResources -= LAUNCH_FIGHTERS;
  bumpCorpStat(game, 'slipwayFighters', LAUNCH_FIGHTERS);
  const ship = revealSpaceCard(game);
  if (ship === undefined) {
    AutomaTurnLog.setBonusBranch(game, {key: 'The deck holds no space card — the launch is scrubbed'});
    return 'discard';
  }
  game.log('${0} launched ${1} off the slipway', (b) => b.player(bot).card(ship));
  bumpCorpStat(game, 'slipwayLaunches');
  AutomaTurnLog.setBonusBranch(game, {key: 'A ship off the slipway — a space card resolved'});
  resolveProjectCardForBot(game, ship);
  return 'discard';
}

/**
 * Reveal project cards until one with a space tag (MarsBot's own tag reading — `AutomaResolver.printedTags`); the
 * others go to the project discard. Bounded by one pass over the deck and its discard.
 */
function revealSpaceCard(game: IGame): IProjectCard | undefined {
  const limit = game.projectDeck.drawPile.length + game.projectDeck.discardPile.length;
  for (let i = 0; i < limit; i++) {
    const card = game.projectDeck.draw(game);
    if (card === undefined) {
      return undefined;
    }
    if (AutomaResolver.printedTags(card).includes(Tag.SPACE)) {
      return card;
    }
    game.log('${0} revealed ${1} — no space tag, discarded', (b) => b.player(marsBotOf(game)).card(card));
    game.projectDeck.discard(card);
  }
  return undefined;
}
