import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {RequirementType} from '@/common/cards/RequirementType';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {GameModule} from '@/common/cards/GameModule';
import {buildPremiumCardViewModel, normalizeRequirement} from '@/client/components/premiumCard/premiumCardViewModel';
import {isPremiumFaceType, premiumThemeFor} from '@/client/components/premiumCard/premiumCardTheme';
import {cardArtUrl, premiumCardArt, CARD_ART_FALLBACK_URL} from '@/client/cards/cardArt';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

function vmOf(name: CardName, overrides: Partial<CardModel> = {}) {
  return buildPremiumCardViewModel(getCardOrThrow(name), model(name, overrides));
}

describe('premiumCardTheme', () => {
  it('maps project + prelude types, rejects the rest', () => {
    expect(premiumThemeFor(CardType.AUTOMATED)).to.eq('emerald');
    expect(premiumThemeFor(CardType.ACTIVE)).to.eq('azure');
    expect(premiumThemeFor(CardType.EVENT)).to.eq('crimson');
    expect(premiumThemeFor(CardType.PRELUDE)).to.eq('prelude');
    expect(premiumThemeFor(CardType.CORPORATION)).to.eq(undefined);
    expect(premiumThemeFor(CardType.CEO)).to.eq(undefined);
    expect(premiumThemeFor(CardType.STANDARD_PROJECT)).to.eq(undefined);
    expect(isPremiumFaceType(CardType.EVENT)).to.eq(true);
    expect(isPremiumFaceType(CardType.CORPORATION)).to.eq(false);
  });
});

describe('cardArt', () => {
  it('resolves real art by cardNumber', () => {
    // Colonizer Training Camp is card 001 — in the shipped art batch.
    expect(cardArtUrl(CardName.COLONIZER_TRAINING_CAMP)).to.eq('assets/card-images/001.webp');
    const art = premiumCardArt(CardName.COLONIZER_TRAINING_CAMP);
    expect(art.fallback).to.eq(false);
  });

  it('falls back for cards without art', () => {
    // Donation is prelude P36 — no art shipped.
    expect(cardArtUrl(CardName.DONATION)).to.eq(undefined);
    const art = premiumCardArt(CardName.DONATION);
    expect(art.url).to.eq(CARD_ART_FALLBACK_URL);
    expect(art.fallback).to.eq(true);
  });
});

describe('buildPremiumCardViewModel', () => {
  it('throws for out-of-scope card types', () => {
    const corp = getCards((c) => c.type === CardType.CORPORATION)[0];
    expect(() => buildPremiumCardViewModel(corp)).to.throw(/outside the premium face scope/);
  });

  it('builds the cost cluster with a discount delta', () => {
    const vm = vmOf(CardName.COMET, {calculatedCost: 17});
    expect(vm.cost).to.deep.eq({printed: 21, effective: 17, delta: -4});
    expect(vm.theme).to.eq('crimson');
  });

  it('cost without model equals printed (delta 0)', () => {
    const vm = buildPremiumCardViewModel(getCardOrThrow(CardName.COMET));
    expect(vm.cost).to.deep.eq({printed: 21, effective: 21, delta: 0});
  });

  it('preludes carry no cost badge', () => {
    const vm = vmOf(CardName.DONATION);
    expect(vm.cost).to.eq(undefined);
    expect(vm.theme).to.eq('prelude');
  });

  it('appends the event tag and substitutes clone tags', () => {
    const comet = vmOf(CardName.COMET);
    expect(comet.tags[comet.tags.length - 1]).to.eq(Tag.EVENT);

    const synthetic: ClientCard = {
      ...getCardOrThrow(CardName.MICRO_MILLS),
      tags: [Tag.CLONE, Tag.BUILDING],
    };
    const vm = buildPremiumCardViewModel(synthetic, model(CardName.MICRO_MILLS, {cloneTag: Tag.SCIENCE}));
    expect(vm.tags[0]).to.eq(Tag.SCIENCE);
  });

  it('carries live card resources (incl. SRR cube)', () => {
    const predators = vmOf(CardName.PREDATORS, {resources: 3});
    expect(predators.resource).to.deep.eq({type: CardResource.ANIMAL, amount: 3, isSrr: false});

    const srr = vmOf(CardName.MICRO_MILLS, {isSelfReplicatingRobotsCard: true, resources: 2});
    expect(srr.resource).to.deep.eq({type: CardResource.RESOURCE_CUBE, amount: 2, isSrr: true});
  });

  it('normalizes VP: fixed, dynamic and vermin', () => {
    expect(vmOf(CardName.COMET).vp).to.eq(undefined);
    const sfl = vmOf(CardName.SEARCH_FOR_LIFE);
    expect(sfl.vp?.kind).to.eq('dynamic');
    if (sfl.vp?.kind === 'dynamic') {
      expect(sfl.vp.targetOneOrMore).to.eq(true);
    }
    expect(vmOf(CardName.VERMIN).vp?.kind).to.eq('vermin');
    const predators = vmOf(CardName.PREDATORS);
    expect(predators.vp?.kind).to.eq('dynamic');
  });

  it('extracts mechanics with a density tier', () => {
    const comet = vmOf(CardName.COMET);
    expect(comet.mechanics.textOnly).to.eq(false);
    expect(comet.mechanics.groups.length).to.be.greaterThan(0);
    expect(['sparse', 'normal', 'dense', 'veryDense']).to.include(comet.mechanics.density);
  });
});

describe('normalizeRequirement', () => {
  it('global parameters carry suffix + comparator', () => {
    const oxygen = normalizeRequirement({oxygen: 9, max: true});
    expect(oxygen.type).to.eq(RequirementType.OXYGEN);
    expect(oxygen.comparator).to.eq('max');
    expect(oxygen.value).to.eq(9);
    expect(oxygen.suffix).to.eq('%');

    const temp = normalizeRequirement({temperature: -14});
    expect(temp.comparator).to.eq('min');
    expect(temp.suffix).to.eq('°C');
    expect(temp.iconUrl).to.contain('temperature');
  });

  it('tag and production requirements resolve their icon', () => {
    const tag = normalizeRequirement({tag: Tag.SCIENCE, count: 2});
    expect(tag.value).to.eq(2);
    expect(tag.iconUrl).to.eq('assets/tags/science.png');

    const prod = normalizeRequirement({production: Resource.TITANIUM});
    expect(prod.iconUrl).to.eq('assets/resources/titanium.png');
  });

  it('binary requirements draw no number', () => {
    const removed = normalizeRequirement({plantsRemoved: true});
    expect(removed.isBinary).to.eq(true);
    expect(removed.negation).to.eq(true);
  });
});

describe('premium face coverage guard', () => {
  // Every project/prelude card of the fork's in-scope modules must build a VM
  // without throwing, and the no-graphics list must stay KNOWN. The accepted
  // cards below genuinely have NO mechanics — their whole rule is the
  // requirement bar + the VP badge (or, for Research Coordination, a prose
  // rule with no iconifiable shape), so an absent mechanics panel is correct
  // (the art takes the space). A NEW card landing in this list should be
  // triaged (does it truly have no graphics?), never silently accepted.
  const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);
  const NO_MECHANICS_ACCEPTED = new Set<string>([
    CardName.ADVANCED_ECOSYSTEMS,
    CardName.BREATHING_FILTERS,
    CardName.COLONIZER_TRAINING_CAMP,
    CardName.DUST_SEALS,
    CardName.INTERSTELLAR_COLONY_SHIP,
    CardName.TRANS_NEPTUNE_PROBE,
    CardName.LUXURY_FOODS,
    CardName.RESEARCH_COORDINATION,
  ]);

  it('builds every in-scope premium card', () => {
    const cards = getCards((c) => SCOPE.has(c.module) && isPremiumFaceType(c.type));
    expect(cards.length).to.be.greaterThan(300);
    const unexpected: Array<string> = [];
    for (const card of cards) {
      const vm = buildPremiumCardViewModel(card);
      if (vm.mechanics.textOnly && !NO_MECHANICS_ACCEPTED.has(card.name)) {
        unexpected.push(card.name);
      }
    }
    expect(unexpected, `cards without extractable mechanics changed:\n${unexpected.join('\n')}`).to.deep.eq([]);
  });
});
