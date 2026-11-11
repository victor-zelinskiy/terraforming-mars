/*
 * A COMPONENT'S SCOPE IS PARENTED BY WHERE THE COMPONENT STANDS (architecture v2 — PLAN §10 · C1;
 * src/client/console/session/useFlowScope.ts · `componentSessionScope`).
 *
 * «The session that stands» is the wrong owner for a component: an app-level layer set up while a game is on screen
 * would be handed that game's session and lose every timer it arms the moment the game screen leaves — while the layer
 * itself lives on. The owner is read off the component tree:
 *
 *  1. inside a console shell → THAT shell's session (it dies with that shell, and so does its scope);
 *  2. the shell's own `setup()` (its controllers) → the same session;
 *  3. outside any shell → the PAGE's scope, even while a game session stands;
 *  4. the scope ends with its component, and what it armed is taken back.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleAppScope, consoleSessionScope, endConsoleSession, useConsoleSession} from '@/client/console/session/consoleSession';
import {useFlowScope} from '@/client/console/session/useFlowScope';

const seen: Record<string, FlowScope> = {};

const Leaf = defineComponent({
  props: {name: {type: String, required: true}},
  setup(props) {
    seen[props.name] = useFlowScope(props.name);
    return () => h('i');
  },
});

const Shell = defineComponent({
  setup() {
    const session = useConsoleSession();
    seen.session = session;
    seen.controller = useFlowScope('a-controller'); // a shell controller is constructed in the shell's own setup()
    return () => h('div', [h(Leaf, {name: 'inside'})]);
  },
});

describe('useFlowScope — a component\'s scope is parented by where the component stands', () => {
  afterEach(() => {
    endConsoleSession();
  });

  it('inside a shell: the shell\'s session; the shell\'s own setup: the same; outside any shell: the PAGE — even while a game stands', () => {
    const shell = mount(Shell);
    expect(seen.inside.parent, 'a child of the shell').to.equal(seen.session);
    expect(seen.controller.parent, 'the shell\'s own controllers').to.equal(seen.session);
    expect(consoleSessionScope(), 'the game session stands').to.equal(seen.session);

    // An app-level layer mounted WHILE the game is on screen is not the game's.
    const layer = mount(Leaf, {props: {name: 'layer'}});
    expect(seen.layer.parent).to.equal(consoleAppScope());

    let fired = 0;
    seen.layer.after(0, 'the layer\'s own beat', () => fired++);
    let lost = 0;
    seen.inside.after(60_000, 'a beat of the game screen', () => lost++);

    shell.unmount();
    expect(seen.session.ended, 'the game screen left: its session ended').to.not.equal(undefined);
    expect(seen.inside.ended, '…and what stood inside it').to.not.equal(undefined);
    expect(seen.controller.ended).to.not.equal(undefined);
    expect(seen.layer.ended, 'the layer beside the shell lives on, and so does its scope').to.equal(undefined);
    expect(lost).to.equal(0);

    layer.unmount();
    expect(seen.layer.ended, 'a scope ends with its component').to.not.equal(undefined);
    expect(fired, 'what it armed was taken back with it').to.equal(0);
  });
});
