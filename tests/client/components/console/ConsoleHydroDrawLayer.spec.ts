import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleHydroDrawLayer from '@/client/components/console/hydroDraw/ConsoleHydroDrawLayer.vue';
import {
  armHydroDraw, hydroDrawState, isHydroDrawClaimed, resetHydroDraw,
} from '@/client/console/hydroDraw/consoleHydroDraw';

/*
 * THE REGRESSION THIS FILE EXISTS FOR.
 *
 * The layer starts its scene from `watch: {'hydroDrawState.nonce'()}` — a PATH
 * watcher, resolved against the component INSTANCE. The module state was not
 * mirrored in data(), so `this.hydroDrawState` was undefined, the path never
 * resolved and the watcher NEVER fired: the «Гидромоделирование» cinematic
 * silently never ran, while ConsoleTaskHost kept the pick modal veiled on its
 * behalf — a black screen with no cards, no modal and no input for the full
 * 15 s arm safety. The controller specs cannot catch that: they never mount
 * the layer. These assert the WIRING itself.
 *
 * The frame clock is the observable: JSDOM has no requestAnimationFrame, so a
 * layer that TAKES the scene immediately hands the modal back (it cannot drive
 * a flight), clearing `active`. A layer whose watcher is dead leaves the scene
 * armed — exactly the shipped bug.
 */

const STUB = {template: '<div class="stub" />'};

function factory() {
  return mount(ConsoleHydroDrawLayer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: STUB}},
  });
}

describe('ConsoleHydroDrawLayer — scene wiring', () => {
  afterEach(() => resetHydroDraw());

  it('arming reaches the mounted layer — the scene is TAKEN, never left armed and unplayed', async () => {
    const w = factory();
    armHydroDraw(5, {left: 400, top: 300, width: 26, height: 26});
    expect(hydroDrawState.active).to.eq(true); // armed synchronously by the shell

    await w.vm.$nextTick();

    // The layer took it and — with no frame clock to fly on — handed the pick
    // modal straight back. A dead watcher would leave `active` true here.
    expect(hydroDrawState.active).to.eq(false);
    expect(isHydroDrawClaimed()).to.eq(false);
    w.unmount();
  });

  it('a second advance is taken too (the watcher stays live across arms)', async () => {
    const w = factory();
    armHydroDraw(5, {left: 400, top: 300, width: 26, height: 26});
    await w.vm.$nextTick();
    expect(hydroDrawState.active).to.eq(false);

    armHydroDraw(7);
    expect(hydroDrawState.active).to.eq(true);
    await w.vm.$nextTick();
    expect(hydroDrawState.active).to.eq(false);
    w.unmount();
  });

  it('NO layer on stage: nothing claims the scene, so the task host must not veil for it', async () => {
    armHydroDraw(5);
    await Promise.resolve();

    // Armed but unplayed — `isHydroDrawClaimed()` is the veil gate, and the
    // controller's claim safety recalls the scene shortly after.
    expect(hydroDrawState.active).to.eq(true);
    expect(isHydroDrawClaimed()).to.eq(false);
  });

  it('unmounting aborts a live scene — the veil can never outlive the layer', async () => {
    const w = factory();
    armHydroDraw(5);
    // Simulate a scene mid-flight (the layer normally holds this while flying).
    hydroDrawState.claimed = true;
    expect(isHydroDrawClaimed()).to.eq(true);

    w.unmount();

    expect(hydroDrawState.active).to.eq(false);
    expect(isHydroDrawClaimed()).to.eq(false);
  });
});
