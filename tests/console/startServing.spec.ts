import {expect} from 'chai';
import {
  START_YIELDS_FOR_PLACEMENT_BLOCKS, StartServingSignals, startServesOf, startServesSomething, startStranded, startYieldsForHeldPlacement,
} from '../../src/client/console/startServing';

/**
 * «ЧТО СЕЙЧАС ОБСЛУЖИВАЕТ СТАРТ» — the game-start scene's honest answer about itself (the reliability iteration of
 * 2026-10-28). The field report it closes: Strategic Base Planning → a colony on Triton → the scene stood EMPTY (crumb
 * «КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ») while the server waited for the prelude's city behind an admission block — «served»
 * for every guard, because the scene was MOUNTED.
 */
const rest: StartServingSignals = {
  mode: 'ceremony', yielded: false, nestedStep: false, flowBeat: false, motion: false, outcomePresenting: false,
  stagePanel: false, stageTransit: false, risk: false, focusables: 0,
};

describe('startServing — what the start serves right now', () => {
  it('an EMPTY ceremony at rest serves NOTHING (the field report\'s frame) — and that is the one answer that is not a surface', () => {
    expect(startServesOf(rest)).eq('none');
    expect(startServesSomething('none')).is.false;
  });

  it('every surface the scene can show is named, in the order the screen shows it', () => {
    expect(startServesOf({...rest, focusables: 2})).eq('queue');
    expect(startServesOf({...rest, risk: true})).eq('risk');
    expect(startServesOf({...rest, stagePanel: true})).eq('stage');
    expect(startServesOf({...rest, outcomePresenting: true})).eq('outcome');
    expect(startServesOf({...rest, nestedStep: true})).eq('step');
    expect(startServesOf({...rest, mode: 'wizard'})).eq('wizard');
    for (const s of ['queue', 'risk', 'stage', 'outcome', 'step', 'wizard', 'beat'] as const) {
      expect(startServesSomething(s), s).is.true;
    }
  });

  it('a moving beat is a bounded serve — a flight, a flow transition, a stage submit', () => {
    expect(startServesOf({...rest, motion: true})).eq('beat');
    expect(startServesOf({...rest, flowBeat: true})).eq('beat');
    expect(startServesOf({...rest, stageTransit: true})).eq('beat');
  });

  it('a YIELDED scene serves nothing ITSELF — whoever it yielded to must (the detector does not count it)', () => {
    expect(startServesOf({...rest, yielded: true, focusables: 3, stagePanel: true})).eq('yielded');
    expect(startServesSomething('yielded')).is.false;
    expect(startServesSomething(undefined)).is.false;
  });

  it('the strand: a live question, an empty scene, nobody else standing for it — and only that', () => {
    expect(startStranded({serves: 'none', promptLive: true, servedElsewhere: false})).is.true;
    expect(startStranded({serves: 'none', promptLive: false, servedElsewhere: false}), 'nothing asked').is.false;
    expect(startStranded({serves: 'none', promptLive: true, servedElsewhere: true}), 'another surface stands').is.false;
    expect(startStranded({serves: 'queue', promptLive: true, servedElsewhere: false}), 'the queue serves').is.false;
    expect(startStranded({serves: 'beat', promptLive: true, servedElsewhere: false}), 'a beat is bounded').is.false;
  });
});

describe('startServing — a held server placement the start cannot host', () => {
  const held = {placementAsked: true, placementLive: false, nestedStep: false};

  it('steps aside for the BOARD\'s waits: a foreign tile owed, the scale story, the announcement', () => {
    expect([...START_YIELDS_FOR_PLACEMENT_BLOCKS].sort()).deep.eq(['announce-gate', 'board-story', 'remote-landing']);
    for (const block of START_YIELDS_FOR_PLACEMENT_BLOCKS) {
      expect(startYieldsForHeldPlacement({...held, block}), block).is.true;
    }
  });

  it('stands for its OWN scenes — a hero on its shelf, a reveal in it, a card into the dock, a blocking cinematic', () => {
    for (const block of ['played-hero', 'reveal', 'card-arrival', 'tile-hero', 'card-discard', 'presentation'] as const) {
      expect(startYieldsForHeldPlacement({...held, block}), block).is.false;
    }
  });

  it('never for a live placement (its own edge already yields), a step it hosts, or no placement at all', () => {
    expect(startYieldsForHeldPlacement({...held, placementLive: true, block: 'remote-landing'})).is.false;
    expect(startYieldsForHeldPlacement({...held, nestedStep: true, block: 'remote-landing'})).is.false;
    expect(startYieldsForHeldPlacement({...held, placementAsked: false, block: 'remote-landing'})).is.false;
    expect(startYieldsForHeldPlacement({...held, block: undefined})).is.false;
  });
});
