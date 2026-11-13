<template>
  <div class="con-pvariant" :class="{'con-pvariant--embedded': embedded, 'con-pvariant--order': variant.kind === 'placement-order'}"
       data-prelude-variant :data-prelude-variant-card="variant.card" :data-prelude-variant-kind="variant.kind">
    <ConsoleVariantChoice class="con-pvariant__choices" layout="column" :exclusive="variant.rows.length <= 3 && variant.kind !== 'placement-order'"
                          :options="options" :label="$t(groupLabel)" @pick="onPick">
      <template #body="{index}">
        <template v-for="row in [variant.rows[index]]" :key="row.key">
          <GamepadGlyph v-if="focus === index && row.available && !sealed" control="confirm" class="con-pvariant__a" />
          <div v-if="row.chips.length > 0 || reactions[index].total > 0" class="con-pvariant__chips" data-prelude-variant-chips>
            <ActionEffectChip v-for="(chip, k) in row.chips" :key="k" :effect="chip" />
            <!-- What the TABLE adds if THIS row is chosen (P65 · GH — the server's `byBranch[pos]`): the composers' own
                 «⚡ сработает» note on the row's line, never on a row whose branch does not set it off. -->
            <ConsoleForecastReactions :reaction="reactions[index]" :data-prelude-variant-reaction="String(index)" />
          </div>
        </template>
      </template>
    </ConsoleVariantChoice>
    <!-- What EVERY variant brings — read once, never on each row (P44's draw of 2 cards with a floater icon). -->
    <div v-if="variant.shared.length > 0" class="con-pvariant__shared" data-prelude-variant-shared>
      <span class="con-pvariant__shared-label">{{ $t(variant.kind === 'resource' ? 'With any resource' : 'With any variant') }}</span>
      <ActionEffectChip v-for="(chip, k) in variant.shared" :key="k" :effect="chip" />
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE PRELUDE'S «ВАРИАНТ» STEP (P44 · ledger EQ) — ONE host-agnostic surface on every host of a prelude's play: the
 * start queue's zone and the «ВЫБОР ПРОЛОГА» stage (a layer over the candidates). It never titles itself — the
 * host's crumb names the stage («… › ВАРИАНТ»); the rows ARE the card's printed rows (`printedVariantRows` cut at
 * the printed slash), each with its own reading. The pad belongs to the HOST (it routes ↑↓ / A / B here through
 * `focus` and the `pick` event) — the step owns no listener.
 * P58 · FS — the SAME step asks a card's LIVE «which tile next» (`kind: 'placement-order'`): one row per printed
 * tile, each its face's own hex; a tile already placed stays in its place SEALED (a kant and the word, the column
 * never reflows), an ocean at the maximum is shown with its reason.
 * P65 · GH — a variant row carries what the TABLE answers to ITS branch (`forecast` — the play's whole forecast, its
 * `byBranch[pos]`): «⚡ сработает» on the row's own line, the Venus row's «+6 M€» and no other row's.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {printedVariantRows, VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {PreludeVariant, placementTileKey, variantRowReaction} from '@/client/console/preludeVariant/preludeVariantModel';
import {VariantReaction} from '@/client/console/effectForecastModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Message} from '@/common/logs/Message';

defineOptions({name: 'ConsolePreludeVariantStep'});
const props = defineProps({
  variant: {type: Object as PropType<PreludeVariant>, required: true},
  /** The cursor's row (the host's pad drives it). */
  focus: {type: Number, default: 0},
  /** The answer is on its way — the seal stands on the focused row, nothing else takes a press. */
  sealed: {type: Boolean, default: false},
  /** Hosted inside another surface's zone (the start's, the pick stage's) — no frame of its own. */
  embedded: {type: Boolean, default: true},
  /** The play's WHOLE forecast (P65 · GH) — each row reads its own branch's facts out of `byBranch`. */
  forecast: {type: Object as PropType<EffectForecast | undefined>, default: undefined},
});
const emit = defineEmits(['pick']);

/** Per row: what the table adds if THAT row is chosen (empty for a resource / order row). */
const reactions = computed((): ReadonlyArray<VariantReaction> => {
  return props.variant.rows.map((row) => variantRowReaction(props.variant, row, props.forecast));
});
const printed = computed((): ReadonlyArray<ReadonlyArray<unknown>> | undefined => {
  // A RESOURCE pre-step (P50 · FC) has no printed rows to cut — each row is a lane, named and iconed by its chip.
  if (props.variant.kind === 'resource') {
    return undefined;
  }
  // A PLACEMENT-ORDER row carries its own printed hex (the face's node of THAT tile) — all of them or the words.
  if (props.variant.kind === 'placement-order') {
    const prints = props.variant.rows.map((r) => r.print);
    return prints.every((p) => p !== undefined && p.length > 0) ? prints as ReadonlyArray<ReadonlyArray<unknown>> : undefined;
  }
  return printedVariantRows(getCard(props.variant.card)?.metadata.renderData, props.variant.rows.length);
});
const groupLabel = computed((): string => {
  return props.variant.kind === 'resource' ? 'Resource' : props.variant.kind === 'placement-order' ? 'Placement' : 'Variant';
});
const options = computed((): ReadonlyArray<VariantChoiceOption> => {
  return props.variant.rows.map((row, i): VariantChoiceOption => {
    const option: VariantChoiceOption = {
      key: row.key,
      state: {focused: props.focus === i, selected: props.sealed && props.focus === i, off: !row.available},
      // The print speaks first; the server's words stay as the row's accessible name and its fallback. A
      // placement-order row keeps its tile's WORD beside the hex (a bare icon in a wide row reads as an empty plate).
      title: printed.value !== undefined && props.variant.kind !== 'placement-order' ? '' : text(row.title),
      attrs: {
        'data-prelude-variant-row': String(i), 'data-prelude-variant-branch': String(row.branchIndex),
        ...(row.tileType !== undefined ? {'data-prelude-variant-tile': placementTileKey(row.tileType)} : {}),
        ...(row.sealed === true ? {'data-prelude-variant-sealed': ''} : {}),
      },
    };
    const print = printed.value?.[i];
    if (print !== undefined) {
      option.printed = print as VariantChoiceOption['printed'];
    }
    if (row.notice !== undefined) {
      option.quiet = translateText(row.notice);
    }
    if (row.reason !== undefined) {
      option.reason = typeof row.reason === 'string' ?
        translateTextWithParams(row.reason, [...(row.reasonParams ?? [])]) :
        translateMessage(row.reason);
    }
    return option;
  });
});
function text(title: string | Message): string {
  return typeof title === 'string' ? translateText(title) : translateMessage(title);
}
function onPick(i: number): void {
  emit('pick', i);
}
</script>
