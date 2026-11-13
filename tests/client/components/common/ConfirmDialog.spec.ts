import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';

/*
 * The native-`<dialog>` confirmation the board binder asks «Place your tile here?» with. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): what it renders for its two props and its slot, its three verbs — `accept`,
 * `dismiss`, `hide` (the «don't show this again» box) — and the ONE member its parent reaches through a ref:
 * `ConsoleBoardInput` calls `this.typedRefs.confirmation.show()`.
 */

/** What the board binder reads through its `ref="confirmation"`. */
type Confirmation = {show(): void};

describe('ConfirmDialog', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(ConfirmDialog, {
      ...globalConfig,
      props: {
        message: 'Are you sure?',
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('renders the question, what the host put between it and the buttons, Yes / No — and the «don\'t show this again» box only when asked for', async () => {
    const wrapper = mount(ConfirmDialog, {
      ...globalConfig,
      props: {message: 'Place your tile here?'},
      slots: {default: () => h('i', {class: 'preview-stub'})},
    });
    expect((wrapper.element as HTMLElement).tagName).to.eq('DIALOG');
    expect(wrapper.find('form[method="dialog"] > p.newlines').text()).to.eq('Place your tile here?');
    expect(wrapper.find('.confirm-dialog__slot > .preview-stub').exists()).to.eq(true);
    expect(wrapper.findAll('menu.dialog-menu > button').map((b) => [b.text(), b.classes().includes('btn-primary')])).to.deep.eq([['Yes', true], ['No', false]]);
    expect(wrapper.find('#dialog-confirm-dismiss').exists()).to.eq(false);

    await wrapper.setProps({enableDontShowAgainCheckbox: true});
    expect(wrapper.find('input#dialog-confirm-dismiss[type="checkbox"]').exists()).to.eq(true);
    expect(wrapper.find('label[for="dialog-confirm-dismiss"]').text()).to.eq('Don\'t show this again');
  });

  it('emits `accept` off Yes, `dismiss` off No, and `hide` with the box\'s value every time it changes', async () => {
    const wrapper = mount(ConfirmDialog, {...globalConfig, props: {message: 'Sure?', enableDontShowAgainCheckbox: true}});
    const [yes, no] = wrapper.findAll('menu.dialog-menu > button');

    await yes.trigger('click');
    expect(wrapper.emitted('accept')).to.deep.eq([[]]);
    expect(wrapper.emitted('dismiss')).to.eq(undefined);
    await no.trigger('click');
    expect(wrapper.emitted('dismiss')).to.deep.eq([[]]);
    expect(wrapper.emitted('hide'), 'the box was not touched').to.eq(undefined);

    const box = wrapper.find('#dialog-confirm-dismiss');
    await box.setValue(true);
    await box.setValue(false);
    expect(wrapper.emitted('hide')).to.deep.eq([[true], [false]]);
  });

  it('a parent\'s ref sees `show` and nothing else — and `show()` opens the dialog as a modal', () => {
    // The dialog the way the board binder mounts it: under an Options host with the string ref `confirmation`.
    const Host = defineComponent({
      render: () => h('div', [h(ConfirmDialog, {ref: 'confirmation', message: 'Place your tile here?'})]),
    });
    const host = mount(Host, {...globalConfig});
    const confirmation = host.vm.$refs.confirmation as Confirmation;
    expect(Object.keys(confirmation), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['show']);

    let opened = 0;
    (host.find('dialog').element as HTMLDialogElement).showModal = () => {
      opened++;
    };
    confirmation.show();
    expect(opened).to.eq(1);
  });
});
