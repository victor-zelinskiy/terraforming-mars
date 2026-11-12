import {expect} from 'chai';
import {computed, effectScope, reactive, ref, shallowReactive, watch} from 'vue';
import {createShellPort} from '@/client/console/shell/shellPort';

/**
 * THE SHELL PORT IS NO COMPONENT INSTANCE (architecture v2 — PLAN §5 · S-last; `console/shell/shellPort.ts`). The
 * controllers of the game screen reach each other through ONE late-bound object — the members they returned, the
 * props, `$nextTick` — built before the first controller and bound after the last. It answers exactly as the
 * component's public instance did (setup state first, refs read and written through), and asks Vue for nothing a
 * `<script setup>` / Vapor component does not have.
 */
describe('the shell port — the controllers\' one way to each other, with no instance behind it', () => {
  type Props = {playerView: {gameAge: number}};
  type Port = {readonly count: number, pending: string | undefined, readonly doubled: number, readonly playerView: {gameAge: number},
    readonly state: {sheet: string | undefined}, bump(): void, $nextTick(fn?: () => void): Promise<void>};

  function compose(props: Props = shallowReactive({playerView: {gameAge: 1}})) {
    const source = createShellPort(props);
    const shell = source.as<Port>();
    const count = ref(1);
    const pending = ref<string | undefined>(undefined);
    const state = reactive({sheet: undefined as string | undefined});
    const members = {count, pending, doubled: computed(() => count.value * 2), state, bump: () => {
      count.value++;
    }};
    return {source, shell, members, props, count, pending, state};
  }

  it('a member read AT CONSTRUCTION is an error, said by name — a controller is built before the shell exists', () => {
    const {shell} = compose();
    expect(() => shell.count).to.throw('shell.count was read while the shell is being composed');
  });

  it('once bound: a ref is read THROUGH, a function is the function, a mirror is the module state itself', () => {
    const {source, shell, members, state} = compose();
    const bound = source.bind(members);
    expect(bound, 'ONE object — what the controllers were handed').to.equal(shell);
    expect(shell.count).to.equal(1);
    expect(shell.doubled).to.equal(2);
    shell.bump();
    expect(shell.count).to.equal(2);
    expect(shell.doubled).to.equal(4);
    expect(shell.state, 'never a copy').to.equal(state);
  });

  it('a prop is the LIVE prop — and a member of the same name would win, as setup state did on the instance', () => {
    const props = shallowReactive({playerView: {gameAge: 1}});
    const {source, shell, members} = compose(props);
    source.bind(members);
    expect(shell.playerView.gameAge).to.equal(1);
    props.playerView = {gameAge: 2};
    expect(shell.playerView.gameAge).to.equal(2);
  });

  it('reads are REACTIVE — a watcher of a port member sees a member\'s change and a prop\'s', () => {
    const props = shallowReactive({playerView: {gameAge: 1}});
    const {source, shell, members, count} = compose(props);
    source.bind(members);
    const seen: Array<string> = [];
    const scope = effectScope();
    scope.run(() => {
      watch(() => shell.doubled, (value) => seen.push(`doubled ${value}`), {flush: 'sync'});
      watch(() => shell.playerView.gameAge, (value) => seen.push(`age ${value}`), {flush: 'sync'});
    });
    count.value = 5;
    props.playerView = {gameAge: 9};
    scope.stop();
    expect(seen).to.deep.equal(['doubled 10', 'age 9']);
  });

  it('a WRITTEN row writes the ref; a write to anything that is not a ref is refused', () => {
    const {source, shell, members, pending} = compose();
    source.bind(members);
    shell.pending = 'pay';
    expect(pending.value).to.equal('pay');
    expect(() => {
      (shell as unknown as {bump: unknown}).bump = () => undefined;
    }).to.throw('shell.bump is not a ref of any controller');
    expect(() => {
      (shell as unknown as {playerView: unknown}).playerView = {gameAge: 0};
    }).to.throw('is not a ref of any controller');
  });

  it('`$nextTick` is the scheduler\'s next tick — of no instance', async () => {
    const {source, shell, members} = compose();
    source.bind(members);
    let ran = false;
    await shell.$nextTick(() => {
      ran = true;
    });
    expect(ran).to.equal(true);
    await shell.$nextTick();
  });

  it('`in` answers for a member, a prop and `$nextTick`; the port is bound ONCE', () => {
    const {source, shell, members} = compose();
    source.bind(members);
    expect('count' in shell).to.equal(true);
    expect('playerView' in shell).to.equal(true);
    expect('$nextTick' in shell).to.equal(true);
    expect('nothing' in shell).to.equal(false);
    expect(() => source.bind(members)).to.throw('bound once');
  });
});
