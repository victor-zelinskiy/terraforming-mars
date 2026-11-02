<template>
  <!-- THE PRELUDE'S «ВАРИАНТ» STEP (P44 · ledger EQ) — ONE host-agnostic surface on every host of a prelude's play: the
       start queue's zone and the «ВЫБОР ПРОЛОГА» stage (a layer over the candidates). It never titles itself — the
       host's crumb names the stage («… › ВАРИАНТ»); the rows ARE the card's printed rows (`printedVariantRows` cut at
       the printed slash), each with its own reading. The pad belongs to the HOST (it routes ↑↓ / A / B here through
       `focus` and the `pick` event) — the step owns no listener. -->
  <div class="con-pvariant" :class="{'con-pvariant--embedded': embedded}" data-prelude-variant :data-prelude-variant-card="variant.card">
    <ConsoleVariantChoice class="con-pvariant__choices" layout="column" :exclusive="variant.rows.length <= 3"
                          :options="options" :label="$t('Variant')" @pick="onPick">
      <template #body="{index}">
        <template v-for="row in [variant.rows[index]]" :key="row.key">
          <GamepadGlyph v-if="focus === index && row.available && !sealed" control="confirm" class="con-pvariant__a" />
          <div v-if="row.chips.length > 0" class="con-pvariant__chips" data-prelude-variant-chips>
            <ActionEffectChip v-for="(chip, k) in row.chips" :key="k" :effect="chip" />
          </div>
        </template>
      </template>
    </ConsoleVariantChoice>
    <!-- What EVERY variant brings — read once, never on each row (P44's draw of 2 cards with a floater icon). -->
    <div v-if="variant.shared.length > 0" class="con-pvariant__shared" data-prelude-variant-shared>
      <span class="con-pvariant__shared-label">{{ $t('With any variant') }}</span>
      <ActionEffectChip v-for="(chip, k) in variant.shared" :key="k" :effect="chip" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {printedVariantRows, VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {PreludeVariant} from '@/client/console/preludeVariant/preludeVariantModel';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Message} from '@/common/logs/Message';

export default defineComponent({
  name: 'ConsolePreludeVariantStep',
  components: {ConsoleVariantChoice, ActionEffectChip, GamepadGlyph},
  props: {
    variant: {type: Object as PropType<PreludeVariant>, required: true},
    /** The cursor's row (the host's pad drives it). */
    focus: {type: Number, default: 0},
    /** The answer is on its way — the seal stands on the focused row, nothing else takes a press. */
    sealed: {type: Boolean, default: false},
    /** Hosted inside another surface's zone (the start's, the pick stage's) — no frame of its own. */
    embedded: {type: Boolean, default: true},
  },
  emits: ['pick'],
  computed: {
    printed(): ReadonlyArray<ReadonlyArray<unknown>> | undefined {
      return printedVariantRows(getCard(this.variant.card)?.metadata.renderData, this.variant.rows.length);
    },
    options(): ReadonlyArray<VariantChoiceOption> {
      return this.variant.rows.map((row, i): VariantChoiceOption => {
        const option: VariantChoiceOption = {
          key: row.key,
          state: {focused: this.focus === i, selected: this.sealed && this.focus === i, off: !row.available},
          // The print speaks first; the server's words stay as the row's accessible name and its fallback.
          title: this.printed !== undefined ? '' : this.text(row.title),
          attrs: {'data-prelude-variant-row': String(i), 'data-prelude-variant-branch': String(row.branchIndex)},
        };
        const print = this.printed?.[i];
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
    },
  },
  methods: {
    text(title: string | Message): string {
      return typeof title === 'string' ? translateText(title) : translateMessage(title);
    },
    onPick(i: number): void {
      this.$emit('pick', i);
    },
  },
});
</script>
