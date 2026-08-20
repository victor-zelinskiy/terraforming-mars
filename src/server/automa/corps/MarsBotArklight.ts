import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C31_ARKLIGHT);
/** The tags that pay. The exclamation mark on the card is about the third one. */
const PAYING_TAGS: ReadonlyArray<Tag> = [Tag.PLANT, Tag.ANIMAL];
/** What one of them pays. */
const TAG_MC = 2;

/**
 * MarsBot Arklight — official card C31:
 *
 *   STARTING TAG    animal
 *   DRAFT PRIORITY  Animal > plant
 *   SETUP           Replace the tracker for the plant track with a white cube
 *                   as a reminder for this corporation's effect.
 *   EFFECT          When resolving a plant or animal tag (not microbe!)
 *                   including the starting tag, MarsBot gains 2 MC.
 *
 * THE CARD IS C09 TERACTOR'S MIRROR, AND THE «(not microbe!)» IS WHY. Teractor
 * paints a white tracker on a track and pays for ADVANCING it — so on Tharsis,
 * where the Earth track also carries CITY, a city pays too, exactly as printed.
 * Arklight paints the same reminder on the plant track and pays for a TAG —
 * and that track carries THREE tags, of which only two pay. Same marking, same
 * mat row, opposite trigger; the printed exclamation exists precisely because
 * the reminder alone would read as Teractor's rule.
 *
 * So it rides `onTagResolved` (the C08/C24 per-tag hook) and NOT
 * `MarsBotTrackPayout`, whose whole contract is «this TRACK advanced». Using
 * the payout module here would silently pay for microbes.
 *
 * «INCLUDING THE STARTING TAG» IS FREE, and the card says it because it
 * matters: the animal tag it opens with is resolved through the ordinary
 * `AutomaResolver.resolveTag` at selection, so the corporation pays itself
 * 2 M€ on the way in.
 *
 * A WILD TAG IS NOT A PLANT TAG. `resolveTag` passes the tag as PRINTED, and a
 * wild one arrives as `Tag.WILD` (it advances the least-advanced track, which
 * may well be this very one). The card names two tags; a wild one is neither.
 *
 * NEITHER IS A MICROBE ADVANCEMENT. The Venus board's cell 9 advances the Bio
 * track BY a microbe (RB-B FAQ), and C24 Splice implements `onMicrobeAdvancement`
 * to catch it. This card deliberately does not: a microbe is the ONE thing its
 * effect box rules out, so being deaf to that cell is the correct reading, not
 * an omission.
 *
 * PER TAG, NOT PER CARD — «when RESOLVING a plant or animal tag», and
 * `resolveProjectCard` resolves the printed tags one at a time, so a card
 * carrying both pays twice.
 */
export const MarsBotArklight: MarsBotCorp = {
  info: INFO,

  onTagResolved(game: IGame, tag: Tag): void {
    if (!PAYING_TAGS.includes(tag)) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, TAG_MC, {log: false});
      game.log('${0} gained ${1} M€ from its corporation ${2} for resolving a ${3} tag',
        (b) => b.player(bot).number(TAG_MC).string('Arklight').string(tag));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'arklightTags');
    bumpCorpStat(game, 'arklightMc', TAG_MC);
  },
};
