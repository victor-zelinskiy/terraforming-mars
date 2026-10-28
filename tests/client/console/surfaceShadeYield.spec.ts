import {expect} from 'chai';
import {
  surfaceEnterHook, surfaceLeaveCancelledHook,
} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {surfaceMotionState, surfaceShadeOn} from '@/client/console/surfaceMotion/surfaceMotionState';

/**
 * A SURFACE THAT YIELDED ITS DIM NEVER TAKES IT BACK THROUGH A DIRECTOR HOOK.
 *
 * «ДЕЙСТВИЯ КАРТ» hands the scene to its own Hydronetwork step and stays on
 * screen (its header carries the crumb), so it gives up the shared
 * `.con-shade` in a component watcher. «Свернуть» → restore re-mounts the
 * whole stack at once: the watcher gave the dim up at SETUP and the `appear`
 * entry hook re-acquired it a flush later — the track then stood under a
 * full dim for the rest of the step (the owner's 4K report, 2026-10-28,
 * «Штормовой барьер» → «Гидромоделирование» → B → A). The surrender is
 * declared on the element (`data-motion-shade-yielded`) and every hook that
 * acquires the dim asks it.
 *
 * The `drawn` variant keeps the entry hook on its no-tween branch; the shade
 * decision it exercises is the same one every entry takes.
 */
function surface(opts: {yielded: boolean}): HTMLElement {
  const el = document.createElement('div');
  el.dataset.motionSurface = 'card-actions';
  el.dataset.motionVariant = 'drawn';
  if (opts.yielded) {
    el.dataset.motionShadeYielded = '1';
  }
  document.body.appendChild(el);
  return el;
}

describe('surface motion — a yielded surface keeps its dim surrendered', () => {
  afterEach(() => {
    surfaceMotionState.shadeOwners.splice(0);
    document.body.innerHTML = '';
  });

  it('an ordinary entry acquires the dim', () => {
    surfaceEnterHook(surface({yielded: false}), () => {});
    expect(surfaceMotionState.shadeOwners).to.deep.eq(['card-actions']);
    expect(surfaceShadeOn()).to.eq(true);
  });

  it('an entry of a surface mounted ALREADY YIELDED does not (the restore after «свернуть»)', () => {
    surfaceEnterHook(surface({yielded: true}), () => {});
    expect(surfaceMotionState.shadeOwners).to.deep.eq([]);
    expect(surfaceShadeOn()).to.eq(false);
  });

  it('a pick-bridge re-show that held the dim does not re-acquire it once yielded', () => {
    const el = surface({yielded: true});
    el.dataset.motionPickHidden = '1';
    el.dataset.motionShadeHeld = '1';
    surfaceEnterHook(el, () => {});
    expect(surfaceMotionState.shadeOwners).to.deep.eq([]);
  });

  it('a cancelled leave of a yielded surface does not re-acquire it', () => {
    surfaceLeaveCancelledHook(surface({yielded: true}));
    expect(surfaceMotionState.shadeOwners).to.deep.eq([]);
    surfaceLeaveCancelledHook(surface({yielded: false}));
    expect(surfaceMotionState.shadeOwners).to.deep.eq(['card-actions']);
  });
});
