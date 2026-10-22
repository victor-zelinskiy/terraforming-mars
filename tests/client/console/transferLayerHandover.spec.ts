import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import ConsoleResourceTransferLayer from '@/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue';
import {boardPaintThrough, measureTransferCover, resourceTransferState, tokenPaintedUnder} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {globalConfig} from '../components/getLocalVue';

/*
 * THE TWO PAINTS OF A FLIGHT — the DOM half (T12 / CA, «жетон никогда не красится под поверхностью, на которую
 * садится»). A token handed between the lit layer and its shaded twin is the SAME element: its node, its inline
 * transform (where GSAP put it) and its box do not change — a handover is never a jump and never a re-render. The
 * covered area is read off the presence bridge's own facts and the shade's box; the paint sentinel names what stands
 * over the token. The pure half — the plan and the turn — is `tests/console/transferPaintPlan.spec.ts`.
 */
describe('the two paints of a flight — the DOM half (T12 / CA)', () => {
  const flushTeleports = async () => {
    await nextTick();
    await nextTick();
    await nextTick();
  };

  afterEach(() => {
    resourceTransferState.flights = [];
  });

  describe('ConsoleResourceTransferLayer — the twin layers', () => {
    it('a token is born in the lit layer, moves UNDER and back as the same node with its transform intact; the end marks follow their own layer', async () => {
      const wrapper = mount(ConsoleResourceTransferLayer, {...globalConfig, attachTo: document.body});
      resourceTransferState.flights = [{id: 7, spec: {channel: 'stock', resource: 'megacredits', amount: 3}, fromBoard: true}];
      await flushTeleports();
      const lit = document.querySelector('[data-transfer-lit]');
      const under = document.querySelector('[data-transfer-under]');
      expect(lit, 'the lit layer').is.not.null;
      expect(under, 'its shaded twin').is.not.null;
      const chip = document.querySelector<HTMLElement>('[data-transfer-id="7"]');
      expect(chip?.parentElement, 'born lit').eq(lit);
      expect(chip?.dataset.transferLayer).eq('lit');
      chip!.style.transform = 'translate(412px, 233px) scale(0.6)';

      const vm = wrapper.vm as unknown as {layers: Record<string, string>};
      vm.layers['chip:7'] = 'under';
      await flushTeleports();
      const moved = document.querySelector<HTMLElement>('[data-transfer-id="7"]');
      expect(moved, 'the SAME node — never re-rendered').eq(chip);
      expect(moved?.parentElement, 'now in the shaded twin').eq(under);
      expect(moved?.dataset.transferLayer).eq('under');
      expect(moved?.style.transform, 'the transform GSAP wrote is untouched').eq('translate(412px, 233px) scale(0.6)');
      expect(lit!.querySelector('.con-transfer__beat'), 'the end marks stay lit while the end is lit').is.not.null;

      vm.layers['end:7'] = 'under';
      await flushTeleports();
      expect(under!.querySelector('.con-transfer__beat'), 'the contact beat stands in its destination\'s paint').is.not.null;
      expect(under!.querySelector('.con-transfer__expect'), 'so does the receiver\'s ring').is.not.null;

      vm.layers['chip:7'] = 'lit';
      await flushTeleports();
      expect(document.querySelector('[data-transfer-id="7"]'), 'handed back up: still the same node').eq(chip);
      expect(chip!.parentElement).eq(lit);
      expect(chip!.style.transform).eq('translate(412px, 233px) scale(0.6)');
      wrapper.unmount();
    });

    it('the flight leaves: its node leaves from WHICHEVER layer it stands in, and its layers are forgotten', async () => {
      const wrapper = mount(ConsoleResourceTransferLayer, {...globalConfig, attachTo: document.body});
      resourceTransferState.flights = [{id: 9, spec: {channel: 'stock', resource: 'plants', amount: 1}, fromBoard: true}];
      await flushTeleports();
      const vm = wrapper.vm as unknown as {layers: Record<string, string>};
      vm.layers['chip:9'] = 'under';
      vm.layers['end:9'] = 'under';
      await flushTeleports();
      expect(document.querySelector('[data-transfer-under] [data-transfer-id="9"]')).is.not.null;
      resourceTransferState.flights = [];
      await flushTeleports();
      expect(document.querySelector('[data-transfer-id="9"]'), 'no orphan token left in the twin').is.null;
      expect(document.querySelector('.con-transfer__beat')).is.null;
      expect(Object.keys(vm.layers)).deep.eq([]);
      wrapper.unmount();
    });
  });

  describe('measureTransferCover — the covered area', () => {
    let root: HTMLElement;
    let shade: HTMLElement;

    beforeEach(() => {
      root = document.createElement('div');
      root.className = 'con-root';
      shade = document.createElement('div');
      shade.className = 'con-shade';
      shade.getBoundingClientRect = () => ({left: 220, top: 80, width: 1480, height: 920, right: 1700, bottom: 1000, x: 220, y: 80, toJSON: () => ({})}) as DOMRect;
      root.appendChild(shade);
      document.body.appendChild(root);
    });

    afterEach(() => {
      root.remove();
    });

    it('no workspace stands: no cover (the board IS the screen)', () => {
      expect(measureTransferCover()).deep.eq({rects: [], everything: false});
    });

    it('a workspace stands (`con-root--ws-open`): the central opening — the shade\'s box, whatever its fade', () => {
      root.classList.add('con-root--ws-open');
      expect(measureTransferCover()).deep.eq({rects: [{x: 220, y: 80, w: 1480, h: 920}], everything: false});
    });

    it('the endgame scene: everything is cover', () => {
      root.classList.add('con-root--endgame', 'con-root--ws-open');
      expect(measureTransferCover()).deep.eq({rects: [], everything: true});
    });
  });

  describe('boardPaintThrough — what the dim over the board lets through (the surfacing ramp starts there)', () => {
    let root: HTMLElement;
    let shade: HTMLElement;

    beforeEach(() => {
      root = document.createElement('div');
      root.className = 'con-root';
      shade = document.createElement('div');
      shade.className = 'con-shade';
      root.appendChild(shade);
      document.body.appendChild(root);
    });

    afterEach(() => {
      root.remove();
    });

    it('nothing dims the board (the shade faded out, the start yielded): the whole paint — the surfacing is a plain change of layer', () => {
      shade.style.opacity = '0';
      const start = document.createElement('div');
      start.className = 'con-start con-start--yielded';
      const bg = document.createElement('div');
      bg.className = 'con-start__bg';
      start.appendChild(bg);
      root.appendChild(start);
      expect(boardPaintThrough()).eq(1);
    });

    it('the shade on: what its dim lets through, floored — the ramp starts from the glass', () => {
      shade.style.opacity = '1';
      expect(boardPaintThrough()).closeTo(0.3, 1e-9);
      shade.style.opacity = '0.28';
      expect(boardPaintThrough()).closeTo(1 - 0.28 * 0.74, 1e-9);
    });

    it('the room of the start scene while it stands (its own dim, .8 of it)', () => {
      shade.style.opacity = '0';
      const start = document.createElement('div');
      start.className = 'con-start con-start--bounded';
      const bg = document.createElement('div');
      bg.className = 'con-start__bg';
      bg.style.opacity = '0.8';
      start.appendChild(bg);
      root.appendChild(start);
      expect(boardPaintThrough()).closeTo(1 - 0.8 * 0.74, 1e-9);
    });
  });

  describe('tokenPaintedUnder — the paint sentinel', () => {
    const originalFromPoint = document.elementsFromPoint;
    let chip: HTMLElement;
    let rail: HTMLElement;
    let row: HTMLElement;

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
      Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
      chip = document.createElement('div');
      chip.className = 'con-transfer__chip';
      chip.style.pointerEvents = 'none';
      chip.appendChild(document.createElement('span'));
      chip.getBoundingClientRect = () => ({left: 100, top: 300, width: 54, height: 54, right: 154, bottom: 354, x: 100, y: 300, toJSON: () => ({})}) as DOMRect;
      rail = document.createElement('div');
      rail.className = 'con-res';
      row = document.createElement('div');
      row.className = 'con-res__row';
      rail.appendChild(row);
      document.body.append(chip, rail);
    });

    afterEach(() => {
      chip.remove();
      rail.remove();
      document.elementsFromPoint = originalFromPoint;
    });

    it('the token topmost at its centre (itself or its own part): nothing to say', () => {
      document.elementsFromPoint = () => [chip, rail];
      expect(tokenPaintedUnder(chip)).eq(undefined);
      document.elementsFromPoint = () => [chip.firstElementChild!, chip, rail];
      expect(tokenPaintedUnder(chip)).eq(undefined);
    });

    it('a surface over it is NAMED (the element and the surface it belongs to) — the token is hit-testable only for the probe', () => {
      let seen = '';
      document.elementsFromPoint = () => {
        seen = chip.style.pointerEvents;
        return [row, chip];
      };
      expect(tokenPaintedUnder(chip)).eq('div.con-res__row in div.con-res');
      expect(seen, 'made hit-testable for the one hit test').eq('auto');
      expect(chip.style.pointerEvents, 'and given back').eq('none');
    });

    it('an off-screen or unmounted token is not asked', () => {
      document.elementsFromPoint = () => [row];
      chip.remove();
      expect(tokenPaintedUnder(chip)).eq(undefined);
    });
  });
});
