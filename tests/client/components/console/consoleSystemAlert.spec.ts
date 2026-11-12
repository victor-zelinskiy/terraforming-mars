/*
 * ConsoleSystemAlert — the pad-reachable system alert. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): it reads the alert queue's module state and renders the alert in front; the shell
 * owns the dismissal (A / B → `dismissConsoleAlert()`), the panel only follows the queue.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {consoleSystemAlertState, dismissConsoleAlert, showConsoleAlert} from '@/client/console/consoleSystemAlertState';
import ConsoleSystemAlert from '@/client/components/console/ConsoleSystemAlert.vue';

// The badge is the gamepad layer's subject; this spec reads which CONTROL the alert asks it to draw.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: ['control'], render: () => h('i', {class: 'glyph-stub'})});

function alertPanel() {
  return mount(ConsoleSystemAlert, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}}});
}

/** The queue is module state every spec of the bundle shares — it starts and ends empty here. */
function clearAlerts(): void {
  consoleSystemAlertState.current = undefined;
  consoleSystemAlertState.queue.splice(0);
}

describe('ConsoleSystemAlert — the console-native system alert', () => {
  beforeEach(clearAlerts);
  afterEach(clearAlerts);

  it('renders the alert in front: the error kicker, its title, its message and the confirm badge', () => {
    showConsoleAlert('Error with input', 'Unable to reach the server.');
    const w = alertPanel();
    expect(w.classes()).to.contain('con-alert');
    expect(w.attributes('role')).to.eq('alertdialog');
    expect(w.attributes('aria-label')).to.eq($t('System error'));
    expect(w.find('.con-alert__backdrop').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-alert__kicker .con-alert__mark').text()).to.eq('!');
    expect(w.find('.con-alert__kicker').text()).to.contain($t('System error'));
    expect(w.find('.con-alert__title').text()).to.eq($t('Error with input'));
    expect(w.find('.con-alert__body').text()).to.eq($t('Unable to reach the server.'));
    expect(w.findComponent(GlyphStub).props('control'), 'A acknowledges').to.eq('confirm');
    expect(w.find('.con-alert__hint').text()).to.contain($t('OK'));
    expect(w.find('.con-alert__queued').exists(), 'nothing waits behind it').to.eq(false);
  });

  it('an alert with no title stands without the title row', () => {
    showConsoleAlert('', 'Unexpected response from server.');
    const w = alertPanel();
    expect(w.find('.con-alert__title').exists()).to.eq(false);
    expect(w.find('.con-alert__body').text()).to.eq($t('Unexpected response from server.'));
  });

  it('counts the alerts queued behind it and follows each dismissal', async () => {
    showConsoleAlert('First', 'one');
    showConsoleAlert('Second', 'two');
    showConsoleAlert('Third', 'three');
    const w = alertPanel();
    expect(w.find('.con-alert__title').text()).to.eq($t('First'));
    expect(w.find('.con-alert__queued').text()).to.eq('+2');

    dismissConsoleAlert();
    await nextTick();
    expect(w.find('.con-alert__title').text()).to.eq($t('Second'));
    expect(w.find('.con-alert__body').text()).to.eq($t('two'));
    expect(w.find('.con-alert__queued').text()).to.eq('+1');

    dismissConsoleAlert();
    await nextTick();
    expect(w.find('.con-alert__title').text()).to.eq($t('Third'));
    expect(w.find('.con-alert__queued').exists(), 'the last one has nothing behind it').to.eq(false);
  });
});
