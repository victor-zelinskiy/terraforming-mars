import {expect} from 'chai';
import {
  ActualStartSignals, StartTruth, actualStartOwner, expectedStartOwner, recordStartShadowFinding, resetStartShadowLog,
  startOwnersAgree, startShadowInScope, startShadowLog, startShadowVerdict,
} from '../../src/client/console/startDirector';

/**
 * «ПРАВДА СЕРВЕРА → ОДНО СОСТОЯНИЕ → ОДИН ВЛАДЕЛЕЦ ЭКРАНА» — phase 0, the SHADOW (the owner, 2026-10-29). Who must serve
 * the start's screen is a pure function of the server's one question; the latches' answer is read beside it and a
 * sustained disagreement is only logged.
 */
const ask = (p: Partial<NonNullable<StartTruth['prompt']>>, generation = 1): StartTruth => ({
  prompt: {type: 'or', bonusAction: false, actionMenu: false, ...p}, generation,
});

describe('startDirector — who MUST serve the start, by the server\'s one question', () => {
  it('nothing asked → waiting; the wizard\'s prompt → the wizard', () => {
    expect(expectedStartOwner({prompt: undefined, generation: 1})).eq('waiting');
    expect(expectedStartOwner(ask({type: 'initialCards', task: 'initialDraft'}))).eq('wizard');
  });

  it('every deployment item of the queue → the queue; the opening move → the first-action stage (generation 1 only)', () => {
    for (const startKind of ['corporationPlay', 'corporationPay', 'preludeSelection', 'corporationMerge', 'campaignBonus', 'campaignLegacy'] as const) {
      expect(expectedStartOwner(ask({startKind})), startKind).eq('queue');
    }
    expect(expectedStartOwner(ask({startKind: 'corporationInitialAction'}))).eq('firstAction');
    expect(expectedStartOwner(ask({startKind: 'corporationInitialAction'}, 3)), 'a mid-game acquisition keeps its modal').eq('step');
  });

  it('a bonus window → its stage; the ordinary menu → the game proper; a placement → the board; anything else → a step', () => {
    expect(expectedStartOwner(ask({bonusAction: true, actionMenu: true}))).eq('bonusAction');
    expect(expectedStartOwner(ask({actionMenu: true}))).eq('game');
    expect(expectedStartOwner(ask({type: 'space'}))).eq('board');
    expect(expectedStartOwner(ask({type: 'colony', task: 'colony'}))).eq('step');
    expect(expectedStartOwner(ask({type: 'card', task: 'deckSelect'}))).eq('step');
  });
});

describe('startDirector — what the latches put on screen', () => {
  const rest: ActualStartSignals = {
    mounted: true, visible: true, serves: 'none', firstActStage: false, placementLive: false, promptSurface: false,
    strandYield: false, parked: false,
  };

  it('reads the scene\'s own answer, the board, the shell and the player\'s park', () => {
    expect(actualStartOwner({...rest, serves: 'queue'})).eq('queue');
    expect(actualStartOwner({...rest, serves: 'risk'})).eq('queue');
    expect(actualStartOwner({...rest, serves: 'outcome'})).eq('step');
    expect(actualStartOwner({...rest, serves: 'stage', firstActStage: true})).eq('firstAction');
    expect(actualStartOwner({...rest, serves: 'stage'})).eq('bonusAction');
    expect(actualStartOwner({...rest, serves: 'wizard'})).eq('wizard');
    expect(actualStartOwner(rest)).eq('none');
    expect(actualStartOwner({...rest, visible: false, placementLive: true})).eq('board');
    expect(actualStartOwner({...rest, visible: false, promptSurface: true})).eq('shell');
    expect(actualStartOwner({...rest, visible: false})).eq('beat');
    expect(actualStartOwner({...rest, parked: true})).eq('parked');
    expect(actualStartOwner({...rest, mounted: false})).eq('game');
    expect(actualStartOwner({...rest, promptSurface: true, serves: 'queue'}), 'a surface over the scene serves the step').eq('step');
  });
});

describe('startDirector — agreement and scope', () => {
  it('a beat and a park are never judged; waiting accepts any calm pose; a step may be the start\'s or the shell\'s', () => {
    expect(startOwnersAgree('queue', 'beat')).is.true;
    expect(startOwnersAgree('board', 'parked')).is.true;
    expect(startOwnersAgree('waiting', 'none')).is.true;
    expect(startOwnersAgree('step', 'shell')).is.true;
    expect(startOwnersAgree('step', 'step')).is.true;
  });

  it('the field hang\'s shape is a disagreement: the city asked, the scene empty', () => {
    expect(startOwnersAgree('board', 'none')).is.false;
    expect(startOwnersAgree('step', 'firstAction'), 'a stage over a question (the sponsor\'s pick)').is.false;
    expect(startOwnersAgree('queue', 'none')).is.false;
  });

  it('judges the start flow only — a game-proper surface is not its business, a start-only question is', () => {
    expect(startShadowInScope('step', 'game')).is.false;
    expect(startShadowInScope('board', 'game')).is.false;
    expect(startShadowInScope('queue', 'game'), 'a deployment item with no scene is a finding').is.true;
    expect(startShadowInScope('board', 'none')).is.true;
  });

  it('a HELD prompt is judged only over a screen with nothing to do (a reveal to take is the player\'s own wait)', () => {
    expect(startShadowVerdict('board', 'step', 'reveal'), 'Valley Trust: the drawn preludes to take').eq('agree');
    expect(startShadowVerdict('firstAction', 'step', 'reveal')).eq('agree');
    expect(startShadowVerdict('board', 'none', 'remote-landing'), 'the field hang').eq('held');
    expect(startShadowVerdict('board', 'beat', 'board-story')).eq('held');
    expect(startShadowVerdict('board', 'none', undefined)).eq('disagree');
    expect(startShadowVerdict('queue', 'queue', undefined)).eq('agree');
  });

  it('a finding is logged ONCE per (kind, owners, prompt)', () => {
    resetStartShadowLog();
    const f = {kind: 'disagree' as const, expected: 'board' as const, actual: 'none' as const, prompt: 'space:#7', at: 1};
    expect(recordStartShadowFinding(f)).is.true;
    expect(recordStartShadowFinding({...f, at: 2})).is.false;
    expect(recordStartShadowFinding({...f, prompt: 'space:#8'})).is.true;
    expect(startShadowLog.findings).length(2);
    resetStartShadowLog();
  });
});
