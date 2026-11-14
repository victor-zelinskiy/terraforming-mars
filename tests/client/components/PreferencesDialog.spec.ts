import {mount, VueWrapper, DOMWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import PreferencesDialog from '@/client/components/PreferencesDialog.vue';
import {Preference, PreferencesManager} from '@/client/utils/PreferencesManager';
import {globalConfig} from './getLocalVue';
import {setDiagnosticsOverlayOpener} from '@/client/diagnostics/diagnosticsOverlayBridge';

describe('PreferencesDialog', () => {
  const preferencesManager = PreferencesManager.INSTANCE;

  function getDataTest(wrapper: VueWrapper<any>, field: Preference): DOMWrapper<Element> {
    return wrapper.find(`[data-test=${field}]`);
  }

  function getCheckbox(wrapper: VueWrapper<any>, field: Preference): HTMLInputElement {
    return getDataTest(wrapper, field).element as HTMLInputElement;
  }

  it('defaults properly set', () => {
    preferencesManager.set('learner_mode', true);
    preferencesManager.set('hide_awards_and_milestones', false);

    const wrapper = mount(PreferencesDialog, {
      ...globalConfig,
      props: {preferencesManager},
    });

    expect(preferencesManager.values().hide_awards_and_milestones).is.false;
    expect(getCheckbox(wrapper, 'hide_awards_and_milestones').checked).is.false;

    expect(getCheckbox(wrapper, 'learner_mode').checked).is.true;
    expect(preferencesManager.values().learner_mode).is.true;
  });

  it('toggling sets the underlying preferences', async () => {
    // Reset to a known starting state regardless of the previous test's
    // mutation of the shared PreferencesManager singleton AND of the
    // current fork default (which is now `true` — see PreferencesManager).
    preferencesManager.set('hide_awards_and_milestones', false);

    const wrapper = mount(PreferencesDialog, {
      ...globalConfig,
      props: {preferencesManager},
    });

    expect(preferencesManager.values().hide_awards_and_milestones).is.false;

    const cbWrapper = getDataTest(wrapper, 'hide_awards_and_milestones');
    const cb = getCheckbox(wrapper, 'hide_awards_and_milestones');
    cb.checked = true;
    cbWrapper.trigger('change');
    await wrapper.vm.$nextTick();

    expect(preferencesManager.values().hide_awards_and_milestones).is.true;
  });

  // The panel is `<script setup>` (step A of docs/claude/vapor/RECIPES.md): its one emit is declared. «Report a bug»
  // opens the game's OWN report — the diagnostics surface — never a dialog that sends the player to upstream.
  it('«Ok» emits okButtonClicked, and «Report a bug» opens the report of the game itself', async () => {
    const wrapper = mount(PreferencesDialog, {
      ...globalConfig,
      props: {preferencesManager},
    });
    const [ok, reportABug] = wrapper.findAll('.preferences_panel_actions > button');

    await ok.trigger('click');
    expect(wrapper.emitted('okButtonClicked')).to.deep.eq([[]]);

    const opened: Array<unknown> = [];
    setDiagnosticsOverlayOpener((target) => opened.push(target));
    try {
      await reportABug.trigger('click');
      expect(opened).to.deep.eq([{to: 'report'}]);
      expect(wrapper.find('dialog.bug-dialog').exists()).to.eq(false);
    } finally {
      setDiagnosticsOverlayOpener(undefined);
    }
  });
});
