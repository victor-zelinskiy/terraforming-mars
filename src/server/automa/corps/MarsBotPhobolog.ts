import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {inplaceShuffle} from '../../utils/shuffle';
import {drawAndResolveBonusDeckCard} from '../AutomaCardDraw';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C07_PHOBOLOG);
/** The printed seeding: reveal until 2 cards carry a space tag. */
const SEED = INFO.bonusDeckSeed ?? {tag: INFO.startingTags[0], count: 2};

/**
 * MarsBot PhoboLog — official card C07:
 *
 *   STARTING TAG  space
 *   SETUP         Reveal cards from the project deck until you've revealed 2
 *                 cards with a space tag. Shuffle these cards into the bonus
 *                 deck. Place a white cube on the space track on spaces #7,
 *                 #10, #13, and #15.
 *   EFFECT        When MarsBot advances onto a white cube, MarsBot draws and
 *                 resolves a card from the bonus deck.
 *
 * «SHUFFLE THESE CARDS» = every card the reveal turned over, not just the two
 * space ones: the card names no other destination for the rest, and a physical
 * reveal has to put every turned card somewhere. So the bonus deck ends up
 * with a handful of PROJECT cards mixed in — which is the whole point of the
 * effect: a white cube pulls from a deck that now holds both bonus cards and
 * (space-heavy) project cards. The deck is typed for that mix
 * (`AutomaState.bonusDeck`), and every existing bonus-deck draw resolves the
 * drawn entry by its own kind.
 *
 * The cubes themselves are pure data (`info.trackCubes`) — the framework seeds
 * them, remembers that a cube is spent and never re-arms it. Nothing here says
 * «instead of», so RB-B's general rule applies: the draw happens BEFORE and IN
 * ADDITION to whatever the space prints (on Tharsis, #7 is the Venus space and
 * #10/#13/#15 are blank).
 */
export const MarsBotPhobolog: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const revealed: Array<IProjectCard> = [];
    let withTag = 0;
    while (withTag < SEED.count) {
      const card = game.projectDeck.draw(game);
      if (card === undefined) {
        break; // Draw + discard piles exhausted — impossible in a real game.
      }
      revealed.push(card);
      if (AutomaResolver.printedTags(card).includes(SEED.tag)) {
        withTag++;
      }
    }
    if (revealed.length === 0) {
      return;
    }
    for (const card of revealed) {
      automa.bonusDeck.push({kind: 'project', name: card.name});
    }
    inplaceShuffle(automa.bonusDeck, game.rng);
    bumpCorpStat(game, 'phobologSeeded', revealed.length);
    // Named out loud: these cards left the project deck, and the human is
    // entitled to know which ones now sit in the bot's bonus deck.
    game.log('${0} shuffled ${1} revealed project cards into its bonus deck: ${2}',
      (b) => b.player(bot).number(revealed.length).cards(revealed));
  },

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    if (cube.cubeType !== 'white') {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bumpCorpStat(game, 'phobologCubesHit');
      game.log('${0} reached a white cube of its corporation ${1} — it draws a card from its bonus deck',
        (b) => b.player(bot).string('PhoboLog'));
      const before = game.automa?.playedPile.length ?? 0;
      if (drawAndResolveBonusDeckCard(game)) {
        // Which kind came up is worth counting: the endgame story is about
        // what the cubes actually produced, not how often they fired.
        const project = (game.automa?.playedPile.length ?? 0) > before;
        bumpCorpStat(game, project ? 'phobologProjectCards' : 'phobologBonusCards');
      }
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // No «instead of» on this card: the space's own printed icon still resolves.
  },
};
