import {expect} from 'chai';
import {clearPanelCommands, consolePanelUi, panelCommands, setPanelCommands} from '../../src/client/console/consolePanelUi';
import type {ConsoleCommand} from '../../src/client/console/consoleCommandModel';

/*
 * EVERY OWNER KEEPS ITS OWN CONTRACT (FREEZE ZERO — CI's autopilot on `a3c1a4cd33`, game 248). The bar's mirror was ONE
 * slot: the Info mode (Y), opened OVER the external draw's take in the Parliament's stage, overwrote the take's commands,
 * and its close cleared the slot — the take, publishing only when its own commands change, never came back: a bar of
 * «Парламент» and nothing else until the door answered the take.
 */
describe('consolePanelUi — every owner keeps its own contract', () => {
  const take: Array<ConsoleCommand> = [{control: 'confirm', label: 'Collect the card'}, {control: 'inspect', label: 'Inspect'}];
  const info: Array<ConsoleCommand> = [{control: 'inspect', label: 'Close'}];

  afterEach(() => {
    clearPanelCommands('externalDraw');
    clearPanelCommands('infoMode');
    clearPanelCommands('taskHost');
  });

  it('a cover opened over a standing panel and closed again: the panel\'s verbs stand again', () => {
    setPanelCommands('externalDraw', take);
    setPanelCommands('infoMode', info);
    expect(panelCommands('infoMode'), 'the cover reads its own').to.deep.eq(info);
    expect(consolePanelUi.owner, 'the latest publication is the top').to.eq('infoMode');
    clearPanelCommands('infoMode');
    expect(panelCommands('externalDraw'), 'the take reads its verbs again').to.deep.eq(take);
    expect(consolePanelUi.owner).to.eq('externalDraw');
    expect(consolePanelUi.commands).to.deep.eq(take);
  });

  it('a panel under a cover that updates its commands keeps its place under it', () => {
    setPanelCommands('externalDraw', take);
    setPanelCommands('infoMode', info);
    const updated: Array<ConsoleCommand> = [{control: 'confirm', label: 'Collect the card', enabled: false}];
    setPanelCommands('externalDraw', updated);
    expect(consolePanelUi.owner, 'the cover stays on top').to.eq('infoMode');
    expect(panelCommands('externalDraw'), 'the update is kept').to.deep.eq(updated);
  });

  it('a cleared owner reads nothing; clearing an owner that never published changes nothing', () => {
    setPanelCommands('taskHost', take);
    clearPanelCommands('externalDraw');
    expect(panelCommands('taskHost')).to.deep.eq(take);
    clearPanelCommands('taskHost');
    expect(panelCommands('taskHost')).to.eq(undefined);
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
  });
});
