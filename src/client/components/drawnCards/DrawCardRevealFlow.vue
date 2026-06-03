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
  },
  watch: {
    fullscreenCard(card: CardModel | undefined) {
      if (card !== undefined) {
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
    takeFromFullscreen(): void {
      const fs = drawnCardsState.fullscreen;
      if (fs === null) {
        return;
      }
      const index = fs.index;
      // Close the fullscreen dialog and clear it first, then take the card. If
      // it was the LAST card, take() closes the whole modal (the player, already
      // in fullscreen, never sees an empty tray); otherwise we return to the
      // modal with the remaining cards.
      (this.$refs.zoom as any)?.close?.();
      drawnCardsState.fullscreen = null;
      this.take(index);
    },
  },
});
</script>
