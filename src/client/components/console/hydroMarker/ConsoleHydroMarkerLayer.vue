<template>
  <div class="con-hydromarker-layer" aria-hidden="true">
    <div v-if="hydroMarkerState.active"
         ref="marker"
         class="con-hydromarker"
         :class="['player_bg_color_' + (hydroMarkerState.color || 'blue'), 'con-hydromarker--' + hydroMarkerState.phase]"></div>
  </div>
</template>

<script setup lang="ts">
/*
 * HYDRO MARKER LAYER — the app-level stage the hydronetwork marker-advance
 * glides on (mounted once in ConsoleShell). A single small token proxy in
 * the viewer's colour glides from the old stop to the new stop and locks in;
 * the flight survives the confirm modal closing beneath it (the controller
 * owns the beats, the director the GSAP). Pointer-inert, clipped.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {nextTick, onBeforeUnmount, useTemplateRef, watch} from 'vue';
import {
  hydroMarkerState, registerHydroMarkerHandle, setHydroMarkerPhase,
} from '@/client/console/hydroMarker/consoleHydroMarker';
import {runHydroMarkerGlide, MarkerPhaseName} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {probeTick} from '@/client/console/probeTick';

/** Read a fresh, stable rect for a stop marker-slot (bounded rAF probe). */
function stableRect(resolve: () => HTMLElement | null): Promise<DOMRect | undefined> {
  return new Promise((done) => {
    let tries = 0;
    let last = '';
    const poll = () => {
      tries++;
      const el = resolve();
      const r = el !== null ? el.getBoundingClientRect() : undefined;
      const ok = r !== undefined && r.width > 2 && r.height > 2;
      const sig = ok ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '';
      if (ok && sig === last) {
        done(r);
        return;
      }
      last = sig;
      if (tries < 40) {
        probeTick(poll);
      } else {
        done(ok ? r : undefined);
      }
    };
    probeTick(poll);
  });
}

defineOptions({name: 'ConsoleHydroMarkerLayer'});

const marker = useTemplateRef<HTMLElement>('marker');

async function glide(): Promise<void> {
  if (!hydroMarkerState.active || typeof window === 'undefined') {
    return;
  }
  await nextTick();
  const markerNow = marker.value;
  if (markerNow === null) {
    return;
  }
  const [from, to] = await Promise.all([
    stableRect(() => document.querySelector<HTMLElement>(`[data-hydro-marker="${hydroMarkerState.fromPosition}"]`)),
    stableRect(() => document.querySelector<HTMLElement>(`[data-hydro-marker="${hydroMarkerState.toPosition}"]`)),
  ]);
  if (!hydroMarkerState.active) {
    return; // aborted while probing
  }
  if (from === undefined || to === undefined) {
    // No believable anchors (edge layout): skip the visual, but the
    // controller phases still advance so the gate resolves on lock.
    setHydroMarkerPhase('arrive');
    return;
  }
  const handle = runHydroMarkerGlide({
    marker: markerNow,
    from,
    to,
    reduced: hydroMarkerState.reducedMotion,
    onPhase: (phase: MarkerPhaseName) => setHydroMarkerPhase(phase),
  });
  registerHydroMarkerHandle(handle);
}

/** A fresh advance (armHydroMarker bumped the nonce): run the glide. */
watch(() => hydroMarkerState.nonce, () => {
  void glide();
});
onBeforeUnmount(() => {
  registerHydroMarkerHandle(undefined);
});
</script>
