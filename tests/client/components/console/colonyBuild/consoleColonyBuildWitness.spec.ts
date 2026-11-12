/*
 * ConsoleColonyBuildWitness — what a probe reads off the DOM about the colony build's transaction. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): it holds no state of its own — its template reads the build's
 * module state directly, so a phase change re-renders this one node.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {ColonyBuildPhase} from '@/client/console/colonyBuild/colonyBuildModel';
import ConsoleColonyBuildWitness from '@/client/components/console/colonyBuild/ConsoleColonyBuildWitness.vue';

const WITNESS = '.con-colonybuild__witness';

/** The three fields the witness reads — module state every spec of the bundle shares, so it starts and ends at rest. */
function pose(active: boolean, phase: ColonyBuildPhase, degraded: boolean): void {
  colonyBuildState.active = active;
  colonyBuildState.phase = phase;
  colonyBuildState.degraded = degraded;
}

describe('ConsoleColonyBuildWitness — the build transaction\'s witness', () => {
  beforeEach(() => pose(false, 'idle', false));
  afterEach(() => pose(false, 'idle', false));

  it('renders nothing while no build is in flight and none was degraded', () => {
    const w = mount(ConsoleColonyBuildWitness, {...globalConfig});
    expect(w.find(WITNESS).exists()).to.eq(false);
  });

  it('publishes the scene\'s phase while it plays, on a node out of every layout — and follows it', async () => {
    pose(true, 'armed', false);
    const w = mount(ConsoleColonyBuildWitness, {...globalConfig});
    const witness = w.find(WITNESS);
    expect((witness.element as HTMLElement).tagName).to.eq('I');
    expect(witness.attributes('hidden')).to.not.eq(undefined);
    expect(witness.attributes('data-colony-build-phase')).to.eq('armed');
    expect(witness.attributes('data-colony-build-degraded'), 'a played flight confesses nothing').to.eq(undefined);

    colonyBuildState.phase = 'descending';
    await nextTick();
    expect(w.find(WITNESS).attributes('data-colony-build-phase')).to.eq('descending');

    pose(false, 'idle', false);
    await nextTick();
    expect(w.find(WITNESS).exists(), 'the transaction is over — the witness leaves').to.eq(false);
  });

  it('a flight that could not be played is confessed past the scene — with no phase beside it', async () => {
    const w = mount(ConsoleColonyBuildWitness, {...globalConfig});
    pose(false, 'idle', true);
    await nextTick();
    const witness = w.find(WITNESS);
    expect(witness.exists(), 'sticky until the next arm').to.eq(true);
    expect(witness.attributes('data-colony-build-degraded')).to.eq('');
    expect(witness.attributes('data-colony-build-phase'), 'no scene is playing').to.eq(undefined);
  });
});
