import {expect} from 'chai';
import {railMcBadges, tagVpBadges, formatTagVpRate} from '@/client/console/railValueModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Tag} from '@/common/cards/Tag';

/**
 * The left rail's VALUE BADGES read-model. Two contracts pinned here:
 *
 *  MC: a badge exists exactly for the resources that are legal tender for
 *  the DISPLAYED player (base steel/titanium; heat/plants/titanium-anywhere
 *  under their standing grants; a card-bound unit only while its enabling
 *  card is in the tableau), and the rate is the live payment rate — never a
 *  re-derived constant. Same-typed resources on non-payment holders earn
 *  nothing (Stormcraft floaters are storage, Dirigibles' are tender).
 *
 *  VP: a tag carries a coefficient exactly while a played card scores that
 *  tag linearly; ratios keep the desktop PointsPerTag language (½ · ⅓ ·
 *  «2⁄2» for two half-cards — structural per===2, never a card-name pair).
 */

function fakeCardModel(name: CardName, resources?: number): CardModel {
  return {name, resources} as CardModel;
}

function fakePlayer(overrides: Partial<Record<string, unknown>> = {}): PublicPlayerModel {
  return {
    color: 'red',
    megacredits: 20,
    steel: 4,
    titanium: 2,
    plants: 3,
    heat: 6,
    steelValue: 2,
    titaniumValue: 3,
    canUseHeatAsMegaCredits: false,
    canUseTitaniumAsMegacredits: false,
    canUsePlantsAsMegacredits: false,
    tableau: [],
    ...overrides,
  } as unknown as PublicPlayerModel;
}

describe('railValueModel — MC badges', () => {
  it('base game: steel 2 and titanium 3, tag-gated contexts, nothing else', () => {
    const badges = railMcBadges(fakePlayer());
    expect(badges.standard.steel?.text).to.eq('2');
    expect(badges.standard.steel?.facts[0]).to.deep.include({unit: 'steel', rate: 2, context: 'building'});
    expect(badges.standard.titanium?.text).to.eq('3');
    expect(badges.standard.titanium?.facts[0]).to.deep.include({unit: 'titanium', rate: 3, context: 'space'});
    expect(badges.standard.heat).to.eq(undefined);
    expect(badges.standard.plants).to.eq(undefined);
    expect(badges.cardBound.size).to.eq(0);
  });

  it('a steel-value modifier flows through (Advanced Alloys / Rego Plastics)', () => {
    const badges = railMcBadges(fakePlayer({steelValue: 3}));
    expect(badges.standard.steel?.text).to.eq('3');
  });

  it('a titanium-value modifier flows through (Advanced Alloys / PhoboLog)', () => {
    const badges = railMcBadges(fakePlayer({titaniumValue: 4}));
    expect(badges.standard.titanium?.text).to.eq('4');
  });

  it('stacked modifiers show the live stacked value, never the base', () => {
    const badges = railMcBadges(fakePlayer({steelValue: 4, titaniumValue: 5}));
    expect(badges.standard.steel?.text).to.eq('4');
    expect(badges.standard.titanium?.text).to.eq('5');
  });

  it('heat is tender only under the standing grant (Helion / Ambient)', () => {
    expect(railMcBadges(fakePlayer()).standard.heat).to.eq(undefined);
    const helion = railMcBadges(fakePlayer({canUseHeatAsMegaCredits: true}));
    expect(helion.standard.heat?.text).to.eq('1');
    expect(helion.standard.heat?.facts[0]).to.deep.include({rate: 1, context: 'any-card'});
  });

  it('plants are tender only under Martian Lumber Corp\'s grant', () => {
    expect(railMcBadges(fakePlayer()).standard.plants).to.eq(undefined);
    const mlc = railMcBadges(fakePlayer({canUsePlantsAsMegacredits: true}));
    expect(mlc.standard.plants?.text).to.eq('3');
    expect(mlc.standard.plants?.facts[0]).to.deep.include({rate: 3, context: 'building'});
  });

  it('Luna Trade Federation: titanium carries BOTH legal rates (space / anywhere)', () => {
    const ltf = railMcBadges(fakePlayer({canUseTitaniumAsMegacredits: true}));
    expect(ltf.standard.titanium?.text).to.eq('3/2');
    expect(ltf.standard.titanium?.rates).to.deep.eq([3, 2]);
    expect(ltf.standard.titanium?.facts.map((f) => f.context)).to.deep.eq(['space', 'non-space-ltf']);
    // …and the pair follows a value modifier (Advanced Alloys + LTF).
    const modified = railMcBadges(fakePlayer({canUseTitaniumAsMegacredits: true, titaniumValue: 4}));
    expect(modified.standard.titanium?.text).to.eq('4/3');
  });

  it('a card-bound unit is tender only while its ENABLING card is played', () => {
    const dirigibles = railMcBadges(fakePlayer({tableau: [fakeCardModel(CardName.DIRIGIBLES, 5)]}));
    const badge = dirigibles.cardBound.get(CardResource.FLOATER);
    expect(badge?.text).to.eq('3');
    expect(badge?.facts[0]).to.deep.include({unit: 'floaters', context: 'venus', source: CardName.DIRIGIBLES, spendableAmount: 5});
  });

  it('the same resource type on a NON-payment holder earns no badge (Stormcraft)', () => {
    const stormcraft = railMcBadges(fakePlayer({tableau: [fakeCardModel(CardName.STORMCRAFT_INCORPORATED, 3)]}));
    expect(stormcraft.cardBound.get(CardResource.FLOATER)).to.eq(undefined);
  });

  it('an aggregated stock stays honest: spendableAmount is the enabler\'s own', () => {
    const both = railMcBadges(fakePlayer({tableau: [
      fakeCardModel(CardName.DIRIGIBLES, 2),
      fakeCardModel(CardName.STORMCRAFT_INCORPORATED, 4),
    ]}));
    const badge = both.cardBound.get(CardResource.FLOATER);
    expect(badge?.text).to.eq('3');
    expect(badge?.facts[0]?.spendableAmount).to.eq(2);
  });

  it('microbes: Psychrophiles enables ×2; a plain microbe holder does not', () => {
    const psychro = railMcBadges(fakePlayer({tableau: [fakeCardModel(CardName.PSYCHROPHILES, 1)]}));
    expect(psychro.cardBound.get(CardResource.MICROBE)?.text).to.eq('2');
    const tardigrades = railMcBadges(fakePlayer({tableau: [fakeCardModel(CardName.TARDIGRADES, 4)]}));
    expect(tardigrades.cardBound.get(CardResource.MICROBE)).to.eq(undefined);
  });

  it('graphene ×4 (city/space) and Kuiper asteroids ×1 (aquifer/asteroid SPs)', () => {
    const badges = railMcBadges(fakePlayer({tableau: [
      fakeCardModel(CardName.CARBON_NANOSYSTEMS, 2),
      fakeCardModel(CardName.KUIPER_COOPERATIVE, 1),
    ]}));
    expect(badges.cardBound.get(CardResource.GRAPHENE)?.text).to.eq('4');
    expect(badges.cardBound.get(CardResource.GRAPHENE)?.facts[0]?.context).to.eq('city-or-space');
    expect(badges.cardBound.get(CardResource.ASTEROID)?.text).to.eq('1');
    expect(badges.cardBound.get(CardResource.ASTEROID)?.facts[0]?.context).to.eq('aquifer-asteroid');
  });

  it('a shared-icon chip with two tender rates carries both (Luna Archives + Spire)', () => {
    const badges = railMcBadges(fakePlayer({tableau: [
      fakeCardModel(CardName.LUNA_ARCHIVES, 3),
      fakeCardModel(CardName.SPIRE, 2),
    ]}));
    const science = badges.cardBound.get(CardResource.SCIENCE);
    expect(science?.text).to.eq('1/2');
    expect(science?.rates).to.deep.eq([1, 2]);
    expect(science?.facts.map((f) => f.unit)).to.deep.eq(['lunaArchivesScience', 'spireScience']);
  });

  it('memoizes by model identity (the always-mounted rail pays O(1))', () => {
    const player = fakePlayer();
    expect(railMcBadges(player)).to.eq(railMcBadges(player));
  });
});

describe('railValueModel — tag VP badges', () => {
  it('no scoring card → no badge on any tag', () => {
    expect(tagVpBadges([fakeCardModel(CardName.ACQUIRED_COMPANY)]).size).to.eq(0);
  });

  it('one «1 VP per Jovian tag» card → jovian carries «1»', () => {
    const badges = tagVpBadges([fakeCardModel(CardName.IO_MINING_INDUSTRIES)]);
    const jovian = badges.get(Tag.JOVIAN);
    expect(jovian?.text).to.eq('1');
    expect(jovian?.wide).to.eq(false);
    expect(jovian?.sources).to.deep.eq([{card: CardName.IO_MINING_INDUSTRIES, each: 1, per: 1}]);
    expect(badges.size).to.eq(1);
  });

  it('several scoring cards SUM into one marginal coefficient', () => {
    const badges = tagVpBadges([
      fakeCardModel(CardName.IO_MINING_INDUSTRIES),
      fakeCardModel(CardName.GANYMEDE_COLONY),
      fakeCardModel(CardName.WATER_IMPORT_FROM_EUROPA),
    ]);
    expect(badges.get(Tag.JOVIAN)?.text).to.eq('3');
    expect(badges.get(Tag.JOVIAN)?.sources).to.have.length(3);
  });

  it('«1 VP per 2 tags» renders the vulgar half, never a rounded integer', () => {
    const badges = tagVpBadges([fakeCardModel(CardName.CULTIVATION_OF_VENUS)]);
    expect(badges.get(Tag.VENUS)?.text).to.eq('½');
    expect(badges.get(Tag.VENUS)?.wide).to.eq(false);
  });

  it('TWO half-cards read «2⁄2» — deliberately not simplified to 1', () => {
    const badges = tagVpBadges([
      fakeCardModel(CardName.CULTIVATION_OF_VENUS),
      fakeCardModel(CardName.VENERA_BASE),
    ]);
    expect(badges.get(Tag.VENUS)?.text).to.eq('2⁄2');
    expect(badges.get(Tag.VENUS)?.wide).to.eq(true);
  });

  it('«1 VP per 3 tags» renders ⅓ (Crescent Research Association)', () => {
    const badges = tagVpBadges([fakeCardModel(CardName.CRESCENT_RESEARCH_ASSOCIATION)]);
    expect(badges.get(Tag.MOON)?.text).to.eq('⅓');
  });

  it('whole + third compose («2⅓» — Copernicus + Luna Senate + Crescent)', () => {
    const badges = tagVpBadges([
      fakeCardModel(CardName.COPERNICUS_TOWER),
      fakeCardModel(CardName.LUNA_SENATE),
      fakeCardModel(CardName.CRESCENT_RESEARCH_ASSOCIATION),
    ]);
    expect(badges.get(Tag.MOON)?.text).to.eq('2⅓');
    expect(badges.get(Tag.MOON)?.wide).to.eq(true);
  });

  it('fixed-number and resource-scoring VP never mark a tag', () => {
    const badges = tagVpBadges([
      fakeCardModel(CardName.VESTA_SHIPYARD), // fixed 1 VP, jovian TAGGED
      fakeCardModel(CardName.BIRDS, 3), // per-resource scorer
    ]);
    expect(badges.size).to.eq(0);
  });

  it('a bespoke  scorer contributes nothing (not a linear coefficient)', () => {
    expect(tagVpBadges([fakeCardModel(CardName.SEARCH_FOR_LIFE, 1)]).size).to.eq(0);
  });

  it('memoizes by tableau identity', () => {
    const tableau = [fakeCardModel(CardName.IO_MINING_INDUSTRIES)];
    expect(tagVpBadges(tableau)).to.eq(tagVpBadges(tableau));
  });
});

describe('railValueModel — formatTagVpRate (desktop PointsPerTag parity)', () => {
  it('whole numbers', () => {
    expect(formatTagVpRate(1, 0, false)).to.eq('1');
    expect(formatTagVpRate(3, 0, false)).to.eq('3');
  });
  it('vulgar fractions with a suppressed zero integer', () => {
    expect(formatTagVpRate(0, 1, false)).to.eq('½');
    expect(formatTagVpRate(1 / 3, 0, false)).to.eq('⅓');
    expect(formatTagVpRate(2 / 3, 0, false)).to.eq('⅔');
  });
  it('integer + fraction composites', () => {
    expect(formatTagVpRate(1.5, 0, false)).to.eq('1½');
    expect(formatTagVpRate(4 / 3, 0, false)).to.eq('1⅓');
    expect(formatTagVpRate(2, 1, false)).to.eq('2½');
  });
  it('the «2⁄2» two-half-cards special case', () => {
    expect(formatTagVpRate(0, 2, false)).to.eq('2⁄2');
    expect(formatTagVpRate(0, 2, true)).to.eq('2⁄2*');
  });
  it('the placement-dependent asterisk', () => {
    expect(formatTagVpRate(1, 0, true)).to.eq('1*');
  });
  it('an inexpressible ratio formats empty (the caller drops the badge)', () => {
    expect(formatTagVpRate(0.25, 0, false)).to.eq('');
  });
});
