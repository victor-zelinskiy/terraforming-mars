import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C40_ECOTEC);
/** The card's printed name, for the journal templates. */
const NAME = 'EcoTec';
/** What the setup box puts on the card. */
const SETUP_PLANTS = 2;
/** The printed threshold, and what one conversion spends. */
const CONVERSION_PLANTS = 5;
/** Which tags feed the card — the human twin's own «bio tag» family. */
const FEEDING_TAGS: ReadonlyArray<Tag> = [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL];
/** The track a conversion pushes (named by its tag, never by an index). */
const REWARD_TRACK = Tag.PLANT;

/**
 * MarsBot EcoTec — official card C40:
 *
 *   STARTING TAG        plant
 *   DRAFT PRIORITY      plant > microbe > animal
 *   SETUP               Place 2 plants on this card. Replace the tracker for
 *                       the plant track with a white cube as a reminder for
 *                       this corporation's effect.
 *   EFFECT              When resolving a plant, microbe, or animal tag,
 *                       including the starting tag, place a plant on this card.
 *   BEFORE ACTION PHASE If there are 5 or more plants on this card, remove 5
 *                       plants from here and MarsBot advances the plant track.
 *
 * A GREENHOUSE, NOT A PAYOUT. The card takes the human EcoTec's own «bio tag»
 * family — plant, microbe, animal, exactly the three its printed effect
 * lists — and turns every one of them into a plant IN STORAGE. Nothing is
 * spent as it arrives; the store is cashed once per generation, five at a
 * time, for one push of the very track those tags ride. So the corporation
 * does not make the bot faster — it makes the bot's bio tags count TWICE, once
 * on the way past the track and once again five tags later.
 *
 * THE STORE IS THE ORDINARY ON-CARD SOCKET (`corpResources`, `resource:
 * 'plant'` — Ecoline's plant and Philares' science live in the same place), so
 * the face's capsule, the serialization and the human's plant-attack rules
 * (`AutomaTargeting.corpPlantPool`, RB-B FAQ: an attack MAY take plants off a
 * corporation card) all come free.
 *
 * ITS SETUP MARKER IS C31 ARKLIGHT'S, WORD FOR WORD — the same tracker on the
 * same track — so the printed line is literally the same i18n key. What the
 * cube REMINDS of is different, which is exactly why `markerLegend` is the
 * card's own: Arklight pays 2 M€ for a plant or animal tag and deliberately
 * NOT for a microbe; this one feeds on all three.
 *
 * «INCLUDING THE STARTING TAG» IS FREE, and the ORDER makes it visible: the
 * framework runs the Setup box FIRST and resolves the starting tags after it
 * (`AutomaCorporations.selectCorporation`), so the card leaves setup holding
 * 2 + 1 = 3 plants. Pinned by a test rather than assumed.
 *
 * A MICROBE ADVANCEMENT IS ALSO A MICROBE (RB-B FAQ), the same reading C24
 * Splice already follows: the Venus board's cell 9 advances the bio track BY a
 * microbe without resolving a tag, and a card that feeds on microbe tags would
 * otherwise be deafer to that cell than the identical clause in a human's
 * tableau. `onMicrobeAdvancement` is that cell's ONLY dispatch site — a
 * starting tag is a real `resolveTag` and arrives through `onTagResolved`, so
 * no microbe is ever counted twice.
 */
export const MarsBotEcotec: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    automa.corpResources += SETUP_PLANTS;
    bumpCorpStat(game, 'ecotecPlantsAdded', SETUP_PLANTS);
    game.log('${0} put ${1} plants on its corporation ${2}',
      (b) => b.player(bot).number(SETUP_PLANTS).string(NAME));
  },

  onTagResolved(game: IGame, tag: Tag): void {
    if (!FEEDING_TAGS.includes(tag)) {
      return;
    }
    feed(game, 'a bio tag');
  },

  onMicrobeAdvancement(game: IGame): void {
    // The Venus board's microbe cell: no tag was resolved, but the FAQ reads
    // it as one (see the file docstring).
    feed(game, 'a microbe advancement');
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || automa.corpResources < CONVERSION_PLANTS) {
      return; // «If there are 5 or more plants on this card…»
    }
    const trackIndex = automa.board.getTrackIndexForTag(REWARD_TRACK);
    if (trackIndex === undefined) {
      return; // No plant track on this board — the plants stay where they are.
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    const before = automa.board.tracks[trackIndex].position;
    try {
      automa.corpResources -= CONVERSION_PLANTS;
      bumpCorpStat(game, 'ecotecSpends');
      game.log('${0} spent ${1} plants off its corporation ${2} to advance the plant track',
        (b) => b.player(bot).number(CONVERSION_PLANTS).string(NAME));
      // The shared advance: the space's printed icon, cascades, cubes and the
      // Failed Action on a completed track all behave as anywhere else.
      AutomaResolver.advanceTrack(game, trackIndex);
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // Counted only when the track actually MOVED: a completed track took the
    // shared Failed Action instead, which is a real outcome, not a step.
    if (automa.board.tracks[trackIndex].position > before) {
      bumpCorpStat(game, 'ecotecSteps');
    }
  },
};

/** «…place a plant on this card.» One plant, whatever fed it. */
function feed(game: IGame, source: 'a bio tag' | 'a microbe advancement'): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  automa.corpResources++;
  bumpCorpStat(game, 'ecotecPlantsAdded');
  if (source === 'a microbe advancement') {
    bumpCorpStat(game, 'ecotecMicrobeCells');
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    game.log('${0} grew a plant on its corporation ${1}', (b) => b.player(bot).string(NAME));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}
