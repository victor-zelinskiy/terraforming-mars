<!--
@console-shared LIVE — the game screen stands on this file.
-->
<template>
  <!--
    THE BOARD-INPUT BINDER — the one thing the transport still renders
    (everything else lives in console/transport/gameTransport.ts, where the
    poll chain / submit funnel / cinematic gates / view apply moved in the
    transport rework; this component is the transport's LIFECYCLE OWNER and
    the mount point of the legacy SelectSpace board binder).

    For a top-level SelectSpace prompt the legacy SelectSpace mounts so its
    `mounted()` can attach the board cell handlers (`.board-space--available`
    highlight + per-cell onclick — the console's one tile-submit path, and
    the single arming point of the console placement hero inside its
    `saveData()`). The hold disjunction keeps the binder down during the
    transport's cinematic gates and during the console's own placement
    admission hold — exactly the windows that must not accept a board press.
  -->
  <div>
    <SelectSpace v-if="spaceBinderActive && topLevelSpaceInput !== undefined"
                 :playerView="binderView"
                 :playerinput="topLevelSpaceInput"
                 :onsave="submit"
                 :showsave="false"
                 :showtitle="false" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {vueRoot} from '@/client/components/vueRoot';
import {PlayerInputModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Phase} from '@/common/Phase';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {clearIfPhaseLeftCardPick, clearDraftWaitPending} from '@/client/components/draftWaitState';
import {isConsolePlacementHeld} from '@/client/console/consolePromptAdmission';
import {
  TransportRoot,
  startGameTransport,
  stopGameTransport,
  submitInput,
  syncTurnPresentation,
  transportHolding,
} from '@/client/console/transport/gameTransport';

export default defineComponent({
  name: 'console-board-binder',
  components: {
    SelectSpace,
  },
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    waitingfor: {
      type: Object as () => PlayerInputModel | undefined,
      default: undefined,
    },
  },
  /*
   * Phase watcher — the SOLE clearing path for `draftWaitState`. Runs
   * immediately on mount so a freshly-mounted binder reconciles the flag
   * against the current server phase right away. clearIfPhaseLeftCardPick is
   * a no-op while phase is RESEARCH / DRAFTING / INITIALDRAFTING; once the
   * server reports a non-card-pick phase the flag clears. If the game ends,
   * defensively clear regardless of phase.
   */
  watch: {
    'playerView.game.phase': {
      immediate: true,
      handler(newPhase: Phase) {
        if (newPhase === Phase.END) {
          clearDraftWaitPending();
        } else {
          clearIfPhaseLeftCardPick(newPhase);
        }
      },
    },
    /*
     * Turn presentation (document title / favicon / the ◑◒◐◓ title spinner)
     * follows the PROMPT reactively — re-sync whenever `waitingfor` changes
     * (immediate covers the initial mount).
     */
    'waitingfor': {
      immediate: true,
      handler() {
        syncTurnPresentation();
      },
    },
  },
  methods: {
    submit(out: InputResponse): void {
      submitInput(out);
    },
  },
  mounted() {
    // The App root satisfies the narrow TransportRoot contract structurally.
    startGameTransport(vueRoot(this) as unknown as TransportRoot);
    // The watcher above ran before mounted() (immediate) — re-sync now that
    // the transport owns the title/favicon state.
    syncTurnPresentation();
  },
  unmounted() {
    stopGameTransport();
  },
  computed: {
    /** The ONE thing this component still renders (see the template note). */
    spaceBinderActive(): boolean {
      return !transportHolding() && !this.holdingForConsolePlacement && this.topLevelSpaceInput !== undefined;
    },
    /** A top-level space prompt only ever exists for a PLAYER view — the
     *  narrowing the binder's props need. */
    binderView(): PlayerViewModel {
      return this.playerView as PlayerViewModel;
    },
    // The current waitingfor when it's a top-level SelectSpace (server-driven
    // mandatory tile placement — standard projects, action card placements,
    // …): mounts the headless board binder. Nested SelectSpace prompts
    // (inside OrOptions like convert-plants or WGT) are NOT detected here —
    // the console shell hosts its own headless instances for those.
    topLevelSpaceInput(): SelectSpaceModel | undefined {
      const wf = this.waitingfor;
      if (wf === undefined || wf.type !== 'space') {
        return undefined;
      }
      return wf;
    },
    /*
     * CONSOLE PROMPT ADMISSION: the console holds a server placement behind a
     * running cinematic (a drawn-cards reveal, a hero scene, cards still
     * flying into the dock — see consolePromptAdmission.ts). Blanking the
     * render unmounts the SelectSpace binder (and the highlight it paints);
     * the highlight re-paints when the console re-admits the placement.
     */
    holdingForConsolePlacement(): boolean {
      return this.topLevelSpaceInput !== undefined && isConsolePlacementHeld();
    },
  },
});
</script>
