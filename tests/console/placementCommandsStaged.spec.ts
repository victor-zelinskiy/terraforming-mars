import {expect} from 'chai';
import {placementCommands, PlacementCommandState, STAGED_BACK_OWED} from '../../src/client/console/tilePlacement/placementCommands';

/**
 * THE STAGED BOARD SPEAKS THE PLAY (T15 · CD). A staged pick is the last reversible step of playing a card — nothing
 * has been sent — so A plays the card for its price and B walks back to it. The generic placement words («Разместить
 * здесь», «Отменить размещение») are the one thing the bar may not say there.
 */
describe('placementCommands — the staged board (T15 · CD)', () => {
  const base: PlacementCommandState = {
    phase: 'navigate', twoStep: true, legal: true, cancellable: true, freeRoam: false, sourceInspectable: true,
  };
  const play: PlacementCommandState = {...base, staged: {flow: 'play', price: '15 M€'}};
  const labels = (state: PlacementCommandState) => placementCommands(state).map((c) => `${c.control}:${c.label}`);
  const confirmOf = (state: PlacementCommandState) => placementCommands(state).find((c) => c.control === 'confirm')!;

  it('navigate (two presses): A «Play here» locks, B «Back to the card» — never «Cancel placement»', () => {
    expect(labels(play)).deep.eq(['dpad:Navigate', 'confirm:Play here', 'stickL:Source', 'stickR:All cells', 'back:Back to the card']);
    expect(labels(play).join(' ')).to.not.match(/Cancel placement|Place here|Select cell/);
  });

  it('locked: A carries the PRICE — «Play · 15 M€»; B is one level (the cell)', () => {
    const locked = {...play, phase: 'locked' as const};
    expect(labels(locked)).deep.eq(['confirm:Play · ${0}', 'back:Change cell', 'stickL:Source']);
    const a = confirmOf(locked);
    expect(a.labelParams).deep.eq(['15 M€']);
    expect(a.enabled).is.true;
    expect(a.highlight).is.true;
  });

  it('single press: the first A commits, so it already carries the price', () => {
    const a = confirmOf({...play, twoStep: false});
    expect(a.label).eq('Play · ${0}');
    expect(a.labelParams).deep.eq(['15 M€']);
  });

  it('no known receipt: the verb stands without a price, never a blank «·»', () => {
    const bare: PlacementCommandState = {...base, staged: {flow: 'play'}};
    expect(confirmOf({...bare, phase: 'locked'}).label).eq('Play here');
    expect(confirmOf({...bare, phase: 'locked'}).labelParams).is.undefined;
    expect(confirmOf({...bare, twoStep: false}).label).eq('Play here');
  });

  it('committing: the status «Playing…», no live verb', () => {
    const cmds = placementCommands({...play, phase: 'committing'});
    expect(cmds.map((c) => c.label)).deep.eq(['Playing…']);
    expect(cmds[0].enabled).is.false;
  });

  it('a focused refusal: A stands disabled — the staged verb, never hidden', () => {
    const a = confirmOf({...play, legal: false});
    expect(a.label).eq('Play here');
    expect(a.enabled).is.false;
    expect(a.highlight).is.false;
  });

  it('B OWED: the return is SHOWN as a status where B stood, and A waits', () => {
    const owed = placementCommands({...play, staged: {flow: 'play', price: '15 M€', backOwed: true}});
    expect(owed.map((c) => `${c.control}:${c.label}`)).deep.eq(['confirm:Play here', `back:${STAGED_BACK_OWED}`]);
    expect(owed.every((c) => c.enabled === false), 'both are statuses').is.true;
  });

  it('a blue card\'s ACTION speaks the action\'s words', () => {
    const action: PlacementCommandState = {...base, staged: {flow: 'action'}};
    expect(labels(action)).deep.eq(['dpad:Navigate', 'confirm:Perform here', 'stickL:Source', 'stickR:All cells', 'back:Back to the action setup']);
    expect(labels({...action, phase: 'committing'})).deep.eq(['confirm:Performing…']);
    const priced = confirmOf({...action, phase: 'locked', staged: {flow: 'action', price: '8 M€'}});
    expect(priced.label).eq('Perform · ${0}');
  });

  it('a staged MOVE keeps its family\'s words (the move\'s levels are their own grammar)', () => {
    const move: PlacementCommandState = {...play, moveLevel: 'cell'};
    expect(labels(move)).deep.eq(['dpad:Navigate', 'confirm:Select cell', 'stickL:Source', 'stickR:All cells', 'back:Another city']);
    expect(labels({...play, moveLevel: 'source'})[1]).eq('confirm:Take the city');
  });

  it('a live placement reads exactly as before', () => {
    expect(labels(base)).deep.eq(['dpad:Navigate', 'confirm:Select cell', 'stickL:Source', 'stickR:All cells', 'back:Cancel placement']);
    expect(labels({...base, phase: 'locked'})).deep.eq(['confirm:Confirm placement', 'back:Change cell', 'stickL:Source']);
  });
});
