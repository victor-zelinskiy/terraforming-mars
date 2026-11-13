/*
 * THE CONSOLE SHELL AS A `<script setup>` COMPONENT (V3 wave 4 — docs/claude/vapor/RECIPES.md § R8, «a `setup()` that
 * returns ONE composition»).
 *
 * The shell is a template over `useConsoleShell(props)`. What this spec pins is the SEAM between the two — the part
 * no guard of the source can see and every e2e spec only shows as «the whole game is broken»:
 *  · the script takes the composition apart into the names the template reads, and the template resolves them (a
 *    name missing from the destructure renders nothing and warns — the mount below fails on a warning);
 *  · the template's own four refs (`ref="conRootEl"` …) reach the COMPOSITION by name (`useTemplateRef` inside
 *    `composeShellMembers`) with no binding of the SFC between them — proven by an effect only the bound root can
 *    have: the `.con-ws` presence bridge is installed ON that root at mount and flips its class.
 * Every child is a stub: the surfaces have specs of their own, and the game screen as a whole is the e2e suite's.
 */
import {expect} from 'chai';
import {shallowMount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {fakeGameModel, fakePlayerViewModel} from '../testHelpers';
import ConsoleShell from '@/client/components/console/ConsoleShell.vue';
import {endConsoleSession} from '@/client/console/session/consoleSession';

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('ConsoleShell — a template over ONE composition', function() {
  // The whole game screen's composition is built per mount — a budget for that, not a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);

  afterEach(() => {
    endConsoleSession();
    document.documentElement.classList.remove('console-native');
  });

  function mountShell() {
    const playerView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    return shallowMount(ConsoleShell, {...globalConfig, props: {playerView}, attachTo: document.body});
  }

  it('mounts on its root: the template resolves every name the script takes from the composition', async () => {
    const wrapper = mountShell();
    await settle();
    expect(wrapper.element.classList.contains('con-root'), 'the root is the shell\'s own element').to.equal(true);
    expect(wrapper.find('.con-main').exists(), 'the central column stands').to.equal(true);
    expect(document.documentElement.classList.contains('console-native'), 'the composition ran: the surface is console-native').to.equal(true);
    wrapper.unmount();
  });

  it('the template\'s own refs reach the composition BY NAME: the presence bridge stands on the bound root', async () => {
    const wrapper = mountShell();
    await settle();
    const root = wrapper.element as HTMLElement;
    expect(root.classList.contains('con-root--ws-open'), 'no workspace surface yet').to.equal(false);
    // A workspace surface appears under the root: only a bridge installed on THIS element can see it.
    const surface = document.createElement('div');
    surface.className = 'con-ws';
    root.appendChild(surface);
    await settle();
    await settle();
    expect(root.classList.contains('con-root--ws-open'), 'the bridge observes the root the template named `conRootEl`').to.equal(true);
    wrapper.unmount();
  });

  it('exposes nothing: a holder of its ref reaches no member (the app only mounts it)', async () => {
    const wrapper = mountShell();
    await settle();
    const exposed = (wrapper.vm.$ as unknown as {exposed: Record<string, unknown> | null}).exposed;
    expect(exposed === null || Object.keys(exposed).length === 0, 'no `defineExpose`').to.equal(true);
    wrapper.unmount();
  });
});
