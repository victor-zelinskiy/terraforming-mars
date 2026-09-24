import {expect} from 'chai';
import {Ants} from '../../src/server/cards/base/Ants';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Fish} from '../../src/server/cards/base/Fish';
import {AddResourcesToCards} from '../../src/server/deferredActions/AddResourcesToCards';
import {TestPlayer} from '../TestPlayer';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {fakeCard, testGame} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

describe('AddResourcesToCards', () => {
  let player: TestPlayer;
  let ghgProducingBacteria: GHGProducingBacteria;
  let tardigrades: Tardigrades;
  let ants: Ants;

  beforeEach(() => {
    [/* game */, player] = testGame(1);
    ghgProducingBacteria = new GHGProducingBacteria();
    tardigrades = new Tardigrades();
    ants = new Ants();
  });

  it('0 cards in hand no action', () => {
    const action = new AddResourcesToCards(player, CardResource.MICROBE, 5);
    expect(action.execute()).is.undefined;
  });

  it('0 resources no action', () => {
    player.playedCards.push(ghgProducingBacteria);
    const action = new AddResourcesToCards(player, CardResource.MICROBE, 0);
    expect(action.execute()).is.undefined;
  });

  it('one card autofill', () => {
    player.playedCards.push(ghgProducingBacteria);
    const options = new AddResourcesToCards(player, CardResource.MICROBE, 5).execute();
    expect(options).is.undefined;
    expect(ghgProducingBacteria.resourceCount).eq(5);
  });

  it('many microbe cards', () => {
    player.playedCards.push(ghgProducingBacteria, tardigrades, ants);

    const options = cast(new AddResourcesToCards(player, CardResource.MICROBE, 9).execute(), AndOptions);

    expect(options.options).has.length(3);
    options.options[0].cb(1);
    options.options[1].cb(3);
    options.options[2].cb(5);
    options.cb(undefined);

    expect(ghgProducingBacteria.resourceCount).eq(1);
    expect(tardigrades.resourceCount).eq(3);
    expect(ants.resourceCount).eq(5);
  });

  it('many microbe cards, wrong input', () => {
    player.playedCards.push(ghgProducingBacteria, tardigrades, ants);

    const options = cast(new AddResourcesToCards(player, CardResource.MICROBE, 9).execute(), AndOptions);

    expect(options.options).has.length(3);

    options.options[0].cb(1);
    options.options[1].cb(3);
    options.options[2].cb(6);
    expect(() => options.cb(undefined)).to.throw(/Expecting 9 .*, got 10/);

    options?.options[2].cb(4);
    expect(() => options.cb(undefined)).to.throw(/Expecting 9 .*, got 8/);
  });
});

/*
 * THE STEP OVER A LIST OF KINDS (Medical Database's «data or microbe»): the
 * holders are the UNION of the holders of each kind, in tableau order, each
 * once; the marker names the kinds and the kind EACH holder takes; every unit
 * lands as ITS card's kind and the placement handed back says which. One
 * kind is the list of one — the callers above are untouched.
 */
describe('AddResourcesToCards over several kinds', () => {
  let player: TestPlayer;

  beforeEach(() => {
    [/* game */, player] = testGame(1);
  });

  const dataVault = () => fakeCard({name: 'Data Vault' as CardName, type: CardType.ACTIVE, resourceType: CardResource.DATA});
  const wareCrate = () => fakeCard({name: 'Ware Crate' as CardName, type: CardType.ACTIVE, resourceType: CardResource.WARE});

  it('one kind as a list of one is the ordinary step: the same holders, the same one-kind marker, the placement names the kind', () => {
    const tardigrades = new Tardigrades();
    const ants = new Ants();
    player.playedCards.push(tardigrades, ants);
    let landed: ReadonlyArray<{card: string, amount: number, resource: string}> = [];
    const step = new AddResourcesToCards(player, [CardResource.MICROBE], 3).andThen((placed) => {
      landed = placed.map((p) => ({card: p.card.name, amount: p.amount, resource: p.resource}));
      return undefined;
    });
    expect(step.resourceType, 'the one kind').eq(CardResource.MICROBE);
    const options = cast(step.execute(), AndOptions);
    expect(options.cardResourceDistributionPrompt?.cardResource).eq('microbe');
    expect(options.cardResourceDistributionPrompt?.cardResources, 'no list for one kind').is.undefined;
    expect(options.cardResourceDistributionPrompt?.cardResourceByCard, 'no per-card map for one kind').is.undefined;
    options.options[0].cb(1);
    options.options[1].cb(2);
    options.cb(undefined);
    expect(landed).deep.eq([{card: tardigrades.name, amount: 1, resource: CardResource.MICROBE}, {card: ants.name, amount: 2, resource: CardResource.MICROBE}]);
  });

  it('several kinds: the holders of EITHER, in tableau order, each once — the marker names the kinds and each holder\'s own', () => {
    const tardigrades = new Tardigrades();
    const vault = dataVault();
    const ants = new Ants();
    player.playedCards.push(tardigrades, vault, new Fish(), ants);
    const step = new AddResourcesToCards(player, [CardResource.DATA, CardResource.MICROBE], 4);
    expect(step.resourceType, 'no ONE kind').is.undefined;
    expect(step.resourceTypes).deep.eq([CardResource.DATA, CardResource.MICROBE]);
    expect(step.getCards().map((c) => c.name)).deep.eq([tardigrades.name, 'Data Vault', ants.name]);
    const options = cast(step.execute(), AndOptions);
    const meta = options.cardResourceDistributionPrompt!;
    expect(meta.cardResource).is.undefined;
    expect(meta.cardResources).deep.eq(['data', 'microbe']);
    expect(meta.cardResourceByCard).deep.eq({[tardigrades.name]: 'microbe', 'Data Vault': 'data', [ants.name]: 'microbe'});
    expect(meta.cards.map((c) => c.name)).deep.eq([tardigrades.name, 'Data Vault', ants.name]);
  });

  it('every unit lands as ITS card\'s kind, and the placement says which; a WARE holder is a holder of either and takes its own', () => {
    const tardigrades = new Tardigrades();
    const vault = dataVault();
    const crate = wareCrate();
    player.playedCards.push(tardigrades, vault, crate);
    let landed: ReadonlyArray<{card: string, amount: number, resource: string}> = [];
    const options = cast(new AddResourcesToCards(player, [CardResource.DATA, CardResource.MICROBE], 6).andThen((placed) => {
      landed = placed.map((p) => ({card: p.card.name, amount: p.amount, resource: p.resource}));
      return undefined;
    }).execute(), AndOptions);
    expect(options.cardResourceDistributionPrompt?.cardResourceByCard?.['Ware Crate' as CardName]).eq('ware');
    options.options[0].cb(3);
    options.options[1].cb(2);
    options.options[2].cb(1);
    options.cb(undefined);
    expect(tardigrades.resourceCount).eq(3);
    expect(vault.resourceCount).eq(2);
    expect(crate.resourceCount).eq(1);
    expect(landed).deep.eq([
      {card: tardigrades.name, amount: 3, resource: CardResource.MICROBE},
      {card: 'Data Vault', amount: 2, resource: CardResource.DATA},
      {card: 'Ware Crate', amount: 1, resource: CardResource.WARE},
    ]);
  });

  it('a wrong sum over several kinds is refused before a single unit lands', () => {
    const tardigrades = new Tardigrades();
    const vault = dataVault();
    player.playedCards.push(tardigrades, vault);
    const options = cast(new AddResourcesToCards(player, [CardResource.DATA, CardResource.MICROBE], 3).execute(), AndOptions);
    options.options[0].cb(1);
    options.options[1].cb(1);
    expect(() => options.cb(undefined)).to.throw(/Expecting 3 .*, got 2/);
    expect(tardigrades.resourceCount).eq(0);
    expect(vault.resourceCount).eq(0);
  });

  it('ONE holder of either kind takes the family\'s pick over the same list; N = 1 over two kinds is a pick spanning both', () => {
    const vault = dataVault();
    player.playedCards.push(vault);
    let landed: ReadonlyArray<{card: string, amount: number, resource: string}> = [];
    const asked = new AddResourcesToCards(player, [CardResource.DATA, CardResource.MICROBE], 3, {autoSelect: false}).andThen((placed) => {
      landed = placed.map((p) => ({card: p.card.name, amount: p.amount, resource: p.resource}));
      return undefined;
    }).execute();
    const pick = cast(asked, SelectCard);
    expect(pick.cards.map((c) => c.name)).deep.eq(['Data Vault']);
    expect(pick.resourceGainPrompt?.cardResource).is.undefined;
    expect(pick.resourceGainPrompt?.cardResources).deep.eq(['data', 'microbe']);
    expect(pick.resourceGainPrompt?.cardResourceByCard).deep.eq({'Data Vault': 'data'});
    pick.cb([vault]);
    expect(vault.resourceCount).eq(3);
    expect(landed).deep.eq([{card: 'Data Vault', amount: 3, resource: CardResource.DATA}]);
    player.playedCards.push(new Tardigrades());
    const one = cast(new AddResourcesToCards(player, [CardResource.DATA, CardResource.MICROBE], 1, {autoSelect: false}).execute(), SelectCard);
    expect(one.cards.map((c) => c.name), 'one unit over two holders of two kinds: a pick, never a distribution').deep.eq(['Data Vault', CardName.TARDIGRADES]);
  });

  it('no holder of either kind: nothing is asked (the caller names the skip); an empty list is refused outright', () => {
    player.playedCards.push(new Fish());
    expect(new AddResourcesToCards(player, [CardResource.DATA, CardResource.MICROBE], 2).execute()).is.undefined;
    expect(() => new AddResourcesToCards(player, [], 2)).to.throw(/at least one/);
  });
});
