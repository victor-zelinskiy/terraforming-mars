import {expect} from 'chai';
import {
  ActualStartSignals, StartTruth, actualStartOwner, expectedStartOwner, recordStartShadowFinding, resetStartShadowLog,
  startDirectorCure, startOwnersAgree, startShadowInScope, startShadowLog, startShadowVerdict,
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
    expect(actualStartOwner({...rest, mounted: false, parked: true}), 'a minimized first action takes the frame off the stack — the player\'s own choice').eq('parked');
    expect(actualStartOwner({...rest, mounted: false, placementLive: true}), 'a placement outside the start is the game\'s — out of the shadow\'s scope').eq('game');
    expect(actualStartOwner({...rest, promptSurface: true, serves: 'queue'}), 'a surface over the scene serves the step').eq('step');
  });
});

describe('startDirector — agreement and scope', () => {
  it('the corp mandatory move inside the bonus window is the bonus stage own sub-stage — agreed', () => {
    expect(startOwnersAgree('firstAction', 'bonusAction')).is.true;
    expect(startOwnersAgree('bonusAction', 'firstAction'), 'the other way round is a real disagreement').is.false;
    expect(startOwnersAgree('game', 'shell'), 'the start frame still standing (yielded) while the game proper asks — NOT agreement').is.false;
    expect(startOwnersAgree('game', 'none'), 'the start standing empty while the game asks is the finding the field showed').is.false;
  });

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

/**
 * PHASE 1 — THE SHADOW ACTS (the owner, 2026-10-31): a confirmed finding is cured through the doors that already
 * exist, by name. The cure is PURE here; the shell runs it (the scene's `healStrand`, the strand's yield) from the
 * shadow's confirmation and from the liveness ladder's rung `start-director` (rank 15).
 */
describe('startDirector — phase 1, the cure of a confirmed finding', () => {
  const cure = (expected: Parameters<typeof startDirectorCure>[0]['expected'], actual: Parameters<typeof startDirectorCure>[0]['actual'], kind: 'disagree' | 'held-long' = 'disagree') =>
    startDirectorCure({kind, expected, actual});

  it('the START must serve and nobody does → HEAL through the scene\'s doors', () => {
    expect(cure('queue', 'none')).to.eq('heal');
    expect(cure('firstAction', 'none')).to.eq('heal');
    expect(cure('bonusAction', 'none')).to.eq('heal');
    expect(cure('wizard', 'none')).to.eq('heal');
  });

  it('the SHELL\'s surface must serve (a step, the board) and the start stands in the way → YIELD', () => {
    expect(cure('step', 'none')).to.eq('yield');
    expect(cure('step', 'queue')).to.eq('yield');
    expect(cure('board', 'firstAction')).to.eq('yield');
  });

  it('the GAME PROPER has begun and the start still stands, in any pose → RELEASE (the field of 2026-10-31 22:15)', () => {
    expect(cure('game', 'none')).to.eq('release');
    expect(cure('game', 'queue')).to.eq('release');
    expect(cure('game', 'shell'), 'a yield already happened — the frame still covers the board').to.eq('release');
    expect(cure('game', 'game'), 'the start is gone').to.eq('none');
    expect(cure('game', 'board'), 'a live placement').to.eq('none');
  });

  it('a HELD prompt is an admission block\'s own ledgered debt — never cured here', () => {
    expect(cure('board', 'none', 'held-long')).to.eq('none');
    expect(cure('queue', 'none', 'held-long')).to.eq('none');
  });

  it('a disagreement the player can ACT on is logged only — the shell already serving a start question, the board under a placement', () => {
    expect(cure('queue', 'shell'), 'the strand\'s yield already happened — not undone').to.eq('none');
    expect(cure('firstAction', 'board')).to.eq('none');
    expect(cure('step', 'shell')).to.eq('none');
  });
});
