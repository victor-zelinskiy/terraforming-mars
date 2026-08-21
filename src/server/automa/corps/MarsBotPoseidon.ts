import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {AutomaColonies} from '../AutomaColonies';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C33_POSEIDON);

/**
 * MarsBot Poseidon — official card C33:
 *
 *   STARTING TAGS  none
 *   SETUP          Use this corp only when playing with Colonies.
 *                  MarsBot builds a colony (and gains 2 of the corresponding
 *                  resource to its Shipping Board).
 *   EFFECT         When you or MarsBot build a colony, including during setup
 *                  of this card, MarsBot advances the least-advanced track,
 *                  topmost if tied.
 *
 * THE CORPORATION THAT TAXES EXPANSION ITSELF. It owns no track, no cube and
 * no resource — it just takes a step every time ANY colony is founded, and the
 * step always goes where the bot is weakest, so the opponent's own outward
 * push keeps levelling the bot's mat. The human cannot avoid feeding it except
 * by not settling.
 *
 * THE SETUP BOX IS ENTIRELY THE ENGINE'S. «Builds a colony (and gains 2 of the
 * corresponding resource)» is `AutomaColonies.botBuildColony` word for word —
 * the random eligible tile, the printed reward ignored in favour of 2 storage
 * resources, Europa's ocean instead, the journal line. Nothing is restated
 * here. A table with no eligible tile simply builds nothing (the B18
 * precedent: an impossible primary effect is not a Failed Action).
 *
 * «INCLUDING DURING SETUP OF THIS CARD» IS FREE, and the card says it because
 * the order is what makes it true: `selectCorporation` seats the corporation
 * BEFORE running its Setup box, so the colony the box builds reaches this very
 * hook and pays the first step. Pinned by a test.
 *
 * THE TRIGGER'S POSITION IS THE RULE (the C28 law). A colony can be founded in
 * exactly two places — `Colony.addColony` (a human) and
 * `AutomaColonies.botBuildColony` (the bot, which deliberately does NOT go
 * through the former, because it ignores the printed reward) — and each of
 * them already runs the engine's «any player built a colony» loop for the
 * HUMAN Poseidon's own `onColonyAddedByAnyPlayer`. The dispatch sits beside
 * that loop in both, so «you or MarsBot» needs no branch and cannot drift from
 * the card whose sentence it shares.
 *
 * «THE LEAST-ADVANCED TRACK, TOPMOST IF TIED» is the engine's existing wild
 * rule: `board.getLeastAdvancedTrackIndex` — the very helper
 * `AutomaResolver.resolveTag(Tag.WILD)` uses. The push goes through
 * `advanceTrack`, not `resolveTag`, because no TAG was resolved; writing a
 * wild-tag note into the turn review would be a lie about what happened.
 */
export const MarsBotPoseidon: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    AutomaColonies.botBuildColony(game);
  },

  onColonyBuilt(game: IGame, builder: IPlayer): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    bumpCorpStat(game, builder.isMarsBot === true ? 'poseidonBotColonies' : 'poseidonHumanColonies');

    const trackIndex = automa.board.getLeastAdvancedTrackIndex();
    const before = automa.board.tracks[trackIndex].position;
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      game.log('${0} advances its least-advanced track from its corporation ${1}: a colony was built',
        (b) => b.player(bot).string('Poseidon'));
      AutomaResolver.advanceTrack(game, trackIndex);
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // That track's OWN position — a cascade may have moved others too, and
    // only this one answers «did the printed push land?». A mat with every
    // track finished took the ordinary Failed Action instead.
    if (automa.board.tracks[trackIndex].position > before) {
      bumpCorpStat(game, 'poseidonSteps');
    }
  },
};
