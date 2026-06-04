import {expect} from 'chai';
import {
  standardProjectPlayState,
  standardProjectPlayPrompt,
  enterStandardProjectPlay,
  exitStandardProjectPlay,
} from '@/client/components/handCards/standardProjectPlayState';
import {handPlayPrompt} from '@/client/components/handCards/handPlayState';

function view(waitingFor: any, hand: Array<string>): any {
  return {waitingFor, cardsInHand: hand.map((name) => ({name}))};
}

function projectCardPrompt(names: Array<string>): any {
  return {type: 'projectCard', title: 'Select your first standard project', cards: names.map((name) => ({name}))};
}

describe('standardProjectPlayState', () => {
  afterEach(() => exitStandardProjectPlay());

  it('matches a top-level projectCard whose candidates are NOT in hand (standard projects)', () => {
    const wf = projectCardPrompt(['City:SP', 'Aquifer:SP']);
    const v = view(wf, ['SomeHandCard']);
    expect(standardProjectPlayPrompt(v)).to.eq(wf);
    // ...and is mutually exclusive with hand-play.
    expect(handPlayPrompt(v)).to.eq(undefined);
  });

  it('ignores a projectCard whose candidates ARE in hand (that is hand-play)', () => {
    const wf = projectCardPrompt(['A', 'B']);
    const v = view(wf, ['A', 'B', 'C']);
    expect(standardProjectPlayPrompt(v)).to.eq(undefined);
    expect(handPlayPrompt(v)).to.eq(wf);
  });

  it('ignores non-projectCard and empty prompts', () => {
    expect(standardProjectPlayPrompt(view({type: 'card', cards: [{name: 'A'}]}, ['A']))).to.eq(undefined);
    expect(standardProjectPlayPrompt(view(projectCardPrompt([]), ['A']))).to.eq(undefined);
    expect(standardProjectPlayPrompt(view(undefined, ['A']))).to.eq(undefined);
  });

  it('enter/exit track active state', () => {
    enterStandardProjectPlay(projectCardPrompt(['City:SP']));
    expect(standardProjectPlayState.active).to.be.true;
    exitStandardProjectPlay();
    expect(standardProjectPlayState.active).to.be.false;
  });
});
