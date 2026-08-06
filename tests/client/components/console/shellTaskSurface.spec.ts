import {expect} from 'chai';
import {ConsoleTask, ShellSurfaceContext, shellTaskOnSurface} from '@/client/console/consoleTaskRouter';

/**
 * THE ASK BANNER'S ONE CONDITION.
 *
 * The central banner means «what you owe is NOT on the screen you are looking
 * at». It used to be keyed on `shellTaskActive` — «the task exists and is not
 * deferred», i.e. its surface is OPEN — so it lit up exactly when it was
 * pointless (a second title over the very screen the prompt IS; inside the
 * Game Start Workspace it landed across the breadcrumb tail) and went dark the
 * moment it would have helped. This is the map it should have been keyed on.
 */
describe('shellTaskOnSurface — where a shell-section task is answered', () => {
  const at = (over: Partial<ShellSurfaceContext> = {}): ShellSurfaceContext => ({
    section: 'board',
    sheet: undefined,
    corpFirstActionOpen: false,
    handEmbedded: false,
    ...over,
  });

  const playFromHand: ConsoleTask = {kind: 'projectCard', mode: 'playFromHand'};
  const standardProject: ConsoleTask = {kind: 'projectCard', mode: 'standardProject'};

  it('no task → nothing is owed anywhere', () => {
    expect(shellTaskOnSurface(undefined, at({section: 'hand'}))).to.eq(false);
  });

  it('play-from-hand is answered ON THE HAND', () => {
    expect(shellTaskOnSurface(playFromHand, at({section: 'hand'}))).to.eq(true);
    expect(shellTaskOnSurface(playFromHand, at({section: 'board'}))).to.eq(false);
    expect(shellTaskOnSurface(playFromHand, at({section: 'colonies'}))).to.eq(false);
  });

  /**
   * «Эпатажный спонсор»: the hand is hosted INSIDE the Game Start Workspace,
   * so being in the start IS being on the hand — one place, not two. Without
   * this row the player would be told to go to a screen they are standing on.
   */
  it('…and INSIDE the Game Start Workspace that is the same place', () => {
    expect(shellTaskOnSurface(playFromHand, at({section: 'hand', handEmbedded: true}))).to.eq(true);
    // Even mid-transition, before the section has settled on 'hand'.
    expect(shellTaskOnSurface(playFromHand, at({section: 'board', handEmbedded: true}))).to.eq(true);
  });

  it('a standard project is answered on ITS SHEET, not merely on the board', () => {
    expect(shellTaskOnSurface(standardProject, at({sheet: 'standardProjects'}))).to.eq(true);
    expect(shellTaskOnSurface(standardProject, at({section: 'board'}))).to.eq(false);
    expect(shellTaskOnSurface(standardProject, at({sheet: 'awards'}))).to.eq(false);
    // The hand is NOT where a standard project is bought.
    expect(shellTaskOnSurface(standardProject, at({section: 'hand'}))).to.eq(false);
  });

  it('a mandatory hand pick is answered on the hand', () => {
    expect(shellTaskOnSurface({kind: 'handSelect'}, at({section: 'hand'}))).to.eq(true);
    expect(shellTaskOnSurface({kind: 'handSelect'}, at({section: 'board'}))).to.eq(false);
    // …and the sponsor embed does NOT vouch for it: that flag is about the
    // play-from-hand step only.
    expect(shellTaskOnSurface({kind: 'handSelect'}, at({section: 'board', handEmbedded: true}))).to.eq(false);
  });

  it('a colony pick is answered on the colonies rail', () => {
    expect(shellTaskOnSurface({kind: 'colony'}, at({section: 'colonies'}))).to.eq(true);
    expect(shellTaskOnSurface({kind: 'colony'}, at({section: 'hand'}))).to.eq(false);
  });

  it('free award funding is answered on the awards sheet', () => {
    expect(shellTaskOnSurface({kind: 'awardFunding'}, at({sheet: 'awards'}))).to.eq(true);
    expect(shellTaskOnSurface({kind: 'awardFunding'}, at({section: 'board'}))).to.eq(false);
  });

  it('the corporation first action has no section — its own confirm IS the surface', () => {
    expect(shellTaskOnSurface({kind: 'corpFirstAction'}, at({corpFirstActionOpen: true}))).to.eq(true);
    expect(shellTaskOnSurface({kind: 'corpFirstAction'}, at({section: 'board'}))).to.eq(false);
  });

  /** A kind outside the shell-section family has no surface of this family. */
  it('a non-shell-section kind is never "on surface"', () => {
    expect(shellTaskOnSurface({kind: 'space'}, at({section: 'board'}))).to.eq(false);
    expect(shellTaskOnSurface({kind: 'initialDraft'}, at({section: 'hand'}))).to.eq(false);
  });
});
