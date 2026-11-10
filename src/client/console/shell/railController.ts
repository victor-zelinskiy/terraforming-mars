/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLAYER RAIL CONTROLLER — whose rail the side column shows (mine, the inspected seat's, the automa's) and the
 * marks it carries (the TR veto, the skipped rating, hidden VP).
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import type {UnwrapRef} from 'vue';
import {computed} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {seatRestricted} from '@/common/models/ParliamentModel';
import {PristarMark, RatingSkipMark, pristarMarkOf, ratingSkipMarkOf} from '@/client/console/railMarks';
import {infoModeState} from '@/client/console/infoModeState';
import {translateText} from '@/client/directives/i18n';
import type {MaController} from '@/client/console/shell/maController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type RailPort = {
  game: UnwrapRef<MaController['game']>,
  readonly inspectedPlayer: PublicPlayerModel,
  readonly playerView: PlayerViewModel,
  readonly thisPlayer: PublicPlayerModel,
};

export function createRailController(shell: RailPort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE RAIL'S OWN SEAT IS UNDER THE RATING VETO (RX42 UNMI Veto): the server's live leaders on the enacted law
   * carry this seat, and the seat is in the law's aspect — the rating cell wears the stamp and names the law.
   * Nothing is counted here.
   */
  const railTrVeto = computed((): {law: string, tr: number} | undefined => {
    const enacted = shell.game.parliament?.enacted;
    const veto = enacted?.trVeto;
    if (enacted === undefined || veto === undefined || !railShowsSelf.value) {
      return undefined;
    }
    const mine = veto.leaders.find((l) => l.color === shell.thisPlayer.color);
    const seat = shell.game.parliament?.players.find((p) => p.color === shell.thisPlayer.color);
    if (mine === undefined || (seat !== undefined && !seatRestricted(seat))) {
      return undefined;
    }
    return {law: translateText(resolutionName(enacted.resolution)), tr: mine.tr};
  });

  /**
   * PRISTAR'S STATE ON THE DISPLAYED SEAT (R07 — `railMarks.pristarMarkOf`): the rail's own seat, or the seat the
   * Information Workspace inspects (the rail IS its summary half) — the server's public flag, nothing counted here.
   */
  const railPristarMark = computed((): PristarMark | undefined => {
    return pristarMarkOf(railPlayer.value);
  });

  /** PRESERVATION PROGRAM'S SKIP ON THE DISPLAYED SEAT (P57 — `railMarks.ratingSkipMarkOf`): the server's field, nothing counted. */
  const railRatingSkipMark = computed((): RatingSkipMark | undefined => {
    return ratingSkipMarkOf(railPlayer.value);
  });

  /**
   * The seat the LEFT RAIL displays: the inspected player while the
   * Information Workspace is open, the viewer's own seat otherwise. The
   * flip is ATOMIC with `open` — closing restores the own context in the
   * same render pass (no flash of the previously inspected player).
   */
  const railPlayer = computed((): PublicPlayerModel => {
    return infoModeState.open ? shell.inspectedPlayer : shell.thisPlayer;
  });

  const railShowsSelf = computed((): boolean => {
    return railPlayer.value.color === shell.thisPlayer.color;
  });

  /**
   * The rail displays the MARSBOT seat (only possible while the workspace
   * inspects it) — hand it the public Automa state so the rail swaps to
   * the dedicated bot presentation (real economy + printed tracks).
   */
  const railAutoma = computed((): MarsBotModel | undefined => {
    return infoModeState.open && railPlayer.value.isMarsBot === true ?
      shell.playerView.game.automa : undefined;
  });

  /** The game rule hides opponents' scores → the rail masks the VP cell
   *  while a HUMAN opponent is inspected (same gate as the panel's
   *  vpVisible). The bot's score is open information by the Automa rules
   *  — the server ships its real breakdown, and the panel shows it, so a
   *  masked rail cell would contradict the workspace one column over. */
  const railVpHidden = computed((): boolean => {
    return !railShowsSelf.value && railPlayer.value.isMarsBot !== true &&
      shell.game.gameOptions.showOtherPlayersVP !== true;
  });

  return {
    railTrVeto,
    railPristarMark,
    railRatingSkipMark,
    railPlayer,
    railShowsSelf,
    railAutoma,
    railVpHidden,
  };
}

export type RailController = ReturnType<typeof createRailController>;
