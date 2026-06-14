import {expect} from 'chai';
import {Server} from '../../src/server/models/ServerModel';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {cardEffect, attackEffect, systemChoice} from '../../src/server/inputs/choiceContext';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {CardName} from '../../src/common/cards/CardName';
import {testGame} from '../TestGame';

describe('choiceContext', () => {
  it('ServerModel.getWaitingFor serializes the contextual marker centrally', () => {
    const [/* game */, player] = testGame(2);
    const or = new OrOptions(new SelectOption('A'), new SelectOption('B'))
      .markChoiceContext(cardEffect(new OlympusConference(), 'A science tag was played.', 'effect-choice'));

    const model = Server.getWaitingFor(player, or);
    expect(model?.choiceContext).is.not.undefined;
    expect(model?.choiceContext?.source.kind).to.eq('card');
    expect(model?.choiceContext?.source.card).to.eq(CardName.OLYMPUS_CONFERENCE);
    expect(model?.choiceContext?.trigger).to.eq('A science tag was played.');
    expect(model?.choiceContext?.mode).to.eq('effect-choice');
  });

  it('an unmarked OrOptions has no choiceContext (backward-compatible)', () => {
    const [/* game */, player] = testGame(2);
    const model = Server.getWaitingFor(player, new OrOptions(new SelectOption('A'), new SelectOption('B')));
    expect(model?.choiceContext).is.undefined;
  });

  it('cardEffect derives the corporation kind from the card type', () => {
    const ctx = cardEffect(new PharmacyUnion(), 'trigger');
    expect(ctx.source.kind).to.eq('corporation');
    expect(ctx.source.card).to.eq(CardName.PHARMACY_UNION);
    expect(ctx.mode).to.eq('optional-effect');
  });

  it('attackEffect uses the attack mode', () => {
    expect(attackEffect(new OlympusConference()).mode).to.eq('attack');
  });

  it('systemChoice has no source card', () => {
    const ctx = systemChoice('colony', 'Trade complete');
    expect(ctx.source.kind).to.eq('colony');
    expect(ctx.source.card).is.undefined;
  });
});
