import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotDraftPriority, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaColonies} from '../AutomaColonies';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {pileCount, pileTagCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF8_PROTEUS);

/** SETUP — the project cards revealed as MarsBot's «Preludes» (the human card plays two-plus Preludes beside it). */
export const IMPRINT_CARDS = 3;
/** SETUP — «You start with … 2 data resources on this card». */
export const STARTING_DATA = 2;
/** EFFECT — data per tag resolved on a track of the imprint (the human card's «add 1 data»). */
export const DATA_PER_MATCH = 1;
/** BC8 — the data one deep run costs (the human card's «spend 6 data»). */
export const DEEP_RUN_DATA = 6;

/**
 * MarsBot Proteus — CF8, the FORK'S OWN bot card (the owner, 2026-11-05) for the Turmoil Redux corporation TR82.
 * «The Imprint of Form» — the owner chose it over a shapeshifter that becomes its least advanced track every
 * generation and a chain reaction of consecutive flips: the human card's «a tag that matches a tag on your Preludes
 * → 1 data; 6 data → a colony or an ocean», read through the one thing MarsBot has in place of Preludes.
 *
 *   STARTING TAG         Wild (resolved like every Wild — the least advanced track; never a match: «non-wild»)
 *   DRAFT PRIORITY       The imprint's tags — Proteus keeps to its form: the chain the setup read, decided in play
 *                        (`draftPriorityInPlay`), so the draft feeds the very tracks that pay.
 *   SETUP                MarsBot reveals 3 project cards — its Preludes: their tags are the IMPRINT, a white marker on
 *                        each of their tracks; the cards go to the (open) discard. Place 2 data on this card.
 *   EFFECT               Each non-wild tag MarsBot resolves on a track of the imprint puts 1 data on this card.
 *   BEFORE ACTION PHASE  Add Deep Run (BC8) to MarsBot's action deck.
 *
 *   BC8 DEEP RUN         While the card holds 6 data, MarsBot spends them: a colony (the bot's own build rule), or —
 *                        no colony to build — an ocean (the shared placement: TR, bonuses, laws). With neither the
 *                        data wait on the card. Recurs every generation.
 *
 * THE MATCH IS A TRACK, NOT A LETTER. The imprint is read off printed tags, but what the table SEES is a white marker
 * on a track — so «matches» means «resolves on a marked track»: on a mat where one track carries two tags (Tharsis:
 * Earth + city, power + Jovian) both pay, exactly as the marker promises. A tag with no track of its own (the flip
 * home rule) is matched by its PRINTED tag — no track, no match — and the Wild never matches (the human card's
 * «non-wild»).
 *
 * THE BALANCE (measured 2026-11-05, 30 seeded 8-generation games with the RESEARCH DRAFT played — the human drafts the
 * first card and buys none — §20). References under the same driver: C38 95.3 / 103.6 · C42 94.8 / 106.9 · CF1
 * 98.1 / 107.1 · CF7 95.5 / 106.6 (base / Venus + Colonies + Prelude). With no plate the card is weak: 84.9 / 93.6 —
 * ~2 data a generation, two or three runs a game. «Most tags» made it the strongest card of the set, 100.5 / 113.0
 * (the plate alone +15 VP — it is a lever of every corporation, not of this one). **The imprint's tags, deep run 6:
 * 94.6 / 104.4** — data 17 → 25 a game, the runs 2.5 → 3.6; run 4 → 96.3 / 108.7; run 5 with a 4-card imprint
 * 98.9 / 110.4. Least-advanced track at run 4: 88.5 / 99.2; most expensive 90.4 / 101.9.
 */
export const MarsBotProteus: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF8_PROTEUS).rates;
    return dividendResult([
      perUnitTerm('Cards with two or more tags in MarsBot\'s played pile', pileCount(game, isManyFormed), r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    // «Proteus mirabilis» — the shape-shifting bacterium named after the god: the microbe tags in MarsBot's pile.
    return pileTagCount(game, [Tag.MICROBE]);
  },

  markerTags(game: IGame): ReadonlyArray<Tag> {
    return game.automa?.corpImprint ?? [];
  },

  /** DRAFT PRIORITY «The imprint's tags» — the chain the setup read, in the order it read it. */
  draftPriorityInPlay(game: IGame): MarsBotDraftPriority | undefined {
    const imprint = game.automa?.corpImprint ?? [];
    return imprint.length === 0 ? undefined : {type: 'tags', tags: imprint};
  },

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      const imprint: Array<Tag> = [];
      for (let i = 0; i < IMPRINT_CARDS; i++) {
        const card = game.projectDeck.draw(game);
        if (card === undefined) {
          break;
        }
        for (const tag of card.tags) {
          // A tag with a track on THIS mat — what a white marker can stand on; one entry per track.
          const track = tag === Tag.WILD ? undefined : automa.board.getTrackIndexForTag(tag);
          if (track !== undefined && !imprint.some((t) => automa.board.getTrackIndexForTag(t) === track)) {
            imprint.push(tag);
          }
        }
        game.log('${0} revealed ${1} as the imprint of its corporation ${2}', (b) => b.player(bot).card(card).string('Proteus'));
        game.projectDeck.discard(card);
      }
      automa.corpImprint = imprint;
      bumpCorpStat(game, 'proteusImprint', imprint.length);
      automa.corpResources += STARTING_DATA;
      game.log('${0} put ${1} data on its corporation ${2}', (b) => b.player(bot).number(STARTING_DATA).string('Proteus'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },

  onTagResolved(game: IGame, tag: Tag): void {
    const automa = game.automa;
    if (automa === undefined || tag === Tag.WILD || !imprintMatches(game, tag)) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources += DATA_PER_MATCH;
      game.log('${0} put ${1} data on its corporation ${2}', (b) => b.player(bot).number(DATA_PER_MATCH).string('Proteus'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'proteusData', DATA_PER_MATCH);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.BC8_DEEP_RUN)) {
      automa.recurringBonusCards.push(BonusCardId.BC8_DEEP_RUN);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC8_DEEP_RUN);
    if (!present) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.BC8_DEEP_RUN});
      game.log('${0} shuffled Deep Run into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC8_DEEP_RUN) {
      throw new Error(`MarsBot Proteus does not own bonus card ${id}`);
    }
    return deepRun(game);
  },
};

/** A card of many forms — two or more non-wild printed tags (the dividend's operand). */
function isManyFormed(card: {tags: ReadonlyArray<Tag>}): boolean {
  return card.tags.filter((tag) => tag !== Tag.WILD).length >= 2;
}

/** Does a tag resolved now land on a track of the imprint? (The match is the TRACK — see the header.) */
export function imprintMatches(game: IGame, tag: Tag): boolean {
  const automa = game.automa;
  if (automa === undefined || tag === Tag.WILD) {
    return false;
  }
  const track = automa.board.getTrackIndexForTag(tag);
  return track !== undefined && automa.corpImprint.some((t) => automa.board.getTrackIndexForTag(t) === track);
}

/** BC8 Deep Run. Always ends in the recurring holding (never destroyed). */
function deepRun(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    return 'discard';
  }
  bumpCorpStat(game, 'deepRunPlayed');
  const bot = marsBotOf(game);
  if (automa.corpResources < DEEP_RUN_DATA) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Fewer than ${0} data on Proteus — no deep run this generation', params: [`${DEEP_RUN_DATA}`]});
    game.log('${0} has fewer than ${1} data — no deep run this generation', (b) => b.player(bot).number(DEEP_RUN_DATA));
    return 'discard';
  }
  let colonies = 0;
  let oceans = 0;
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    while (automa.corpResources >= DEEP_RUN_DATA) {
      // The colony first — the build rule says whether one stands open; then the ocean, while Mars has room for it.
      if (AutomaColonies.botBuildColony(game)) {
        colonies++;
        bumpCorpStat(game, 'deepRunColonies');
      } else if (game.canAddOcean()) {
        AutomaTilePlacer.placeOcean(game);
        oceans++;
        bumpCorpStat(game, 'deepRunOceans');
      } else {
        game.log('${0} has no colony to build and no ocean to place — the data wait on Proteus', (b) => b.player(bot));
        break;
      }
      automa.corpResources -= DEEP_RUN_DATA;
      bumpCorpStat(game, 'deepRunData', DEEP_RUN_DATA);
      game.log('${0} spent ${1} data from its corporation ${2}', (b) => b.player(bot).number(DEEP_RUN_DATA).string('Proteus'));
    }
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  if (colonies + oceans === 0) {
    AutomaTurnLog.setBonusBranch(game, {key: 'No colony to build and no ocean to place — the data wait on Proteus'});
  } else {
    AutomaTurnLog.setBonusBranch(game, {key: 'A deep run: ${0} colony(ies) and ${1} ocean(s) bought with data', params: [`${colonies}`, `${oceans}`]});
  }
  return 'discard';
}
