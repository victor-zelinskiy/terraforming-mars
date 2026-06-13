<template>
  <!--
    App-level REVEAL-RESULT overlay. Mounted next to DraftFlowOverlay /
    StartGameFlowOverlay so it survives App.vue's `playerkey` remount — the very
    server response that carries the reveal result also remounts <player-home>, so
    the result can't live inside it. It MIRRORS the action-confirm modal's CURRENT
    layout EXACTLY (the composed 2-column `.action-confirm__top2`: the compact
    source card on the LEFT, the action graphic + description + the reveal slot in
    the RIGHT `act-panel`) so the revealed card appears in the SAME spot the empty
    slot occupied in the confirm modal — a seamless continuation, not a new modal
    with a different layout.

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

            <div class="action-confirm__main">
              <!-- SAME composed 2-column top as CardActionConfirmContent so the
                   empty slot (confirm) and the revealed card (here) share the spot. -->
              <div class="action-confirm__top2">
                <aside class="action-confirm__src">
                  <span class="action-confirm__src-label" v-i18n>Source</span>
                  <!-- autoTall mirrors the confirm modal's source card: the card grows
                       to fit its text instead of squeezing behind an inner scrollbar. -->
                  <div v-if="sourceCard !== undefined" class="action-confirm__src-card action-confirm__src-card--static">
                    <Card :key="revealResultState.cardName" :card="sourceCard" :autoTall="true" />
                  </div>
                </aside>

                <section class="action-confirm__act-panel">
                  <span class="action-confirm__summary-label" v-i18n>You are about to</span>

                  <div v-if="actionNode !== undefined" class="action-confirm__act-graphic">
                    <CompactActionCard :node="actionNode"
                                       title=""
                                       status="available"
                                       :interactive="false" />
                  </div>

                  <p v-if="actDescription !== ''" class="action-confirm__act-desc" v-i18n v-strip-action-prefix>{{ actDescription }}</p>

                  <ActionRevealSlot :state="slotState"
                                    :reveal="revealResultState.descriptor"
                                    :result="result" />
                </section>
              </div>
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
import {ActionGroup, playerActionGroups, actionNodeDescription} from '@/client/components/actions/actionExtraction';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import Card from '@/client/components/card/Card.vue';
import CompactActionCard from '@/client/components/actions/CompactActionCard.vue';
import ActionRevealSlot from '@/client/components/actions/ActionRevealSlot.vue';

type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'RevealResultOverlay',
  components: {Card, CompactActionCard, ActionRevealSlot},
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
    // SAME way the confirm modal does (group.nodes[0] → CompactActionCard), so the
    // right column matches the confirm modal pixel-for-pixel.
    actionNode(): GroupNode | undefined {
      if (revealResultState.cardName === undefined) {
        return undefined;
      }
      const group = playerActionGroups([{name: revealResultState.cardName} as CardModel])[0];
      return group?.nodes[0];
    },
    // The action's full description text, shown inline under the graphic — exactly
    // like the confirm modal's `actDescription`.
    actDescription(): string {
      return this.actionNode !== undefined ? actionNodeDescription(this.actionNode) : '';
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
