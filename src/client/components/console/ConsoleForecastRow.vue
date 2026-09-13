<template>
  <!--
    THE COMPACT «Сработает» ROW — what the TABLE answers to this play / action,
    in chips alone: no card names, no groups, no numbers to add up (the layer
    behind R3 explains everything). One unit of the composer's result cluster
    (the play screen) or the fourth side of the action formula (the action
    screen); it is NOT a focus stop — no cursor, no selection, no A — and a
    click opens the layer the way R3 does.

    Four chip forms (§5.2 of the spec), all the shared `ActionEffectChip`:
      · own guaranteed gain      — the ordinary mint gain chip;
      · a gain you will be ASKED — the same chip + a «?» badge (cyan);
      · another seat's gain/loss — steel chassis + that player's colour bar
                                    and dot (never mint: mint means «mine»);
      · «⚡ ?»                    — ONE dashed steel chip for every reaction
                                    that fires but was not calculated;
    plus «+N» past the cap. Membership + merging + the cap are the pure
    model's (`compactForecastChips`).
  -->
  <div class="con-forecast"
       :class="{'con-forecast--bare': !caption}"
       role="note"
       :aria-label="ariaLabel"
       data-forecast-row
       @click="$emit('open')">
    <span class="con-forecast__glyph" aria-hidden="true">⚡</span>
    <span v-if="caption" class="con-forecast__label">{{ $t('Will trigger') }}:</span>
    <span class="con-forecast__chips">
      <!-- Keyed on the chip's VALUE too: a refreshed forecast that moved a
           number re-mounts that one chip, and its entrance is the 100 ms
           flick the cell dossier plays on a changed value. -->
      <span v-for="chip in row.chips" :key="chipKey(chip)"
            class="con-forecast__chip" :class="chipClasses(chip)"
            :data-forecast-chip="chip.kind">
        <template v-if="chip.kind === 'own' || chip.kind === 'asks' || chip.kind === 'other'">
          <!-- WHOSE gain this is: the seat's colour as a leading BAR plus a dot
               before the number — the `player_bg_color_*` palette the option
               dots speak, never a second colour table. -->
          <span v-if="chip.kind === 'other'" class="con-forecast__owner-bar" :class="'player_bg_color_' + chip.color" aria-hidden="true"></span>
          <span v-if="chip.kind === 'other'" class="con-forecast__owner-dot" :class="'player_bg_color_' + chip.color" aria-hidden="true"></span>
          <ActionEffectChip :effect="chip.effect" />
          <span v-if="chip.kind === 'asks'" class="con-forecast__ask" aria-hidden="true">?</span>
        </template>
        <template v-else-if="chip.kind === 'unknown'">
          <span class="con-forecast__unknown" aria-hidden="true">⚡ ?</span>
        </template>
        <template v-else>
          <span class="con-forecast__more">+{{ chip.count }}</span>
        </template>
      </span>
    </span>
    <span class="con-forecast__key" aria-hidden="true">
      <GamepadGlyph control="stickR" />
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {ForecastChip, ForecastRow, compactForecastChips} from '@/client/console/effectForecastModel';
import {translateText} from '@/client/directives/i18n';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleForecastRow',
  components: {ActionEffectChip, GamepadGlyph},
  props: {
    forecast: {type: Object as PropType<EffectForecast | undefined>, default: undefined},
    /**
     * Draw the «Сработает:» caption. The action composer's hero already names
     * the side with its own `__hero-label`, so it passes `false` and the row
     * shows glyph + chips + the R3 key only.
     */
    caption: {type: Boolean, default: true},
  },
  emits: ['open'],
  computed: {
    row(): ForecastRow {
      return compactForecastChips(this.forecast);
    },
    ariaLabel(): string {
      return `${translateText('Will trigger')}: ${this.row.total}`;
    },
  },
  methods: {
    /** Identity + value: a changed number re-mounts the chip (the flick). */
    chipKey(chip: ForecastChip): string {
      switch (chip.kind) {
      case 'unknown':
        return `${chip.key}|${chip.facts}`;
      case 'more':
        return `${chip.key}|${chip.count}`;
      default:
        return `${chip.key}|${chip.effect.amount}|${chip.effect.current ?? ''}|${chip.effect.resulting ?? ''}`;
      }
    },
    chipClasses(chip: ForecastChip): Record<string, boolean> {
      return {
        ['con-forecast__chip--' + chip.kind]: true,
        'con-forecast__chip--bot': chip.kind === 'other' && chip.bot,
      };
    },
  },
});
</script>
