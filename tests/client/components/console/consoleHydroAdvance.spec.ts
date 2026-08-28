import {expect} from 'chai';
import {hydroAdvanceResponses, hydroAdvanceTail} from '@/client/console/consoleHydroAdvance';
import {CardName} from '@/common/cards/CardName';

const ACTIVATE = {type: 'or', index: 3, response: {type: 'option'}};

/**
 * The console «Укрепить гидросеть» batch. The stage-7 COMPOSED repeat must
 * append the ProjInsp/Viron-parity tail (`[{card:[chosen]}, ...composed]`);
 * a STALE composition (the plan's card moved on) must degrade to the bare
 * card pick — the follow-ups then arrive as native sequential tasks.
 */
describe('hydroAdvanceResponses (console advance batch)', () => {
  it('a bare advance → activate + the deltaProject amount', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 2},
    ]);
  });

  it('a CHOICE stage (pos 1/2) appends the OR pick', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 1, rewardChoice: 1})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('a card-pick stage WITHOUT a composition (pos 9 / bare pos 7) appends the card pick only', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 3, rewardChoice: undefined, selectedCard: CardName.PETS})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 3},
      {type: 'card', cards: [CardName.PETS]},
    ]);
  });

  it('the COMPOSED stage-7 repeat appends the byte-parity tail (card pick + branch slot + steps)', () => {
    const stepResp = {type: 'player', player: 'red'};
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.SEARCH_FOR_LIFE,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: 2, preResponses: [{type: 'and'}], optionResponse: undefined, stepResponses: [stepResp]},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
      {type: 'card', cards: [CardName.SEARCH_FOR_LIFE]},
      {type: 'and'},
      {type: 'or', index: 2, response: {type: 'option'}},
      stepResp,
    ]);
  });

  it('a STALE composition (chosenCard ≠ the plan card) degrades to the bare card pick', () => {
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.PETS,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
      {type: 'card', cards: [CardName.PETS]},
    ]);
  });

  it('a composition with NO selected card sends no tail at all (the reward fizzled)', () => {
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
    ]);
  });
});

/**
 * ══ THE LANDED STAGE'S ANSWERS ARE THE SAME ON BOTH ROADS ═══════════════
 *
 * The player's own action and a card's bonus offer differ ONLY in how the move
 * is authorised — `activate` + `{deltaProject, amount}` versus one `OrOptions`
 * index. From the landing on they reach the same server code, so they must send
 * the same tail. A bonus move that assembled its own is how the stage-7 pick
 * ended up arriving AFTER the commit, as a standalone legacy card browser.
 */
describe('hydroAdvanceTail (shared by the bonus offer)', () => {
  it('is exactly what the standard batch carries past its own prefix', () => {
    const payload = {spend: 3, rewardChoice: 1, selectedCard: CardName.PETS};
    const full = hydroAdvanceResponses(ACTIVATE, payload);
    expect(hydroAdvanceTail(payload)).to.deep.equal(full.slice(2));
  });

  it('carries nothing when the landed stage asks nothing', () => {
    expect(hydroAdvanceTail({spend: 2, rewardChoice: undefined})).to.deep.equal([]);
  });

  it('a DECLINED target reward rides the move step, never the tail', () => {
    // «Если не выбрал, значит не надо»: the player confirmed past the warning
    // with no pick, so the decision travels WITH the move — the server then
    // defers no SelectCard and nothing rises after the confirmed advance.
    expect(hydroAdvanceResponses(ACTIVATE, {
      spend: 1, rewardChoice: undefined, waiveTarget: true,
    })).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1, waiveReward: true},
    ]);
  });

  it('an ordinary batch is byte-identical to the historical shape', () => {
    // The key EXISTS only when the decline was actually made — every other
    // batch must keep the exact bytes the server has always received.
    const plain = hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined});
    expect(Object.keys(plain[1] as object)).to.deep.equal(['type', 'amount']);
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined, waiveTarget: false}))
      .to.deep.equal(plain);
  });

  it('a decline still carries a CHOICE the same stage asked for', () => {
    // The two are independent: pos 1/2's reward choice is not a target pick,
    // so a landing that asks both keeps answering the one it was given.
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 1, rewardChoice: 0, waiveTarget: true})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1, waiveReward: true},
      {type: 'or', index: 0, response: {type: 'option'}},
    ]);
  });

  it('carries the COMPOSED repeat tail, not a bare pick', () => {
    const tail = hydroAdvanceTail({
      spend: 0,
      rewardChoice: undefined,
      selectedCard: CardName.VIRON,
      repeat: {
        chosenCard: CardName.VIRON,
        nodeIndex: 0,
        composed: {branchIndex: 1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    // More than the bare `{card:[X]}`: the chosen action's own responses ride
    // along in defer order (ProjInsp/Viron parity).
    expect(tail).to.deep.equal([
      {type: 'card', cards: [CardName.VIRON]},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });
});
