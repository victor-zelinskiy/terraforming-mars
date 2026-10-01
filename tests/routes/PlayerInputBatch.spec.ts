import {expect} from 'chai';
import {reconcileBatchResponse} from '../../src/server/routes/PlayerInputBatch';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Factorum} from '../../src/server/cards/promo/Factorum';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {CardName} from '../../src/common/cards/CardName';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';

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

/*
 * THE ADDRESSED PARTY TAIL (Turmoil Redux TR03 — the staged vote): the batch
 * route reshapes WRAPPERS only, so the tail's address survives it untouched,
 * and the input it finally meets accepts the addressed form as it accepts the
 * plain one. Who the tail may LAND on is `deferredInputBatch`'s decision
 * (tests/inputs/deferredInputBatch.spec.ts § addressed staged resolution).
 */
describe('PlayerInputBatch — the addressed party tail', () => {
  const tail: InputResponse = {type: 'party', partyName: PartyName.MARS, stagedFor: CardName.POLITICAL_DONATION};
  const grant = () => {
    const picked: Array<PartyName> = [];
    const input = new SelectParty('Add 1 delegate to a resolution', 'Add', [PartyName.MARS, PartyName.GREENS]).andThen((party) => {
      picked.push(party);
      return undefined;
    });
    return {input, picked};
  };

  it('the reconciler leaves it UNCHANGED against its own prompt — the address is not a wrapper', () => {
    expect(reconcileBatchResponse(tail, grant().input)).to.eq(tail);
  });

  it('wrapped for a single-option menu, the address rides INSIDE the wrapper', () => {
    const one = new OrOptions(grant().input);
    expect(reconcileBatchResponse(tail, one)).to.deep.eq({type: 'or', index: 0, response: tail});
  });

  it('the input accepts the addressed form and answers with the party; an unknown key is still refused', () => {
    const {input, picked} = grant();
    input.process(tail);
    expect(picked).to.deep.eq([PartyName.MARS]);
    expect(() => grant().input.process({...tail, extra: 1} as unknown as InputResponse)).to.throw('Not a valid SelectPartyResponse');
    expect(() => grant().input.process({type: 'party', partyName: PartyName.UNITY, stagedFor: CardName.POLITICAL_DONATION})).to.throw('Invalid party selected');
  });
});

/**
 * THE ADDRESSED COLONY TAIL (Turmoil Redux TR07 — the staged colony): the
 * third form of the colony answer. The route reshapes wrappers only, so the
 * address survives it; the input accepts `{colonyName, stagedFor}` as it
 * accepts a bare tile; a DOCK is never staged. Who the tail may LAND on is
 * `deferredInputBatch`'s decision (§ addressed staged colony).
 */
describe('PlayerInputBatch — the addressed colony tail', () => {
  const tail: InputResponse = {type: 'colony', colonyName: ColonyName.LUNA, stagedFor: CardName.ANTS};
  const pick = () => {
    const picked: Array<ColonyName> = [];
    const input = new SelectColony('Select a colony track to move to its highest position', 'Select', [new Luna(), new Ceres()]).andThen((colony) => {
      picked.push(colony.name);
      return undefined;
    });
    return {input, picked};
  };

  it('the reconciler leaves it UNCHANGED against its own prompt — the address is not a wrapper', () => {
    expect(reconcileBatchResponse(tail, pick().input)).to.eq(tail);
  });

  it('the input accepts all three forms\' tile answers, and refuses a dock beside an address', () => {
    const {input, picked} = pick();
    input.process(tail);
    expect(picked).to.deep.eq([ColonyName.LUNA]);
    const plain = pick();
    plain.input.process({type: 'colony', colonyName: ColonyName.CERES});
    expect(plain.picked).to.deep.eq([ColonyName.CERES]);
    expect(() => pick().input.process({type: 'colony', fleetDock: CardName.ANTS, stagedFor: CardName.ANTS} as unknown as InputResponse))
      .to.throw('Not a valid SelectColonyResponse');
    expect(() => pick().input.process({...tail, extra: 1} as unknown as InputResponse)).to.throw('Not a valid SelectColonyResponse');
    expect(() => pick().input.process({type: 'colony', colonyName: ColonyName.EUROPA, stagedFor: CardName.ANTS})).to.throw('Colony Europa not found');
  });
});
