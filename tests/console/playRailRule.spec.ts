import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {ICard} from '../../src/server/cards/ICard';
import {BribedCommittee} from '../../src/server/cards/base/BribedCommittee';
import {TerraformingGanymede} from '../../src/server/cards/base/TerraformingGanymede';
import {MagneticFieldDome} from '../../src/server/cards/base/MagneticFieldDome';
import {NitrogenRichAsteroid} from '../../src/server/cards/base/NitrogenRichAsteroid';
import {JovianLanterns} from '../../src/server/cards/colonies/JovianLanterns';
import {NitrogenShipment} from '../../src/server/cards/prelude/NitrogenShipment';
import {UNMIContractor} from '../../src/server/cards/prelude/UNMIContractor';
import {MagneticFieldGeneratorsPromo} from '../../src/server/cards/promo/MagneticFieldGeneratorsPromo';
import {MinorityRepresentation} from '../../src/server/cards/turmoilRedux/MinorityRepresentation';
import {ShipmentToEarth} from '../../src/server/cards/promo/ShipmentToEarth';
import {Moss} from '../../src/server/cards/base/Moss';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Phase} from '../../src/common/Phase';
import {Payment} from '../../src/common/inputs/Payment';
import {RATING_RAIL_KEY} from '../../src/client/console/resourceTransfer/resourceTransferModel';
import {actionRailTrSpecs, playRailReward, playRailTrSpecs, playSpendReward} from '../../src/client/console/consoleActionCommit';
import {heroRewardEffectsOf} from '../../src/client/console/consolePlayCardComposer';
import {reactionRailSpecs} from '../../src/client/console/colonyTrade/fleetDockModel';

/**
 * PL-001 FOR PLAYS — «A DIRECT TR OF A PLAY IS A REWARD OF THE RAIL», swept over
 * the SERVER's own play previews (server runner: the client half is pure). The
 * rule is the action's (`actionRailTrSpecs`) read at the play door
 * (`playRailTrSpecs` over the chips the landing scene's reward beat carries):
 * ✓ — the TR flies from the landed card and ticks on the touchdown; ✗ — a tile,
 * a scale or a walk of the Agenda track owns it and it arrives with them. One
 * door difference: a DRAW owns an action's TR (its commit's result), never a
 * play's (UNMI Contractor).
 */
function table(): {p: TestPlayer} {
  const [game, p] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, preludeExtension: true});
  game.phase = Phase.ACTION;
  p.megaCredits = 60;
  p.production.add(Resource.ENERGY, 2);
  return {p};
}

const trSpecs = (amount: number) => [{channel: 'stock', resource: RATING_RAIL_KEY, amount}];

describe('the card play\'s rail rule — a DIRECT TR of a play flies to the rail', () => {
  const cases: ReadonlyArray<{name: string, card: () => ICard, tr: number}> = [
    {name: 'Bribed Committee (an event)', card: () => new BribedCommittee(), tr: 2},
    {name: 'Terraforming Ganymede (its own Jovian tag)', card: () => new TerraformingGanymede(), tr: 1},
    {name: 'Magnetic Field Dome (a production wave, then the TR)', card: () => new MagneticFieldDome(), tr: 1},
    {name: 'Jovian Lanterns', card: () => new JovianLanterns(), tr: 1},
    {name: 'Nitrogen Shipment (a prelude)', card: () => new NitrogenShipment(), tr: 1},
    {name: 'UNMI Contractor (a draw does not own a play\'s TR)', card: () => new UNMIContractor(), tr: 3},
    {name: 'Nitrogen-Rich Asteroid (the temperature step owns it)', card: () => new NitrogenRichAsteroid(), tr: 0},
    {name: 'Magnetic Field Generators:promo (the tile owns it)', card: () => new MagneticFieldGeneratorsPromo(), tr: 0},
    {name: 'Minority Representation (the walk of the Agenda track owns it)', card: () => new MinorityRepresentation(), tr: 0},
  ];
  for (const c of cases) {
    it(`${c.name}: ${c.tr > 0 ? `✓ +${c.tr} TR rides the rail` : '✗ nothing for the rail'}`, () => {
      const {p} = table();
      const card = c.card();
      const branch = cardPlayPreview(p, card).branches[0];
      expect(branch, 'the preview has a branch').is.not.undefined;
      expect(branch.effects.some((e) => e.icon === 'tr'), 'the preview prints a TR chip').is.true;
      expect(playRailTrSpecs(branch, heroRewardEffectsOf(branch))).deep.eq(c.tr > 0 ? trSpecs(c.tr) : []);
    });
  }

  it('the door difference is ONE term: UNMI Contractor\'s draw owns an action\'s TR, never a play\'s', () => {
    const {p} = table();
    const branch = cardPlayPreview(p, new UNMIContractor()).branches[0];
    expect(actionRailTrSpecs(branch)).deep.eq([]);
    expect(playRailTrSpecs(branch, heroRewardEffectsOf(branch))).deep.eq(trSpecs(3));
  });

  it('the table\'s answer is the ruling Greens\' M€, read off the server\'s own forecast; the price is a known move', () => {
    const {p} = table();
    const card = new BribedCommittee();
    const preview = cardPlayPreview(p, card);
    const branch = preview.branches[0];
    const reactions = reactionRailSpecs(effectForecastForPlay(p, card, preview).facts);
    expect(reactions, 'the Greens rule a fresh Redux table and pay 2 M€ for each TR step').deep.eq([{channel: 'stock', resource: 'megacredits', amount: 4}]);
    const rail = playRailReward(branch, heroRewardEffectsOf(branch), {}, {megacredits: 7} as Payment, reactions);
    expect(rail?.cause).deep.eq(trSpecs(2));
    expect(rail?.known).deep.eq({'stock:megacredits': -7});
  });
});

/**
 * THE RAIL-SPEND LAW AT THE PLAY DOOR (PL-107, X87 Shipment to Earth) — «a
 * price on the rail is a departure», read off the SERVER's own play previews:
 * a `cost` chip of a standard resource with no note is a `stock` link flying
 * `loss`, in the chips' (printed) order; the card's own price is never one
 * (the payment panel's — it rides `known`); a card resource a play spends has
 * no standing source on this door and is not a link here.
 */
describe('the card play\'s rail rule — the price a play takes OFF THE RAIL is a departure', () => {
  it('X87 Shipment to Earth: the plants and the steel leave, in the printed order; the TR and the M€ are the reward beat\'s', () => {
    const {p} = table();
    p.plants = 5;
    p.steel = 4;
    p.tagsForTest = {earth: 2};
    const card = new ShipmentToEarth();
    const branch = cardPlayPreview(p, card).branches[0];
    const spends = playSpendReward(card.name, branch, {}, {megacredits: 17} as Payment);
    expect(spends?.cause).deep.eq([
      {channel: 'stock', resource: 'plants', amount: 3, direction: 'loss'},
      {channel: 'stock', resource: 'steel', amount: 3, direction: 'loss'},
    ]);
    // The diff check's known moves: the price, the M€ the Earth tags pay — never the rows the links carry.
    expect(spends?.known).deep.eq({'stock:megacredits': -17 + 4});
    expect(spends?.reactions).deep.eq([]);
    // …and the rail half still carries the TR alone, with the whole answer as its known moves.
    const rail = playRailReward(branch, heroRewardEffectsOf(branch), {}, {megacredits: 17} as Payment, []);
    expect(rail?.cause).deep.eq(trSpecs(3));
    expect(rail?.known).deep.eq({'stock:megacredits': -17 + 4, 'stock:plants': -3, 'stock:steel': -3});
  });

  it('Moss: the one plant leaves; the production is the plate\'s own number', () => {
    const {p} = table();
    p.plants = 2;
    const card = new Moss();
    const branch = cardPlayPreview(p, card).branches[0];
    expect(playSpendReward(card.name, branch, {}, {megacredits: 4} as Payment)?.cause).deep.eq([
      {channel: 'stock', resource: 'plants', amount: 1, direction: 'loss'},
    ]);
  });

  it('Bribed Committee: nothing leaves the rail — the price alone is no link', () => {
    const {p} = table();
    const branch = cardPlayPreview(p, new BribedCommittee()).branches[0];
    expect(playSpendReward(CardName.BRIBED_COMMITTEE, branch, {}, {megacredits: 7} as Payment)).is.undefined;
  });
});
