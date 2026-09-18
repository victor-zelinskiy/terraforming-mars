<template>
  <!-- CHAIRMAN SEAT — the mandatory pick: every delegate of the viewer's is on
       a resolution; ◀ ▶ walk the candidate cards, A takes the delegate off the
       focused one for the seat. -->
  <div class="con-parl__stage-head">
    <div>
      <b class="con-parl__stage-title">{{ $t('You completed the chairman quest') }}</b>
      <span class="con-parl__stage-sub">{{ $t('Every delegate of yours is on a resolution — choose which one gives a delegate up for the seat.') }}</span>
    </div>
    <span class="con-parl__stage-nav" aria-hidden="true">◀ ▶</span>
  </div>
  <div class="con-parl__stage-body">
    <div class="con-parl__txn">
      <div class="con-parl__txn-row">
        <span class="con-parl__chip-dim">{{ $t('Resolution') }}</span>
        <b>{{ $t(resolutionTitle(slot.resolutionId)) }}</b>
      </div>
      <div class="con-parl__txn-row">
        <span class="con-parl__chip-dim">{{ $t('Your delegates there') }}</span>
        <b>{{ slot.viewerVotes }} → {{ slot.viewerVotes - 1 }}</b>
      </div>
      <div class="con-parl__txn-row">
        <span class="con-parl__chip-dim">{{ $t('Chairman seat') }}</span>
        <span class="con-parl__txn-val"><PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" /><b>{{ $t('yours') }}</b></span>
      </div>
    </div>
  </div>
  <div class="con-parl__cta" :class="{'con-parl__cta--ready': flow.stage === 'seat', 'con-parl__cta--busy': flow.stage === 'submitting'}" data-parl-cta @click="submit()">
    <GamepadGlyph control="confirm" class="con-parl__cta-glyph" />
    <span class="con-parl__cta-label">{{ $t(flow.stage === 'submitting' ? 'Performing…' : 'Take the delegate') }}</span>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow, parliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {ParliamentSlotVm, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {ParliamentInspectRequest, slotFaceOf} from '@/client/console/parliament/parliamentInspect';
import {rectOf} from '@/client/console/parliament/parliamentFlights';
import type {Rect} from '@/client/console/parliament/consoleParliamentVoteMotion';

/**
 * The chairman SEAT stage — a mandatory pick rendered inside the middle
 * tier's stage zone. It owns its own grammar (◀ ▶ over the candidates, X
 * inspects, A submits — with the rect of the cube that leaves the card, the
 * flight's source); the send itself is the section's, because the delegate
 * flies from the card only once the server has answered.
 */
export default defineComponent({
  name: 'ConsoleParliamentSeatPick',
  components: {PlayerCube, GamepadGlyph},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    /** The focused candidate slot. */
    slot: {type: Object as PropType<ParliamentSlotVm>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The candidate slots (indices) the server offers. */
    seatCandidates: {type: Array as PropType<ReadonlyArray<number>>, default: () => []},
  },
  emits: ['submit', 'inspect'],
  computed: {
    flow() {
      return parliamentFlow;
    },
  },
  methods: {
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    resolutionTitle(id: string): string {
      return resolutionTitleOf(this.view, id);
    },
    /** The stage's own verbs: ◀ ▶ over the candidates, X inspects the focused card, A takes the delegate. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const candidates = this.seatCandidates;
        if (candidates.length > 0) {
          const at = candidates.indexOf(parliamentFlow.slotIndex);
          const next = intent.dir === 'left' ? Math.max(0, at - 1) : intent.dir === 'right' ? Math.min(candidates.length - 1, at + 1) : at;
          parliamentFlow.slotIndex = candidates[next < 0 ? 0 : next];
        }
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'inspect') {
        this.inspect();
      } else if (action === 'primary') {
        this.submit();
      }
    },
    /** A: the cube that leaves the card for the seat is the viewer's newest one on it — its rect rides the submit. */
    submit(): void {
      const slot = this.slot;
      const me = this.viewerColor;
      const mine = slot.votes.filter((v) => v.owner === me).map((v) => v.seq);
      const seq = mine.length > 0 ? Math.max(...mine) : undefined;
      const cube = seq === undefined ? null : parliamentRootEl()?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${slot.instance}"] [data-seq="${seq}"]`) ?? null;
      const from: Rect | undefined = rectOf(cube);
      this.$emit('submit', from);
    },
    inspect(): void {
      const slot = this.slot;
      const request: ParliamentInspectRequest = {kind: 'resolution', ids: [slot.resolutionId], index: 0, origin: () => slotFaceOf(parliamentRootEl(), slot.instance)};
      this.$emit('inspect', request);
    },
  },
});
</script>
