<template>
  <div class="con-tender-back" aria-hidden="true">
    <!--
      THE BACK OF A TENDER — the Committee's cover (the face's third pass, 2026-11-08 — the owner: «обложка сейчас просто
      тёмный фон, который сливается с фоном самой игры»). The face's own enamel in the Committee's petrol, a GOLD double
      rim that draws the card's silhouette on the dark stage, a fine engraved hatch, and the Committee's SEAL in the
      middle — a ringed planet over its horizon lines — above the word «ТЕНДЕР». Every length is in `em` off the back's
      own width (a size container), so the Register's stack, the dealt back and any future host share one drawing.
      Decoration only: no state, no light.
    -->
    <i class="con-tender-back__plate"></i>
    <i class="con-tender-back__rim"></i>
    <div class="con-tender-back__body">
      <svg class="con-tender-back__seal" viewBox="0 0 48 48">
        <circle class="con-tender-back__ring" cx="24" cy="24" r="22" />
        <circle class="con-tender-back__ring con-tender-back__ring--inner" cx="24" cy="24" r="18.5" />
        <!-- the ring's far half runs BEHIND the planet (the planet's fill covers it), its near half in front -->
        <ellipse class="con-tender-back__orbit" cx="24" cy="24" rx="15" ry="4.6" transform="rotate(-18 24 24)" />
        <circle class="con-tender-back__planet" cx="24" cy="24" r="9.5" />
        <path class="con-tender-back__lat" d="M16.2 20.5h15.6 M14.9 24h18.2 M16.2 27.5h15.6" />
        <path class="con-tender-back__orbit" d="M9 24A15 4.6 0 0 0 39 24" transform="rotate(-18 24 24)" />
        <path class="con-tender-back__tick" d="M24 2.5v3 M24 42.5v3 M2.5 24h3 M42.5 24h3" />
      </svg>
      <span class="con-tender-back__word">{{ $t('Tender') }}</span>
      <span class="con-tender-back__sub">{{ $t('Terraforming Committee') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'ConsoleTenderBack',
});
</script>
