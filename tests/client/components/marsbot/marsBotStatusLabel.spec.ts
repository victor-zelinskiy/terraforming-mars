import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus} from '@/client/components/overview/playerStatusPresenter';

function player(overrides: Partial<PublicPlayerModel>): PublicPlayerModel {
  return {
    color: 'blue',
    name: 'Human',
    isActive: false,
    isWaitingForInput: false,
    ...overrides,
  } as PublicPlayerModel;
}

function view(
  players: ReadonlyArray<PublicPlayerModel>,
  phase: Phase = Phase.ACTION,
  passedPlayers: ReadonlyArray<string> = [],
): ViewModel {
  return {
    players,
    game: {phase, generation: 3, passedPlayers},
  } as unknown as ViewModel;
}

describe('marsBot status label (server-authoritative active turn)', () => {
  it('shows the bot as taking its turn while the server holds it ACTIVE', () => {
    // The bot is the ACTION-phase active player during its bounded pending turn
    // (BotTurnScheduler), so the model — not any client review/theater state —
    // drives its status.
    const human = player({color: 'blue'});
    const bot = player({color: 'red', name: 'MarsBot', isMarsBot: true, isActive: true});
    const v = view([human, bot]);

    expect(actionLabelForPlayer(v, bot)).to.eq('turn');

    // Presented like a human's active turn (same active category + glow) but a
    // DISTINCT cpu glyph and NO 1/2 counter (the bot plays one automa card per
    // turn, so a counter would be a lie).
    const p = presentPlayerStatus('turn', true);
    expect(p.category).to.eq('active');
    expect(p.glyph).to.eq('cpu');
    expect(p.showCounter).to.be.false;
  });

  it('a human active turn keeps the dot glyph AND the 1/2 counter', () => {
    const human = player({color: 'blue', isActive: true, isWaitingForInput: true});
    expect(actionLabelForPlayer(view([human]), human)).to.eq('turn');
    const p = presentPlayerStatus('turn', false);
    expect(p.category).to.eq('active');
    expect(p.glyph).to.eq('dot');
    expect(p.showCounter).to.be.true;
  });

  it('between its turns the bot reads waiting / passed / ready (no bot-only label)', () => {
    const otherActive = player({color: 'blue', isActive: true, isWaitingForInput: true});
    // Another player's turn (or forced action) → the bot is passively waiting.
    expect(actionLabelForPlayer(
      view([otherActive, player({color: 'red', name: 'MarsBot', isMarsBot: true})]),
      player({color: 'red', name: 'MarsBot', isMarsBot: true})))
      .to.eq('waiting');
    // Bot passed for the generation (its action deck is empty).
    expect(actionLabelForPlayer(
      view([player({color: 'blue'}), player({color: 'red', name: 'MarsBot', isMarsBot: true})], Phase.ACTION, ['red']),
      player({color: 'red', name: 'MarsBot', isMarsBot: true})))
      .to.eq('passed');
    // Simultaneous human setup/draft/research phase — the bot has nothing to do
    // there, so it reads as "ready", never a fake drafting/researching status.
    expect(actionLabelForPlayer(
      view([player({color: 'blue'}), player({color: 'red', name: 'MarsBot', isMarsBot: true})], Phase.RESEARCH),
      player({color: 'red', name: 'MarsBot', isMarsBot: true})))
      .to.eq('ready');
  });

  it('never returns the removed "next" label, even in a 3-player ACTION game', () => {
    const a = player({color: 'blue', isActive: true, isWaitingForInput: true});
    const b = player({color: 'green'});
    const c = player({color: 'yellow'});
    const v = view([a, b, c]);
    for (const p of [a, b, c]) {
      expect(actionLabelForPlayer(v, p)).to.not.eq('next');
    }
  });
});
