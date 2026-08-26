import {expect} from 'chai';
import {railProtections} from '@/client/console/railProtectionModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';

/**
 * The rail's PROTECTION read-model. The verdicts themselves are the server's
 * (`protectedResources` / `protectedProduction` / `protectedCardResources` +
 * the printed `CardModel.protectedResources`); what is pinned here is how the
 * rail reads them — including the one thing a shield must never claim: that a
 * chip aggregating protected and unprotected holders is fully safe.
 */

function card(name: CardName, resources?: number, protectedResources?: true): CardModel {
  return {name, resources, protectedResources} as CardModel;
}

const NONE = {megacredits: 'off', steel: 'off', titanium: 'off', plants: 'off', energy: 'off', heat: 'off'} as const;

function fakePlayer(overrides: Partial<Record<string, unknown>> = {}): PublicPlayerModel {
  return {
    color: 'red',
    protectedResources: {...NONE},
    protectedProduction: {...NONE},
    protectedCardResources: {},
    tableau: [],
    ...overrides,
  } as unknown as PublicPlayerModel;
}

describe('railProtectionModel — stock and production', () => {
  it('an unprotected player carries no mark at all', () => {
    const p = railProtections(fakePlayer());
    expect(Object.keys(p.stock)).to.have.length(0);
    expect(Object.keys(p.production)).to.have.length(0);
    expect(p.cardResources.size).to.eq(0);
  });

  it('protected plants read FULL and name the granting card', () => {
    const p = railProtections(fakePlayer({
      protectedResources: {...NONE, plants: 'on'},
      tableau: [card(CardName.PROTECTED_HABITATS)],
    }));
    expect(p.stock[Resource.PLANTS]?.kind).to.eq('full');
    expect(p.stock[Resource.PLANTS]?.sources).to.deep.eq([CardName.PROTECTED_HABITATS]);
  });

  it('Botanical Experience reads HALF, never full', () => {
    const p = railProtections(fakePlayer({
      protectedResources: {...NONE, plants: 'half'},
      tableau: [card(CardName.BOTANICAL_EXPERIENCE)],
    }));
    expect(p.stock[Resource.PLANTS]?.kind).to.eq('half');
    expect(p.stock[Resource.PLANTS]?.sources).to.deep.eq([CardName.BOTANICAL_EXPERIENCE]);
  });

  it('Lunar Security Stations shields both alloys AND their production', () => {
    const p = railProtections(fakePlayer({
      protectedResources: {...NONE, steel: 'on', titanium: 'on'},
      protectedProduction: {...NONE, steel: 'on', titanium: 'on'},
      tableau: [card(CardName.LUNAR_SECURITY_STATIONS)],
    }));
    expect(p.stock[Resource.STEEL]?.kind).to.eq('full');
    expect(p.stock[Resource.TITANIUM]?.kind).to.eq('full');
    expect(p.production[Resource.STEEL]?.kind).to.eq('full');
    expect(p.production[Resource.TITANIUM]?.kind).to.eq('full');
    // …and it says nothing about the stocks it does not cover.
    expect(p.stock[Resource.PLANTS]).to.eq(undefined);
    expect(p.production[Resource.MEGACREDITS]).to.eq(undefined);
  });

  it('a blanket production shield marks every row, stocks untouched', () => {
    const p = railProtections(fakePlayer({
      protectedProduction: {megacredits: 'on', steel: 'on', titanium: 'on', plants: 'on', energy: 'on', heat: 'on'},
      tableau: [card(CardName.PRIVATE_SECURITY)],
    }));
    expect(Object.keys(p.production)).to.have.length(6);
    expect(p.production[Resource.HEAT]?.sources).to.deep.eq([CardName.PRIVATE_SECURITY]);
    expect(Object.keys(p.stock)).to.have.length(0);
  });

  it('a mark with no known source card still stands (the map is the verdict)', () => {
    // The Hollandia deflection zone is a BOARD state, not a played card.
    const p = railProtections(fakePlayer({protectedResources: {...NONE, plants: 'on'}}));
    expect(p.stock[Resource.PLANTS]?.kind).to.eq('full');
    expect(p.stock[Resource.PLANTS]?.sources).to.have.length(0);
  });
});

describe('railProtectionModel — card resources', () => {
  it('Protected Habitats shields the whole animal / microbe types', () => {
    const p = railProtections(fakePlayer({
      protectedCardResources: {[CardResource.ANIMAL]: 'on', [CardResource.MICROBE]: 'on'},
      tableau: [card(CardName.PROTECTED_HABITATS), card(CardName.BIRDS, 3)],
    }));
    expect(p.cardResources.get(CardResource.ANIMAL)?.kind).to.eq('full');
    expect(p.cardResources.get(CardResource.ANIMAL)?.sources).to.deep.eq([CardName.PROTECTED_HABITATS]);
    expect(p.cardResources.get(CardResource.MICROBE)?.kind).to.eq('full');
  });

  it('a printed per-card shield covering EVERY holder reads full', () => {
    const p = railProtections(fakePlayer({tableau: [card(CardName.PETS, 4, true)]}));
    expect(p.cardResources.get(CardResource.ANIMAL)?.kind).to.eq('full');
    expect(p.cardResources.get(CardResource.ANIMAL)?.sources).to.deep.eq([CardName.PETS]);
  });

  it('a chip aggregating a protected and an unprotected holder reads PARTIAL with the split', () => {
    const p = railProtections(fakePlayer({
      tableau: [card(CardName.PETS, 4, true), card(CardName.BIRDS, 3)],
    }));
    const mark = p.cardResources.get(CardResource.ANIMAL);
    expect(mark?.kind).to.eq('partial');
    expect(mark?.protectedAmount).to.eq(4);
    expect(mark?.total).to.eq(7);
    expect(mark?.sources).to.deep.eq([CardName.PETS]);
  });

  it('the blanket shield OUTRANKS the partial reading (nothing is exposed)', () => {
    const p = railProtections(fakePlayer({
      protectedCardResources: {[CardResource.ANIMAL]: 'on'},
      tableau: [card(CardName.PROTECTED_HABITATS), card(CardName.PETS, 4, true), card(CardName.BIRDS, 3)],
    }));
    expect(p.cardResources.get(CardResource.ANIMAL)?.kind).to.eq('full');
  });

  it('an ordinary holder alone carries no mark', () => {
    const p = railProtections(fakePlayer({tableau: [card(CardName.BIRDS, 3), card(CardName.TARDIGRADES, 2)]}));
    expect(p.cardResources.size).to.eq(0);
  });

  it('protection is per TYPE: a shielded animal says nothing about microbes', () => {
    const p = railProtections(fakePlayer({
      tableau: [card(CardName.PETS, 2, true), card(CardName.TARDIGRADES, 5)],
    }));
    expect(p.cardResources.get(CardResource.ANIMAL)?.kind).to.eq('full');
    expect(p.cardResources.get(CardResource.MICROBE)).to.eq(undefined);
  });

  it('memoizes by model identity', () => {
    const player = fakePlayer();
    expect(railProtections(player)).to.eq(railProtections(player));
  });

  it('degrades on a legacy model with no protection fields', () => {
    const legacy = {color: 'red', tableau: []} as unknown as PublicPlayerModel;
    const p = railProtections(legacy);
    expect(Object.keys(p.stock)).to.have.length(0);
    expect(p.cardResources.size).to.eq(0);
  });
});
