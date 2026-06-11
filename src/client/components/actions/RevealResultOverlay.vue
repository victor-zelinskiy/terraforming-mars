<template>
  <!--
    App-level REVEAL-RESULT overlay. Mounted next to DraftFlowOverlay /
    StartGameFlowOverlay so it survives App.vue's `playerkey` remount — the very
    server response that carries the reveal result also remounts <player-home>, so
    the result can't live inside it. Reuses the `.action-confirm` frame so it reads
    as a seamless continuation of the action-confirm modal: same chrome, the reveal
    slot now filled, the CTA flipped to «ОК».

    Shown only while `revealResultState.active` (set on confirm). It bridges the
    server round-trip: `pending` slot immediately, then the `result` once
    `thisPlayer.lastReveal` (matching the action) arrives.
  -->
  <Teleport to="body">
    <div v-if="revealResultState.active" class="reveal-overlay">
      <div class="reveal-overlay__backdrop"></div>

      <div class="reveal-overlay__card">
        <div class="action-confirm">
          <div class="action-confirm__frame">
            <div class="action-confirm__corner action-confirm__corner--tl" aria-hidden="true"></div>
            <div class="action-confirm__corner action-confirm__corner--tr" aria-hidden="true"></div>
            <div class="action-confirm__corner action-confirm__corner--bl" aria-hidden="true"></div>
            <div class="action-confirm__corner action-confirm__corner--br" aria-hidden="true"></div>

            <header class="action-confirm__header">
              <span class="action-confirm__kicker">
                <span class="action-confirm__kicker-dot" aria-hidden="true"></span>
                <span class="action-confirm__kicker-text" v-i18n>{{ kicker }}</span>
              </span>
              <h3 class="action-confirm__title" v-i18n>Activate card action</h3>
            </header>

            <div class="action-confirm__top">
              <aside class="action-confirm__source" v-if="sourceCard !== undefined">
                <span class="action-confirm__source-label" v-i18n>Source</span>
                <div class="action-confirm__card action-confirm__card--static">
                  <Card :card="sourceCard" />
                </div>
              </aside>

              <section class="action-confirm__action reveal-overlay__action">
                <ActionRevealSlot :state="slotState" :reveal="revealResultState.descriptor" :result="result" />
              </section>
            </div>

            <footer class="action-confirm__footer">
              <div class="action-confirm__actions">
                <button class="action-confirm__confirm cab-action-confirm-go"
                        :disabled="result === undefined"
                        @click="dismiss"
                        data-test="reveal-ok">
                  <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
                  <span class="cab-action-confirm-go__label" v-i18n>{{ result === undefined ? 'Revealing card…' : 'OK' }}</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import Card from '@/client/components/card/Card.vue';
import ActionRevealSlot from '@/client/components/actions/ActionRevealSlot.vue';

export default defineComponent({
  name: 'RevealResultOverlay',
  components: {Card, ActionRevealSlot},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  data() {
    return {revealResultState};
  },
  computed: {
    // The live result, only when it matches the action we're showing (so a stale
    // lastReveal from a different action never leaks in).
    result(): RevealResultModel | undefined {
      const lr = this.playerView.lastReveal;
      if (lr === undefined || lr.action !== revealResultState.action) {
        return undefined;
      }
      return lr;
    },
    slotState(): 'pending' | 'result' {
      return this.result === undefined ? 'pending' : 'result';
    },
    sourceCard(): CardModel | undefined {
      return revealResultState.cardName === undefined ? undefined : ({name: revealResultState.cardName} as CardModel);
    },
    kicker(): string {
      return this.result === undefined ? 'Action confirmation' : 'Action result';
    },
  },
  methods: {
    dismiss(): void {
      dismissReveal();
    },
  },
});
</script>
