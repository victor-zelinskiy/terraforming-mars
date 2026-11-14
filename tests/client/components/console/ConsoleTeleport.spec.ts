import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, nextTick} from 'vue';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';
import VaporTeleportHost from '../../vapor/fixtures/VaporTeleportHost.vue';

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

  it('law 4 — content that ARRIVES in the render enabling into an absent target never stands up in place first', async () => {
    // The shell's reveal: the teleport stood disabled and EMPTY (`v-if` off); in one render the overlay arrives and
    // the claim names a zone the host renders later in the same flush. Native-shaped, the overlay mounted in the
    // teleport's own place and MOVED a tick later — two insertions, the dealt card told twice.
    const Gate = defineComponent({
      components: {Leaf, ConsoleTeleport},
      props: {to: {type: String, required: true}, disabled: {type: Boolean, default: true}, on: {type: Boolean, default: false}},
      template: '<div class="host"><ConsoleTeleport :to="to" :disabled="disabled"><Leaf v-if="on" :n="1" /></ConsoleTeleport></div>',
    });
    const w = mount(Gate, {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    const inserted: Array<string> = [];
    const watcher = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement && n.classList.contains('leaf')) {
        inserted.push((r.target as HTMLElement).id || (r.target as HTMLElement).className);
      }
    })));
    watcher.observe(document.body, {childList: true, subtree: true});
    await w.setProps({disabled: false, on: true});
    expect(w.element.querySelector('.leaf'), 'nothing stands up in the teleport\'s own place').to.eq(null);
    const el = target('tp-a');
    await waitFor(() => el.querySelector('.leaf') !== null);
    await new Promise((r) => setTimeout(r, 0));
    watcher.disconnect();
    expect(inserted, 'ONE insertion — straight into the target').to.deep.eq(['tp-a']);
    w.unmount();
    expect(errors).to.deep.eq([]);
  });

  it('law 4 — the same with the target ALREADY there: the arriving content is inserted once, into the target', async () => {
    const Gate = defineComponent({
      components: {Leaf, ConsoleTeleport},
      props: {to: {type: String, required: true}, disabled: {type: Boolean, default: true}, on: {type: Boolean, default: false}},
      template: '<div class="host"><ConsoleTeleport :to="to" :disabled="disabled"><Leaf v-if="on" :n="1" /></ConsoleTeleport></div>',
    });
    const el = target('tp-a');
    const w = mount(Gate, {props: {to: '#tp-a'}, attachTo: document.body, global: config()});
    const inserted: Array<string> = [];
    const watcher = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement && n.classList.contains('leaf')) {
        inserted.push((r.target as HTMLElement).id || (r.target as HTMLElement).className);
      }
    })));
    watcher.observe(document.body, {childList: true, subtree: true});
    await w.setProps({disabled: false, on: true});
    await new Promise((r) => setTimeout(r, 0));
    watcher.disconnect();
    expect(el.querySelector('.leaf')).to.not.eq(null);
    expect(inserted, 'ONE insertion — straight into the target').to.deep.eq(['tp-a']);
    // …while content that STANDS keeps law 3: it moves, it is never re-mounted.
    await w.setProps({disabled: true});
    const leaf = w.element.querySelector('.leaf');
    expect(leaf, 'disabled again: back in place').to.not.eq(null);
    await w.setProps({disabled: false});
    expect(el.querySelector('.leaf'), 'the SAME node moved, not a fresh one').to.eq(leaf);
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

  /*
   * THE PRODUCT'S SHAPE: the parent is a VAPOR component, the content its slot, and the target may be a zone the same
   * parent renders — declared (`v-embed-zone`), and standing AFTER the teleport in its template, so the teleport is
   * created before its target exists.
   */
  describe('under a Vapor parent', () => {
    /** Where the leaf stands: `place` (the teleport's own place), the target's id, or `nowhere`. */
    const where = (root: Element): string => {
      const leaf = document.querySelector('.vp-tph__leaf');
      return leaf === null ? 'nowhere' : root.contains(leaf) && leaf.parentElement === root ? 'place' : (leaf.parentElement?.id ?? 'elsewhere');
    };
    /**
     * The ticks of ONE task — never a frame, never a timer: a zone's own mount re-asks the document after the flush
     * that inserted it, and the teleport moves in the flush after that.
     */
    const ticks = async (): Promise<void> => {
      await nextTick();
      await nextTick();
      await nextTick();
    };
    const insertions = (): {seen: Array<string>, stop: () => void} => {
      const seen: Array<string> = [];
      const watcher = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.classList.contains('vp-tph__leaf')) {
          seen.push((r.target as HTMLElement).id || (r.target as HTMLElement).className);
        }
      })));
      watcher.observe(document.body, {childList: true, subtree: true});
      return {seen, stop: () => watcher.disconnect()};
    };

    it('the wrapper adds NO ELEMENT to its host: disabled, the content is the host\'s only new child; teleported away, the host is as if nothing stood there', async () => {
      // The wrapper stands among its host's own children (the parties' grid, the government's dais, the shell's
      // root). Its two home marks are COMMENTS: an element — even a hidden one — is a child a script counts and a
      // `:first-child` / `:empty` a sheet reads (the dais' fit summed two hidden marks and their gaps).
      const w = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', disabled: true, zone: true, n: 1}, attachTo: document.body, global: config()});
      await ticks();
      const host = w.element as Element;
      expect(Array.from(host.children).map((el) => el.className), 'in place: the leaf and the host\'s own zone').to.deep.eq(['vp-tph__leaf', 'vp-tph__zone']);
      expect(host.firstElementChild?.matches(':first-child'), 'the content is the host\'s first element child').to.eq(true);
      await w.setProps({disabled: false});
      await ticks();
      expect(where(host)).to.eq('vp-tph-zone');
      expect(Array.from(host.children).map((el) => el.className), 'teleported: the host keeps only its own child').to.deep.eq(['vp-tph__zone']);
      expect(Array.from(document.querySelector('#vp-tph-zone')!.children).map((el) => el.className), '…and the zone holds the content alone').to.deep.eq(['vp-tph__leaf']);
      w.unmount();
      expect(errors).to.deep.eq([]);
    });

    it('a zone of the SAME parent, rendered after the teleport: the content stands in it in the mount\'s own flush — ONE insertion, no wait', async () => {
      const seen = insertions();
      const w = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', zone: true, n: 1}, attachTo: document.body, global: config()});
      await nextTick();
      expect(where(w.element as Element)).to.eq('vp-tph-zone');
      await new Promise((r) => setTimeout(r, 0));
      seen.stop();
      expect(seen.seen, 'straight into the zone').to.deep.eq(['vp-tph-zone']);
      await w.setProps({n: 2});
      expect(document.querySelector('.vp-tph__leaf')?.textContent).to.eq('2');
      w.unmount();
      expect(document.querySelector('.vp-tph__leaf')).to.eq(null);
      expect(errors).to.deep.eq([]);
    });

    it('law 1 and the zone that arrives LATER: nowhere while it is absent, into it the moment it is declared', async () => {
      const w = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', n: 1}, attachTo: document.body, global: config()});
      await nextTick();
      expect(where(w.element as Element)).to.eq('nowhere');
      await w.setProps({zone: true});
      await ticks();
      expect(where(w.element as Element), 'the zone\'s own mount re-asked the document — no frame of waiting').to.eq('vp-tph-zone');
      await w.setProps({zone: false});
      await w.setProps({n: 3});
      expect(errors, 'the zone left under the standing content').to.deep.eq([]);
      await w.setProps({zone: true});
      await ticks();
      expect(where(w.element as Element), 'a NEW element under the same selector receives the content (law 2)').to.eq('vp-tph-zone');
      expect(document.querySelector('.vp-tph__leaf')?.textContent).to.eq('3');
      w.unmount();
      expect(errors).to.deep.eq([]);
    });

    it('law 3 — what stands in place keeps standing while the zone is absent, and MOVES (the same node) when it comes', async () => {
      const w = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', disabled: true, n: 1}, attachTo: document.body, global: config()});
      const leaf = document.querySelector('.vp-tph__leaf');
      expect(where(w.element as Element)).to.eq('place');
      await w.setProps({disabled: false});
      expect(where(w.element as Element), 'enabled into an absent zone: it stays').to.eq('place');
      await w.setProps({zone: true});
      await ticks();
      expect(where(w.element as Element)).to.eq('vp-tph-zone');
      expect(document.querySelector('.vp-tph__leaf'), 'moved, never re-mounted').to.eq(leaf);
      await w.setProps({disabled: true});
      expect(where(w.element as Element), 'disabled again: back in place').to.eq('place');
      expect(document.querySelector('.vp-tph__leaf')).to.eq(leaf);
      w.unmount();
      expect(errors).to.deep.eq([]);
    });

    it('a zone that ARRIVES receives standing content INSIDE the flush that renders it — before the post hooks of that flush measure', async () => {
      // The first Vapor wrapper (`console-parliament-sitting-v3` red on that build): the zone's directive runs when
      // its element is CREATED, the wrapper asked the document on the spot (nothing yet) and moved a tick later —
      // after the post hooks of that flush had read the content where it stood.
      const measured: Array<string> = [];
      const onMeasured = (): void => {
        measured.push(where(w.element as Element));
      };
      const w = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', disabled: true, n: 1, onMeasured}, attachTo: document.body, global: config()});
      await ticks();
      await w.setProps({disabled: false});
      await ticks();
      expect(where(w.element as Element), 'law 3: it stands in place while the zone is absent').to.eq('place');
      const seen = insertions();
      await w.setProps({zone: true});
      await new Promise((r) => setTimeout(r, 0));
      seen.stop();
      expect(measured, 'the post-flush hook of the arrival already finds the content in the zone').to.deep.eq(['vp-tph-zone']);
      expect(seen.seen, 'moved once').to.deep.eq(['vp-tph-zone']);
      w.unmount();
      expect(errors).to.deep.eq([]);
    });

    it('law 4 — content that arrives with the enable never stands up in place: ONE insertion, into the zone — absent or present', async () => {
      const absent = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', disabled: true, on: false}, attachTo: document.body, global: config()});
      const first = insertions();
      await absent.setProps({disabled: false, on: true});
      expect(where(absent.element as Element), 'nothing stands up in the teleport\'s own place').to.eq('nowhere');
      await absent.setProps({zone: true});
      await ticks();
      expect(where(absent.element as Element)).to.eq('vp-tph-zone');
      await new Promise((r) => setTimeout(r, 0));
      first.stop();
      expect(first.seen).to.deep.eq(['vp-tph-zone']);
      absent.unmount();

      const present = mount(VaporTeleportHost, {props: {to: '#vp-tph-zone', disabled: true, on: false, zone: true}, attachTo: document.body, global: config()});
      const second = insertions();
      await present.setProps({disabled: false, on: true});
      await new Promise((r) => setTimeout(r, 0));
      second.stop();
      expect(second.seen).to.deep.eq(['vp-tph-zone']);
      present.unmount();
      expect(errors).to.deep.eq([]);
    });
  });
});
