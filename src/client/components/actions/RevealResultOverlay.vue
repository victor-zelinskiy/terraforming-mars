<template>
  <!--
    App-level REVEAL-RESULT overlay. Mounted next to DraftFlowOverlay /
    StartGameFlowOverlay so it survives App.vue's `playerkey` remount — the very
    server response that carries the reveal result also remounts <player-home>, so
    the result can't live inside it. It MIRRORS the action-confirm modal's layout
    EXACTLY (same frame, same width, the source card + reveal slot in the LEFT
    column, the action graphic on the right) so the revealed card appears in the
    SAME spot the empty slot occupied — a seamless continuation, not a new modal.

    Shown only while `revealResultState.active` (set on confirm). It bridges the
    server round-trip: the slot is `pending` immediately, then `result` once
    `lastReveal` (matching the action) arrives.
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
                <ActionRevealSlot :state="slotState" :reveal="revealResultState.descriptor" :result="result" />
              </aside>

              <section class="action-confirm__action">
                <div class="action-confirm__summary">
                  <span class="action-confirm__summary-label" v-i18n>You are about to</span>
                  <div class="action-confirm__section" v-if="actionNode !== undefined">
                    <span class="action-confirm__section-label" v-i18n>Action</span>
                    <div class="action-confirm__graphic">
                      <div class="action-confirm__render card-container" v-i18n v-strip-action-prefix>
                        <CardRenderEffectBoxComponent v-if="actionNode.actionNode !== undefined" :effectData="actionNode.actionNode" />
                        <CardRenderData v-else-if="actionNode.renderRoot !== undefined" :renderData="actionNode.renderRoot" />
                        <span v-else-if="actionNode.text">{{ actionNode.text }}</span>
                      </div>
                    </div>
                  </div>
                </div>
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
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import Card from '@/client/components/card/Card.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ActionRevealSlot from '@/client/components/actions/ActionRevealSlot.vue';

type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'RevealResultOverlay',
  components: {Card, CardRenderEffectBoxComponent, CardRenderData, ActionRevealSlot},
  directives: {stripActionPrefix},
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
    // The source card's printed action graphic — derived from the manifest the
    // SAME way the confirm modal does, so the right column matches it pixel-for-pixel.
    actionNode(): GroupNode | undefined {
      if (revealResultState.cardName === undefined) {
        return undefined;
      }
      const group = playerActionGroups([{name: revealResultState.cardName} as CardModel])[0];
      return group?.nodes[0];
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
