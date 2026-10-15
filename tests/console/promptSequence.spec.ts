import {expect} from 'chai';
import {
  chainAfterSubmit, CHAIN_MAX_AGE_MS, EMPTY_CHAIN, planPresentation, PromptChain, promptSequenceKey, promptViewIsIdle, sameDecision,
  SETTLE_FIRST_MS, SETTLE_FOLLOW_MS, SETTLE_SHIFT_MS, settleBlocks, settleGreysControl,
} from '../../src/client/console/promptSequence';
import {GamepadIntent} from '../../src/client/gamepad/gamepadPollModel';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {ACTION_MENU_NEXT_TITLE} from '../../src/common/inputs/actionMenuTitles';

/**
 * THE DECISION SEQUENCE — one press asks several questions in a row (a tile beside an Ares hazard owned by Philares:
 * the adjacency pick, then Philares' reward, then the hazard's production loss LAST), and a decision may never be
 * answered by the rhythm of the one before it. The chain, the presentation and the settle window are pure.
 */
const press = (button: string): GamepadIntent => ({kind: 'press', button} as GamepadIntent);

describe('promptSequence', () => {
  it('a placement opens a chain; the first decision it raises is ordinal 1 with only the double-tap guard', () => {
    const chain = chainAfterSubmit(EMPTY_CHAIN, undefined, 1000);
    expect(chain.open).to.be.true;
    const first = planPresentation(chain, undefined, 'k1', 'gain', 1500, 1);
    expect(first).to.include({ordinal: 1, inChain: true, toneShift: false, settleMs: SETTLE_FIRST_MS});
  });

  it('THE OWNER\'S CHAIN: reward → reward → LOSS — the loss is decision 3, its character flipped, its settle the longest', () => {
    let chain: PromptChain = chainAfterSubmit(EMPTY_CHAIN, undefined, 0); // the tile placement
    const adjacency = planPresentation(chain, undefined, 'adjacency', 'gain', 100, 1);
    chain = chainAfterSubmit(chain, adjacency, 200);
    const philares = planPresentation(chain, adjacency, 'philares', 'gain', 300, 2);
    expect(philares).to.include({ordinal: 2, toneShift: false, settleMs: SETTLE_FOLLOW_MS});
    chain = chainAfterSubmit(chain, philares, 400);
    const hazard = planPresentation(chain, philares, 'hazard', 'loss', 500, 3);
    expect(hazard).to.include({ordinal: 3, toneShift: true, previousTone: 'gain', settleMs: SETTLE_SHIFT_MS});
  });

  it('a NEUTRAL step between two characters is its own kind of screen, not a flip', () => {
    let chain = chainAfterSubmit(EMPTY_CHAIN, undefined, 0);
    const pay = planPresentation(chain, undefined, 'pay', 'neutral', 10, 1);
    chain = chainAfterSubmit(chain, pay, 20);
    expect(planPresentation(chain, pay, 'loss', 'loss', 30, 2)).to.include({toneShift: false, settleMs: SETTLE_FOLLOW_MS});
  });

  it('a decision presented with no chain (an opponent\'s trigger opened from the plate) stands alone', () => {
    expect(planPresentation(EMPTY_CHAIN, undefined, 'k', 'loss', 10, 1)).to.include({ordinal: 1, inChain: false, settleMs: SETTLE_FIRST_MS});
  });

  it('a chain older than its bound is not the cause of what is presented now', () => {
    const chain = chainAfterSubmit(chainAfterSubmit(EMPTY_CHAIN, undefined, 0), planPresentation(EMPTY_CHAIN, undefined, 'a', 'gain', 0, 1), 0);
    expect(planPresentation(chain, undefined, 'b', 'loss', CHAIN_MAX_AGE_MS + 1, 2)).to.include({ordinal: 1, inChain: false, toneShift: false});
  });

  it('the SAME decision re-presented (minimize → restore) keeps its ordinal and shift, with only the double-tap guard', () => {
    let chain = chainAfterSubmit(EMPTY_CHAIN, undefined, 0);
    const gain = planPresentation(chain, undefined, 'g', 'gain', 10, 1);
    chain = chainAfterSubmit(chain, gain, 20);
    const loss = planPresentation(chain, gain, 'l', 'loss', 30, 2);
    const again = planPresentation(chain, loss, 'l', 'loss', 5000, 3);
    expect(again).to.include({ordinal: 2, toneShift: true, settleMs: SETTLE_FIRST_MS, nonce: 3});
  });

  it('a wizard step the player opens INSIDE a decision is the same decision — no new ordinal, only the double-tap guard', () => {
    let chain = chainAfterSubmit(EMPTY_CHAIN, undefined, 0);
    const gain = planPresentation(chain, undefined, '7|or|x', 'gain', 10, 1);
    chain = chainAfterSubmit(chain, gain, 20);
    const loss = planPresentation(chain, gain, '8|or|y', 'loss', 30, 2);
    expect(loss).to.include({ordinal: 2, toneShift: true, settleMs: SETTLE_SHIFT_MS});
    const step = planPresentation(chain, loss, '8|or|y|n1', 'loss', 900, 3);
    expect(step).to.include({ordinal: 2, toneShift: true, settleMs: SETTLE_FIRST_MS, key: '8|or|y|n1'});
    expect(sameDecision('8|or|y', '8|or|y|n1')).to.be.true;
    expect(sameDecision('8|or|y', '9|or|y')).to.be.false;
  });

  it('a refused submit re-sent from the same decision is answered ONCE', () => {
    const chain = chainAfterSubmit(EMPTY_CHAIN, undefined, 0);
    const d = planPresentation(chain, undefined, 'd', 'gain', 10, 1);
    const once = chainAfterSubmit(chain, d, 20);
    expect(chainAfterSubmit(once, d, 30).answered).to.have.length(1);
  });

  it('the settle swallows DECIDING presses only — navigation, B, Y and the sticks always pass', () => {
    for (const b of ['confirm', 'secondary', 'bumperL', 'bumperR', 'triggerL', 'triggerR']) {
      expect(settleBlocks(press(b), 1000, 999), b).to.be.true;
      expect(settleGreysControl(b), b).to.be.true;
    }
    for (const b of ['back', 'inspect', 'stickL', 'stickR', 'view', 'menu']) {
      expect(settleBlocks(press(b), 1000, 999), b).to.be.false;
    }
    expect(settleBlocks({kind: 'nav', dir: 'down', repeat: false}, 1000, 999)).to.be.false;
    expect(settleGreysControl('dpad')).to.be.false;
    // …and only INSIDE the window.
    expect(settleBlocks(press('confirm'), 1000, 1000)).to.be.false;
  });

  it('the chain ends where the player is idle again: no prompt, or the action menu', () => {
    expect(promptViewIsIdle(undefined)).to.be.true;
    expect(promptViewIsIdle({type: 'or', title: ACTION_MENU_NEXT_TITLE, buttonLabel: 'x', options: []} as unknown as PlayerInputModel)).to.be.true;
    expect(promptViewIsIdle({type: 'productionToLose', title: 'x', buttonLabel: 'x'} as unknown as PlayerInputModel)).to.be.false;
  });

  it('two prompts with the same title are two decisions — the server\'s own serial tells them apart', () => {
    const a = promptSequenceKey({promptId: 7} as unknown as PlayerInputModel, 'card|Add 1 animal');
    const b = promptSequenceKey({promptId: 8} as unknown as PlayerInputModel, 'card|Add 1 animal');
    expect(a).to.not.eq(b);
    expect(promptSequenceKey({promptId: 7} as unknown as PlayerInputModel, 'card|x', 1)).to.eq('7|card|x|n1');
  });
});
