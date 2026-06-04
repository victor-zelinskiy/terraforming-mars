<template>
  <div>
    <!--
      Backdrop (blurred) + centered card. Teleported to body so it escapes any
      ancestor clip-path / transform (the whole #player-home subtree applies
      several). Backdrop has NO dismiss handler and there is NO minimize — the
      reveal is fully mandatory; the only exit is taking the cards. On close the
      whole subtree unmounts (v-if), removing the blur instantly; the КАРТЫ
      delta-chip is released a couple of frames later (see closeAndRelease) so
      it lands on a clear, un-blurred screen.
    -->
    <Teleport to="body">
      <div class="draw-reveal">
        <div class="draw-reveal__backdrop"></div>

        <div v-if="activeEvent" ref="card" class="draw-reveal__card">
          <span class="draw-reveal__corner draw-reveal__corner--tl" aria-hidden="true"></span>
          <span class="draw-reveal__corner draw-reveal__corner--tr" aria-hidden="true"></span>
          <span class="draw-reveal__corner draw-reveal__corner--bl" aria-hidden="true"></span>
          <span class="draw-reveal__corner draw-reveal__corner--br" aria-hidden="true"></span>

          <header class="draw-reveal__header">
            <span class="draw-reveal__pulse" aria-hidden="true"></span>
            <h2 class="draw-reveal__title" v-i18n>Cards received</h2>
          </header>

          <!--
            `:key="activeEvent.id"` so advancing to the next queued batch
            remounts the content → its transition-group `appear` re-deals the
            new cards instead of diffing against the previous batch.
          -->
          <DrawCardRevealContent
            :key="activeEvent.id"
            :event="activeEvent"
            @open="openFullscreen"
            @take-all="takeAll" />
        </div>
      </div>
    </Teleport>

    <!--
      Fullscreen viewer (reuses the shared CardZoomModal — native <dialog>,
      top layer above everything). Single ВЗЯТЬ in the #actions slot takes
      that one card and returns to the modal (or closes it if it was the last).
    -->
    <CardZoomModal v-if="fullscreenCard"
                   ref="zoom"
                   :card="fullscreenCard"
                   :cards="navCards"
                   @navigate="onZoomNavigate"
                   @close="onFullscreenClosed">
      <template #actions>
        <button type="button"
                class="card-zoom-actions__btn card-zoom-actions__btn--primary draw-reveal__fs-take"
                @click="takeFromFullscreen">
          <span v-i18n>Take card</span>
        </button>
      </template>
    </CardZoomModal>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {paths} from '@/common/app/paths';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import DrawCardRevealContent from '@/client/components/drawnCards/DrawCardRevealContent.vue';
import {
  drawnCardsState,
  DrawnCardEntry,
  currentRevealEvent,
  markCardTaken,
  markAllTaken,
  setAcking,
  dismissEvent,
} from '@/client/components/drawnCards/drawnCardsState';

export default defineComponent({
  name: 'DrawCardRevealFlow',
  components: {CardZoomModal, DrawCardRevealContent},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  computed: {
    // The batch currently shown — the oldest non-dismissed batch with cards
    // still to take. Undefined once the last batch is dismissed, which (with the
    // App-level v-if) unmounts the modal at once.
    activeEvent(): DrawnCardEntry | undefined {
      return currentRevealEvent();
    },
    fullscreenCard(): CardModel | undefined {
      const fs = drawnCardsState.fullscreen;
      if (fs === null) {
        return undefined;
      }
      const e = drawnCardsState.events.find((ev) => ev.id === fs.eventId);
      return e?.cards[fs.index];
    },
    // The UNTAKEN cards of the active batch, in tray order — the list the
    // fullscreen viewer navigates. Taken cards are excluded (the modal only
    // browses what's still on offer, mirroring the tray).
    navCards(): ReadonlyArray<CardModel> {
      const e = this.activeEvent;
      if (e === undefined) {
        return [];
      }
      return this.untakenEntriesOf(e).map((x) => x.card);
    },
  },
  watch: {
    /*
     * Open the dialog only on the OPEN transition (undefined → a card).
     * Navigating WITHIN fullscreen changes `fullscreenCard` (the parent
     * mirror of the current card) defined → defined — re-calling show() there
     * would reset the viewer's index + re-fit, breaking navigation.
     */
    fullscreenCard(card: CardModel | undefined, prev: CardModel | undefined) {
      if (card !== undefined && prev === undefined) {
        this.$nextTick(() => (this.$refs.zoom as any)?.show?.());
      }
    },
  },
  mounted() {
    document.documentElement.classList.add('draw-reveal-open');
    document.body.classList.add('draw-reveal-open');
  },
  beforeUnmount() {
    document.documentElement.classList.remove('draw-reveal-open');
    document.body.classList.remove('draw-reveal-open');
  },
  methods: {
    take(index: number): void {
      const e = this.activeEvent;
      if (e === undefined) {
        return;
      }
      const id = e.id;
      const isLast = (e.cards.length - e.takenIndices.size) <= 1;
      if (isLast) {
        // Last card → close the modal (remove blur) first, then release the
        // hand-staging + ack after the blur has painted out.
        this.closeAndRelease(id, () => markCardTaken(id, index));
      } else {
        // Partial take (multi-card via fullscreen) — the modal stays open, so
        // there's no close to sequence against; mark immediately.
        markCardTaken(id, index);
      }
    },
    takeAll(): void {
      const e = this.activeEvent;
      if (e === undefined) {
        return;
      }
      this.closeAndRelease(e.id, () => markAllTaken(e.id));
    },
    /*
     * Close the modal NOW (dismiss → the whole flow unmounts via the App-level
     * v-if → the blurred backdrop is removed from the DOM), then release the
     * hand-staging (`releaseFn` marks the cards taken, which raises the КАРТЫ
     * count and fires its delta-chip) only AFTER the blur has actually been
     * painted out. Two nested rAFs guarantee at least one painted frame without
     * the backdrop before the chip animates, so it reads on a clear screen.
     * Both callbacks call module functions / a captured `view`, never `this`
     * reactive state, so they're safe to run after this component unmounts.
     */
    closeAndRelease(id: number, releaseFn: () => void): void {
      const ev = drawnCardsState.events.find((e) => e.id === id);
      if (ev === undefined || ev.acking) {
        return;
      }
      setAcking(id, true);
      const view = this.playerView;
      dismissEvent(id);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        releaseFn();
        this.ackEvent(view, id);
      }));
    },
    ackEvent(view: PlayerViewModel, id: number): void {
      // Pure fire-and-forget. The batch is already dismissed (modal closed), so
      // this independent endpoint only clears the server's transient queue. We
      // deliberately do NOT apply the response / bump playerkey: that PlayerHome
      // remount could cut the КАРТЫ delta-chip that just fired. The lingering
      // (hidden) store entry is reconciled out by the next regular playerView
      // poll / the player's next input.
      fetch(
        paths.ACKNOWLEDGE_DRAW + '?id=' + view.id + '&revealId=' + id,
        {method: 'POST'},
      )
        .then((resp) => {
          if (!resp.ok) {
            setAcking(id, false);
            console.warn('acknowledge-draw failed', resp.status);
          }
        })
        .catch((err) => {
          setAcking(id, false);
          console.error(err);
        });
    },
    // The untaken cards of a batch, paired with their full-array index, in
    // tray order. Both the nav list and the take mapping derive from this so
    // they never drift.
    untakenEntriesOf(e: DrawnCardEntry): Array<{card: CardModel, index: number}> {
      const out: Array<{card: CardModel, index: number}> = [];
      e.cards.forEach((card, index) => {
        if (!e.takenIndices.has(index)) {
          out.push({card, index});
        }
      });
      return out;
    },
    openFullscreen(index: number): void {
      const e = this.activeEvent;
      if (e === undefined) {
        return;
      }
      drawnCardsState.fullscreen = {eventId: e.id, index};
    },
    onFullscreenClosed(): void {
      drawnCardsState.fullscreen = null;
    },
    // The viewer navigated to a different untaken card — mirror the current
    // card into `fullscreen.index` (a FULL-array index) so the ВЗЯТЬ action
    // always takes exactly what's on screen.
    onZoomNavigate(_card: CardModel, pos: number): void {
      const e = this.activeEvent;
      if (e === undefined || drawnCardsState.fullscreen === null) {
        return;
      }
      const entry = this.untakenEntriesOf(e)[pos];
      if (entry !== undefined) {
        drawnCardsState.fullscreen = {eventId: e.id, index: entry.index};
      }
    },
    takeFromFullscreen(): void {
      const fs = drawnCardsState.fullscreen;
      const e = this.activeEvent;
      if (fs === null || e === undefined) {
        return;
      }
      const list = this.untakenEntriesOf(e);
      const pos = list.findIndex((x) => x.index === fs.index);
      if (pos < 0) {
        return;
      }
      const fullIndex = fs.index;
      // Last untaken card → close the fullscreen and let take() close the whole
      // reveal modal, so the player never lands on an empty tray.
      if (list.length <= 1) {
        (this.$refs.zoom as any)?.close?.();
        drawnCardsState.fullscreen = null;
        this.take(fullIndex);
        return;
      }
      // Otherwise stay in fullscreen and advance to the next untaken card: mark
      // this one taken (no modal close), then point fullscreen at the neighbour
      // that slides into the same slot (or the new last card). The viewer's own
      // list-shrink watcher plays the "consume" swap to the next card.
      markCardTaken(e.id, fullIndex);
      const after = this.untakenEntriesOf(e);
      const nextPos = Math.min(pos, after.length - 1);
      drawnCardsState.fullscreen = {eventId: e.id, index: after[nextPos].index};
    },
  },
});
</script>
