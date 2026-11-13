/*
 * DesktopUpdateOverlay — the blocking «update required» gate of the desktop build. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — it reads the module's update state
 * and the desktop bridge, so the spec is what it renders for that state and what its buttons ask of the bridge.
 * Mounted WITHOUT the i18n plugin on purpose: the component imports `v-i18n` itself, and a Vue warning (an unresolved
 * directive or component) fails the test.
 */
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import DesktopUpdateOverlay from '@/client/components/desktop/DesktopUpdateOverlay.vue';
import {desktopUpdateState, type DesktopUpdateState} from '@/client/components/desktop/desktopUpdateState';

type BridgeCalls = {install: number, recheck: number, download: number};

/** The desktop shell's bridge as the overlay reads it: «this is the desktop build» and the three verbs. */
function installBridge(): BridgeCalls {
  const calls: BridgeCalls = {install: 0, recheck: 0, download: 0};
  (window as unknown as {desktopBridge?: unknown}).desktopBridge = {
    desktopMode: true,
    quitAndInstall: () => {
      calls.install++;
      return Promise.resolve();
    },
    recheck: () => {
      calls.recheck++;
      return Promise.resolve({...desktopUpdateState});
    },
    openDownload: () => {
      calls.download++;
      return Promise.resolve();
    },
  };
  return calls;
}

function setState(state: Partial<DesktopUpdateState>): void {
  Object.assign(desktopUpdateState, state);
}

function overlay() {
  return mount(DesktopUpdateOverlay, {global: {config: globalConfig.global.config, stubs: {GamepadGlyph: true}}});
}

describe('DesktopUpdateOverlay — the blocking update gate', () => {
  afterEach(() => {
    delete (window as unknown as {desktopBridge?: unknown}).desktopBridge;
    for (const key of Object.keys(desktopUpdateState)) {
      delete (desktopUpdateState as unknown as Record<string, unknown>)[key];
    }
    Object.assign(desktopUpdateState, {mode: 'idle', currentVersion: ''});
  });

  it('stands only on the desktop build and only for a blocking mode — the web and a quiet check render nothing', async () => {
    setState({mode: 'required', currentVersion: '1.2.0'});
    expect(overlay().find('.desktop-update').exists(), 'the web has no bridge').to.eq(false);

    installBridge();
    setState({mode: 'checking'});
    const w = overlay();
    expect(w.find('.desktop-update').exists(), 'a check is silent').to.eq(false);

    setState({mode: 'required', latestVersion: '1.3.0'});
    await nextTick();
    expect(w.find('.desktop-update--cover').exists()).to.eq(true);
    expect(w.find('.desktop-update__title').text()).to.eq($t('Update required'));
    const versions = w.findAll('.desktop-update__versions > span');
    expect(versions.map((v) => v.find('b').text())).to.deep.eq(['1.2.0', '1.3.0']);
    expect(w.find('.desktop-update__panel > .desktop-update__status').text()).to.eq($t('Preparing the update…'));
    expect(w.find('.desktop-update__btn').exists(), 'nothing to press yet').to.eq(false);
  });

  it('a pending release is a WAIT — its own title, the version that is coming, the reason in words, no button', async () => {
    installBridge();
    setState({mode: 'pending', currentVersion: '1.2.0', latestVersion: '1.2.9', pendingVersion: '1.3.0', releaseNotes: ['Faster boot', 'A new map']});
    const w = overlay();
    expect(w.find('.desktop-update__title').text()).to.eq($t('Update on the way'));
    expect(w.findAll('.desktop-update__versions b').map((b) => b.text()), 'the coming version, never the half-published one').to.deep.eq(['1.2.0', '1.3.0']);
    expect(w.findAll('.desktop-update__notes li').map((li) => li.text())).to.deep.eq(['Faster boot', 'A new map']);
    expect(w.find('.desktop-update__wait').text()).to.eq($t('Update is building — waiting…'));
    expect(w.find('.desktop-update__btn').exists()).to.eq(false);

    setState({pendingReason: 'platform-feed', releaseNotes: undefined});
    await nextTick();
    expect(w.find('.desktop-update__wait').text()).to.eq($t('The release is published — waiting for the build for your platform…'));
    expect(w.find('.desktop-update__notes').exists(), 'no notes — no list').to.eq(false);
  });

  it('a download shows its percent (rounded, kept inside 0…100) and its speed; a downloaded update is installed by the button only where the app cannot restart itself', async () => {
    const calls = installBridge();
    setState({mode: 'downloading', currentVersion: '1.2.0', progress: {percent: 41.6, transferred: 1, total: 2, bytesPerSecond: 3 * 1024 * 1024}});
    const w = overlay();
    expect(w.find('.desktop-update__progress-meta').text()).to.eq('42% · 3.0 MB/s');
    expect((w.find('.desktop-update__bar-fill').element as HTMLElement).style.width).to.eq('42%');

    setState({progress: {percent: 140, transferred: 2, total: 2, bytesPerSecond: 2048}});
    await nextTick();
    expect(w.find('.desktop-update__progress-meta').text()).to.eq('100% · 2 KB/s');
    setState({progress: {percent: 7, transferred: 0, total: 2, bytesPerSecond: 0}});
    await nextTick();
    expect(w.find('.desktop-update__progress-meta').text(), 'no speed — no separator').to.eq('7%');

    setState({mode: 'downloaded', progress: undefined});
    await nextTick();
    const install = w.find('.desktop-update__btn--primary');
    expect(install.attributes('data-gp-verb')).to.eq('Install and close');
    expect(install.text()).to.eq($t('Install and close'));
    await install.trigger('click');
    expect(calls).to.deep.eq({install: 1, recheck: 0, download: 0});

    setState({restartSupported: true});
    await nextTick();
    expect(w.find('.desktop-update__btn').exists(), 'the app restarts by itself').to.eq(false);
    expect(w.find('.desktop-update__wait').text()).to.eq($t('The game will restart automatically.'));
  });

  it('a failure names itself and offers «Try again» — «Download manually» only with a link — and the pad row stands while there is more than one action', async () => {
    const calls = installBridge();
    setState({mode: 'error', currentVersion: '1.2.0', error: 'checksum mismatch'});
    const w = overlay();
    expect(w.find('.desktop-update__status--err').text()).to.eq($t('Update failed.'));
    expect(w.find('.desktop-update__err-detail').text()).to.eq('checksum mismatch');
    expect(w.findAll('.desktop-update__btn').map((b) => b.attributes('data-gp-verb'))).to.deep.eq(['Try again']);
    expect(w.find('.desktop-update__pad-hints').exists(), 'several actions are possible in this mode').to.eq(true);

    await w.find('.desktop-update__btn--primary').trigger('click');
    expect(calls).to.deep.eq({install: 0, recheck: 1, download: 0});

    setState({downloadUrl: 'https://example.invalid/update'});
    await nextTick();
    expect(w.findAll('.desktop-update__btn').map((b) => b.attributes('data-gp-verb'))).to.deep.eq(['Try again', 'Download manually']);
    await w.find('.desktop-update__btn--ghost').trigger('click');
    expect(calls).to.deep.eq({install: 0, recheck: 1, download: 1});

    setState({mode: 'manualDownloadRequired'});
    await nextTick();
    expect(w.findAll('.desktop-update__btn').map((b) => b.attributes('data-gp-verb')), 'the manual download leads here').to.deep.eq(['Download manually', 'Try again']);

    setState({mode: 'installing'});
    await nextTick();
    expect(w.find('.desktop-update__pad-hints').exists(), 'one thing on screen — nothing to navigate').to.eq(false);
    expect(w.find('.desktop-update__status').text()).to.eq($t('Installing…'));
  });
});
