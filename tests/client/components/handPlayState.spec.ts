import {expect} from 'chai';
import {
  handPlayState,
  handPlayPrompt,
  handPlaySignature,
  enterHandPlay,
  exitHandPlay,
} from '@/client/components/handCards/handPlayState';

function view(waitingFor: any, hand: Array<string>): any {
  return {waitingFor, cardsInHand: hand.map((name) => ({name}))};
}

function projectCardPrompt(names: Array<string>): any {
  return {type: 'projectCard', title: 'Select a card to play', cards: names.map((name) => ({name}))};
}

describe('handPlayState', () => {
  afterEach(() => exitHandPlay());

  it('matches a top-level projectCard whose candidates are all in hand', () => {
    const wf = projectCardPrompt(['A', 'B']);
    expect(handPlayPrompt(view(wf, ['A', 'B', 'C']))).to.eq(wf);
  });

  it('ignores a projectCard whose candidates are NOT in hand (standard projects)', () => {
    const wf = projectCardPrompt(['City', 'Greenery']);
    expect(handPlayPrompt(view(wf, ['A', 'B']))).to.eq(undefined);
  });

  it('ignores non-projectCard and empty prompts', () => {
    expect(handPlayPrompt(view({type: 'card', cards: [{name: 'A'}]}, ['A']))).to.eq(undefined);
    expect(handPlayPrompt(view(projectCardPrompt([]), ['A']))).to.eq(undefined);
    expect(handPlayPrompt(view(undefined, ['A']))).to.eq(undefined);
  });

  it('enter/exit track active + signature', () => {
    const wf = projectCardPrompt(['A', 'B']);
    enterHandPlay(wf);
    expect(handPlayState.active).to.be.true;
    expect(handPlayState.signature).to.eq(handPlaySignature(wf));
    exitHandPlay();
    expect(handPlayState.active).to.be.false;
    expect(handPlayState.signature).to.eq('');
  });
});
