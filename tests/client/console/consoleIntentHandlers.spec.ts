import {expect} from 'chai';
import {dispatchConsoleIntent, registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';

/*
 * THE PAD's HANDLERS ARE A STACK (2026-11-23 — the same class as the played hero's landing places, found by looking
 * for it). The router kept ONE handler: the shell registers for the whole game, and a scene that takes the pad over
 * it — the campaign map standing INSIDE the endgame workspace installs the menu pad — wrote over the shell's. When
 * that scene left, its release cleared the slot: no handler at all, every press dropped, until a reload. «B returns
 * to the results» returned the player to a screen that heard nothing.
 */
describe('the console pad\'s intent handlers — a scene that leaves gives the pad back', () => {
  const confirm = () => dispatchConsoleIntent({kind: 'press', button: 'confirm'});

  it('the shell hears the pad again after a scene over it has left', () => {
    const heard: Array<string> = [];
    const offShell = registerConsoleIntentHandler(() => {
      heard.push('shell');
      return true;
    });
    try {
      confirm();
      expect(heard).to.deep.eq(['shell']);
      // The scene (a menu pad — the campaign map's own) takes the pad: it is in front.
      const offScene = installMenuPad(() => {
        heard.push('scene');
        return true;
      });
      confirm();
      expect(heard).to.deep.eq(['shell', 'scene']);
      // The scene leaves: the pad is the shell's again — never nobody's.
      offScene();
      expect(confirm(), 'the press is taken').to.be.true;
      expect(heard).to.deep.eq(['shell', 'scene', 'shell']);
      // …and leaving twice takes nothing more.
      offScene();
      confirm();
      expect(heard).to.deep.eq(['shell', 'scene', 'shell', 'shell']);
    } finally {
      offShell();
    }
    expect(confirm(), 'nobody is left to take it').to.be.false;
  });

  it('the one UNDER may leave first — the one in front keeps the pad', () => {
    const heard: Array<string> = [];
    const offUnder = registerConsoleIntentHandler(() => {
      heard.push('under');
      return true;
    });
    const offFront = registerConsoleIntentHandler(() => {
      heard.push('front');
      return true;
    });
    offUnder();
    confirm();
    expect(heard).to.deep.eq(['front']);
    offFront();
    expect(confirm()).to.be.false;
  });
});
