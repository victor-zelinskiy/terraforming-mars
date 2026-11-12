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
import {defineAsyncComponent, defineComponent, h, nextTick, provide, reactive, ref} from 'vue';
import type {Component} from 'vue';
import i18nPlugin from '@/client/plugins/i18n.plugin';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {FlowScope} from '@/client/console/kernel/flowScope';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {consoleAppScope, endConsoleSession, useConsoleSession} from '@/client/console/session/consoleSession';
import VaporBasics from './fixtures/VaporBasics.vue';
import VaporTransitionProbe from './fixtures/VaporTransitionProbe.vue';
import VaporI18nProbe from './fixtures/VaporI18nProbe.vue';
import SetupI18nProbe from './fixtures/SetupI18nProbe.vue';
import VaporTeleportProbe from './fixtures/VaporTeleportProbe.vue';
import VaporHostsVdom from './fixtures/VaporHostsVdom.vue';
import VaporFlowProbe from './fixtures/VaporFlowProbe.vue';
import VaporIfRoot from './fixtures/VaporIfRoot.vue';
import VaporShellProbe from './fixtures/VaporShellProbe.vue';
import VaporDirectivesProbe from './fixtures/VaporDirectivesProbe.vue';
import SetupDirectivesProbe from './fixtures/SetupDirectivesProbe.vue';
import VaporRefsProbe from './fixtures/VaporRefsProbe.vue';
import VaporContextProbe from './fixtures/VaporContextProbe.vue';
import VaporKeyProbe from './fixtures/VaporKeyProbe.vue';
import VaporTeleportLate from './fixtures/VaporTeleportLate.vue';
import {embedZoneMounted, resetEmbedZones} from '@/client/console/embedZoneRegistry';
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
  'Action: Research phase': 'Действие: Фаза исследований',
  'Action: Production phase': 'Действие: Фаза производства',
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

    /*
     * THE LOCAL DIRECTIVES (RECIPES.md § R17). `v-strip-action-prefix` / `v-strip-effect-prefix` rewrite the text
     * `v-i18n` translated; `v-embed-zone` has a LIFETIME — the registry must learn that its element LEFT. One imported
     * binding each (`dualDirective`), the same line in a `<script setup>` component before and after it gains `vapor`.
     * The virtual-DOM half pins what `dualDirective` leans on: a function directive's `unmounted`, set on `binding.dir`.
     */
    for (const [form, component] of [['a Vapor component', VaporDirectivesProbe], ['a `<script setup>` component on the virtual DOM', SetupDirectivesProbe]] as const) {
      it(`the local directives in ${form}: the text is rewritten after the translation and follows a change; the zone registers AND unregisters`, async () => {
        resetEmbedZones();
        const props = reactive({action: 'Action: Research phase', effect: 'Effect: gain a plant', zone: true});
        const Host = defineComponent({setup: () => () => h('div', [h(component as never, {...props})])});
        const wrapper = mount(Host, {attachTo: document.body});
        const q = (selector: string) => (wrapper.element as Element).querySelector<HTMLElement>(selector)!;
        const settled = async (): Promise<void> => {
          await nextTick(); // the patch / the text effects
          await Promise.resolve(); // the observers' records (a Vapor element follows its text through one)
          await nextTick();
        };
        await settled();
        expect(q('.dd__action').textContent, 'translated, THEN stripped').to.equal('Фаза исследований');
        expect(q('.dd__effect').textContent).to.equal('Gain a plant');
        expect(embedZoneMounted('[data-embed-slot="probe"]'), 'the zone stands in the registry').to.equal(true);

        props.action = 'Action: Production phase';
        props.effect = 'Effect: lose a plant';
        await settled();
        expect(q('.dd__action').textContent, 'a new string is translated and stripped again').to.equal('Фаза производства');
        expect(q('.dd__effect').textContent).to.equal('Lose a plant');

        props.zone = false;
        await settled();
        expect(embedZoneMounted('[data-embed-slot="probe"]'), 'the element left — the directive\'s `unmounted` ran').to.equal(false);
        props.zone = true;
        await settled();
        expect(embedZoneMounted('[data-embed-slot="probe"]')).to.equal(true);
        wrapper.unmount();
        await settled();
        expect(embedZoneMounted('[data-embed-slot="probe"]'), '…and with its component').to.equal(false);
      });
    }

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

  /*
   * TEMPLATE REFS (RECIPES.md § R11 · R12 · R16). What `this.$refs` / `this.$el` become, and what each kind of ref holds.
   */
  it('template refs in a Vapor component: its root, an ARRAY for a ref inside `v-for`, a function ref, a vdom child\'s public instance, a Vapor child\'s exposed object; `provide` reaches a vdom child', async () => {
    type Seen = {rootTag?: string, rows?: () => Array<string>, fn?: Array<string>, pressVdom?: () => number, vaporKeys?: Array<string>, bumpVapor?: () => void};
    const seen: Seen = {};
    const {props, q, wrapper} = mountVapor(VaporRefsProbe, {count: 2, seen});
    expect(seen.rootTag, '`useTemplateRef` on the root — what `this.$el` was').to.equal('DIV');
    expect(seen.rows!(), 'a ref inside `v-for` is an array, in order').to.deep.equal(['1', '2']);
    expect(seen.fn, 'a function ref is called with the element').to.deep.equal(['B']);
    expect(q('.opt-ctx')!.getAttribute('data-theme'), 'a Vapor `provide` reaches an Options child\'s `inject`').to.equal('from-vapor');
    expect(seen.pressVdom!(), 'a ref of a virtual-DOM child is its public instance — its methods are callable').to.equal(1);
    await nextTick();
    expect(q('.opt-ctx')!.textContent).to.equal('1');
    expect(seen.vaporKeys, 'a ref of a Vapor child is what it `defineExpose`d — nothing else').to.deep.equal(['bump', 'count']);
    seen.bumpVapor!();
    await nextTick();
    expect(q('.vp-basics__label')!.textContent).to.equal('inner: 1');

    props.count = 3;
    await nextTick();
    expect(seen.rows!(), 'the array follows the list').to.deep.equal(['1', '2', '3']);
    wrapper.unmount();
    await nextTick();
    expect(seen.fn, '…and with `null` when the element leaves').to.deep.equal(['B', 'null']);
  });

  /*
   * CONTEXT AND HOOKS (RECIPES.md § R9 · R13 · R16).
   */
  it('context in a Vapor component: `inject` from a vdom ancestor, `inheritAttrs: false` + `useAttrs`, `$slots` and `$emit` in the template, a `post` watcher over the written DOM, `onErrorCaptured`', async () => {
    const seen: {hooks: Array<string>, post?: string, captured?: string} = {hooks: []};
    const picked: Array<string> = [];
    const {props, q} = mountVapor(VaporContextProbe, {'n': 1, 'armed': false, seen, 'data-probe': 'fell-through'}, {
      slots: {extra: () => h('b', {class: 'vp-ctx__extra'}, 'extra')},
      listeners: {onPicked: ((theme: string) => picked.push(theme)) as never},
      setup: () => provide('probe-theme', 'from-vdom'),
    });
    expect(q('.vp-ctx')!.getAttribute('data-theme'), '`inject` of what the virtual-DOM host provided').to.equal('from-vdom');
    expect(q('.vp-ctx')!.getAttribute('data-probe'), '`inheritAttrs: false` — nothing falls on the root').to.equal(null);
    expect(q('.vp-ctx__inner')!.getAttribute('data-probe'), '…`v-bind="attrs"` puts it where the component says').to.equal('fell-through');
    expect(q('.vp-ctx__has'), '`$slots.extra` in the template').to.not.equal(null);
    expect(q('.vp-ctx__extra')!.textContent).to.equal('extra');
    q('.vp-ctx__inner')!.click();
    expect(picked, '`$emit` in the template reaches the vdom parent').to.deep.equal(['from-vdom']);

    props.n = 2;
    await nextTick();
    expect(q('.vp-ctx__updates')!.textContent, 'a watcher of a prop ran').to.equal('2');
    expect(seen.post, 'a `flush: \'post\'` watcher reads the DOM the same change wrote').to.equal('2');
    expect(seen.hooks, '`onBeforeUpdate` / `onUpdated` fire when the component\'s own bindings re-ran').to.deep.equal(['beforeUpdate', 'updated']);

    props.armed = true;
    await nextTick();
    await nextTick();
    expect(seen.captured, '`onErrorCaptured` over a virtual-DOM child — the error stops here (it returned false)').to.equal('the child threw');
    await nextTick();
    expect(q('.vp-ctx__caught')!.textContent, '…and what the handler wrote is on screen').to.equal('the child threw');
  });

  /*
   * WHAT A CONVERSION MEETS THAT IS NOT AN OPTION BLOCK (RECIPES.md § R0 · R6 · R16).
   */
  it('`:key` re-mounts a plain element and swaps a `<Transition>`\'s child; an injected REF arrives as the ref and is followed; two prop watchers run in their SOURCES\' trigger order', async () => {
    const giveBack = lendFrames();
    try {
      const live = ref('one');
      const {props, q, wrapper} = mountVapor(VaporKeyProbe, {nonce: 1, text: 'alpha', a: 1, b: 1, cards: ['x', 'y', 'z']}, {setup: () => provide('probe-live', live)});
      const cards = (): Array<string> => [...wrapper.element.querySelectorAll('.vp-key__card')].map((el) => el.textContent ?? '');
      expect(cards()).to.deep.equal(['x', 'y', 'z']);
      const first = q('.vp-key__node')!;
      expect(q('.vp-key')!.getAttribute('data-live'), 'the template unwraps the injected ref').to.equal('one');
      live.value = 'two';
      await nextTick();
      expect(q('.vp-key')!.getAttribute('data-live'), '…and follows it').to.equal('two');

      props.nonce = 2;
      await nextTick();
      const second = q('.vp-key__node')!;
      expect(second, 'a new key is a NEW node — the forced re-mount a flip restarts on').to.not.equal(first);
      expect(second.textContent).to.equal('2');
      expect(wrapper.element.querySelectorAll('.vp-key__node').length).to.equal(1);

      const before = q('.vp-key__swap')!;
      props.text = 'beta';
      await nextTick();
      const swaps = [...wrapper.element.querySelectorAll('.vp-key__swap')];
      expect(swaps.some((el) => el !== before && el.textContent === 'beta'), 'the keyed child of a `<Transition>` (no `v-if`): the new node entered').to.equal(true);
      await nextTick();
      await nextTick();

      props.cards = ['p', 'q', 'r'];
      await nextTick();
      expect(cards(), 'every key of a `v-for` changed at once').to.deep.equal(['p', 'q', 'r']);
      expect(q('.vp-key')!.getAttribute('data-seated'), 'the function refs seated the NEW nodes, index-aligned (the `null` of a leaving node did not land on its successor)').to.equal('p,q,r');

      // Two props, one parent update, two watchers declared b-then-a: they run in the order their SOURCES were written.
      props.a = 2;
      props.b = 2;
      await nextTick();
      expect(q('.vp-key')!.getAttribute('data-order'), 'TRIGGER order (a was written first), not declaration order — the contract of the tick, as on the virtual DOM (`vueTickOrder.spec`). A pair whose order matters is ONE watch (RECIPES § R6)').to.equal('a>b');
    } finally {
      await giveBack();
    }
  });

  /*
   * A TELEPORT WHOSE TARGET IS NOT THERE YET (RECIPES.md § R18). The virtual-DOM teleport mounted nothing into an absent
   * target and THREW on the next patch — the reason `foundation/ConsoleTeleport.vue` is a render function over its own
   * `subTree`. The Vapor one does not throw; it also never looks for its target again. So the rewrite is a TEMPLATE:
   * the same «wait for the target» loop, and a `v-if` + `:key` that stands the teleport once the target exists.
   */
  it('a Vapor `<Teleport>` and an absent target: nothing is mounted, a patch does NOT throw, the target is never re-resolved — a re-mount (or `disabled`) is what places the content', async () => {
    const facts: Array<string> = [];
    const where = (root: Element): string => {
      const el = document.querySelector('.vp-late__content');
      return el === null ? 'nowhere' : root.contains(el) ? 'in place' : (el.parentElement?.id ?? 'elsewhere');
    };
    const errors: Array<string> = [];
    const onError = (event: ErrorEvent): void => {
      errors.push(event.message);
    };
    window.addEventListener('error', onError);
    const warn = console.warn;
    const warned: Array<string> = [];
    console.warn = (...args: Array<unknown>): void => {
      warned.push(String(args[0]).slice(0, 90));
    };
    try {
      const {props, wrapper} = mountVapor(VaporTeleportLate, {to: '#vp-late-zone', disabled: false, n: 1, armed: true});
      const root = wrapper.element as Element;
      facts.push(`mounted, target absent: ${where(root)}`);
      try {
        props.n = 2;
        await nextTick();
        facts.push(`patched, target absent: ${where(root)} text=${document.querySelector('.vp-late__content')?.textContent ?? '-'}`);
      } catch (error) {
        facts.push(`patch THREW: ${(error as Error).message.slice(0, 60)}`);
      }
      const zone = document.createElement('div');
      zone.id = 'vp-late-zone';
      document.body.appendChild(zone);
      props.n = 3;
      await nextTick();
      facts.push(`target arrived + patch: ${where(root)} text=${document.querySelector('.vp-late__content')?.textContent ?? '-'}`);
      props.armed = false;
      await nextTick();
      props.armed = true;
      await nextTick();
      facts.push(`re-mounted with the target present: ${where(root)}`);
      props.disabled = true;
      await nextTick();
      facts.push(`disabled: ${where(root)}`);
      props.disabled = false;
      await nextTick();
      facts.push(`enabled again: ${where(root)}`);
      wrapper.unmount();
      await nextTick();
      facts.push(`unmounted: ${where(root)}`);
      zone.remove();
    } finally {
      console.warn = warn;
      window.removeEventListener('error', onError);
    }
    expect(facts).to.deep.equal([
      'mounted, target absent: nowhere',
      'patched, target absent: nowhere text=-',
      'target arrived + patch: nowhere text=-',
      're-mounted with the target present: vp-late-zone',
      'disabled: in place',
      'enabled again: vp-late-zone',
      'unmounted: nowhere',
    ]);
    expect(errors, 'no patch of a teleport with an absent target throws').to.deep.equal([]);
    expect(warned.some((line) => line.includes('Failed to locate Teleport target')), 'the runtime SAYS the target is missing (a development build)').to.equal(true);
  });

  /*
   * THE SHELL'S COMPOSITION (architecture v2 — S-last). `ConsoleShell.vue` is a template over `useConsoleShell(props)`:
   * controllers behind a late-bound port, surfaces in a registry, an ordered reactions table, two wiring hooks. None of
   * it asks for a component instance — this row is the proof that the SHAPE runs inside a Vapor component, so the
   * shell's own conversion is a change of form (how the template names the members), never of mechanism.
   */
  it('the shell\'s composition runs in a Vapor component: a port with no instance, a surface in the registry, the reactions table, the wiring hooks', async () => {
    const seen: {log: Array<string>, instance?: unknown, surfaces?: SurfaceRegistry, reset?: () => void} = {log: []};
    const {wrapper, props, q} = mountVapor(VaporShellProbe, {playerView: {gameAge: 1}, seen});
    const shell = q('.vp-shell')!;

    expect(seen.instance, 'no instance behind the composition').to.equal(null);
    expect([shell.dataset.count, shell.dataset.doubled, shell.dataset.age], 'the template reads the members; one controller reads the other through the port; a prop comes through it')
      .to.deep.equal(['1', '2', '1']);
    expect(seen.log, 'the wiring hook ran after the surface stood in the registry (a function ref is called during the patch)')
      .to.deep.equal(['mounted · surface B']);
    expect(seen.surfaces!.standing()).to.deep.equal(['handSection']);

    shell.click();
    await nextTick();
    expect([shell.dataset.count, shell.dataset.doubled]).to.deep.equal(['2', '4']);
    expect(seen.log.at(-1), 'a row of the reactions table delegated to its controller').to.equal('doubled 4 (read through the port: 4)');

    props.playerView = {gameAge: 7};
    await nextTick();
    expect(shell.dataset.age).to.equal('7');
    expect(seen.log.at(-1), 'a row over a PROP read through the port').to.equal('age 7');

    seen.reset!();
    await nextTick();
    expect(shell.dataset.count, 'a WRITTEN row of a port writes the other controller\'s ref').to.equal('0');

    wrapper.unmount();
    await nextTick();
    expect(seen.log, 'the leaving hook ran').to.include('leaving');
    expect(seen.surfaces!.standing(), 'the surface left the registry with its element').to.deep.equal([]);
  });
});
