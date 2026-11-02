import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  beginPreludePlayChain, endPreludePlayChain, preludeChainHoldsClaim, preludeChainOn, preludeChainOwesHand, preludePlayChainState,
} from '@/client/console/deckPick/preludePlayChain';
import {CardName} from '@/common/cards/CardName';

/*
 * PL-1467 · THE HAND YIELDS TO THE BOARD AND COMES BACK ONLY IF THE FLOW STILL OWES IT (P91, decision 6). The return
 * branch has no natural trigger in today's prelude deck (Experimental Forest searches BEFORE its greenery), so its
 * verdict is pinned here: the hand comes back for a card pick, a payment, a colony — never for the action menu or for
 * nothing.
 */
describe('preludePlayChain', () => {
  const view = (waitingFor: unknown) => ({
    id: 'p-viewer',
    waitingFor,
    cardsInHand: [],
    thisPlayer: {tableau: []},
    game: {phase: 'action', generation: 2, gameOptions: {}},
  } as unknown as PlayerViewModel);

  afterEach(() => endPreludePlayChain());

  it('the chain is live from the play to its end; it holds the claim only through a board step', () => {
    expect(preludePlayChainState.live).is.false;
    expect(preludeChainHoldsClaim(true), 'no chain, no hold').is.false;
    beginPreludePlayChain('Experimental Forest' as CardName);
    expect(preludePlayChainState.live).is.true;
    expect(preludeChainHoldsClaim(true), 'a live placement of the chain keeps the claim').is.true;
    endPreludePlayChain();
    expect(preludeChainHoldsClaim(true)).is.false;
  });

  it('the HOST is a parameter (P45): a chain played out of «ДЕЙСТВИЯ КАРТ» stands there, not in the hand', () => {
    beginPreludePlayChain('Loan' as CardName);
    expect(preludePlayChainState.host, 'the default stays the hand (P91)').eq('hand');
    expect(preludeChainOn('hand')).is.true;
    endPreludePlayChain();
    beginPreludePlayChain('Loan' as CardName, 'card-actions');
    expect(preludeChainOn('card-actions')).is.true;
    expect(preludeChainOn('hand')).is.false;
    endPreludePlayChain();
    expect(preludePlayChainState.host, 'the end resets the host').eq('hand');
  });

  it('owed: a card pick / a deck pick the hand hosts brings the hand back', () => {
    const pick = view({type: 'card', title: 'Select card', buttonLabel: 'Select', cards: [{name: 'Birds'}], min: 1, max: 1});
    expect(preludeChainOwesHand(pick)).is.true;
    const deck = view({type: 'card', title: 'Select', buttonLabel: 'Select', cards: [{name: 'Birds'}],
      deckPickPrompt: {revealed: 2, min: 1, max: 1, origin: 'prelude', mode: 'play'}});
    expect(preludeChainOwesHand(deck)).is.true;
  });

  it('owed nothing: no prompt, or the action menu — the flow ends on the board (never a return into an empty hand)', () => {
    expect(preludeChainOwesHand(view(undefined))).is.false;
    expect(preludeChainOwesHand(view({type: 'or', title: 'Take your first action', options: [{type: 'option', title: 'Pass for this generation'}]}))).is.false;
  });
});
