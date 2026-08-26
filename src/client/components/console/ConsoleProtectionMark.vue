<template>
  <!--
    THE PROTECTION MARK — «этот запас под защитой», pinned to a rail icon's
    upper-left corner (the lower-right belongs to the MC-value coin, so the
    two information layers can never collide).

    The silhouette IS the printed one: the same heraldic shield the card face
    prints for Protected Habitats / Pets / Asteroid Deflection System
    (`assets/misc/shield-protect.svg`), redrawn inline in flat fills so the
    three states differ by MATERIAL, not by a filter — the console paint
    baseline strips `filter`, which is exactly what would have made the
    legacy `.shield_icon_half` (a grayscale/opacity variant) read as full
    protection here.

      · full    — gold body, dark engraved check: they cannot take it.
      · half    — gold body, «½» instead of the check: they still take, but
                  half as much (Botanical Experience). NOT «half is safe».
      · partial — a shield filled only to its waist: part of this aggregated
                  stock is shielded; the aria names the exact split.

    Passive: no focus, no input, no layout (absolute pin, `pointer-events:
    none`). The appearance of a mark is a one-shot settle — protection is
    gained mid-game and the mark must not simply pop into the corner.
  -->
  <span class="con-shieldmark"
        :class="['con-shieldmark--' + kind, {'con-shieldmark--enter': entering}]"
        role="img"
        :aria-label="label">
    <svg class="con-shieldmark__svg" viewBox="0 0 24 26" aria-hidden="true" focusable="false">
      <!-- shield silhouette (the printed asset's own path) -->
      <path class="con-shieldmark__body"
            d="M12 1 2.6 4.3v7.1c0 6.4 4.3 10.3 9.4 12.6 5.1-2.3 9.4-6.2 9.4-12.6V4.3L12 1Z"
            stroke-width="1.6" stroke-linejoin="round"/>
      <!-- inner bevel — the machined depth of the printed badge -->
      <path d="M12 3.4 4.7 5.9v5.5c0 5.2 3.4 8.5 7.3 10.4 3.9-1.9 7.3-5.2 7.3-10.4V5.9L12 3.4Z"
            fill="none" stroke="#fff6da" stroke-opacity="0.3" stroke-width="0.7"/>
      <!-- PARTIAL is a shield filled only up to its waist — “part of this
           stock is behind it”. A literal fill level reads at a glance where a
           mere colour swap does not; the aria carries the exact split. -->
      <path v-if="kind === 'partial'" class="con-shieldmark__fill"
            d="M2.75 13c0.55 5.6 4.6 8.9 9.25 11 4.65-2.1 8.7-5.4 9.25-11Z"/>
      <!-- the verdict: a check for a protected stock, «½» for a halved one -->
      <path v-else-if="kind !== 'half'" class="con-shieldmark__check"
            d="M8.2 12.6l2.7 2.7 5.1-5.4" fill="none" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round"/>
      <text v-else class="con-shieldmark__half" x="12" y="16.4" text-anchor="middle">½</text>
    </svg>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {RailProtectionKind} from '@/client/console/railProtectionModel';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

export default defineComponent({
  name: 'ConsoleProtectionMark',
  props: {
    kind: {type: String as PropType<RailProtectionKind>, required: true},
    /** The full accessible sentence — the glyph alone states no rule. */
    label: {type: String, required: true},
  },
  data() {
    return {
      entering: false,
      enterTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  mounted() {
    // The mark exists only while the protection does, so a MOUNT *is* the
    // moment the player gained it (or switched to a seat that has it) — a
    // short settle, never a loop.
    if (consoleReducedMotionActive()) {
      return;
    }
    this.entering = true;
    this.enterTimer = setTimeout(() => {
      this.entering = false;
      this.enterTimer = undefined;
    }, consoleMotionMs(460));
  },
  beforeUnmount() {
    if (this.enterTimer !== undefined) {
      clearTimeout(this.enterTimer);
    }
  },
});
</script>
