/*
 * ConsoleTerraformedTitle — «МАРС ТЕРРАФОРМИРОВАН», the title plate of the terraformed scene. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): it reads the scene's module state and nothing else — it stands
 * from the show to the end of the return, and its claim is honest about the last generation.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {TerraformedScenePhase, terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import ConsoleTerraformedTitle from '@/client/components/console/ConsoleTerraformedTitle.vue';

const PLATE = '[data-terraformed-title]';

/** The three fields the plate reads — module state every spec of the bundle shares, so it starts and ends at rest. */
function pose(phase: TerraformedScenePhase, final = false, skipped = false): void {
  terraformedSceneState.phase = phase;
  terraformedSceneState.final = final;
  terraformedSceneState.skipped = skipped;
}

describe('ConsoleTerraformedTitle — the title plate of the terraformed scene', () => {
  beforeEach(() => pose('idle'));
  afterEach(() => pose('idle'));

  it('renders nothing before the planet shows', () => {
    for (const phase of ['idle', 'armed', 'recede', 'focus'] as const) {
      pose(phase);
      const w = mount(ConsoleTerraformedTitle, {...globalConfig});
      expect(w.find(PLATE).exists(), phase).to.eq(false);
      w.unmount();
    }
  });

  it('in the show: the kicker, the headline and the three parameters as its claim', () => {
    pose('show');
    const plate = mount(ConsoleTerraformedTitle, {...globalConfig}).find(PLATE);
    expect(plate.classes()).to.deep.eq(['con-terraformed']);
    expect(plate.attributes('role')).to.eq('status');
    expect(plate.attributes('aria-label')).to.eq($t('Terraforming complete'));
    expect(plate.attributes('data-terraformed-phase')).to.eq('show');
    expect(plate.find('.con-terraformed__plate > .con-terraformed__kicker').text()).to.eq($t('Terraforming complete'));
    expect(plate.find('.con-terraformed__plate > .con-terraformed__name').text()).to.eq($t('Mars is terraformed'));
    expect(plate.find('.con-terraformed__plate > .con-terraformed__claim').text())
      .to.eq($t('Temperature, oxygen and oceans are complete'));
  });

  it('claims the last generation only when the scene says so — and marks a skipped show', () => {
    pose('show', true, true);
    const plate = mount(ConsoleTerraformedTitle, {...globalConfig}).find(PLATE);
    expect(plate.classes()).to.include.members(['con-terraformed', 'con-terraformed--final', 'con-terraformed--skipped']);
    expect(plate.find('.con-terraformed__claim').text()).to.eq($t('The current generation will be the last'));
  });

  it('follows the scene: it stands through the return and leaves with it', async () => {
    const w = mount(ConsoleTerraformedTitle, {...globalConfig});
    expect(w.find(PLATE).exists()).to.eq(false);

    pose('show');
    await nextTick();
    expect(w.find(PLATE).attributes('data-terraformed-phase')).to.eq('show');

    pose('return', true);
    await nextTick();
    expect(w.find(PLATE).attributes('data-terraformed-phase'), 'the leave transition carries it out').to.eq('return');
    expect(w.find(PLATE).classes()).to.contain('con-terraformed--final');
    expect(w.find('.con-terraformed__claim').text()).to.eq($t('The current generation will be the last'));

    pose('idle');
    await nextTick();
    expect(w.find(PLATE).exists()).to.eq(false);
  });
});
