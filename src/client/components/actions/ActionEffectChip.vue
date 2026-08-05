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
          'action-effect-chip--skipped': skipped,
          'action-effect-chip--danger': danger && !shortfall,
          'action-effect-chip--bare': iconClass === '' && !isVictoryPoints,
        }]">
    <!-- The icon is ALWAYS a real sprite (including `tr` → tr.png and `cards` →
         card.png, via iconClassFor) — never a drawn glyph, so it matches the game art.
         A few effects have NO honest single sprite (the Ares penalty lets the player
         pick WHICH production to lose); those drop the box rather than reserve an
         empty 22px hole. -->
    <!-- VICTORY POINTS carry their identity as TYPE, not art: the game draws them
         as the card's own printed badge, and there is no inline sprite for them
         (the colony trade panel already answers TR the same way). The badge is
         not decoration — it must survive `noEffect`, which REPLACES the note, or
         a capped reading renders as a bare «1 → 1 · нет эффекта» with no word
         about WHAT did not change. -->
    <span v-if="isVictoryPoints" class="action-effect-chip__vp" v-i18n>VP</span>
    <span v-else-if="iconClass !== ''" class="action-effect-chip__icon" :class="iconClass" aria-hidden="true"></span>

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

    <!-- The note and "no effect" are BOTH shown: they answer different
         questions (WHICH pool this touches vs whether it moves). The note used
         to be replaced, which made a zero PRODUCTION chip indistinguishable
         from a zero STOCK chip of the same resource — the same hazard the VP
         badge above is spelled out for. -->
    <span v-if="effect.note" class="action-effect-chip__note" v-i18n>{{ effect.note }}</span>
    <span v-if="noEffect" class="action-effect-chip__note action-effect-chip__note--noeffect" v-i18n>no effect</span>

    <!-- Variable-amount BASIS — "why is it this much": the live count of each
         counted entity (e.g. Cities on Mars: 3). It comes LAST, behind its own
         hairline: the chip states the change first and the reason after, so the
         count never lands in the middle of the reading («0 → 0 производство ·
         без эффекта | Метки соперников: 0»). It is also what makes a ZERO
         legible rather than baffling — the answer to the question a bare 0 asks. -->
    <span v-if="basisTerms.length > 0" class="action-effect-chip__basis">
      <span v-for="(b, i) in basisTerms" :key="i" class="action-effect-chip__basis-term">
        <span class="action-effect-chip__basis-label" v-i18n>{{ b.label }}</span>
        <!-- The counted TAG as its own icon: one label per SCOPE instead of one
             per tag, and no translation can get the tag's name wrong. -->
        <span v-if="b.tag !== undefined" class="resource-tag action-effect-chip__basis-tag"
              :class="'tag-' + b.tag" aria-hidden="true"></span>
        <span class="action-effect-chip__basis-sep" aria-hidden="true">:</span>
        <span class="action-effect-chip__basis-count">{{ b.count }}</span>
      </span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionEffect, ActionEffectBasis} from '@/common/models/ActionPreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

export default defineComponent({
  name: 'ActionEffectChip',
  props: {
    effect: {
      type: Object as PropType<ActionEffect>,
      required: true,
    },
    // This chip describes an effect that will NOT happen (no valid target) — it is
    // shown INSIDE a warning block purely to name the magnitude that is lost. Muted
    // + struck through so it can never be misread as something that applies.
    skipped: {
      type: Boolean,
      default: false,
    },
    // The hosting row is DANGER-severity (a forced, unavoidable loss). The chip
    // takes the row's red so the two read as one statement — an amber "cost" chip
    // under a red title read as a second, milder fact.
    danger: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    iconClass(): string {
      return iconClassFor(this.effect.icon);
    },
    /** A VP reading — rendered as a typographic badge, never a sprite. */
    isVictoryPoints(): boolean {
      return this.effect.icon === 'vp';
    },
    basisTerms(): ReadonlyArray<ActionEffectBasis> {
      return this.effect.basis ?? [];
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
    // A gain that changes nothing — because the pool is already capped (raising a
    // maxed global parameter) or because the amount itself counted to zero (a
    // "per X" reward on a board with no X). Shown muted with a "no effect" note.
    // The POOL-LESS form ("+N to a card", "draw N") has no `current` to compare,
    // so a zero amount is the only signal it has.
    noEffect(): boolean {
      if (this.effect.direction !== 'gain') {
        return false;
      }
      if (this.effect.current === undefined || this.effect.resulting === undefined) {
        return this.effect.amount === 0;
      }
      return this.effect.current === this.effect.resulting;
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
  // A FORCED loss the player cannot plan around (the Ares hazard-adjacency
  // production penalty). Same red as the unaffordable case — it is blocker-grade
  // news, and its row title is already red.
  &--danger {
    --chip-rim: rgba(255, 120, 110, 0.6);
    --chip-bg: rgba(62, 26, 24, 0.55);
    --chip-accent: #ff9f96;
  }
  // No sprite → no reserved icon box, so the pill stays symmetric.
  &--bare {
    padding-left: 10px;
  }
  // No-op gain (capped at max) — muted, so it reads as "this won't do anything".
  &--noeffect {
    opacity: 0.62;
    filter: saturate(0.55);
  }
  // A SKIPPED effect (shown inside a warning): amber rim to match the warning
  // block, desaturated, and the value struck through — it names what is lost, so
  // it must never read as an applied change.
  &--skipped {
    --chip-rim: rgba(240, 184, 106, 0.5);
    --chip-bg: rgba(58, 42, 22, 0.42);
    --chip-accent: #f4d3a6;
    filter: saturate(0.7);

    .action-effect-chip__value {
      text-decoration: line-through;
      text-decoration-thickness: 1px;
      text-decoration-color: rgba(240, 184, 106, 0.75);
    }
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

// The VP identity as type rather than art (see the template note). Sized to the
// icon box so a row mixing sprite chips and this one keeps ONE baseline, and
// tinted from the chip's own accent so gain / no-effect / skipped all carry it
// without a second colour rule.
.action-effect-chip__vp {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 6px;
  border: 1px solid var(--chip-rim);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--chip-accent);
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

/* Variable-amount basis ("Cities on Mars: 3") — a quiet pill inside the chip,
   set off by a hairline so it reads as the reason for the amount. Several terms
   («Cities: 2 · Colonies: 1») share the one pill, separated by a middle dot. */
.action-effect-chip__basis {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 7px;
  margin-left: 1px;
  border-left: 1px solid var(--chip-rim);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: rgba(200, 224, 240, 0.66);
}
.action-effect-chip__basis-term {
  display: inline-flex;
  align-items: center;
  gap: 3px;

  & + & {
    padding-left: 5px;
    &::before {
      content: '·';
      padding-right: 4px;
      opacity: 0.55;
    }
  }
}
.action-effect-chip__basis-label { letter-spacing: 0.01em; }
/* The counted tag, sized down to the basis line — the global `.resource-tag`
   is a 30px card badge with a card-face margin, neither of which belongs here. */
.action-effect-chip__basis-tag {
  width: 14px;
  height: 14px;
  background-size: 16px 16px;
  background-position: -1px -1px;
  line-height: 12px;
  margin-bottom: 0;
  box-shadow: none;
  vertical-align: middle;
}
.action-effect-chip__basis-sep { margin: 0 1px; opacity: 0.6; }
.action-effect-chip__basis-count {
  font-weight: 700;
  color: var(--chip-accent);
}
/* "no effect" sits AFTER the pool note, so it needs its own quieter voice —
   the note says WHAT this touches, this says that it does not move. */
.action-effect-chip__note--noeffect {
  font-style: italic;
  opacity: 0.85;
}
</style>
