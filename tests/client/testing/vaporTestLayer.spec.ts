/*
 * THE UNIT SUITE'S VAPOR LAYER — what a spec may rely on (tests/client/testing/vaporTestUtils.ts · vaporTree.ts ·
 * vueForTests.ts; docs/claude/vapor/ROADMAP.md § 4a · B6).
 *
 * `@vue/test-utils` is a virtual-DOM tool; the layer makes its reading surface hold over a tree that Vapor renders.
 * Every row here is a promise a spec of a converted component leans on WITHOUT knowing it was converted: the same
 * `mount(Component, {props, slots, global: {stubs}})`, the same `findComponent`, the same wrapper. The fixtures are
 * Vapor in every mode of the bundle (they stand outside `src/client` — scripts/vapor/unitVaporPolicy.cjs), so this
 * table is red the day a new core changes one of the runtime internals the layer reads.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick} from 'vue';
import {mount, shallowMount} from '@vue/test-utils';
import LayerLeaf from './fixtures/LayerLeaf.vue';
import LayerChassis from './fixtures/LayerChassis.vue';
import LayerParent from './fixtures/LayerParent.vue';
import LayerFragment from './fixtures/LayerFragment.vue';

type Reach = Record<string, any>;

/** The far content of every mount of the test: a real teleport puts it in the body. */
function clearBody(): void {
  for (const far of Array.from(document.body.querySelectorAll('.parent__far'))) {
    far.remove();
  }
}

describe('the unit suite\'s Vapor layer — test-utils over a tree that Vapor renders', () => {
  afterEach(clearBody);

  describe('a Vapor component as the ROOT of a mount', () => {
    it('the wrapper speaks for the component: its element, props, events, `vm`, the DOM under it; `setProps` and `unmount` work', async () => {
      const w = mount(LayerLeaf, {props: {label: 'one'}});
      expect(w.exists()).to.eq(true);
      expect((w.element as Element).tagName, 'the component\'s own root, not the host around it').to.eq('BUTTON');
      expect(w.classes()).to.deep.eq(['leaf']);
      expect(w.attributes('data-label')).to.eq('one');
      expect(w.text()).to.eq('one:0');
      expect(w.html()).to.contain('<button class="leaf"');
      expect(w.props()).to.deep.eq({label: 'one'});
      expect(w.props('label')).to.eq('one');
      expect(w.find('.leaf').exists(), '`find` sees the root itself, as a virtual-DOM wrapper\'s does').to.eq(true);
      expect(w.findAll('button')).to.have.length(1);
      expect(w.find('.no-such').exists()).to.eq(false);
      expect(() => w.get('.no-such')).to.throw();

      await w.setProps({label: 'two'});
      expect(w.text()).to.eq('two:0');

      await w.trigger('click');
      expect(w.emitted('pick')).to.deep.eq([['two']]);
      expect(Object.keys(w.emitted())).to.include('pick');

      const vm = w.vm as Reach;
      vm.bump();
      await nextTick();
      expect(w.text(), 'an exposed member is callable').to.eq('two:1');
      expect(vm.count, 'a setup binding is readable (a development build)').to.eq(1);
      expect(vm.label, 'a prop by its name').to.eq('two');
      vm.count = 5;
      await nextTick();
      expect(w.text(), '…and writable').to.eq('two:5');
      expect(vm.$el).to.eq(w.element);
      vm.$emit('pick', 'by hand');
      expect(w.emitted('pick')).to.deep.eq([['two'], ['by hand']]);

      w.unmount();
      expect(w.exists()).to.eq(false);
    });

    it('the mount\'s `data()` is written into the setup bindings; a key that names none is ignored', async () => {
      const w = mount(LayerLeaf, {props: {label: 'd'}, data: () => ({count: 7, noSuchBinding: 1})} as never);
      await nextTick();
      expect(w.text()).to.eq('d:7');
    });

    it('a component of SEVERAL roots: the text of all of them, `find` over all of them, the element their parent', async () => {
      const w = mount(LayerFragment, {props: {tail: 'z'}});
      expect(w.text()).to.eq('az');
      expect(w.find('.frag__a').exists()).to.eq(true);
      expect(w.find('.frag__b').text()).to.eq('z');
      expect(w.findAll('i, b')).to.have.length(2);
      expect((w.element as Element).hasAttribute('data-vapor-host'), 'a fragment\'s element is its parent').to.eq(true);
      await w.setProps({tail: 'y'});
      expect(w.text()).to.eq('ay');
    });

    it('a FUNCTION slot of the mount renders inside the component — also when it is forwarded into a virtual-DOM stub, with no warning', async () => {
      const warned: Array<string> = [];
      const ChassisStub = defineComponent({
        name: 'LayerChassis',
        setup(_props, {slots}) {
          return () => h('div', {class: 'chassis-stub'}, slots.default?.());
        },
      });
      const w = mount(LayerParent, {
        slots: {default: () => h('em', {class: 'from-the-spec'}, 'slotted')},
        global: {stubs: {Chassis: ChassisStub}, config: {warnHandler: (message: string) => warned.push(message)}},
      });
      expect(w.find('.chassis-stub > .from-the-spec').text()).to.eq('slotted');
      expect(warned, 'no «Slot invoked outside of the render function» for a slot Vapor tracks itself').to.deep.eq([]);

      const real = mount(LayerParent, {slots: {default: () => h('em', {class: 'from-the-spec'}, 'slotted')}});
      expect(real.find('.chassis > .from-the-spec').text(), 'and into the real Vapor child').to.eq('slotted');
    });

    it('THE FACT BEHIND that (vue 3.6.0-rc.15): a slot the virtual-DOM renderer NORMALIZED, forwarded by a Vapor component into a virtual-DOM child, is warned about', () => {
      // A spec's own host hands its normalized slots on — the road the layer's host does NOT take (`splitSlots`).
      // The day this row is red the runtime exempts the case itself, and `splitSlots` can go.
      const warned: Array<string> = [];
      const ChassisStub = defineComponent({
        name: 'LayerChassis',
        setup(_props, {slots}) {
          return () => h('div', {class: 'chassis-stub'}, slots.default?.());
        },
      });
      const Host = defineComponent({
        setup(_props, {slots}) {
          return () => h('div', [h(LayerParent, null, slots)]);
        },
      });
      const w = mount(Host, {
        slots: {default: () => h('em', {class: 'from-the-spec'}, 'slotted')},
        global: {stubs: {Chassis: ChassisStub}, config: {warnHandler: (message: string) => warned.push(message)}},
      });
      expect(w.find('.chassis-stub > .from-the-spec').text(), 'it renders all the same').to.eq('slotted');
      expect(warned.filter((message) => message.includes('invoked outside of the render function'))).to.have.length(1);
    });
  });

  describe('the stub rule of a mount reaches the children a Vapor render creates', () => {
    it('`true` by the LOCAL binding name of the parent\'s script, or by the component\'s own name — a default stub with its props', () => {
      const byLocal = mount(LayerParent, {props: {items: ['a', 'b']}, global: {stubs: {Leaf: true, teleport: true}}});
      expect(byLocal.findAll('.parent > leaf-stub').map((stub) => stub.attributes('label'))).to.deep.eq(['a', 'b', 'dyn']);
      expect(byLocal.find('.leaf').exists(), 'no real leaf anywhere').to.eq(false);

      const byName = mount(LayerParent, {props: {items: ['a']}, global: {stubs: {LayerLeaf: true, teleport: true}}});
      expect(byName.findAll('layer-leaf-stub').map((stub) => stub.attributes('label'))).to.deep.eq(['a', 'far', 'dyn']);

      const optedOut = mount(LayerParent, {props: {items: ['a']}, global: {stubs: {Leaf: false}}});
      expect(optedOut.findAll('.parent > .leaf')).to.have.length(2);
    });

    it('a CUSTOM stub stands in — and is found by the stub and by the component it stands for', () => {
      const LeafStub = defineComponent({
        name: 'LayerLeaf',
        props: {label: {type: String, required: true}},
        emits: ['pick'],
        setup: (props) => () => h('i', {class: 'leaf-stub'}, props.label),
      });
      const w = mount(LayerParent, {props: {items: ['a', 'b']}, global: {stubs: {Leaf: LeafStub, teleport: true}}});
      expect(w.findAll('.parent > .leaf-stub').map((stub) => stub.text())).to.deep.eq(['a', 'b', 'dyn']);
      expect(w.findAllComponents(LeafStub).map((stub) => stub.props('label'))).to.deep.eq(['a', 'b', 'far', 'dyn']);
      expect(w.findAllComponents(LayerLeaf), 'asked by the original').to.have.length(4);

      // …and an event the stub emits reaches the Vapor parent's listener.
      (w.findComponent(LeafStub).vm as Reach).$emit('pick', 'a');
      return nextTick().then(() => expect(w.find('.parent__picked').text()).to.eq('a'));
    });

    it('`shallowMount` stubs every child — named as the script of the parent binds it — and keeps the root real', () => {
      const w = shallowMount(LayerParent, {props: {items: ['a']}});
      expect(w.classes()).to.deep.eq(['parent']);
      expect(w.find('.leaf').exists()).to.eq(false);
      expect(w.findAll('.parent > leaf-stub')).to.have.length(2);
      expect(w.find('chassis-stub').exists()).to.eq(true);
      expect(w.find('.parent__picked').exists(), 'the root\'s own DOM').to.eq(true);
    });

    it('a transition is test-utils\' pass-through stub by default — its content stands at once; `transition: false` keeps the real one', async () => {
      const w = mount(LayerParent, {props: {open: false}});
      expect(w.find('transition-stub').exists()).to.eq(true);
      expect(w.find('.parent__note').exists()).to.eq(false);
      await w.setProps({open: true});
      expect(w.find('transition-stub > .parent__note').text()).to.eq('note');
      await w.setProps({open: false});
      expect(w.find('.parent__note').exists(), 'no leave to wait for').to.eq(false);

      const real = mount(LayerParent, {props: {open: true}, global: {stubs: {transition: false}}});
      expect(real.find('transition-stub').exists()).to.eq(false);
      expect(real.find('.parent > .parent__note').exists()).to.eq(true);
    });

    it('a teleport is real unless the mount asks: `teleport: true` reads its content in place', () => {
      const real = mount(LayerParent, {});
      expect(real.find('.parent__far').exists(), 'gone to the body').to.eq(false);
      expect(document.body.querySelector('.parent__far > .leaf')?.textContent).to.eq('far:0');

      const inPlace = mount(LayerParent, {global: {stubs: {teleport: true}}});
      expect(inPlace.find('.parent > teleport-stub').attributes('to')).to.eq('body');
      expect(inPlace.find('teleport-stub > .parent__far > .leaf').text()).to.eq('far:0');
    });
  });

  describe('`findComponent` walks ONE tree over both runtimes', () => {
    it('finds Vapor children in the order they STAND — a list re-keyed, a child inside a stub\'s slot, `<component :is>`', async () => {
      const w = mount(LayerParent, {props: {items: ['a', 'b']}, global: {stubs: {teleport: true}}});
      const labels = (): Array<string> => w.findAllComponents(LayerLeaf).map((leaf) => leaf.props('label'));
      expect(labels()).to.deep.eq(['a', 'b', 'far', 'dyn']);

      await w.setProps({items: ['c', 'a', 'b']});
      expect(labels(), 'the new first item was created last').to.deep.eq(['c', 'a', 'b', 'far', 'dyn']);
      await w.setProps({items: ['b']});
      expect(labels(), 'an unmounted child is gone').to.deep.eq(['b', 'far', 'dyn']);

      expect(w.findComponent(LayerLeaf).props('label')).to.eq('b');
      expect(w.findComponent({name: 'LayerLeaf'}).exists(), 'by name').to.eq(true);
      expect(w.findComponent(LayerChassis).classes()).to.deep.eq(['chassis']);
      expect(w.findComponent({name: 'NoSuchComponent'}).exists()).to.eq(false);
      expect(() => w.getComponent({name: 'NoSuchComponent'})).to.throw();
    });

    it('a found Vapor child is a wrapper: its props, its events, its `vm`; a DOM wrapper finds only what stands inside it', async () => {
      const w = mount(LayerParent, {props: {items: ['a', 'b']}, global: {stubs: {teleport: true}}});
      const second = w.findAllComponents(LayerLeaf)[1];
      await second.trigger('click');
      expect(second.emitted('pick')).to.deep.eq([['b']]);
      expect(w.find('.parent__picked').text()).to.eq('b');
      (second.vm as Reach).bump();
      await nextTick();
      expect(second.text()).to.eq('b:1');

      const far = w.find('.parent__far');
      expect(far.findAllComponents(LayerLeaf).map((leaf: Reach) => leaf.props('label'))).to.deep.eq(['far']);
      expect(far.findComponent(LayerLeaf).text()).to.eq('far:0');
      expect(w.find('.parent__picked').findComponent(LayerLeaf).exists()).to.eq(false);
    });

    it('from a virtual-DOM host: its own children stay test-utils\' (a stub by name, found by the original), the Vapor ones are found beside them', () => {
      const Plain = defineComponent({name: 'PlainChild', props: {n: {type: Number, default: 0}}, setup: (props) => () => h('u', {class: 'plain'}, String(props.n))});
      const Host = defineComponent({
        name: 'MixedHost',
        setup: () => () => h('div', {class: 'mixed'}, [h(Plain, {n: 1}), h(LayerLeaf, {label: 'in-host'}), h(LayerParent, {items: ['deep']})]),
      });
      const w = mount(Host, {global: {stubs: {PlainChild: true, teleport: true}}});
      expect(w.find('plain-child-stub').attributes('n')).to.eq('1');
      expect(w.findComponent(Plain).props('n'), 'test-utils\' own stub, asked by the original').to.eq(1);
      expect(w.findAllComponents(LayerLeaf).map((leaf) => leaf.props('label'))).to.deep.eq(['in-host', 'deep', 'far', 'dyn']);
      expect(w.findComponent(LayerParent).find('.parent__picked').exists()).to.eq(true);
    });

    it('a spec\'s own host whose ROOT is the Vapor component mounts and reads', () => {
      const Host = defineComponent({render: () => h(LayerLeaf, {label: 'bare'})});
      const w = mount(Host);
      expect(w.find('.leaf').text()).to.eq('bare:0');
      expect(w.text()).to.eq('bare:0');
      expect(w.findComponent(LayerLeaf).props('label')).to.eq('bare');
    });
  });
});
