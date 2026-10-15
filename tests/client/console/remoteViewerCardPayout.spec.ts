import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {CardModel} from '@/common/models/CardModel';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {claimCityPayoutsOf} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {resetCityPayoutClaims} from '@/client/console/tilePlacement/cityDataPayoutModel';
import {panelRewardHold, releasePanelRewardHold, releasePanelVpHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/**
 * A RIVAL'S PLACEMENT PAYS THE VIEWER'S CARD (the TR53 iteration, case 4 — К-R5): Pets on somebody else's city. The
 * remote stage hands the viewer's OWN record the card's face (`viewerCards`), so the own scene plays — the card rises
 * by the field and the animal flies to it — never a token into the satellite; another seat's record carries no face
 * (its unit flies to that seat's chip). The viewer's holds are seeded in the commit's block either way.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const CITY = '23' as SpaceId;

const record = (over: Partial<CardAdjacencyPayoutModel>): CardAdjacencyPayoutModel => ({
  seq: 900, cause: 'tile-placed', color: BLUE, spaceId: CITY, neighbours: [{spaceId: CITY, units: 1}],
  target: CardName.PETS, resource: CardResource.ANIMAL, amount: 1, before: 1, ...over,
});

describe('remote placement — a rival\'s city pays the VIEWER\'s card', () => {
  beforeEach(() => resetCityPayoutClaims());

  it('the viewer\'s own record carries the card\'s face; another seat\'s carries none', () => {
    const pets = {name: CardName.PETS, resources: 2} as CardModel;
    const out = claimCityPayoutsOf(CITY, {
      viewerColor: BLUE,
      viewerCards: [pets],
      cardPayouts: [record({}), record({seq: 901, color: RED, target: CardName.SMALL_ANIMALS})],
      prevCardPayouts: [],
    });
    expect(out?.map((i) => [i.payout.target, i.own, i.cardModel?.name])).deep.eq([
      [CardName.PETS, true, CardName.PETS],
      [CardName.SMALL_ANIMALS, false, undefined],
    ]);
    // The viewer's satellite cell and points are held from the commit (released by the scene's touchdown).
    expect(panelRewardHold.cardRes.animal ?? 0, 'the satellite waits for the token').to.be.greaterThan(0);
    releasePanelRewardHold({channel: 'card-resource', resource: 'animal', amount: 1});
    releasePanelVpHold(panelRewardHold.vp);
  });

  it('without the viewer\'s tableau the record still plays — as the old token into the satellite', () => {
    const out = claimCityPayoutsOf(CITY, {viewerColor: BLUE, cardPayouts: [record({seq: 902})], prevCardPayouts: []});
    expect(out?.[0].own).is.true;
    expect(out?.[0].cardModel).is.undefined;
    releasePanelRewardHold({channel: 'card-resource', resource: 'animal', amount: 1});
    releasePanelVpHold(panelRewardHold.vp);
  });
});
