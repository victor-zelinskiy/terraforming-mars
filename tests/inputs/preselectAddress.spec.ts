import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {
  AddressableInput,
  addressVerdict,
  addressed,
  answerAddressOf,
  promptAddressOf,
  roleOf,
  sameSource,
  withoutAddress,
} from '../../src/common/inputs/preselectAddress';

/**
 * THE PRE-SELECT ADDRESS — the pure law (`common/inputs/preselectAddress.ts`)
 * both the server's batch replay and the client's «re-asked» witness read.
 * What a prompt's address is (role + source off its structural markers), when
 * two sources are the same asker, and the three verdicts an addressed answer
 * gets against a waiting prompt: `own` (process; a refusal is honest),
 * `foreign` (park untried), `anonymous` (the positional rules decide).
 */
const ACADEMIES = {kind: 'card' as const, card: CardName.SPONSORED_ACADEMIES};
const OLYMPUS = {kind: 'card' as const, card: CardName.OLYMPUS_CONFERENCE};
const GRANT = {kind: 'card' as const, card: CardName.ICHTIOLOGY_GRANT};

describe('preselectAddress', () => {
  describe('the role and the source of a prompt', () => {
    it('a card pick is `card`; a marked discard is `discard`; a deck pick is `deckPick`; every other input its type', () => {
      expect(roleOf({type: 'card'})).eq('card');
      expect(roleOf({type: 'card', discardPrompt: {source: ACADEMIES}})).eq('discard');
      expect(roleOf({type: 'card', deckPickPrompt: {source: ACADEMIES}})).eq('deckPick');
      expect(roleOf({type: 'or'})).eq('or');
      expect(roleOf({type: 'amount'})).eq('amount');
    });

    it('the source reads choiceContext, then placementContext, discardPrompt, deckPickPrompt', () => {
      expect(promptAddressOf({type: 'card', choiceContext: {source: GRANT}, discardPrompt: {source: ACADEMIES}}).source).deep.eq(GRANT);
      expect(promptAddressOf({type: 'card', discardPrompt: {source: ACADEMIES}})).deep.eq({role: 'discard', source: ACADEMIES});
      expect(promptAddressOf({type: 'card'}).source).is.undefined;
    });

    it('a placement is addressed by its own card (`sourceCard`) alone — a bonus placement names none', () => {
      expect(promptAddressOf({type: 'space', sourceCard: CardName.NUCLEAR_ZONE}).source).deep.eq({kind: 'card', card: CardName.NUCLEAR_ZONE});
      expect(promptAddressOf({type: 'space', placementContext: {source: GRANT}}).source, 'only the sourceCard addresses a cell').is.undefined;
    });

    it('a party question has a card address only as a GRANT or a SUPPORT AREA pick — never the chairman\'s seat', () => {
      expect(promptAddressOf({type: 'party', votePrompt: {source: 'grant'}, choiceContext: {source: GRANT}}).source).deep.eq(GRANT);
      expect(promptAddressOf({type: 'party', supportPrompt: {}, choiceContext: {source: GRANT}}).source).deep.eq(GRANT);
      expect(promptAddressOf({type: 'party', votePrompt: {source: 'chairman-seat'}, choiceContext: {source: GRANT}}).source).is.undefined;
    });
  });

  describe('the same asker', () => {
    it('a card is its name whatever its kind; a colony payout ROUTED BY a card is that card\'s', () => {
      expect(sameSource(GRANT, {kind: 'corporation', card: CardName.ICHTIOLOGY_GRANT})).is.true;
      expect(sameSource(GRANT, OLYMPUS)).is.false;
      expect(sameSource(GRANT, {kind: 'colony', name: ColonyName.LUNA, via: CardName.ICHTIOLOGY_GRANT})).is.true;
      expect(sameSource(GRANT, {kind: 'colony', name: ColonyName.LUNA})).is.false;
    });

    it('a colony is its tile — a trade\'s reward pick (named) is not the owner\'s discard (unnamed)', () => {
      expect(sameSource({kind: 'colony', name: ColonyName.VENUS_REDUX}, {kind: 'colony', name: ColonyName.VENUS_REDUX})).is.true;
      expect(sameSource({kind: 'colony', name: ColonyName.VENUS_REDUX}, {kind: 'colony'})).is.false;
      expect(sameSource({kind: 'resolution', resolution: 'RX01'}, {kind: 'resolution', resolution: 'RX02'})).is.false;
    });
  });

  describe('the verdict', () => {
    const discard: AddressableInput = {type: 'card', discardPrompt: {source: ACADEMIES}};
    const olympusOr: AddressableInput = {type: 'or', choiceContext: {source: OLYMPUS}, options: [{}, {}]};

    it('OWN — the same asker and the same kind of question (Sponsored Academies\' discard)', () => {
      expect(addressVerdict({role: 'discard', source: ACADEMIES}, discard)).eq('own');
    });

    it('FOREIGN — another asker (Olympus Conference\'s choice in front of the card\'s own), or another kind (a target meeting a discard)', () => {
      expect(addressVerdict({role: 'or', source: GRANT}, olympusOr)).eq('foreign');
      expect(addressVerdict({role: 'card', source: ACADEMIES}, discard), 'a target answer never meets a discard of the same card').eq('foreign');
      expect(addressVerdict({role: 'card', source: {kind: 'colony', name: ColonyName.VENUS_REDUX}}, {type: 'card', discardPrompt: {source: {kind: 'colony'}}})).eq('foreign');
    });

    it('ANONYMOUS — the kind matches and the prompt names nobody: the positional rules decide', () => {
      expect(addressVerdict({role: 'card', source: GRANT}, {type: 'card'})).eq('anonymous');
    });

    it('a PLACEMENT-shaped question must name its asker: an anonymous one is foreign (the bonus ocean, the chairman\'s seat)', () => {
      expect(addressVerdict({role: 'space', source: {kind: 'card', card: CardName.NUCLEAR_ZONE}}, {type: 'space'})).eq('foreign');
      expect(addressVerdict({role: 'party', source: GRANT}, {type: 'party', votePrompt: {source: 'chairman-seat'}})).eq('foreign');
      expect(addressVerdict({role: 'card', source: GRANT}, {type: 'card', deckPickPrompt: {}})).eq('foreign');
    });

    it('the two wire reshapes: an OR-wrapped pick meets its card\'s collapsed bare input; a bare answer meets a one-option OrOptions', () => {
      expect(addressVerdict({role: 'or', source: GRANT}, {type: 'card', choiceContext: {source: GRANT}})).eq('own');
      expect(addressVerdict({role: 'or', source: GRANT}, {type: 'card', choiceContext: {source: OLYMPUS}})).eq('foreign');
      expect(addressVerdict({role: 'card', source: GRANT}, {type: 'or', choiceContext: {source: GRANT}, options: [{}]})).eq('own');
      expect(addressVerdict({role: 'card', source: GRANT}, {type: 'or', choiceContext: {source: GRANT}, options: [{}, {}]})).eq('foreign');
    });
  });

  describe('the answer\'s address and the wire', () => {
    it('`for` wins; a staged answer\'s `stagedFor` is the same address in its older spelling', () => {
      expect(answerAddressOf({type: 'card', for: {role: 'card', source: GRANT}})).deep.eq({role: 'card', source: GRANT});
      expect(answerAddressOf({type: 'space', stagedFor: CardName.NUCLEAR_ZONE})).deep.eq({role: 'space', source: {kind: 'card', card: CardName.NUCLEAR_ZONE}});
      expect(answerAddressOf({type: 'card'})).is.undefined;
    });

    it('`addressed` stamps (absent address → untouched), `withoutAddress` strips — `process` never sees the key', () => {
      const answer = {type: 'card', cards: [CardName.PETS]};
      expect(addressed(answer, undefined)).eq(answer);
      const stamped = addressed(answer, {role: 'card', source: GRANT});
      expect(stamped).deep.eq({type: 'card', cards: [CardName.PETS], for: {role: 'card', source: GRANT}});
      expect(answer, 'the original is not mutated').not.to.have.property('for');
      expect(withoutAddress(stamped)).deep.eq(answer);
    });
  });
});
