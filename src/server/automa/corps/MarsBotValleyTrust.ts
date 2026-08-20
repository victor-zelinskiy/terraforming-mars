import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {drawAndResolveProjectCard} from '../AutomaCardDraw';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C16_VALLEY_TRUST);
/** «Give MarsBot 1 extra card from the project deck for its starting hand.» */
const EXTRA_START_CARDS = 1;

/**
 * MarsBot Valley Trust — official card C16:
 *
 *   DRAFT PRIORITY  Science
 *   SETUP           Use this corporation only when playing with Prelude.
 *                   Give MarsBot 1 extra card from the project deck for its
 *                   starting hand. Place a white cube on the science track on
 *                   spaces #8 and #16.
 *   EFFECT          When MarsBot advances onto a white cube, it draws a card
 *                   from the project deck and resolves it.
 *
 * The card prints NO starting tag — the science symbol on it is the draft
 * priority. Everything here is science: it drafts for science, its cubes sit
 * on the science track, and each one buys the bot a free project.
 *
 * «USE THIS CORPORATION ONLY WHEN PLAYING WITH PRELUDE» is DATA, not a runtime
 * check: `info.requiresModules` keeps the corporation out of the selection
 * pool entirely (`AutomaCorporations.eligibleCorpIds`), which is also what
 * stops a dev-force from seating it in a game without Prelude. A corporation
 * that cannot legally be selected must never reach its own hooks.
 *
 * «ITS STARTING HAND» is the generation-1 ACTION DECK — the only pile MarsBot
 * is dealt at setup (3 project cards, +3 with Prelude, +1 on Brutal, plus the
 * bonus card). This engine builds that deck at game creation, BEFORE the
 * corporation exists, so the extra card is not dealt-with-the-rest but
 * SHUFFLED IN here at a seeded-random position — the same state the table
 * order would have produced, and the same technique B23/B25/B28 use for their
 * generation-1 insertion.
 *
 * The EFFECT is the plain shared draw (`drawAndResolveProjectCard`): the card
 * is PLAYED, so the journal, the played pile, the corporation dispatch and the
 * RB-B human reactors all see it. Nothing says «instead of», so RB-B's general
 * rule stands — the science space's own printed icon resolves too, after the
 * cube (science #8 prints tr2, #16 is blank).
 */
export const MarsBotValleyTrust: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    for (let i = 0; i < EXTRA_START_CARDS; i++) {
      const card = game.projectDeck.draw(game);
      if (card === undefined) {
        return; // Draw + discard exhausted at setup — impossible in practice.
      }
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'project', name: card.name});
      bumpCorpStat(game, 'valleyExtraStartCards');
    }
    // Journal-only: WHICH card it is stays hidden (the deck is face down —
    // naming it here would leak what the bot is about to play).
    game.log('${0} received ${1} extra project card in its starting deck from its corporation ${2}',
      (b) => b.player(bot).number(EXTRA_START_CARDS).string('Valley Trust'));
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
      bumpCorpStat(game, 'valleyCubesHit');
      game.log('${0} reached a white cube of its corporation ${1} — it draws a card',
        (b) => b.player(bot).string('Valley Trust'));
      if (drawAndResolveProjectCard(game)) {
        bumpCorpStat(game, 'valleyCardsDrawn');
      }
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // No «instead of» on this card: the space's printed icon still resolves.
  },
};
