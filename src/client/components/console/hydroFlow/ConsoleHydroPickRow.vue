<template>
  <div class="con-hydro__summary con-hydro__pickrow"
       :class="{
         'con-hydro__summary--focused': focused && !fizzled,
         'con-hydro__pickrow--missing': missing,
         'con-hydro__pickrow--fizzled': fizzled,
       }"
       data-unfold-item
       :role="fizzled ? undefined : 'button'"
       @click="fizzled ? undefined : $emit('open')">
    <span class="con-hydro__section-label">{{ $t(labelKey) }}</span>

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

    <!-- pos 9: the chosen target card + the honest count. -->
    <span v-else-if="card !== undefined" class="con-hydro__summary-body">
      <b>{{ $t(card) }}</b>
      <span v-if="animalCurrent !== undefined" class="con-hydro__pick-cur">
        <span class="card-resource card-resource-animal" aria-hidden="true"></span>
        {{ animalCurrent }} <span aria-hidden="true">→</span> {{ animalCurrent + 2 }}
      </span>
      <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
    </span>

    <!-- UNCHOSEN — the press IS the content.
         THE GLYPH FOLLOWS THE CURSOR: only the FOCUSED affordance wears the
         cap (the quick wheel's own rule). Drawn unconditionally it put a
         second «A» on screen beside the confirm's, so two buttons claimed the
         same press. -->
    <span v-else class="con-hydro__summary-body con-hydro__summary-body--empty">
      <GamepadGlyph v-if="focused" control="confirm" />
      <span>{{ $t(chooseKey) }}</span>
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
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {$t} from '@/client/directives/i18n';

type GroupNode = ActionGroup['nodes'][number];

/** Which pick the landed stage asks for. */
export type HydroPickKind = 'reuse-action' | 'animal-target';

/** The row's copy, keyed on the pick — ONE table, so the two scenes cannot
 *  word the same question differently.
 *
 *  TWO WARNINGS, because there are two honest outcomes and the copy may never
 *  promise the wrong one: `warn` POSTPONES the question (the DOB prompt door,
 *  whose answer is a bare option index and cannot carry a decision about the
 *  landing), `warnWaive` FORFEITS the reward (the player's own advance and a
 *  card's entry, whose batch carries `waiveReward` — «если не выбрал, значит
 *  не надо»). One table, so a door can only pick between them, never coin a
 *  third phrasing. */
export const HYDRO_PICK_COPY: Readonly<Record<HydroPickKind, {
  label: string, choose: string, change: string, fizzle: string,
  warn: string, warnWaive: string,
}>> = {
  'reuse-action': {
    label: 'Action to repeat',
    choose: 'Choose an action',
    change: 'Change the action',
    fizzle: 'No used actions to repeat',
    warn: 'The action to repeat is not chosen — you will be asked after advancing',
    warnWaive: 'No action is chosen — press again to advance without repeating one',
  },
  'animal-target': {
    label: 'Target card',
    choose: 'Choose a card',
    change: 'Change the card',
    fizzle: 'No card can receive the animals',
    warn: 'The card for the animals is not chosen — you will be asked after advancing',
    warnWaive: 'No card is chosen — press again to advance without the animals',
  },
};

export default defineComponent({
  name: 'ConsoleHydroPickRow',
  components: {CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripActionPrefix},
  props: {
    kind: {type: String as PropType<HydroPickKind>, required: true},
    /** The chosen card, or undefined while the question stands. */
    card: {type: String as PropType<CardName>, default: undefined},
    /** The chosen action's own branch node (already `stripNodeOr`-ed). */
    node: {type: Object as PropType<GroupNode>, default: undefined},
    /** pos 9: the target's live animal count, for the honest «сейчас → станет». */
    animalCurrent: {type: Number, default: undefined},
    focused: {type: Boolean, default: false},
    /** The server offered NO candidate — the reward fizzles and nothing is owed. */
    fizzled: {type: Boolean, default: false},
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
