<template>
  <svg class="con-vp-badge" viewBox="0 0 40 44" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="uid + '-rim'" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f7dfa2"/>
        <stop offset="0.45" stop-color="#d3a557"/>
        <stop offset="1" stop-color="#8a6226"/>
      </linearGradient>
      <linearGradient :id="uid + '-core'" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b3547"/>
        <stop offset="1" stop-color="#0e1520"/>
      </linearGradient>
    </defs>
    <!-- gold rim (outer shield silhouette) -->
    <path d="M4 3 H36 V24 L20 41 L4 24 Z" :fill="`url(#${uid}-rim)`"/>
    <!-- graphite core -->
    <path d="M6.6 5.6 H33.4 V22.8 L20 37.4 L6.6 22.8 Z" :fill="`url(#${uid}-core)`"/>
    <!-- bevel light along the core's upper edge (subtle machined depth) -->
    <path d="M6.6 5.6 H33.4 V22.8 L20 37.4 L6.6 22.8 Z" fill="none"
          stroke="rgba(255, 255, 255, 0.09)" stroke-width="1"/>
    <text class="con-vp-badge__label" x="20" y="24.2"
          text-anchor="middle">{{ label }}</text>
  </svg>
</template>

<script setup vapor lang="ts">
/*
 * Victory-points emblem for the console score header — an award TOKEN
 * (pentagon shield: warm gold rim over a deep graphite core, the localized
 * «VP»/«ПО» set in the centre). Pure inline SVG — no bitmap, no emoji —
 * so it scales losslessly across every TV profile. Deliberately NOT a star
 * (collides with the board VP glyphs), NOT a crown (award leadership), NOT
 * a globe (too close to the TR tile's silhouette).
 *
 * The label arrives PRE-LOCALIZED as a prop (the host passes $t('VP')), so
 * this one component serves every locale; text-anchor="middle" keeps the
 * optical centre identical for «VP» and «ПО» — no jump on language switch.
 * The font stack mirrors the console's own (@con-font) — inline SVG inherits
 * the document webfonts, so it renders the same in Electron on Windows and
 * on SteamOS.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {ref} from 'vue';
import {nextVpBadgeUid} from '@/client/components/console/consoleVpBadgeState';

defineOptions({name: 'ConsoleVpBadge'});
defineProps({
  /** The localized emblem text — the host passes $t('VP') («ПО» in ru). */
  label: {type: String, required: true},
});

// Per-instance gradient ids — the number comes from the MODULE's counter (`consoleVpBadgeState.ts`: a counter
// declared here would be one per badge, and every badge would then be number 1).
const uid = ref(`con-vpb-${nextVpBadgeUid()}`);
</script>
