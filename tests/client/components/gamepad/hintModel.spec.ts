import {expect} from 'chai';
import {hintsFor} from '@/client/gamepad/hintModel';

function controls(scopeId: string, focusKind: Parameters<typeof hintsFor>[1] = 'action'): Array<string> {
  return hintsFor(scopeId, focusKind).map((h) => `${h.control}:${h.label}`);
}

describe('hintModel', () => {
  it('base scope offers navigation, select, panels, journal and the legend', () => {
    const hints = controls('base');
    expect(hints).to.include('dpad:Navigate');
    expect(hints).to.include('confirm:Select');
    expect(hints).to.include('bumperR:Panels');
    expect(hints).to.include('view:Log');
    expect(hints).to.include('menu:Controls');
  });

  it('a focused card adds the Y zoom hint', () => {
    expect(controls('base', 'card')).to.include('inspect:Zoom card');
    expect(controls('overlay-hand', 'card')).to.include('inspect:Zoom card');
    expect(controls('base', 'action')).to.not.include('inspect:Zoom card');
  });

  it('the mandatory modal says B = minimize, never close', () => {
    const hints = controls('mandatoryModal');
    expect(hints).to.include('back:Minimize');
    expect(hints).to.not.include('back:Close');
  });

  it('placement: A reads "Place here" ONLY on an available cell; B always cancels', () => {
    const onAvailable = controls('placement', 'board-cell-available');
    expect(onAvailable).to.include('confirm:Place here');
    expect(onAvailable).to.include('back:Cancel placement');

    const onIllegal = controls('placement', 'board-cell');
    expect(onIllegal).to.not.include('confirm:Place here');
    expect(onIllegal).to.include('back:Cancel placement');
  });

  it('overlays get the common surface grammar (close + panels + scroll)', () => {
    for (const scope of ['overlay-hand', 'overlay-played', 'overlay-actions', 'overlay-vp', 'overlay-dropdown']) {
      const hints = controls(scope);
      expect(hints, scope).to.include('back:Close');
      expect(hints, scope).to.include('bumperR:Panels');
      expect(hints, scope).to.include('stickScroll:Scroll');
    }
  });

  it('the fullscreen card browser hints ←/→ paging', () => {
    expect(controls('dialog')).to.include('dpadH:Navigate');
  });

  it('every scope resolves to a non-empty hint set (the bar is never blank)', () => {
    for (const scope of ['base', 'placement', 'mandatoryModal', 'dialog', 'drawReveal', 'colonies', 'endgame', 'startGameFlow', 'overlay-effects', 'revealViewer', 'unknown-future-scope', 'mainMenu', 'createGame', 'lobby', 'joinPanel', 'finalReveal']) {
      expect(hintsFor(scope, 'action').length, scope).to.be.greaterThan(0);
    }
  });

  it('lifecycle screens hint the System menu; create hints Back', () => {
    expect(controls('mainMenu')).to.include('menu:System');
    expect(controls('lobby')).to.include('menu:System');
    const create = controls('createGame');
    expect(create).to.include('menu:System');
    expect(create).to.include('back:Back');
  });
});
