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
import {MartianCensus} from '../../src/server/cards/turmoilRedux/MartianCensus';
import {ScientificBreakthrough} from '../../src/server/cards/turmoilRedux/ScientificBreakthrough';
import {Moss} from '../../src/server/cards/base/Moss';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Phase} from '../../src/common/Phase';
import {Payment} from '../../src/common/inputs/Payment';
import {RATING_RAIL_KEY} from '../../src/client/console/resourceTransfer/resourceTransferModel';
import {actionRailTrSpecs, playRailReward, playRailTrSpecs, playSpendReward, playTargetSpendSpecs, startPlaySpendReward} from '../../src/client/console/consoleActionCommit';
import {IndustrialComplex} from '../../src/server/cards/prelude2/IndustrialComplex';
import {Manutech} from '../../src/server/cards/venusNext/Manutech';
import {heroRewardEffectsOf} from '../../src/client/console/consolePlayCardComposer';
import {reactionRailSpecs} from '../../src/client/console/colonyTrade/fleetDockModel';
import {VenusL1Shade} from '../../src/server/cards/prelude2/VenusL1Shade';
import {AtmosphericEnhancers} from '../../src/server/cards/prelude2/AtmosphericEnhancers';
import {UNMI_VETO_ID} from '../../src/server/parliament/resolutions/reds/UnmiVeto';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {scaleStepRatingSpecs} from '../../src/client/console/consoleActionCommit';
import {verifyRailReward} from '../../src/client/console/resourceTransfer/railReward';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {PalladinShipping} from '../../src/server/cards/prelude2/PalladinShipping';
import {ImportedGHG} from '../../src/server/cards/base/ImportedGHG';

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

describe('PL-268 — the play\'s price off a card the composer CHOSE (TR52 Scientific Breakthrough)', () => {
  function attack(): {p: TestPlayer, census: MartianCensus, branch: ReturnType<typeof cardPlayPreview>['branches'][number]} {
    const [game, p, rival] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true});
    game.phase = Phase.ACTION;
    const census = new MartianCensus();
    census.resourceCount = 3;
    rival.playedCards.push(census);
    const branch = cardPlayPreview(p, new ScientificBreakthrough()).branches[0];
    return {p, census, branch};
  }

  it('the 2 data leave the card the target step chose — ANY seat\'s (a rival\'s census here)', () => {
    const {census, branch} = attack();
    expect(playTargetSpendSpecs(CardName.SCIENTIFIC_BREAKTHROUGH, branch, {0: {type: 'card', cards: [census.name]}})).deep.eq([
      {channel: 'card-resource', resource: 'data', amount: 2, targetCard: census.name, direction: 'loss'},
    ]);
  });

  it('nothing chosen yet → nothing to fly; the card\'s own capsule is never a target spend', () => {
    const {branch} = attack();
    expect(playTargetSpendSpecs(CardName.SCIENTIFIC_BREAKTHROUGH, branch, {})).deep.eq([]);
    expect(playTargetSpendSpecs(CardName.SCIENTIFIC_BREAKTHROUGH, branch, {0: {type: 'card', cards: [CardName.SCIENTIFIC_BREAKTHROUGH]}})).deep.eq([]);
  });

  it('a play that takes nothing off a chosen card flies nothing (Moss: a stock price only)', () => {
    const {p} = table();
    p.plants = 2;
    expect(playTargetSpendSpecs(CardName.MOSS, cardPlayPreview(p, new Moss()).branches[0], {})).deep.eq([]);
  });
});

describe('P52 · FH — THE PRICE OF A START PLAY leaves the rail FIRST (Industrial Complex)', () => {
  it('the 18 M€ is a departure off the M€ row; the six raised lines are known moves, never links', () => {
    const {p} = table();
    p.production.override({});
    const card = new IndustrialComplex();
    const branch = cardPlayPreview(p, card).branches[0];
    const spends = startPlaySpendReward(card.name, branch, {});
    expect(spends?.cause).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 18, direction: 'loss'}]);
    expect(spends?.known).deep.eq({
      'production:megacredits': 1, 'production:steel': 1, 'production:titanium': 1,
      'production:plants': 1, 'production:energy': 1, 'production:heat': 1,
    });
  });

  it('Manutech\'s answer on the same rows joins the known moves — the check nets it out', () => {
    const {p} = table();
    p.playCorporationCard(new Manutech());
    p.production.override({});
    const card = new IndustrialComplex();
    const preview = cardPlayPreview(p, card);
    const branch = preview.branches[0];
    const facts = effectForecastForPlay(p, card, preview).facts;
    const spends = startPlaySpendReward(card.name, branch, {}, reactionRailSpecs(facts));
    expect(spends?.cause).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 18, direction: 'loss'}]);
    expect(spends?.known?.['stock:megacredits'], 'Manutech: 1 for the M€ line + 1 for each of the ruling Greens\' two M€ steps').eq(3);
    expect(spends?.known?.['stock:steel']).eq(1);
  });
});


/**
 * P66 · GJ — «A SCALE STEP AT THE START PAYS ITS RATING»: on the start host no field beat can tell a scale step's
 * rating (`scaleStepRatingPlan` refuses every phase but ACTION — the start's cover), so the HERO tells it: one rating
 * token per step, born on the k-th printed scale icon (`bornOn`); the ruling Greens' M€ rides as the answer. Off the
 * start host the rule is unchanged: the scale owns its rating (the field beat tells it).
 */
describe('P66 · GJ — a scale step on the START HOST pays its rating off the printed scale icons', () => {
  function startTable(): {p: TestPlayer, rival: TestPlayer} {
    const [game, p, rival] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, preludeExtension: true, venusNextExtension: true});
    game.phase = Phase.PRELUDES;
    return {p, rival};
  }
  const born = (scale: string, n: number) => Array.from({length: n}, () => ({channel: 'stock', resource: RATING_RAIL_KEY, amount: 1, bornOn: scale}));

  it('Venus L1 Shade (Venus +3): three tokens, each born on a printed Venus icon; the Greens answer +6', () => {
    const {p} = startTable();
    const card = new VenusL1Shade();
    const preview = cardPlayPreview(p, card);
    const branch = preview.branches[0];
    expect(playRailTrSpecs(branch, branch.effects, {}, {startHost: true})).deep.eq(born('venus', 3));
    const reactions = reactionRailSpecs(effectForecastForPlay(p, card, preview).facts);
    expect(reactions, "the fresh table's Greens: 2 M€ for each of the three rating steps").deep.eq([{channel: 'stock', resource: 'megacredits', amount: 6}]);
    const rail = playRailReward(branch, branch.effects, {}, undefined, reactions, {startHost: true});
    expect(rail?.cause).deep.eq(born('venus', 3));
    expect(rail?.reactions, 'the cause is a rating of the chain — the scale-step beat takes no answer away').deep.eq(reactions);
  });

  it('off the start host the scale still owns its rating: nothing for the rail (the field beat tells it in the action phase)', () => {
    const {p} = startTable();
    const branch = cardPlayPreview(p, new VenusL1Shade()).branches[0];
    expect(playRailTrSpecs(branch, branch.effects)).deep.eq([]);
    expect(actionRailTrSpecs(branch)).deep.eq([]);
  });

  it('the promise equals the applied view: rating +3 and M€ +6 verify; one step less does not', () => {
    const {p} = startTable();
    const card = new VenusL1Shade();
    const preview = cardPlayPreview(p, card);
    const branch = preview.branches[0];
    const rail = playRailReward(branch, branch.effects, {}, undefined, reactionRailSpecs(effectForecastForPlay(p, card, preview).facts), {startHost: true});
    const view = (tr: number, mc: number) => ({id: 'p', thisPlayer: {terraformRating: tr, megacredits: mc, tableau: []}} as unknown as PlayerViewModel);
    const ok = verifyRailReward(rail!, view(20, 0), view(23, 6));
    expect(ok.mismatches).deep.eq([]);
    expect(ok.cause).length(3);
    expect(ok.reactions).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 6}]);
    expect(verifyRailReward(rail!, view(20, 0), view(22, 4)).cause, 'a rating that moved otherwise is not held').deep.eq([]);
  });

  it('Atmospheric Enhancers — the class: the CHOSEN Venus branch (+2) is two tokens off the Venus icons, the temperature branch two off the temperature', () => {
    const {p} = startTable();
    const preview = cardPlayPreview(p, new AtmosphericEnhancers());
    const of = (icon: string) => preview.branches.find((b) => b.effects.some((e) => e.icon === icon && e.direction === 'gain'))!;
    expect(playRailTrSpecs(of('venus'), of('venus').effects, {}, {startHost: true})).deep.eq(born('venus', 2));
    expect(playRailTrSpecs(of('temperature'), of('temperature').effects, {}, {startHost: true})).deep.eq(born('temperature', 2));
  });

  it('UNMI Veto (RX42): the scale moves, the refused rating flies NOTHING on the start host either', () => {
    const {p, rival} = startTable();
    p.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
    p.terraformRating = 30;
    rival.terraformRating = 20;
    const branch = cardPlayPreview(p, new VenusL1Shade()).branches[0];
    expect(branch.effects.find((e) => e.icon === 'tr')?.vetoed).is.not.undefined;
    expect(playRailTrSpecs(branch, branch.effects, {}, {startHost: true})).deep.eq([]);
  });

  it('the pure reading: an implied rating only after its scale; a struck step and a replaced unit fly nothing; a direct TR keeps its own icon', () => {
    expect(scaleStepRatingSpecs([
      {direction: 'gain', icon: 'venus', amount: 2},
      {direction: 'gain', icon: 'tr', amount: 1, implied: true},
      {direction: 'gain', icon: 'tr', amount: 1, implied: true, vetoed: {} as never},
    ])).deep.eq(born('venus', 1));
    expect(scaleStepRatingSpecs([
      {direction: 'gain', icon: 'oxygen', amount: 1, diverted: {} as never},
      {direction: 'gain', icon: 'tr', amount: 1, implied: true},
    ]), 'RX35: the replaced unit implies no rating').deep.eq([]);
    expect(playRailTrSpecs({effects: [], steps: []} as never, [
      {direction: 'gain', icon: 'temperature', amount: 1},
      {direction: 'gain', icon: 'tr', amount: 1, implied: true},
      {direction: 'gain', icon: 'tr', amount: 2},
    ], {}, {startHost: true})).deep.eq([...born('temperature', 1), {channel: 'stock', resource: RATING_RAIL_KEY, amount: 2}]);
  });
});

/**
 * PC02 Palladin Shipping (ledger GQ, A6) — THE PRICE AND THE ANSWER IN ONE ROW. A space event paid with titanium answers
 * with titanium: the play's price rides `known` on the SAME row the reactor's token lands on, so the applied view reads
 * «5 → 3» (−3 price, +1 answer) and the promise holds; a row that moved otherwise still holds nothing and names itself.
 */
describe('the card play\'s rail rule — a price and the table\'s answer on ONE row (Palladin Shipping)', () => {
  function palladinTable(): {p: TestPlayer} {
    const [game, p] = testGame(2);
    game.phase = Phase.ACTION;
    p.playCorporationCard(new PalladinShipping());
    p.megaCredits = 0;
    return {p};
  }
  const view = (titanium: number) => ({id: 'p', thisPlayer: {terraformRating: 20, megacredits: 0, titanium, tableau: []}} as unknown as PlayerViewModel);

  it('Imported GHG paid with 3 titanium: the answer +1 titanium is a reaction, the price −3 a known move of the same row', () => {
    const {p} = palladinTable();
    const card = new ImportedGHG();
    const preview = cardPlayPreview(p, card);
    const branch = preview.branches[0];
    const reactions = reactionRailSpecs(effectForecastForPlay(p, card, preview).facts);
    expect(reactions).deep.eq([{channel: 'stock', resource: 'titanium', amount: 1}]);
    const rail = playRailReward(branch, heroRewardEffectsOf(branch), {}, {...Payment.EMPTY, titanium: 3}, reactions);
    expect(rail?.known).deep.include({'stock:titanium': -3});
    const ok = verifyRailReward(rail!, view(5), view(3));
    expect(ok.mismatches).deep.eq([]);
    expect(ok.reactions).deep.eq([{channel: 'stock', resource: 'titanium', amount: 1}]);
  });

  it('an unexplained difference on that row holds nothing and names itself', () => {
    const {p} = palladinTable();
    const card = new ImportedGHG();
    const preview = cardPlayPreview(p, card);
    const branch = preview.branches[0];
    const rail = playRailReward(branch, heroRewardEffectsOf(branch), {}, {...Payment.EMPTY, titanium: 3},
      reactionRailSpecs(effectForecastForPlay(p, card, preview).facts));
    const bad = verifyRailReward(rail!, view(5), view(2));
    expect(bad.reactions).deep.eq([]);
    expect(bad.mismatches.join(' ')).contains('titanium');
  });
});
