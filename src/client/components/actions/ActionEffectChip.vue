<template>
  <!--
    One premium cost/gain chip for an action's preview: an icon + a
    `current → resulting` readout (or a signed amount when there's no single pool
    to track). Colour conveys direction — amber for a cost, mint for a gain — so
    the player reads "what changes, and to what value" at a glance, BEFORE they
    confirm. Used in the action confirmation modal (branch options + summary).
  -->
  <span class="action-effect-chip"
        :class="['action-effect-chip--' + effect.direction, {
          'action-effect-chip--insufficient': shortfall,
          'action-effect-chip--noeffect': noEffect,
        }]">
    <span v-if="iconMode === 'sprite'" class="action-effect-chip__icon" :class="iconClass" aria-hidden="true"></span>
    <span v-else-if="iconMode === 'tr'" class="action-effect-chip__badge" aria-hidden="true"><span v-i18n>TR</span></span>
    <span v-else class="action-effect-chip__badge action-effect-chip__badge--cards" aria-hidden="true">▭</span>

    <span class="action-effect-chip__value">
      <!-- Unaffordable cost → "have / need" so the shortfall is explicit. -->
      <template v-if="shortfall">
        <span class="action-effect-chip__cur">{{ effect.current }}</span>
        <span class="action-effect-chip__sep" aria-hidden="true">/</span>
        <span class="action-effect-chip__need">{{ effect.amount }}{{ unit }}</span>
      </template>
      <template v-else-if="hasDelta">
        <span class="action-effect-chip__cur">{{ effect.current }}{{ unit }}</span>
        <span class="action-effect-chip__arrow" aria-hidden="true">→</span>
        <span class="action-effect-chip__res">{{ effect.resulting }}{{ unit }}</span>
      </template>
      <span v-else class="action-effect-chip__amount">{{ sign }}{{ effect.amount }}{{ unit }}</span>
    </span>

    <span v-if="noEffect" class="action-effect-chip__note" v-i18n>no effect</span>
    <span v-else-if="effect.note" class="action-effect-chip__note" v-i18n>{{ effect.note }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

export default defineComponent({
  name: 'ActionEffectChip',
  props: {
    effect: {
      type: Object as PropType<ActionEffect>,
      required: true,
    },
  },
  computed: {
    iconMode(): 'sprite' | 'tr' | 'cards' {
      if (this.effect.icon === 'tr') {
        return 'tr';
      }
      if (this.effect.icon === 'cards') {
        return 'cards';
      }
      return 'sprite';
    },
    iconClass(): string {
      return iconClassFor(this.effect.icon);
    },
    hasDelta(): boolean {
      return this.effect.current !== undefined && this.effect.resulting !== undefined;
    },
    // An unaffordable cost (you have fewer than the amount required) — shown as
    // "have / need" in an insufficient (red) style. Only ever true on a branch
    // the server already marked unavailable.
    shortfall(): boolean {
      return this.effect.direction === 'cost' &&
        this.effect.current !== undefined &&
        this.effect.current < this.effect.amount;
    },
    // A gain that changes nothing because the pool is already capped (e.g. raising
    // a maxed global parameter) — shown muted with a "no effect" note.
    noEffect(): boolean {
      return this.effect.direction === 'gain' &&
        this.effect.current !== undefined &&
        this.effect.resulting !== undefined &&
        this.effect.current === this.effect.resulting;
    },
    unit(): string {
      return this.effect.unit ?? '';
    },
    sign(): string {
      return this.effect.direction === 'cost' ? '−' : '+';
    },
  },
});
</script>

<style scoped lang="less">
.action-effect-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--chip-rim);
  background: var(--chip-bg);
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;

  --chip-rim: rgba(120, 200, 255, 0.28);
  --chip-bg: rgba(22, 44, 64, 0.55);
  --chip-accent: #bfe6ff;

  &--gain {
    --chip-rim: rgba(110, 235, 180, 0.45);
    --chip-bg: rgba(20, 54, 44, 0.5);
    --chip-accent: #8ff0c4;
  }
  &--cost {
    --chip-rim: rgba(255, 196, 120, 0.5);
    --chip-bg: rgba(58, 42, 22, 0.5);
    --chip-accent: #ffce92;
  }
  // Unaffordable cost — a stronger red so the shortfall reads as a blocker.
  &--insufficient {
    --chip-rim: rgba(255, 120, 110, 0.6);
    --chip-bg: rgba(62, 26, 24, 0.55);
    --chip-accent: #ff9f96;
  }
  // No-op gain (capped at max) — muted, so it reads as "this won't do anything".
  &--noeffect {
    opacity: 0.62;
    filter: saturate(0.55);
  }
}

.action-effect-chip__icon {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  /* Normalise the three sprite families to a single box (mirrors
     .modal-input__option-icon) so resource / param / card-resource icons align. */
  transform: scale(1);
}

.action-effect-chip__badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 5px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #0a1a26;
  background: linear-gradient(180deg, #d6f0ff, #98c8e6);
  &--cards { font-size: 13px; background: linear-gradient(180deg, #cfe0ff, #9fb6e6); }
}

.action-effect-chip__value {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.action-effect-chip__cur { color: rgba(220, 236, 247, 0.72); }
.action-effect-chip__arrow { color: var(--chip-accent); font-weight: 700; }
.action-effect-chip__res { color: var(--chip-accent); }
.action-effect-chip__amount { color: var(--chip-accent); }
.action-effect-chip__sep { color: rgba(220, 236, 247, 0.5); font-weight: 700; }
.action-effect-chip__need { color: var(--chip-accent); }

.action-effect-chip__note {
  font-size: 10.5px;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  color: rgba(180, 210, 230, 0.6);
}
</style>
