import {expect} from 'chai';
import {
  REVEAL_HANDOFF_DEGRADED_ATTR, resetRevealHandoff, revealHandoffState, runRevealHandoff, seedRevealRewardHold,
} from '@/client/console/revealHandoff';
import {beginPanelRewardHold, clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {CardName} from '@/common/cards/CardName';

const M5 = {direction: 'gain', icon: 'megacredits', amount: 5, current: 12, resulting: 17} as const;

function kept(name: CardName = CardName.WILDLIFE_DOME): RevealResultModel {
  return {
    action: CardName.POLITICAL_THINK_TANK,
    revealed: {name} as RevealResultModel['revealed'],
    conditionMet: true,
    check: {icon: 'party-requirement', label: 'Party requirement'},
    reward: M5,
    destination: 'hand',
  };
}

function view(lastReveal?: RevealResultModel): PlayerViewModel {
  return {lastReveal} as unknown as PlayerViewModel;
}

/**
 * THE VERDICT'S STOCK REWARD is held on the rail from the answer to the «OK»
 * flight's touchdown — and this module only ever touches ITS OWN hold: the
 * rail's hold is one shared ledger, and a sibling's chip seeded by the same
 * response must survive every release here (memory: panel-reward-hold-is-shared).
 */
describe('revealHandoff', () => {
  afterEach(() => {
    resetRevealHandoff();
    clearPanelRewardHold();
    document.documentElement.removeAttribute(REVEAL_HANDOFF_DEGRADED_ATTR);
  });

  it('SEEDS the rail hold when a fresh verdict pays a stock reward', () => {
    seedRevealRewardHold(view(), view(kept()));
    expect(heldStock('megacredits')).eq(5);
    expect(revealHandoffState.owed?.key).eq('Political Think Tank|Wildlife Dome');
  });

  it('is idempotent over echo frames, and a FIRST view seeds nothing (a reload shows the truth)', () => {
    seedRevealRewardHold(view(), view(kept()));
    seedRevealRewardHold(view(kept()), view(kept()));
    expect(heldStock('megacredits')).eq(5);
    resetRevealHandoff();
    seedRevealRewardHold(undefined, view(kept()));
    expect(heldStock('megacredits')).eq(0);
  });

  it('a verdict without a stock reward (a miss, a card resource) holds nothing', () => {
    seedRevealRewardHold(view(), view({...kept(), conditionMet: false, reward: undefined, destination: 'discard'}));
    seedRevealRewardHold(view(), view({...kept(CardName.ASTEROID), reward: {direction: 'gain', icon: 'science', amount: 1, note: 'on this card'}}));
    expect(heldStock('megacredits')).eq(0);
    expect(revealHandoffState.owed).is.undefined;
  });

  it('a verdict that goes away unflown releases ONLY its own hold — a sibling\'s chip survives', () => {
    beginPanelRewardHold([{channel: 'stock', resource: 'megacredits', amount: 3}]); // somebody else's
    seedRevealRewardHold(view(), view(kept()));
    expect(heldStock('megacredits')).eq(8);
    seedRevealRewardHold(view(kept()), view(undefined));
    expect(heldStock('megacredits')).eq(3);
    expect(revealHandoffState.owed).is.undefined;
  });

  it('a REPLACED verdict releases the old hold and seeds the new one', () => {
    seedRevealRewardHold(view(), view(kept()));
    seedRevealRewardHold(view(kept()), view(kept(CardName.RED_TOURISM_WAVE)));
    expect(heldStock('megacredits')).eq(5);
    expect(revealHandoffState.owed?.key).eq('Political Think Tank|Red Tourism Wave');
  });

  it('«OK» with nothing to lift from: the end pose, a NAMED degradation, the host acknowledged ONCE', () => {
    seedRevealRewardHold(view(), view(kept()));
    let acks = 0;
    runRevealHandoff({reveal: kept(), slot: undefined, verdict: undefined, onDetached: () => acks++});
    expect(acks).eq(1);
    expect(heldStock('megacredits'), 'the counter ticks — the reward is never stranded').eq(0);
    expect(document.documentElement.getAttribute(REVEAL_HANDOFF_DEGRADED_ATTR)).eq('no-slot');
  });

  it('the handoff releases only its own spec on the degraded path too', () => {
    beginPanelRewardHold([{channel: 'stock', resource: 'megacredits', amount: 3}]);
    seedRevealRewardHold(view(), view(kept()));
    runRevealHandoff({reveal: kept(), slot: undefined, verdict: undefined, onDetached: () => undefined});
    expect(heldStock('megacredits')).eq(3);
  });
});
