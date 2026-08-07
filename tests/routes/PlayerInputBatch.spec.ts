import {expect} from 'chai';
import {reconcileBatchResponse} from '../../src/server/routes/PlayerInputBatch';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Factorum} from '../../src/server/cards/promo/Factorum';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

describe('PlayerInputBatch.reconcileBatchResponse', () => {
  const orWrap: InputResponse = {type: 'or', index: 1, response: {type: 'option'}};

  it('UNWRAPS an OR-wrapped response when the live input is NOT an OrOptions', () => {
    // The card's action() collapsed to a bare SelectOption (Factorum with
    // energy) — the pre-collected {or, index:1} must fall through to {option}.
    const bare = new SelectOption('Spend 3 M€ to draw a building card', 'Draw card');
    expect(reconcileBatchResponse(orWrap, bare)).to.deep.eq({type: 'option'});
  });

  it('leaves an OR-wrapped response UNCHANGED against a real OrOptions', () => {
    const or = new OrOptions(new SelectOption('a'), new SelectOption('b'));
    expect(reconcileBatchResponse(orWrap, or)).to.eq(orWrap);
  });

  it('WRAPS a bare response against a SINGLE-option OrOptions', () => {
    const one = new OrOptions(new SelectOption('only'));
    const bareOption: InputResponse = {type: 'option'};
    expect(reconcileBatchResponse(bareOption, one)).to.deep.eq({type: 'or', index: 0, response: {type: 'option'}});
  });

  it('leaves a bare response UNCHANGED against a MULTI-option OrOptions (a genuine divergence fails later)', () => {
    const two = new OrOptions(new SelectOption('a'), new SelectOption('b'));
    const bareOption: InputResponse = {type: 'option'};
    expect(reconcileBatchResponse(bareOption, two)).to.eq(bareOption);
  });

  it('leaves a matching bare↔bare response UNCHANGED', () => {
    const bare = new SelectOption('x');
    const bareOption: InputResponse = {type: 'option'};
    expect(reconcileBatchResponse(bareOption, bare)).to.eq(bareOption);
  });

  /*
   * HISTORY, worth keeping: reconcile was built for Factorum and did not fix it.
   *
   * It reshapes a branch wrapper the batch ALREADY CONTAINS. But Factorum's
   * preview auto-resolves its lone available branch (`orBranches`'
   * `autoResolveSingle` → every branch at index -1), so the composer sent NO
   * branch response at all — there was nothing for reconcile to unwrap, and the
   * bare `SelectOption` `action()` returned stayed on screen as the redundant
   * «Потратьте 3 M€…» confirmation. The mitigation was only ever verified
   * against a hand-built `{or, index:1}`, never against the batch the composer
   * actually builds from the preview.
   *
   * The source is fixed now — `action()` RESOLVES a lone option (see
   * `tests/models/actionPromptCoverage.spec.ts` for the contract, enforced
   * across every in-scope action card). Reconcile stays as defence in depth for
   * the case it does cover, exercised by the synthetic unit tests above.
   */
  describe('Factorum (the reported bug): the source, not the wrapper', () => {
    it('a lone legal branch is RESOLVED — no bare SelectOption to reconcile', () => {
      const [game, player] = testGame(2);
      const card = new Factorum();
      player.playedCards.push(card);
      player.megaCredits = 10;
      player.energy = 1; // energy > 0 → only the draw branch is legal

      // Nothing is returned, so nothing is left waiting: the batch that submits
      // no branch response is a COMPLETE answer to this action.
      expect(card.action(player)).is.undefined;
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(1);
      expect(player.megaCredits).to.eq(7);
      expect(player.getWaitingFor()).to.eq(undefined);
    });

    it('the reconciler still lands an OR-wrapper on a bare input generally', () => {
      const [game, player] = testGame(2);
      const bare = cast(new SelectOption('draw', 'Draw').andThen(() => {
        player.drawCard(1);
        return undefined;
      }), SelectOption);
      player.setWaitingFor(bare, () => {});
      const live = player.getWaitingFor();
      expect(live).to.not.eq(undefined);
      player.process(reconcileBatchResponse(orWrap, live as OrOptions));
      runAllActions(game);
      expect(player.cardsInHand).has.lengthOf(1);
      expect(player.getWaitingFor()).to.eq(undefined);
    });
  });

  it('does not disturb a Helion-style follow-up payment prompt', () => {
    // Sanity: an action whose collapse leads to a REAL follow-up (a payment
    // choice) still presents that follow-up — reconcile only reshapes the
    // branch wrapper, never swallows a genuine next step.
    const [game, player] = testGame(2);
    const card = new Factorum();
    player.playedCards.push(card);
    // Both branches live → action() returns a real 2-option OrOptions; the
    // wrapper matches as-is (index 1 = draw building card).
    player.megaCredits = 10;
    player.energy = 0;

    const or = cast(card.action(player), OrOptions);
    player.setWaitingFor(or, () => {});
    const live = player.getWaitingFor();
    player.process(reconcileBatchResponse(orWrap, live as OrOptions));
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(1);
    expect(player.megaCredits).to.eq(7);
  });
});
