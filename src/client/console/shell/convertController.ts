/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CONVERSIONS CONTROLLER — plants → greenery and heat → temperature as the shell reads them: ready, futile,
 * vetoed, refused (each mirrors the server's option — invariant 2), and the plants conversion's pending placement.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import {computed} from 'vue';
import {scopedState} from '@/client/console/session/scopedState';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {RatingRefusalSource, ratingRefusalOfEffects} from '@/client/console/ratingRefusal';
import {ConvertPlantsMatch, findConvertHeatOption, findConvertPlantsOption} from '@/client/console/turnIntents';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type ConvertPort = {
  readonly playerView: PlayerViewModel,
  readonly thisPlayer: PublicPlayerModel,
};

export function createConvertController(shell: ConvertPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const convertPlantsPending = scopedState('convert-plants-pending', undefined as ConvertPlantsMatch | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The server offers convert-plants RIGHT NOW — drives BOTH the resource-
   *  cell highlight and the LT quick menu. Server-authoritative (mirrors the
   *  desktop convert availability), so it's live only on the viewer's turn. */
  const convertPlantsReady = computed((): boolean => {
    return findConvertPlantsOption(shell.playerView.waitingFor, shell.thisPlayer.canConvertPlants === true) !== undefined;
  });

  /** The server offers convert-heat RIGHT NOW (same contract as above). */
  const convertHeatReady = computed((): boolean => {
    return findConvertHeatOption(shell.playerView.waitingFor) !== undefined;
  });

  /** …and it would change nothing (the temperature at its maximum — the option's own `futile` verdict): the reason key. */
  const convertHeatFutile = computed((): string | undefined => {
    return findConvertHeatOption(shell.playerView.waitingFor)?.option.metadata?.futile?.reason;
  });

  /** The heat conversion's rating is refused — by the standing law (RX42) or a card's skip (P57): its own struck chip says so. */
  const convertHeatVetoed = computed((): boolean => {
    return (findConvertHeatOption(shell.playerView.waitingFor)?.option.metadata?.effects ?? []).some((e) => e.vetoed !== undefined);
  });

  /** WHO refuses the heat conversion's rating — the law (RX42) or a card's skip (P57): the wheel's note names it. */
  const convertHeatRefusal = computed((): RatingRefusalSource | undefined => {
    return ratingRefusalOfEffects(findConvertHeatOption(shell.playerView.waitingFor)?.option.metadata?.effects ?? []);
  });

  // ── placement ───────────────────────────────────────────────────────
  /** The convert-plants inner SelectSpace, narrowed for the headless picker. */
  const convertPlantsPrompt = computed(() => {
    const p = convertPlantsPending.value?.spacePrompt;
    return p !== undefined && p.type === 'space' ? p : undefined;
  });

  return {
    convertPlantsPending,
    convertPlantsReady,
    convertHeatReady,
    convertHeatFutile,
    convertHeatVetoed,
    convertHeatRefusal,
    convertPlantsPrompt,
  };
}

export type ConvertController = ReturnType<typeof createConvertController>;
