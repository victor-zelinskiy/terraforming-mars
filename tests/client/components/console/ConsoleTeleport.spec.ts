import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, nextTick} from 'vue';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';

/*
 * A TELEPORT NEVER MOUNTS INTO NOTHING (the field crash of game-pdb19bfa,
 * 2026-11-07 — `Cannot read properties of null (reading 'emitsOptions')`).
 *
 * The control proves the native defect this component exists for: a
 * `<Teleport>` mounted while its target is absent mounts no children, and the
 * next patch of those children throws. The rest proves the three laws of
 * `foundation/ConsoleTeleport.vue` against real Vue patches.
 */

/** A leaf with `emits` — the exact field the native patch reads off a missing instance. */
const Leaf = defineComponent({
  name: 'TeleportLeaf',
  props: {n: {type: Number, required: true}},
  emits: ['ping'],
  template: '<span class="leaf">{{ n }}</span>',
});

function host(teleport: 'native' | 'console') {
  const tag = teleport === 'native' ? 'Teleport' : 'ConsoleTeleport';
  return defineComponent({
    components: {Leaf, ConsoleTeleport},
    props: {
      to: {type: String, required: true},
      disabled: {type: Boolean, default: false},
      n: {type: Number, default: 0},
    },
    template: `<div class="host"><${tag} :to="to" :disabled="disabled"><Leaf :n="n" /></${tag}></div>`,
  });
}

async function waitFor(check: () => boolean, ms = 1500): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) {
      throw new Error('condition never held');
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

function target(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

describe('ConsoleTeleport — a teleport never mounts into nothing', () => {
  let errors: Array<unknown>;
  const config = () => ({config: {errorHandler: (e: unknown) => {
    errors.push(e);
  }}});

  beforeEach(() => {
    errors = [];
  });

  afterEach(() => {
    for (const id of ['tp-a', 'tp-b']) {
      document.querySelectorAll(`#${id}`).forEach((el) => el.remove());
    }
  });

  it('CONTROL: the native teleport mounted into an absent target crashes on its next patch', async () => {
    const w = mount(host('native'), {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    await w.setProps({n: 1});
    expect(errors.map(String).join(' ')).to.match(/emitsOptions/);
  });

  it('law 1 — absent at mount: renders nowhere, patches cleanly, mounts once the target exists', async () => {
    const w = mount(host('console'), {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    await w.setProps({n: 1});
    expect(errors).to.deep.eq([]);
    expect(document.querySelector('.leaf')).to.eq(null);
    const el = target('tp-a');
    await waitFor(() => el.querySelector('.leaf') !== null);
    await w.setProps({n: 2});
    expect(el.querySelector('.leaf')?.textContent).to.eq('2');
    w.unmount();
    expect(errors).to.deep.eq([]);
    expect(el.querySelector('.leaf')).to.eq(null);
  });

  it('a target rendered later in the same flush is found without a visible wait (the `defer` case)', async () => {
    const w = mount(host('console'), {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    const el = target('tp-a');
    await nextTick();
    await nextTick();
    expect(el.querySelector('.leaf')).to.not.eq(null);
    w.unmount();
  });

  it('law 3 — mounted disabled, enabled while the target is absent: stays in place, moves when it comes', async () => {
    const w = mount(host('console'), {props: {to: '#tp-a', disabled: true}, attachTo: document.body, global: config()});
    expect(w.element.querySelector('.leaf')).to.not.eq(null);
    await w.setProps({disabled: false, n: 1});
    expect(errors).to.deep.eq([]);
    expect(w.element.querySelector('.leaf')?.textContent).to.eq('1');
    const el = target('tp-a');
    await waitFor(() => el.querySelector('.leaf') !== null);
    expect(w.element.querySelector('.leaf')).to.eq(null);
    w.unmount();
    expect(errors).to.deep.eq([]);
  });

  it('law 2 — a target node REPLACED under the same selector receives the content on the next render', async () => {
    const first = target('tp-a');
    const w = mount(host('console'), {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    expect(first.querySelector('.leaf')).to.not.eq(null);
    first.remove();
    const second = target('tp-a');
    await w.setProps({n: 3});
    expect(second.querySelector('.leaf')?.textContent).to.eq('3');
    w.unmount();
    expect(errors).to.deep.eq([]);
  });

  it('a target that goes away under a mounted teleport is survived — patches and unmount stay clean', async () => {
    const el = target('tp-a');
    const w = mount(host('console'), {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    el.remove();
    await w.setProps({n: 4});
    await w.setProps({to: '#tp-b'});
    w.unmount();
    expect(errors).to.deep.eq([]);
  });
});
