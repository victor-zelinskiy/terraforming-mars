import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {
  claimAresGrant, latestAresGrantFor, resetAresGrantClaims, viewerAresAdjacencyFlights,
} from '@/client/console/tilePlacement/aresAdjacencyFlights';

function grant(over: Partial<AresAdjacencyGrantModel>): AresAdjacencyGrantModel {
  return {
    seq: 1,
    spaceId: '09',
    placerColor: 'red',
    grants: [],
    ownerPayouts: [],
    ...over,
  };
}

describe('aresAdjacencyFlights', () => {
  afterEach(() => resetAresGrantClaims());

  it('the placer flies stock entries, one chip per unit, off the paying tile', () => {
    const flights = viewerAresAdjacencyFlights(grant({
      grants: [
        {sourceSpaceId: '08', bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT},
        {sourceSpaceId: '08', bonus: SpaceBonus.HEAT, delivery: 'stock', resource: Resource.HEAT},
        {sourceSpaceId: '10', bonus: SpaceBonus.STEEL, delivery: 'stock', resource: Resource.STEEL},
      ],
    }), 'red');
    expect(flights).deep.eq([
      {sourceSpaceId: '08', spec: {channel: 'stock', resource: 'heat', amount: 1}},
      {sourceSpaceId: '08', spec: {channel: 'stock', resource: 'heat', amount: 1}},
      {sourceSpaceId: '10', spec: {channel: 'stock', resource: 'steel', amount: 1}},
    ]);
  });

  it('a single-target card resource flies to that card (normalized icon key)', () => {
    const flights = viewerAresAdjacencyFlights(grant({
      grants: [{
        sourceSpaceId: '08', bonus: SpaceBonus.ANIMAL, delivery: 'card-resource',
        cardResource: CardResource.ANIMAL, targetCard: 'Predators' as CardName,
      }],
    }), 'red');
    expect(flights).deep.eq([
      {sourceSpaceId: '08', spec: {channel: 'card-resource', resource: 'animal', amount: 1, targetCard: 'Predators'}},
    ]);
  });

  it('draws, prompts and lost bonuses fly nothing (they have their own surfaces)', () => {
    const flights = viewerAresAdjacencyFlights(grant({
      grants: [
        {sourceSpaceId: '08', bonus: SpaceBonus.DRAW_CARD, delivery: 'draw'},
        {sourceSpaceId: '08', bonus: SpaceBonus.ANIMAL, delivery: 'prompt', cardResource: CardResource.ANIMAL},
        {sourceSpaceId: '08', bonus: SpaceBonus.MICROBE, delivery: 'none', cardResource: CardResource.MICROBE},
      ],
    }), 'red');
    expect(flights).is.empty;
  });

  it('an owner receives only THEIR tiles\' income; the placer\'s gains stay the placer\'s', () => {
    const g = grant({
      placerColor: 'red',
      grants: [{sourceSpaceId: '08', bonus: SpaceBonus.MEGACREDITS, delivery: 'stock', resource: Resource.MEGACREDITS}],
      ownerPayouts: [
        {sourceSpaceId: '08', ownerColor: 'blue', megacredits: 2},
        {sourceSpaceId: '10', ownerColor: 'green', megacredits: 1},
      ],
    });
    expect(viewerAresAdjacencyFlights(g, 'blue')).deep.eq([
      {sourceSpaceId: '08', spec: {channel: 'stock', resource: 'megacredits', amount: 2}},
    ]);
    expect(viewerAresAdjacencyFlights(g, 'green')).deep.eq([
      {sourceSpaceId: '10', spec: {channel: 'stock', resource: 'megacredits', amount: 1}},
    ]);
  });

  it('a placer next to their OWN tile gets both halves in one wave', () => {
    const flights = viewerAresAdjacencyFlights(grant({
      placerColor: 'red',
      grants: [{sourceSpaceId: '08', bonus: SpaceBonus.PLANT, delivery: 'stock', resource: Resource.PLANTS}],
      ownerPayouts: [{sourceSpaceId: '08', ownerColor: 'red', megacredits: 1}],
    }), 'red');
    expect(flights).deep.eq([
      {sourceSpaceId: '08', spec: {channel: 'stock', resource: 'plants', amount: 1}},
      {sourceSpaceId: '08', spec: {channel: 'stock', resource: 'megacredits', amount: 1}},
    ]);
  });

  it('latestAresGrantFor picks the NEWEST grant for the space (an ocean cell pays twice)', () => {
    const older = grant({seq: 100, spaceId: '09'});
    const newer = grant({seq: 205, spaceId: '09'});
    const other = grant({seq: 300, spaceId: '11'});
    expect(latestAresGrantFor([older, newer, other], '09')).eq(newer);
    expect(latestAresGrantFor([older, newer, other], '11')).eq(other);
    expect(latestAresGrantFor([older], '12')).is.undefined;
    expect(latestAresGrantFor(undefined, '09')).is.undefined;
  });

  it('a grant is claimed exactly once (the two scenes share the ledger)', () => {
    expect(claimAresGrant(42)).is.true;
    expect(claimAresGrant(42)).is.false;
    expect(claimAresGrant(43)).is.true;
    resetAresGrantClaims();
    expect(claimAresGrant(42)).is.true;
  });
});
