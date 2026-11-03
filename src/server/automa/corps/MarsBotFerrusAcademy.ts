import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {Resource} from '../../../common/Resource';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {Space} from '../../boards/Space';
import {AutomaAres} from '../AutomaAres';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {bestCampus, botCitySpaces, pileCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF1_FERRUS_ACADEMY);

/** «The bonus icons of its space paying double» — the human card's own multiple. */
const FOUNDING_BONUS_MULTIPLIER = 2;

/** BC1's printed tuition — «Tuition is astronomical». The balance knob (docs/AUTOMA_DATA_AUDIT.md §20). */
export const FIELD_PRACTICE_TUITION = 10;

/**
 * Nested Graduations in flight. Each one needs a NEW tile on a Campus cube (or a paid Field Practice) and the
 * Campus never grows, so the chain is bounded by construction; the counter is the depth the shared runaway guard
 * reads (`advanceTrack(…, depth)`), kept in the MODULE (never serialized), the C22 / C35 law.
 */
let graduationDepth = 0;

/**
 * MarsBot Ferrus Academy — CF1, the FORK'S OWN bot card (the owner, 2026-11-03): no official MarsBot card exists
 * for the Turmoil Redux corporation TR79, so this one is designed, not transcribed. «The Campus»:
 *
 *   STARTING TAGS        science, city
 *   DRAFT PRIORITY       science
 *   SETUP                MarsBot founds the Academy — a city by its usual rules, the bonus icons of its space paying
 *                        double — and its player markers reserve every adjacent non-reserved land space: the Campus.
 *   EFFECT               Graduation: each tile MarsBot places on a space of its Campus advances its least advanced
 *                        track.
 *   BEFORE ACTION PHASE  Add Field Practice (BC1) to MarsBot's action deck.
 *
 *   BC1 FIELD PRACTICE   MarsBot pays 10 M€ tuition, if able. Then it places a greenery on a free space of its Campus
 *                        (its Graduation follows); with no free Campus space, a Graduation all the same. Unable to
 *                        pay, nothing happens. Recurs every generation.
 *
 * THE LORE IS THE RULE. «A self-governing research campus … tuition is astronomical, but the pedigree is valued
 * everywhere»: the Campus is closed land around ONE city (the owner chose the closed campus that never grows),
 * every building on it sends a graduate to where the bot is weakest — the least advanced track, the board's own
 * wild-tag rule (`getLeastAdvancedTrackIndex`) — and the practice that fills it is paid for.
 *
 * THE BALANCE (measured 2026-11-03, 30 seeded 8-generation games per variant, the human passing — §20): the setup
 * alone is an ordinary corporation (82 VP, the C01/C18 band); a FREE Field Practice made it the strongest by far
 * (111 VP; every corporation measured 79–98). The bot's own greeneries rarely land on the Campus by themselves
 * (≈1.5 Graduations a game), so BC1 is the engine and its tuition is the knob: 10 M€ puts the corporation at
 * ≈96 VP — strong (C38 94.5, C42 98.2) — with ≈6 Graduations and ≈2.5 Campus greeneries a game.
 *
 * THE HUMAN CARD GIVES THE SHAPES, NOT THE RULES: the ring is the human card's own predicate
 * (`FerrusAcademy.reservableRing` = `isNonReservedLand` over the city's neighbours), minus the hazard cells the bot
 * never builds on (the `AutomaMarkerPlacer` law); the doubled bonus rides `AddTileOptions.printedBonusMultiplier`,
 * which for the bot doubles the icons' M€ (`Game.grantPlacementBonuses`). The reservation needs no code — a cube on
 * a tile-less cell is the engine's own block (C18's law) — and the Graduation answers the very line that tells a
 * human Ferrus Academy its cube was built on (`Game.answerOwnMarkerBuilt` → `onOwnMarkerBuilt`).
 */
export const MarsBotFerrusAcademy: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF1_FERRUS_ACADEMY).rates;
    return dividendResult([
      perUnitTerm('MarsBot tiles around its best-surrounded city', bestCampus(game), r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return pileCount(game, (card) => card.cost >= 20);
  },

  setup(game: IGame): void {
    foundAcademy(game);
  },

  onOwnMarkerBuilt(game: IGame, _space: Space): void {
    graduate(game);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.BC1_FIELD_PRACTICE)) {
      automa.recurringBonusCards.push(BonusCardId.BC1_FIELD_PRACTICE);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC1_FIELD_PRACTICE);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.BC1_FIELD_PRACTICE});
      // Journal-only (no scope): the deck join is public bookkeeping — the card announces itself when flipped.
      game.log('${0} shuffled Field Practice into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC1_FIELD_PRACTICE) {
      throw new Error(`MarsBot Ferrus Academy does not own bonus card ${id}`);
    }
    return fieldPractice(game);
  },
};

/** The free spaces of the Campus — the bot's own cubes on cells with no tile. */
export function freeCampusSpaces(game: IGame): ReadonlyArray<Space> {
  const bot = marsBotOf(game);
  return game.board.spaces.filter((space) => space.player?.id === bot.id && space.tile === undefined);
}

/** SETUP — the Academy city (its icons paying double), then the Campus ring around it. */
function foundAcademy(game: IGame): void {
  const bot = marsBotOf(game);
  const before = new Set(botCitySpaces(game).map((space) => space.id));
  // A legal city space always exists at the table's setup; were there none, the box simply founds nothing.
  if (!AutomaTilePlacer.placeCity(game, {printedBonusMultiplier: FOUNDING_BONUS_MULTIPLIER, onEmpty: 'impossible'})) {
    return;
  }
  const academy = botCitySpaces(game).find((space) => !before.has(space.id));
  if (academy === undefined) {
    return; // A standing law diverted the city — no Academy, no Campus.
  }
  bumpCorpStat(game, 'ferrusFoundings');
  // The human card's own ring predicate (`FerrusAcademy.reservableRing`) — the board's `isNonReservedLand` over the
  // city's neighbours; read from the BOARD, not the card class (a card import here closes a module cycle).
  const ring = AutomaAres.withoutHazardSpaces(game,
    game.board.getAdjacentSpaces(academy).filter((cell) => game.board.isNonReservedLand(cell)));
  for (const cell of ring) {
    cell.player = bot;
  }
  bumpCorpStat(game, 'ferrusCampusSpaces', ring.length);
  game.log('${0} founded its Academy on ${1}: ${2} Campus space(s) reserved around it', (b) =>
    b.player(bot).space(academy).number(ring.length));
}

/**
 * GRADUATION — a graduate goes to work where MarsBot is weakest: its least advanced track (topmost if tied — the
 * board's own wild-tag rule). Advanced through `advanceTrack`, never `resolveTag`: no tag was resolved. A finished
 * mat makes it the official Failed Action, as for every push of a maxed track.
 */
function graduate(game: IGame): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  graduationDepth++;
  try {
    const trackIndex = automa.board.getLeastAdvancedTrackIndex();
    const before = automa.board.tracks[trackIndex].position;
    game.log('${0} graduated a class from its Academy: its least advanced track advances', (b) => b.player(bot));
    AutomaResolver.advanceTrack(game, trackIndex, graduationDepth);
    if (automa.board.tracks[trackIndex].position > before) {
      bumpCorpStat(game, 'ferrusGraduations');
    }
  } finally {
    graduationDepth--;
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}

/** BC1 Field Practice. Always ends in the recurring holding (never destroyed). */
function fieldPractice(game: IGame): BonusCardOutcome {
  bumpCorpStat(game, 'fieldPracticePlayed');
  const bot = marsBotOf(game);
  // «Pays 10 M€, if able» — all or nothing, and no Failed Action: the card prints its own empty branch.
  if (bot.megaCredits < FIELD_PRACTICE_TUITION) {
    AutomaTurnLog.setBonusBranch(game, {key: 'No ${0} M€ for the tuition — no practice this generation', params: [`${FIELD_PRACTICE_TUITION}`]});
    game.log('${0} could not pay the ${1} M€ tuition of Field Practice', (b) => b.player(bot).number(FIELD_PRACTICE_TUITION));
    return 'discard';
  }
  bot.stock.deduct(Resource.MEGACREDITS, FIELD_PRACTICE_TUITION, {log: false});
  game.log('${0} paid ${1} M€ tuition for Field Practice', (b) => b.player(bot).number(FIELD_PRACTICE_TUITION));
  bumpCorpStat(game, 'fieldPracticeTuition', FIELD_PRACTICE_TUITION);
  const campus = new Set(freeCampusSpaces(game).map((space) => space.id));
  // The greenery goes through the ONE greenery pipeline (TR, oxygen, adjacency, its own Graduation through the
  // marker hook) narrowed to the Campus — a HARD constraint, so «nowhere» is no Failed Action: the card prints its
  // own else-branch.
  const placed = campus.size > 0 && AutomaTilePlacer.placeGreenery(game, {
    restrict: (space) => campus.has(space.id),
    onEmpty: 'impossible',
  });
  if (placed) {
    bumpCorpStat(game, 'fieldPracticeGreeneries');
    AutomaTurnLog.setBonusBranch(game, {key: 'A greenery on the Campus — and its Graduation'});
  } else {
    AutomaTurnLog.setBonusBranch(game, {key: 'No free Campus space — a Graduation all the same'});
    graduate(game);
  }
  return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
}
