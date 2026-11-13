import {mount, shallowMount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import BugReportDialog from '@/client/components/BugReportDialog.vue';
import {APP_ROOT} from '@/client/components/appRoot';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';

/*
 * The «Report a bug» dialog of the preferences panel. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): the report it writes into its read-only textarea — with the game the APP ROOT'S PORT
 * hands it (R26) and with no root above it at all — the copy button, and the ONE member its parent reaches through a
 * ref: `PreferencesDialog` calls `bugDialog.show()`.
 */

/** What the preferences panel reads through its `ref="bugDialog"`. */
type BugDialog = {show(): void};

/** The report the dialog offers for copying — the text of its textarea. */
function reportIn(text: string): Record<string, unknown> {
  return JSON.parse(text);
}

describe('BugReportDialog', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(BugReportDialog, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('with no app root above it (a bare mount) the report carries the build and the browser — and no game', async () => {
    const wrapper = mount(BugReportDialog, {...globalConfig});
    // the report is written when the dialog is mounted — it reaches the textarea on the next render
    await nextTick();
    expect((wrapper.element as HTMLElement).tagName).to.eq('DIALOG');
    expect(wrapper.classes()).to.deep.eq(['bug-dialog']);
    expect(wrapper.find('textarea').attributes('readonly')).to.not.eq(undefined);
    expect(reportIn(wrapper.find('textarea').element.value)).to.have.all.keys(['url', 'version', 'builtAt', 'browser', 'language', 'experimental_ui']);
  });

  it('with the app root\'s port it adds the game on stage: the viewer\'s colour, the expansions in play, the step — and the ruling party under Turmoil', async () => {
    const playerView = fakePlayerViewModel({game: fakeGameModel({step: 7})});
    playerView.game.gameOptions.expansions.venus = true;
    const wrapper = mount(BugReportDialog, {global: {...globalConfig.global, provide: {[APP_ROOT as symbol]: {playerView}}}});
    await nextTick();
    const report = reportIn(wrapper.find('textarea').element.value);
    expect(report.color).to.eq('blue');
    expect(report.step).to.eq(7);
    expect(String(report.expansions).split(', ')).to.include('venus');
    expect(report, 'no Parliament in this game').to.not.have.property('party');

    const sitting = fakePlayerViewModel({game: fakeGameModel({turmoil: {ruling: undefined}})});
    const under = mount(BugReportDialog, {global: {...globalConfig.global, provide: {[APP_ROOT as symbol]: {playerView: sitting}}}});
    await nextTick();
    expect(reportIn(under.find('textarea').element.value).party, 'a Parliament with nobody ruling').to.eq('None');
  });

  it('«Copy to Clipboard» selects the report, sends it off and only then shows «Copied!»', async () => {
    // jsdom has no clipboard: VueUse's legacy road copies through `document.execCommand`, which jsdom lacks too.
    const doc = document as unknown as {execCommand?: (command: string) => boolean};
    const execCommandWas = doc.execCommand;
    const commands: Array<string> = [];
    doc.execCommand = (command: string) => {
      commands.push(command);
      return true;
    };
    try {
      const wrapper = mount(BugReportDialog, {...globalConfig});
      await nextTick();
      const textarea = wrapper.find('textarea').element;
      const note = wrapper.find('.dialog-menu .center');
      expect(note.text()).to.eq('Copied!');
      expect(note.classes(), 'nothing was copied yet').to.include('invisible');

      await wrapper.find('button.btn-primary').trigger('click');
      expect([textarea.selectionStart, textarea.selectionEnd], 'the whole report is selected').to.deep.eq([0, textarea.value.length]);
      expect(commands).to.deep.eq(['copy']);
      expect(note.classes()).to.not.include('invisible');
    } finally {
      if (execCommandWas === undefined) {
        delete doc.execCommand;
      } else {
        doc.execCommand = execCommandWas;
      }
    }
  });

  it('a parent\'s ref sees `show` and nothing else — and `show()` opens the dialog as a modal', () => {
    // The dialog the way the preferences panel mounts it: under a host with the string ref `bugDialog`.
    const Host = defineComponent({
      render: () => h('div', [h(BugReportDialog, {ref: 'bugDialog'})]),
    });
    const host = mount(Host, {...globalConfig});
    const bugDialog = host.vm.$refs.bugDialog as BugDialog;
    expect(Object.keys(bugDialog), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['show']);

    let opened = 0;
    (host.find('dialog').element as HTMLDialogElement).showModal = () => {
      opened++;
    };
    bugDialog.show();
    expect(opened).to.eq(1);
  });
});
