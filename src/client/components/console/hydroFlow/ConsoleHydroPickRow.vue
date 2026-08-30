<template>
  <div class="con-hydro__summary con-hydro__pickrow"
       :class="{
         'con-hydro__summary--focused': focused && !fizzled,
         'con-hydro__pickrow--missing': missing,
         'con-hydro__pickrow--fizzled': fizzled,
         'con-hydro__pickrow--conflict': conflictReason !== '',
       }"
       data-unfold-item
       :role="fizzled ? undefined : 'button'"
       @click="fizzled ? undefined : $emit('open')">
    <!-- ONE composition in EVERY state: the eyebrow on its OWN line, then the
         action row — glyph slot first, then the state's content. The eyebrow
         used to share a wrapping flex line with the body, so it sat inline
         beside a short «choose» and above a long chosen graphic: the row
         re-composed itself on every state (and focus) change. -->
    <span class="con-hydro__section-label">
      {{ $t(labelKey) }}<template v-if="stageLabel !== ''"> · {{ stageLabel }}</template>
    </span>
    <span class="con-hydro__pickrow-body">
      <!-- THE GLYPH SLOT IS PERMANENT; the badge's VISIBILITY follows the
           cursor (only the focused affordance wears the cap — the quick
           wheel's own rule, which keeps exactly one lit «A» on screen).
           Hidden with footprint preserved, never unmounted: a badge that
           mounts on focus re-wraps the line under the cursor. -->
      <span class="con-glyphslot"
            :class="{'con-glyphslot--ghost': !focused || fizzled}"
            aria-hidden="true">
        <GamepadGlyph control="confirm" />
      </span>

      <!-- NOTHING TO CHOOSE — the honest dead end, never a «choose first». -->
      <span v-if="fizzled" class="con-hydro__summary-body con-hydro__summary-body--fizzled">
        <span class="con-hydro__pickwarn-mark" aria-hidden="true">⚑</span>
        <span>{{ $t('This reward will be skipped') }} — {{ $t(fizzleKey) }}</span>
      </span>

      <!-- pos 7: the chosen action — the SAME branch block the Actions
           workspace draws on its tiles (`stripNodeOr`), never the whole
           card's action group. -->
      <span v-else-if="kind === 'reuse-action' && card !== undefined && node !== undefined"
            class="con-composer__repeatpick con-hydro__pick-action">
        <span class="con-composer__repeatpick-graphic card-container" v-i18n v-strip-action-prefix>
          <CardRenderEffectBoxComponent v-if="node.actionNode !== undefined" :effectData="node.actionNode" />
          <CardRenderData v-else-if="node.renderRoot !== undefined" :renderData="node.renderRoot" />
          <span v-else class="con-composer__graphic-text">{{ node.text }}</span>
        </span>
        <span class="con-composer__repeatpick-name">{{ $t(card) }}</span>
        <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
      </span>

      <!-- pos 1/2 on a traversal: the CHOSEN alternative's own printed chips. -->
      <span v-else-if="kind === 'reward-choice' && chips !== undefined" class="con-hydro__summary-body">
        <HydroReward :chips="chips" :compact="true" />
        <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
      </span>

      <!-- pos 9: the chosen target card + the honest count. -->
      <span v-else-if="card !== undefined" class="con-hydro__summary-body">
        <b>{{ $t(card) }}</b>
        <span v-if="animalCurrent !== undefined" class="con-hydro__pick-cur">
          <span class="card-resource card-resource-animal" aria-hidden="true"></span>
          {{ animalCurrent }} <span aria-hidden="true">→</span> {{ animalCurrent + 2 }}
        </span>
        <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
      </span>

      <!-- UNCHOSEN — the press IS the content. -->
      <span v-else class="con-hydro__summary-body con-hydro__summary-body--empty">
        <span>{{ $t(chooseKey) }}</span>
      </span>
    </span>
    <!-- THE PLAN'S CONFLICT, named IN PLACE: the promise stands (the summary
         stays — never a silent clearing), the register says it cannot be
         kept, and the reason names the short resource. A = change it. -->
    <span v-if="conflictReason !== ''" class="con-hydro__pickrow-conflict" role="status">
      <span class="con-hydro__pickwarn-mark" aria-hidden="true">⚠</span>
      <span>{{ $t(conflictReason) }}</span>
    </span>
  </div>
</template>

<script lang="ts">
/*
 * THE LANDED STAGE'S PRE-SELECT — ONE row, both roads onto the track.
 *
 * Positions 7 (repeat a used blue action) and 9 (which card receives the
 * animals) defer a `SelectCard` the rules do not let anyone skip. This is
 * where it is answered, and it reads the same whether the move is the
 * player's own advance or a card's bonus offer — the same label, the same
 * branch graphic the Actions workspace draws, the same focus ring, the same
 * verbs. Two similar rows in two scenes is exactly how they drifted.
 *
 * THREE STATES, and the row never lies about which it is in:
 * · NOTHING TO CHOOSE — the server offered no candidate, so the reward
 * fizzles. The row states THAT and offers no press: telling a player to
 * «choose an action first» when there is physically nothing to choose is
 * an instruction they cannot follow.
 * · UNCHOSEN — the press is the point, so the row wears the amber owed
 * register and names the verb.
 * · CHOSEN — the branch's own printed graphic + the card's name + a tick.
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {$t} from '@/client/directives/i18n';
import {HydroStage} from '@/client/components/hydronetwork/hydroStages';
import {HYDRO_PICK_COPY, HydroPickKind} from '@/client/console/hydroFlow/hydroDecisionRail';

type GroupNode = ActionGroup['nodes'][number];

// The copy table and the kind union live in the PURE rail model
// (`hydroDecisionRail.ts`) — one source for the card, the section and the
// specs. Re-exported so existing importers keep their path.
export {HYDRO_PICK_COPY};
export type {HydroPickKind};

export default defineComponent({
  name: 'ConsoleHydroPickRow',
  components: {CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph, HydroReward},
  directives: {stripActionPrefix},
  props: {
    kind: {type: String as PropType<HydroPickKind>, required: true},
    /** The chosen card, or undefined while the question stands. */
    card: {type: String as PropType<CardName>, default: undefined},
    /** The chosen action's own branch node (already `stripNodeOr`-ed). */
    node: {type: Object as PropType<GroupNode>, default: undefined},
    /** pos 9: the target's live animal count, for the honest «сейчас → станет». */
    animalCurrent: {type: Number, default: undefined},
    /** `reward-choice`: the CHOSEN alternative's printed chips (the summary). */
    chips: {type: Array as PropType<HydroStage['rewardOptions'][number]>, default: undefined},
    /** A traversal decision names its stage — «Награда этапа · Плотина». */
    stageLabel: {type: String, default: ''},
    focused: {type: Boolean, default: false},
    /** The server offered NO candidate — the reward fizzles and nothing is owed. */
    fizzled: {type: Boolean, default: false},
    /** The ordered plan cannot keep this pick (i18n key) — '' = no conflict. */
    conflictReason: {type: String, default: ''},
  },
  emits: ['open'],
  computed: {
    copy(): (typeof HYDRO_PICK_COPY)[HydroPickKind] {
      return HYDRO_PICK_COPY[this.kind];
    },
    labelKey(): string {
      return this.copy.label;
    },
    chooseKey(): string {
      return this.copy.choose;
    },
    fizzleKey(): string {
      return this.copy.fizzle;
    },
    missing(): boolean {
      return !this.fizzled && this.card === undefined;
    },
  },
  methods: {$t},
});
</script>
