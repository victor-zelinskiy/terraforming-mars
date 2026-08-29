import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroDecisionRail from '@/client/components/console/hydroFlow/ConsoleHydroDecisionRail.vue';
import {HydroRailDecision} from '@/client/console/hydroFlow/hydroDecisionRail';
import {CardName} from '@/common/cards/CardName';

/**
 * THE MULTI-DECISION FIXTURE — the future multi-reward movement's honest
 * stand-in: several descriptors of mixed kinds and states rendered through
 * the ONE rail component. No feature flag, no future card: the array IS the
 * contract, and this pins that the rail already serves it natively.
 */
const MULTI: Array<HydroRailDecision> = [
  // Deliberately out of order — the rail must sort by game resolution order.
  {id: '1:animal-target', kind: 'animal-target', order: 1, state: 'open', optional: false},
  {id: '0:reuse-action', kind: 'reuse-action', order: 0, state: 'resolved', optional: true, chosen: CardName.VIRON},
  {id: '2:animal-target', kind: 'animal-target', order: 2, state: 'unavailable', optional: false,
    skipReasonKey: 'No card can receive the animals'},
];

function mountRail(decisions: ReadonlyArray<HydroRailDecision>, focusNode = 'cta') {
  return mount(ConsoleHydroDecisionRail, {
    props: {decisions, focusNode},
    global: {stubs: {GamepadGlyph: true, CardRenderEffectBoxComponent: true, CardRenderData: true}},
  });
}

describe('ConsoleHydroDecisionRail (the stack of decision cards)', () => {
  it('renders nothing for an empty step (the CTA keeps its berth alone)', () => {
    const w = mountRail([]);
    expect(w.find('.con-hydro__railstack').exists()).to.eq(false);
    w.unmount();
  });

  it('renders EVERY descriptor, in GAME order, one card each', () => {
    const w = mountRail(MULTI);
    const rows = w.findAll('.con-hydro__pickrow');
    expect(rows.length, 'three decisions → three cards').to.eq(3);
    // Game order 0 → 1 → 2, not the array order.
    expect(rows[0].text()).to.contain('Viron');
    expect(rows[1].classes()).to.contain('con-hydro__pickrow--missing');
    expect(rows[2].classes()).to.contain('con-hydro__pickrow--fizzled');
    w.unmount();
  });

  it('lights exactly the FOCUSED card, never a neighbour', () => {
    const w = mountRail(MULTI, 'rail:1:animal-target');
    const focused = w.findAll('.con-hydro__summary--focused');
    expect(focused.length).to.eq(1);
    expect(focused[0].classes()).to.contain('con-hydro__pickrow--missing');
    w.unmount();
  });

  it('an unavailable slot is a STATUS, not a button: no press, honest reason', async () => {
    const w = mountRail(MULTI);
    const fizzled = w.findAll('.con-hydro__pickrow')[2];
    expect(fizzled.attributes('role'), 'no button role').to.eq(undefined);
    expect(fizzled.text()).to.contain('No card can receive the animals');
    await fizzled.trigger('click');
    expect(w.emitted('open'), 'a click on a dead slot opens nothing').to.eq(undefined);
    w.unmount();
  });

  it('a click on a LIVE card emits its own descriptor (mouse = point + press)', async () => {
    const w = mountRail(MULTI);
    await w.findAll('.con-hydro__pickrow')[1].trigger('click');
    const emitted = w.emitted('open');
    expect(emitted).to.have.length(1);
    expect((emitted?.[0][0] as HydroRailDecision).id).to.eq('1:animal-target');
    w.unmount();
  });

  it('a resolved card shows the chosen value and the check, not a «choose»', () => {
    const w = mountRail(MULTI);
    const resolved = w.findAll('.con-hydro__pickrow')[0];
    expect(resolved.text()).to.contain('Viron');
    expect(resolved.find('.con-hydro__bonus-tick').exists(), 'the check is its own mark').to.eq(true);
    expect(resolved.text()).to.not.match(/Choose|Выберите/);
    w.unmount();
  });
});
