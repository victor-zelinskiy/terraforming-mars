import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus} from '@/client/components/overview/playerStatusPresenter';
import {botTurnReviewState, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';

function player(overrides: Partial<PublicPlayerModel>): PublicPlayerModel {
  return {
    color: 'blue',
    name: 'Human',
    isActive: false,
    isWaitingForInput: false,
    ...overrides,
  } as PublicPlayerModel;
}

function view(players: ReadonlyArray<PublicPlayerModel>, passedPlayers: ReadonlyArray<string> = []): ViewModel {
  return {
    players,
    game: {phase: Phase.ACTION, generation: 3, passedPlayers},
  } as unknown as ViewModel;
}

describe('marsBot status label (the theater IS the bot\'s active window)', () => {
  afterEach(() => {
    resetBotTurnReview();
  });

  it('shows the bot as actively taking its turn while the theater plays', () => {
    const human = player({color: 'blue', isActive: true, isWaitingForInput: true});
    const bot = player({color: 'red', name: 'MarsBot', isMarsBot: true});
    const v = view([human, bot]);

    botTurnReviewState.open = true;
    botTurnReviewState.botColor = 'red';

    expect(actionLabelForPlayer(v, bot)).to.eq('bottheater');
    // Presented exactly like a human's active turn — same category and glyph,
    // no 1/2 counter (one card per bot turn).
    const presentation = presentPlayerStatus('bottheater');
    expect(presentation.category).to.eq('active');
    expect(presentation.glyph).to.eq('dot');
    expect(presentation.showCounter).to.be.false;
    // The human's own label is untouched by the bot override.
    expect(actionLabelForPlayer(v, human)).to.eq('turn');
  });

  it('falls back to the ordinary model-driven label outside the theater window', () => {
    const bot = player({color: 'red', name: 'MarsBot', isMarsBot: true});
    expect(actionLabelForPlayer(view([player({color: 'blue'}), bot]), bot)).to.eq('waiting');
    expect(actionLabelForPlayer(view([player({color: 'blue'}), bot], ['red']), bot)).to.eq('passed');
  });

  it('never marks a human with the bot-theater label', () => {
    const human = player({color: 'blue'});
    const bot = player({color: 'red', name: 'MarsBot', isMarsBot: true});
    botTurnReviewState.open = true;
    botTurnReviewState.botColor = 'red';
    expect(actionLabelForPlayer(view([human, bot]), human)).to.not.eq('bottheater');
  });
});
