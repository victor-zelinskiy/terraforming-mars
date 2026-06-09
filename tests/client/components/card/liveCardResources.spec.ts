import {expect} from 'chai';
import {setLiveCardResources, liveCardResources, withLiveResources} from '@/client/components/card/liveCardResources';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ViewModel} from '@/common/models/PlayerModel';

function view(...tableaus: Array<Array<CardModel>>): ViewModel {
  return {players: tableaus.map((tableau) => ({tableau}))} as unknown as ViewModel;
}

describe('liveCardResources', () => {
  afterEach(() => setLiveCardResources(undefined));

  it('builds a name→resource map across every player tableau', () => {
    setLiveCardResources(view(
      [{name: CardName.ANTS, resources: 5} as CardModel],
      [{name: CardName.PREDATORS, resources: 3} as CardModel],
    ));
    expect(liveCardResources(CardName.ANTS)).to.eq(5);
    expect(liveCardResources(CardName.PREDATORS)).to.eq(3);
    expect(liveCardResources(CardName.TARDIGRADES)).to.eq(undefined);
  });

  it('stores a real 0 but skips cards with no resource count', () => {
    setLiveCardResources(view([
      {name: CardName.PETS, resources: 0} as CardModel,
      {name: CardName.TARDIGRADES} as CardModel, // no resources field
    ]));
    expect(liveCardResources(CardName.PETS)).to.eq(0);
    expect(liveCardResources(CardName.TARDIGRADES)).to.eq(undefined);
  });

  it('withLiveResources fills a missing count, keeps a provided one (incl 0)', () => {
    setLiveCardResources(view([{name: CardName.ANTS, resources: 7} as CardModel]));
    // name-only model → filled from the live map
    expect(withLiveResources({name: CardName.ANTS} as CardModel).resources).to.eq(7);
    // a model that already carries a value keeps it, even a legitimate 0
    expect(withLiveResources({name: CardName.ANTS, resources: 0} as CardModel).resources).to.eq(0);
    // not in the map → returned unchanged
    expect(withLiveResources({name: CardName.TARDIGRADES} as CardModel).resources).to.eq(undefined);
  });

  it('clears the map when the view is undefined', () => {
    setLiveCardResources(view([{name: CardName.ANTS, resources: 7} as CardModel]));
    setLiveCardResources(undefined);
    expect(liveCardResources(CardName.ANTS)).to.eq(undefined);
  });
});
