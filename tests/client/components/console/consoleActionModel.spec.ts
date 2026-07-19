import {expect} from 'chai';
import {
  BASE_ACTION_OF_BUTTON,
  CONSOLE_KEY_BUTTON,
  CONSOLE_KEY_NAV,
  consoleActionOf,
  isConsoleAction,
  keyboardConsoleIntent,
} from '@/client/console/composables/consoleActionModel';

/**
 * Foundation layer (docs/CONSOLE_FOUNDATION.md §2): the PURE semantic vocabulary —
 * physical input → SemanticButton/GamepadIntent → ConsoleAction. The ONE
 * keyboard map of the whole console flow also lives here.
 */
describe('consoleActionModel (foundation)', () => {
  it('base map: the canonical console verbs', () => {
    expect(consoleActionOf({kind: 'press', button: 'confirm'})).to.eq('primary');
    expect(consoleActionOf({kind: 'press', button: 'back'})).to.eq('back');
    expect(consoleActionOf({kind: 'press', button: 'secondary'})).to.eq('inspect'); // X = «Осмотреть»
    expect(consoleActionOf({kind: 'press', button: 'inspect'})).to.eq('fullscreen'); // Y
    expect(consoleActionOf({kind: 'press', button: 'bumperL'})).to.eq('prevSection');
    expect(consoleActionOf({kind: 'press', button: 'bumperR'})).to.eq('nextSection');
    expect(consoleActionOf({kind: 'press', button: 'triggerL'})).to.eq('prevTab');
    expect(consoleActionOf({kind: 'press', button: 'triggerR'})).to.eq('nextTab');
    expect(consoleActionOf({kind: 'press', button: 'view'})).to.eq('reset');
    expect(consoleActionOf({kind: 'press', button: 'menu'})).to.eq('system');
  });

  it('sticks have NO default action (screen-specific: board / scale inspection)', () => {
    expect(consoleActionOf({kind: 'press', button: 'stickL'})).to.eq(undefined);
    expect(consoleActionOf({kind: 'press', button: 'stickR'})).to.eq(undefined);
    expect(BASE_ACTION_OF_BUTTON.stickL).to.eq(undefined);
  });

  it('only PRESS intents resolve — releases / nav / scroll stay raw', () => {
    expect(consoleActionOf({kind: 'release', button: 'confirm'})).to.eq(undefined);
    expect(consoleActionOf({kind: 'nav', dir: 'up', repeat: false})).to.eq(undefined);
    expect(consoleActionOf({kind: 'scroll', dx: 0, dy: 1})).to.eq(undefined);
  });

  it('contextual overrides re-label a control per screen', () => {
    // Create-game: X = the global launch action.
    expect(consoleActionOf({kind: 'press', button: 'secondary'}, {secondary: 'launch'})).to.eq('launch');
    // In-game shell: the triggers are the quick wheels.
    expect(consoleActionOf({kind: 'press', button: 'triggerR'}, {triggerR: 'openActionsWheel'})).to.eq('openActionsWheel');
    expect(consoleActionOf({kind: 'press', button: 'triggerL'}, {triggerL: 'openStandardProjectsWheel'})).to.eq('openStandardProjectsWheel');
    // A dialog: primary reads as confirm, back as cancel.
    expect(consoleActionOf({kind: 'press', button: 'confirm'}, {confirm: 'confirm'})).to.eq('confirm');
    expect(consoleActionOf({kind: 'press', button: 'back'}, {back: 'cancel'})).to.eq('cancel');
    // An override never leaks onto other buttons.
    expect(consoleActionOf({kind: 'press', button: 'back'}, {secondary: 'launch'})).to.eq('back');
  });

  it('isConsoleAction: the handler-side predicate', () => {
    expect(isConsoleAction({kind: 'press', button: 'confirm'}, 'primary')).to.eq(true);
    expect(isConsoleAction({kind: 'press', button: 'confirm'}, 'back')).to.eq(false);
  });

  describe('keyboard map (the ONE map of the console flow)', () => {
    it('arrows synthesize nav with the native repeat flag', () => {
      expect(keyboardConsoleIntent('ArrowUp', false)).to.deep.eq({kind: 'nav', dir: 'up', repeat: false});
      expect(keyboardConsoleIntent('ArrowDown', true)).to.deep.eq({kind: 'nav', dir: 'down', repeat: true});
      expect(keyboardConsoleIntent('ArrowLeft', false)).to.deep.eq({kind: 'nav', dir: 'left', repeat: false});
      expect(keyboardConsoleIntent('ArrowRight', false)).to.deep.eq({kind: 'nav', dir: 'right', repeat: false});
    });

    it('buttons synthesize edge presses — never on key repeat (mirrors pad edges)', () => {
      expect(keyboardConsoleIntent('Enter', false)).to.deep.eq({kind: 'press', button: 'confirm'});
      expect(keyboardConsoleIntent('NumpadEnter', false)).to.deep.eq({kind: 'press', button: 'confirm'});
      expect(keyboardConsoleIntent('Escape', false)).to.deep.eq({kind: 'press', button: 'back'});
      expect(keyboardConsoleIntent('KeyX', false)).to.deep.eq({kind: 'press', button: 'secondary'});
      expect(keyboardConsoleIntent('KeyY', false)).to.deep.eq({kind: 'press', button: 'inspect'});
      expect(keyboardConsoleIntent('KeyQ', false)).to.deep.eq({kind: 'press', button: 'bumperL'});
      expect(keyboardConsoleIntent('KeyE', false)).to.deep.eq({kind: 'press', button: 'bumperR'});
      expect(keyboardConsoleIntent('KeyR', false)).to.deep.eq({kind: 'press', button: 'view'});
      expect(keyboardConsoleIntent('Enter', true)).to.eq(undefined);
    });

    it('bracket keys stay bumper ALIASES (create-game parity); triggers ride ,/.', () => {
      expect(keyboardConsoleIntent('BracketLeft', false)).to.deep.eq({kind: 'press', button: 'bumperL'});
      expect(keyboardConsoleIntent('BracketRight', false)).to.deep.eq({kind: 'press', button: 'bumperR'});
      expect(keyboardConsoleIntent('Comma', false)).to.deep.eq({kind: 'press', button: 'triggerL'});
      expect(keyboardConsoleIntent('Period', false)).to.deep.eq({kind: 'press', button: 'triggerR'});
    });

    it('unmapped keys stay with the browser', () => {
      expect(keyboardConsoleIntent('KeyA', false)).to.eq(undefined);
      expect(keyboardConsoleIntent('Tab', false)).to.eq(undefined);
      expect(keyboardConsoleIntent('Space', false)).to.eq(undefined);
    });

    it('every mapped key resolves through the tables (no dead entries)', () => {
      for (const code of Object.keys(CONSOLE_KEY_NAV)) {
        expect(keyboardConsoleIntent(code, false)?.kind).to.eq('nav');
      }
      for (const code of Object.keys(CONSOLE_KEY_BUTTON)) {
        expect(keyboardConsoleIntent(code, false)?.kind).to.eq('press');
      }
    });
  });
});
