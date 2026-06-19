import {expect} from 'chai';
import {Units} from '@/common/Units';
import {CardName} from '@/common/cards/CardName';
import {buildVenusBonusResponse, venusAmountsResponse} from '@/client/components/modalInputs/venusBonusResponses';

// Pure shape test (no Vue/DOM) — runs under the server runner. Guards the EXACT
// InputResponse shapes VenusBonusContent submits against the restructured
// GrantVenusAltTrackBonusDeferred (asserted accepted end-to-end in the server
// spec GrantVenusAltTrackBonusDeferred.spec.ts).
describe('venusBonusResponses', () => {
  it('venusAmountsResponse emits 6 amounts in unit order', () => {
    const r = venusAmountsResponse(Units.of({steel: 1, heat: 2}));
    expect(r.type).eq('and');
    expect(r.responses).to.deep.eq([
      {type: 'amount', amount: 0}, // megacredits
      {type: 'amount', amount: 1}, // steel
      {type: 'amount', amount: 0}, // titanium
      {type: 'amount', amount: 0}, // plants
      {type: 'amount', amount: 0}, // energy
      {type: 'amount', amount: 2}, // heat
    ]);
  });

  it('standard bonus → bare AndOptions response', () => {
    const r = buildVenusBonusResponse(false, Units.of({plants: 1}), undefined, false);
    expect(r).to.deep.eq(venusAmountsResponse(Units.of({plants: 1})));
  });

  it('final WITHOUT a card branch → bare AndOptions (base + wild standard)', () => {
    const r = buildVenusBonusResponse(true, Units.of({megacredits: 1}), {kind: 'standard', resource: 'heat'}, false);
    expect(r).to.deep.eq(venusAmountsResponse(Units.of({megacredits: 1, heat: 1})));
  });

  it('final wild→standard → OrOptions index 1 with the wild folded into base', () => {
    const r = buildVenusBonusResponse(true, Units.of({megacredits: 1}), {kind: 'standard', resource: 'megacredits'}, true);
    expect(r).to.deep.eq({
      type: 'or',
      index: 1,
      response: venusAmountsResponse(Units.of({megacredits: 2})),
    });
  });

  it('final wild→standard with a different resource', () => {
    const r = buildVenusBonusResponse(true, Units.of({steel: 1}), {kind: 'standard', resource: 'plants'}, true);
    expect(r).to.deep.eq({
      type: 'or',
      index: 1,
      response: venusAmountsResponse(Units.of({steel: 1, plants: 1})),
    });
  });

  it('final wild→card → OrOptions index 0 with nested [card, base]', () => {
    const r = buildVenusBonusResponse(true, Units.of({titanium: 1}), {kind: 'card', card: CardName.TARDIGRADES}, true);
    expect(r).to.deep.eq({
      type: 'or',
      index: 0,
      response: {
        type: 'and',
        responses: [
          {type: 'card', cards: [CardName.TARDIGRADES]},
          venusAmountsResponse(Units.of({titanium: 1})),
        ],
      },
    });
  });
});
