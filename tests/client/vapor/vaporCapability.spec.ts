/*
 * WHAT VAPOR TAKES FOR US — the capability table of the road to `createVaporApp(App)`, as executable facts.
 *
 * Every row of `docs/claude/vapor/ROADMAP.md` §3.6 («the Vapor probe») is a test here: a Vapor single-file component
 * (`<script setup vapor>`, compiled by the same webpack toolchain the product is built with — vue-loader +
 * `scripts/vapor/sfcTemplateCompiler.cjs`) mounted INSIDE a virtual-DOM application through `vaporInteropPlugin`,
 * which is exactly how every wave of the rework will run until the last component is converted.
 *
 * The suite is the pilot's result AND its regression net: a new release candidate re-reads the table by running it.
 * A row that turns red on a bump is a Vapor regression to report upstream or a recipe of §4 to change — never
 * something to discover in the middle of a wave.
 *
 * What the pilot found that is NOT a green row is written down where it is asserted:
 *  · `@vue/test-utils` cannot mount a Vapor component as the ROOT (it reads `vm.$` / walks `subTree`) — a spec mounts
 *    it under a virtual-DOM host with an element root (`mountVapor`); DOM-level finders work, `findComponent` on a
 *    Vapor child does not;
 *  · `getCurrentInstance()` is `null` in a Vapor `setup` — the flow kernel's binding does not use it;
 *  · a custom directive is IMPORTED, in a form both runtimes call — `src/client/directives/vDirectives.ts`.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineAsyncComponent, defineComponent, h, nextTick, reactive, ref} from 'vue';
import type {Component} from 'vue';
import i18nPlugin from '@/client/plugins/i18n.plugin';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleAppScope, endConsoleSession, useConsoleSession} from '@/client/console/session/consoleSession';
import VaporBasics from './fixtures/VaporBasics.vue';
import VaporTransitionProbe from './fixtures/VaporTransitionProbe.vue';
import VaporI18nProbe from './fixtures/VaporI18nProbe.vue';
import SetupI18nProbe from './fixtures/SetupI18nProbe.vue';
import VaporTeleportProbe from './fixtures/VaporTeleportProbe.vue';
import VaporHostsVdom from './fixtures/VaporHostsVdom.vue';
import VaporFlowProbe from './fixtures/VaporFlowProbe.vue';
import VaporIfRoot from './fixtures/VaporIfRoot.vue';
import {lendFrames} from './lendFrames';

type Slots = Record<string, (props: Record<string, unknown>) => unknown>;

/**
 * Mount a Vapor component the way the product does during the rework: inside a virtual-DOM app with the interop
 * plugin, under a host whose root is an ELEMENT (test-utils walks the host's vnode tree and cannot enter a Vapor one).
 * `props` is reactive: write to it and the Vapor child follows.
 */
function mountVapor<P extends Record<string, unknown>>(component: Component, props: P, options: {slots?: Slots, listeners?: Record<string, (...args: Array<never>) => void>, setup?: () => void} = {}) {
  const live = reactive(props) as P;
  const Host = defineComponent({
    setup() {
      options.setup?.();
      return () => h('div', {'data-vapor-host': ''}, [h(component as never, {...live, ...options.listeners}, options.slots as never)]);
    },
  });
  // `vaporInteropPlugin` is installed for every mount of the bundle (tests/client/components/bundleSetup.ts).
  const wrapper = mount(Host, {global: {plugins: [i18nPlugin]}, attachTo: document.body});
  const root = (): Element => wrapper.element as Element;
  return {wrapper, root, props: live, q: (selector: string) => root().querySelector<HTMLElement>(selector)};
}

const RU: Record<string, string> = {
  'Research phase': 'Фаза исследований',
  'Action phase': 'Фаза действий',
  'Production phase': 'Фаза производства',
  'Draw ${0} cards': 'Возьмите карт: ${0}',
};

describe('Vapor in the virtual-DOM app — what it takes (vue 3.6.0-rc.15, through vaporInteropPlugin)', () => {
  it('the toolchain compiles a `<script setup vapor>` SFC as a Vapor component — in the non-inline (test / dev) mode too', () => {
    const def = VaporBasics as unknown as {__vapor?: boolean, render?: unknown, setup?: unknown};
    expect(def.__vapor, 'compiler-sfc marked it').to.equal(true);
    expect(def.render, 'the template loader attached a render — compiled by @vue/compiler-vapor (sfcTemplateCompiler.cjs)').to.be.a('function');
    // A virtual-DOM render function takes (_ctx, _cache, …) and returns vnodes; a Vapor one takes the setup state and
    // returns DOM. The proof it is the right compiler's output is that the rows below mount at all.
  });

  it('props, text, class / attribute bindings, `v-for` (keyed), `v-if` / `v-else`, `v-show`, `v-html`, `v-model`, `<component :is>`', async () => {
    const {props, q, wrapper} = mountVapor(VaporBasics, {label: 'hits', items: [{id: 1, name: 'one'}], on: false, html: '<s>raw</s>', tag: 'u'});
    expect(q('.vp-basics__label')!.textContent).to.equal('hits: 0');
    expect(q('.vp-basics')!.getAttribute('data-total')).to.equal('1');
    expect(q('.vp-basics__else'), '`v-else`').to.not.equal(null);
    expect(q('.vp-basics__show')!.style.display, '`v-show` false').to.equal('none');
    expect(q('.vp-basics__html')!.innerHTML).to.equal('<s>raw</s>');
    expect(q('.vp-basics__dynamic')!.tagName).to.equal('U');

    props.label = 'taps';
    props.on = true;
    props.items = [{id: 2, name: 'two'}, {id: 1, name: 'one'}];
    props.tag = 'mark';
    await nextTick();
    expect(q('.vp-basics__label')!.textContent, 'a prop from the vdom parent is reactive').to.equal('taps: 0');
    expect(q('.vp-basics')!.classList.contains('vp-basics--on')).to.equal(true);
    expect([...wrapper.element.querySelectorAll('.vp-basics__item')].map((el) => el.getAttribute('data-id'))).to.deep.equal(['2', '1']);
    expect(q('.vp-basics__if'), '`v-if`').to.not.equal(null);
    expect(q('.vp-basics__else')).to.equal(null);
    expect(q('.vp-basics__show')!.style.display).to.equal('');
    expect(q('.vp-basics__dynamic')!.tagName).to.equal('MARK');

    const input = q('.vp-basics__input') as HTMLInputElement;
    input.value = 'typed';
    input.dispatchEvent(new window.Event('input'));
    await nextTick();
    expect(q('.vp-basics__typed')!.textContent, '`v-model`').to.equal('typed');
  });

  it('an `emit` reaches the virtual-DOM parent\'s listener; `defineExpose` is what a parent\'s ref sees', async () => {
    const heard: Array<number> = [];
    const child = ref<{bump(): void, count: number} | null>(null);
    const Host = defineComponent({
      setup: () => () => h('div', [h(VaporBasics as never, {label: 'x', ref: child, onBumped: (n: number) => heard.push(n)})]),
    });
    const wrapper = mount(Host, {attachTo: document.body});
    (wrapper.element as Element).querySelector<HTMLElement>('.vp-basics__label')!.click();
    await nextTick();
    expect(heard, 'a native click inside → `emit` → the vdom listener').to.deep.equal([1]);
    expect(child.value, 'the ref of a Vapor child is its EXPOSED object').to.not.equal(null);
    child.value!.bump();
    await nextTick();
    expect(heard).to.deep.equal([1, 2]);
    expect(wrapper.element.querySelector('.vp-basics__label')!.textContent).to.equal('x: 2');
  });

  it('attributes and a class from the vdom parent fall through onto a `v-if` ROOT — again every time the root comes back', async () => {
    const opened: Array<number> = [];
    const {props, q} = mountVapor(VaporIfRoot, {'shown': true, 'data-unfold-late': '', 'class': 'from-parent'}, {listeners: {onOpen: () => opened.push(1)}});
    const expectDressed = (when: string): void => {
      const root = q('.vp-ifroot')!;
      expect(root, when).to.not.equal(null);
      expect(root.hasAttribute('data-unfold-late'), `${when}: the parent's attribute`).to.equal(true);
      expect(root.hasAttribute('data-own'), `${when}: its own attribute`).to.equal(true);
      expect(root.classList.contains('from-parent'), `${when}: the parent's class beside its own`).to.equal(true);
    };
    expectDressed('at the mount');
    props.shown = false;
    await nextTick();
    expect(q('.vp-ifroot')).to.equal(null);
    props.shown = true;
    await nextTick();
    expectDressed('after the root came back');
    q('.vp-ifroot')!.click();
    expect(opened, 'the emit of the returned root').to.deep.equal([1]);
  });

  it('…and onto a `v-if` root that was ABSENT at the mount, when it arrives', async () => {
    const {props, q} = mountVapor(VaporIfRoot, {'shown': false, 'data-unfold-late': '', 'class': 'from-parent'});
    expect(q('.vp-ifroot')).to.equal(null);
    props.shown = true;
    await nextTick();
    const root = q('.vp-ifroot')!;
    expect(root.hasAttribute('data-unfold-late')).to.equal(true);
    expect(root.classList.contains('from-parent')).to.equal(true);
    // ⚠ Only because the fixture's template starts with its root. With a COMMENT before the root a development build
    // (and this bundle) keeps the comment, the root is a fragment and the attributes are dropped with a warning; a
    // production build strips the comment and inherits them. The rule is a guard, not a hope:
    // tests/console/vaporReadiness.spec.ts § a Vapor template starts with its root.
  });

  it('events are NOT delegated to the document (rc.2+: delegation is opt-in) — `.stop` shields exactly what it did, and a listener above still hears a plain click', async () => {
    const {q, wrapper} = mountVapor(VaporBasics, {label: 'x'});
    let aboveHeard = 0;
    wrapper.element.addEventListener('click', () => aboveHeard++);
    q('.vp-basics__label')!.click();
    expect(aboveHeard, 'a plain `@click` bubbles to a listener above the component').to.equal(1);
    q('.vp-basics__stop')!.click();
    await nextTick();
    expect(q('.vp-basics__stop')!.textContent, 'the `.stop` handler itself ran').to.equal('stop 1');
    expect(aboveHeard, '…and stopped the event exactly there').to.equal(1);
    // The listeners are on the ELEMENTS: nothing of the component hangs on `document` (the console's key bridge and
    // its input-absorb ledger listen at the window and must not be bypassed by a delegated handler).
    const el = q('.vp-basics__label') as unknown as Record<string, unknown>;
    expect(Object.keys(el).filter((key) => key.startsWith('$evt')), 'no delegated-event slot on the element').to.deep.equal([]);
  });

  describe('`<Transition>` / `<TransitionGroup>`', () => {
    // A Vapor `<Transition>` is the real one in a spec and needs a frame source there (`lendFrames.ts`).
    let giveBack: () => Promise<void>;
    beforeEach(() => {
      giveBack = lendFrames();
    });
    afterEach(() => giveBack());

    it('over a keyed `v-if` and a list: enter / leave hooks fire, classes are applied, a new key replays the enter', async () => {
      const state = reactive({edge: '', nonce: 0, rows: ['a']});
      const log: Array<string> = [];
      const {q, wrapper} = mountVapor(VaporTransitionProbe, {state, log});
      expect(q('.vp-tr__notice')).to.equal(null);

      state.edge = 'no-prev';
      await nextTick();
      expect(q('.vp-tr__notice')!.className, 'the enter classes').to.match(/vp-fade-enter-(from|active|to)/);
      expect(log).to.include('before-enter');

      state.nonce++; // the same edge pressed again: the keyed node is REPLACED — the pop replays
      await nextTick();
      expect(log.filter((hook) => hook === 'before-enter'), 'a new key is a new enter').to.have.length(2);
      expect(log).to.include('before-leave');

      state.rows.push('b');
      await nextTick();
      expect([...wrapper.element.querySelectorAll('.vp-tr__row')].map((el) => el.textContent)).to.deep.equal(['a', 'b']);
      expect(wrapper.element.querySelector('.vp-tr__list')!.tagName, '`<TransitionGroup tag>`').to.equal('UL');
    });
  });

  describe('`v-i18n` — the directive as an import, one binding for both runtimes (src/client/directives/vDirectives.ts)', () => {
    let originalTranslations: unknown;
    beforeEach(() => {
      originalTranslations = (window as unknown as {_translations: unknown})._translations;
      (window as unknown as {_translations: unknown})._translations = RU;
      PreferencesManager.INSTANCE.set('lang', 'ru');
    });
    afterEach(() => {
      (window as unknown as {_translations: unknown})._translations = originalTranslations;
      PreferencesManager.INSTANCE.set('lang', 'en');
    });

    it('static text, an interpolation, params and a late `v-if` branch are translated — at the first frame and after every change', async () => {
      const {props, q} = mountVapor(VaporI18nProbe, {text: 'Research phase', amount: 2, extra: false});
      // No `await`: the translation is there when `mount()` returns.
      expect(q('.vp-i18n__static')!.textContent).to.equal('Фаза исследований');
      expect(q('.vp-i18n__dynamic')!.textContent).to.equal('Фаза исследований');
      expect(q('.vp-i18n__params')!.textContent).to.equal('Возьмите карт: 2');
      expect(q('.vp-i18n__fn')!.textContent, '`$t` is an imported binding, not a global property').to.equal('Фаза исследований');
      expect(q('.vp-i18n__static')!.getAttribute('tm-has-i18n')).to.equal('true');

      props.text = 'Production phase'; // the text binding writes the ENGLISH string straight into the node
      props.amount = 5; // the params change, the template does not
      props.extra = true; // an element created after the mount
      await nextTick();
      expect(q('.vp-i18n__dynamic')!.textContent, 'the directive followed the text it owns').to.equal('Фаза производства');
      expect(q('.vp-i18n__params')!.textContent, 're-substituted from the remembered English template').to.equal('Возьмите карт: 5');
      expect(q('.vp-i18n__late')!.textContent).to.equal('Фаза действий');
      expect(q('.vp-i18n__fn')!.textContent).to.equal('Фаза производства');
    });

    it('the SAME imports in a `<script setup>` component that is not Vapor yet: translated on mount and after every update', async () => {
      const props = reactive({text: 'Research phase', amount: 2});
      const Host = defineComponent({setup: () => () => h('div', [h(SetupI18nProbe as never, {...props})])});
      const wrapper = mount(Host, {attachTo: document.body});
      const q = (selector: string) => (wrapper.element as Element).querySelector<HTMLElement>(selector)!;
      expect(q('.st-i18n__static').textContent).to.equal('Фаза исследований');
      expect(q('.st-i18n__dynamic').textContent).to.equal('Фаза исследований');
      expect(q('.st-i18n__params').textContent).to.equal('Возьмите карт: 2');
      expect(q('.st-i18n__fn').textContent).to.equal('Фаза исследований');
      expect([...q('.st-i18n').childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && (node as Text).data.trim() === '')).to.deep.equal([]);

      props.text = 'Production phase';
      props.amount = 5;
      await nextTick();
      expect(q('.st-i18n__dynamic').textContent, 'the virtual DOM calls the binding again on `updated`').to.equal('Фаза производства');
      expect(q('.st-i18n__params').textContent).to.equal('Возьмите карт: 5');
    });

    it('`v-trim-whitespace` (in a Vapor component) leaves no whitespace-only text node in the row', () => {
      const {q} = mountVapor(VaporI18nProbe, {text: 'Research phase', amount: 1, extra: false});
      const blanks = [...q('.vp-i18n')!.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && (node as Text).data.trim() === '');
      expect(blanks).to.deep.equal([]);
    });

    it('a Vapor PARENT hosts an Options-API CHILD: its props, its `$emit`, the slot it is given — and the child keeps the GLOBAL `v-i18n` / `$t`', async () => {
      const {props, q} = mountVapor(VaporHostsVdom, {label: 'Research phase'});
      expect(q('.opt-child__label')!.textContent, 'the vdom child\'s global directive').to.equal('Фаза исследований');
      expect(q('.opt-child__t')!.textContent, '…and its global `$t`').to.equal('Фаза исследований');
      expect(q('.vp-hosts__slot')!.textContent, 'a scoped slot passed DOWN from Vapor into vdom').to.equal('slot 7');
      q('.opt-child')!.click();
      await nextTick();
      expect(q('.vp-hosts__picked')!.textContent, 'the vdom child\'s `$emit` is heard by the Vapor parent').to.equal('Research phase!');
      props.label = 'Action phase';
      await nextTick();
      expect(q('.opt-child__label')!.textContent).to.equal('Фаза действий');
    });
  });

  it('`<Teleport :to :disabled>` with a default and a scoped slot from the vdom parent — the embedded-step chain', async () => {
    const zone = document.createElement('div');
    zone.id = 'vp-zone';
    document.body.appendChild(zone);
    try {
      const {props, q} = mountVapor(VaporTeleportProbe, {to: '#vp-zone', disabled: true, n: 1}, {
        slots: {
          default: () => h('b', {class: 'vp-tp__slotted'}, 'from the parent'),
          foot: ({n}) => h('i', {class: 'vp-tp__foot'}, `foot ${String(n)}`),
        },
      });
      expect(q('.vp-tp .vp-tp__content'), 'disabled: rendered in place').to.not.equal(null);
      expect(q('.vp-tp__slotted')!.textContent, 'a vdom slot rendered inside Vapor').to.equal('from the parent');
      expect(q('.vp-tp__foot')!.textContent, 'a scoped slot receives its props').to.equal('foot 1');

      const node = q('.vp-tp__content');
      props.disabled = false;
      props.n = 2;
      await nextTick();
      expect(zone.querySelector('.vp-tp__content'), 'enabled: the SAME node moved into the zone').to.equal(node);
      expect(zone.querySelector('.vp-tp__foot')!.textContent).to.equal('foot 2');

      props.disabled = true;
      await nextTick();
      expect(q('.vp-tp .vp-tp__content'), '…and back, the same node').to.equal(node);
    } finally {
      zone.remove();
    }
  });

  it('a virtual-DOM `defineAsyncComponent` loads a Vapor component (the lazy chunks of the console)', async () => {
    const Lazy = defineAsyncComponent(() => Promise.resolve(VaporBasics as never));
    const Host = defineComponent({setup: () => () => h('div', [h(Lazy as never, {label: 'lazy'})])});
    const wrapper = mount(Host, {attachTo: document.body});
    for (let i = 0; i < 6; i++) {
      await nextTick(); // the loader's promise, the wrapper's re-render, the Vapor child's mount
    }
    expect(wrapper.element.querySelector('.vp-basics__label')?.textContent).to.equal('lazy: 0');
  });

  describe('the flow kernel in a Vapor component', () => {
    afterEach(() => {
      setFlowClock(undefined);
      endConsoleSession();
    });

    it('`useFlowScope` binds without an instance: inside a shell — the shell\'s session; its wait is taken back on unmount; lifecycle hooks and `useTemplateRef` work', async () => {
      const clock = createManualClock(0);
      setFlowClock(clock);
      const seen: {flow?: FlowScope, instance?: unknown, scope?: unknown, rootTag?: string, hooks: Array<string>} = {hooks: []};
      let session: FlowScope | undefined;
      const {wrapper} = mountVapor(VaporFlowProbe, {seen}, {setup: () => {
        session = useConsoleSession(); // the host plays the console shell
      }});

      expect(seen.instance, '`getCurrentInstance()` answers null inside a Vapor component').to.equal(null);
      expect(seen.scope, '…while its effect scope is there').to.not.equal(undefined);
      expect(seen.flow!.parent, 'the session came down by `inject` — no instance was asked').to.equal(session);
      expect(seen.hooks).to.deep.equal(['mounted']);
      expect(seen.rootTag, '`useTemplateRef` on its own root').to.equal('I');

      wrapper.unmount();
      await nextTick();
      expect(seen.hooks).to.deep.equal(['mounted', 'unmounted']);
      expect(seen.flow!.ended, 'the scope ended with its component').to.not.equal(undefined);
      clock.advance(120_000);
      expect(seen.flow!.ended, 'nothing of it fired after it left').to.not.equal(undefined);
      expect(document.querySelector('.vp-flow'), 'gone from the document').to.equal(null);
    });

    it('outside any shell a Vapor component\'s scope is the PAGE\'s', () => {
      const seen: {flow?: FlowScope, hooks: Array<string>} = {hooks: []};
      mountVapor(VaporFlowProbe, {seen});
      expect(seen.flow!.parent).to.equal(consoleAppScope());
    });
  });
});
