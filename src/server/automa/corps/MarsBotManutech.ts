import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C29_MANUTECH);

/**
 * The columns the printed reminder cubes stand above — READ FROM THE CARD's
 * own data, so the rule and the mat marking can never disagree. The setup box
 * and the effect box of this card describe ONE set of numbers.
 */
const TRIGGER_COLUMNS: ReadonlyArray<number> = INFO.reminderColumns ?? [];

/**
 * MarsBot Manutech — official card C29:
 *
 *   STARTING TAG    building
 *   SETUP           Place a black cube as a reminder above the #5 and #12
 *                   columns.
 *   EFFECT          When any track (including Venus) reaches #5 or #12, after
 *                   resolving the effect, advance it another space, and
 *                   resolve that one as well.
 *
 * THE ONLY CORPORATION THAT PAYS IN TEMPO. Every other card in the set hands
 * the bot a resource, a tile or a point; this one hands it a MOVE — two
 * checkpoints on every track where the assembly line simply does not stop.
 * What it is worth is therefore whatever the mat happens to print two spaces
 * on: a TR jump, an ocean, another cascade. It is the human Manutech's own
 * idea read through the bot's board — production that comes with its output
 * attached, here as a space that comes with the next space attached.
 *
 * A COLUMN, NOT A TRACK. The reminder is not the C04/C20 per-track marker
 * turned up to two: it is that primitive through 90°. The physical mat lays
 * the tracks out as rows of ONE grid, so «the #5 column» is a vertical band
 * crossing every track at once — which is why `reminderColumns` needs no
 * board resolution (a column number means the same on every track long enough
 * to have it) where `whiteMarkerTracks` has to resolve a tag to an index.
 *
 * THE TRIGGER IS THE LANDING, THE PUSH IS FROM WHEREVER THE MARKER NOW IS.
 * «After resolving the effect» orders the push AFTER the space's printed icon
 * — and that icon may itself be «advance», which has already carried the
 * marker on. So the trigger reads the space the marker LANDED on (the
 * resolver captures it before the icon runs) while the push is an ordinary
 * `advanceTrack` from the current position: physically, the player finishes
 * the space, looks at the reminder, and moves the marker one more.
 *
 * NO SPECIAL CASE FOR ANYTHING ELSE. «Advance it another space, and resolve
 * that one as well» IS `AutomaResolver.advanceTrack`, so every shared rule
 * comes with it and none is restated here: the new space's icon fires, a
 * cascade it opens cascades, a corporation cube on it triggers, a track
 * already at its end is the ordinary Failed Action (the Venus track's #12 is
 * its LAST space, so the push there is always that), and the depth counter
 * that guards runaway chains keeps counting because `depth + 1` is passed on.
 *
 * A REGRESSED RE-ADVANCE STILL COUNTS. The regression rule suppresses the
 * SPACE'S OWN printed action, not a corporation clause triggered by the move
 * — the same reading C04 already runs on (`onTrackAdvance` fires for every
 * successful advance, regressed space or not). The physical tell agrees: a
 * spent resource cube leaves the mat, this black cube never does.
 */
export const MarsBotManutech: MarsBotCorp = {
  info: INFO,

  onTrackSpaceResolved(game: IGame, trackIndex: number, position: number, depth: number): void {
    const automa = game.automa;
    if (automa === undefined || !TRIGGER_COLUMNS.includes(position)) {
      return;
    }
    const track = automa.board.tracks[trackIndex];
    const bot = marsBotOf(game);
    const before = track.position;
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      game.log('${0} reached space ${1} — its corporation ${2} pushes that track one space further',
        (b) => b.player(bot).number(position).string('Manutech'));
      bumpCorpStat(game, 'manutechTriggers');
      AutomaResolver.advanceTrack(game, trackIndex, depth + 1);
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // Counted only when the push LANDED: a track at its end took the Failed
    // Action instead, and that is not a step. `>` rather than `=== before + 1`
    // because the new space's own icon may have carried the marker further.
    if (track.position > before) {
      bumpCorpStat(game, 'manutechSteps');
    }
  },
};
