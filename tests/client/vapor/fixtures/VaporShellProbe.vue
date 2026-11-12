<template>
  <section class="vp-shell" :data-count="count" :data-doubled="doubled" :data-age="age" @click="bump">
    <b :ref="surfaces.bind.handSection" class="vp-shell__surface">surface</b>
  </section>
</template>

<script setup vapor lang="ts">
// THE GAME SCREEN'S COMPOSITION, IN MINIATURE (architecture v2 — S-last): two controllers that reach each other through
// a late-bound PORT (`shellPort.ts` — no component instance behind it), a surface standing in the REGISTRY through a
// function ref, a reactions TABLE installed after the controllers, the wiring hooks registered last. `ConsoleShell.vue`
// is exactly this shape (`useConsoleShell`); this probe says the shape runs inside a Vapor component.
import {computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {createShellPort} from '@/client/console/shell/shellPort';
import {createSurfaceRegistry, SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';

type View = {gameAge: number};
const props = defineProps<{playerView: View, seen: {log: Array<string>, instance?: unknown, surfaces?: SurfaceRegistry, reset?: () => void}}>();

/** Owns the count; reads the OTHER controller's derivation through its port. */
type CounterPort = {readonly doubled: number};
function createCounterController(shell: CounterPort) {
  const count = ref(1);
  const bump = (): void => {
    count.value++;
  };
  const whenDoubledChanges = (now: number): void => {
    props.seen.log.push(`doubled ${now} (read through the port: ${shell.doubled})`);
  };
  return {count, bump, whenDoubledChanges};
}

/** Derives from the first one's ref and from a PROP — and WRITES the ref through a WRITTEN row. */
type ViewPort = {/** WRITTEN here. */ count: number, readonly playerView: View};
function createViewController(shell: ViewPort) {
  const doubled = computed(() => shell.count * 2);
  const age = computed(() => shell.playerView.gameAge);
  const reset = (): void => {
    shell.count = 0;
  };
  const whenAgeChanges = (now: number): void => {
    props.seen.log.push(`age ${now}`);
  };
  return {doubled, age, reset, whenAgeChanges};
}

props.seen.instance = getCurrentInstance();
const port = createShellPort(props);
const surfaces = createSurfaceRegistry();
const counter = createCounterController(port.as<CounterPort>());
const view = createViewController(port.as<ViewPort>());
const members = {surfaces, ...counter, ...view};
const shell = port.bind(members);
// The reactions table: after the controllers, in ONE order.
watch(() => shell.doubled, (now) => shell.whenDoubledChanges(now));
watch(() => shell.playerView.gameAge, (now) => shell.whenAgeChanges(now));
// The wiring hooks, last.
onMounted(() => props.seen.log.push(`mounted · surface ${surfaces.at<HTMLElement>('handSection')?.tagName ?? 'none'}`));
onBeforeUnmount(() => props.seen.log.push('leaving'));
props.seen.surfaces = surfaces;
props.seen.reset = shell.reset;

// What the template names — the one thing a `<script setup>` shell adds to the composition.
const {count, doubled, age, bump} = members;
</script>
