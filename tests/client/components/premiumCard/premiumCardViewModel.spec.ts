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
import {isICardRenderEffect, isICardRenderSymbol, isICardRenderItem, isICardRenderCorpBoxAction, isICardRenderCorpBoxEffect, isICardRenderCorpBoxEffectAction} from '@/common/cards/render/Types';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {Size} from '@/common/cards/render/Size';
import {effectParts} from '@/client/components/premiumCard/mechanicsModel';
import {buildPremiumCardViewModel, normalizeRequirement, vpVariantOf} from '@/client/components/premiumCard/premiumCardViewModel';
import {isPremiumFaceType, premiumThemeFor} from '@/client/components/premiumCard/premiumCardTheme';
import {tagClusterPlan} from '@/client/components/premiumCard/tagLayout';
import {cardArtUrl, premiumCardArt, CARD_ART_FALLBACK_URL} from '@/client/cards/cardArt';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

function vmOf(name: CardName, overrides: Partial<CardModel> = {}) {
  return buildPremiumCardViewModel(getCardOrThrow(name), model(name, overrides));
}

describe('premiumCardTheme', () => {
  it('maps project + prelude + corporation types, rejects the rest', () => {
    expect(premiumThemeFor(CardType.AUTOMATED)).to.eq('emerald');
    expect(premiumThemeFor(CardType.ACTIVE)).to.eq('azure');
    expect(premiumThemeFor(CardType.EVENT)).to.eq('crimson');
    expect(premiumThemeFor(CardType.PRELUDE)).to.eq('prelude');
    expect(premiumThemeFor(CardType.CORPORATION)).to.eq('corporation');
    expect(premiumThemeFor(CardType.CEO)).to.eq(undefined);
    expect(premiumThemeFor(CardType.STANDARD_PROJECT)).to.eq(undefined);
    expect(isPremiumFaceType(CardType.EVENT)).to.eq(true);
    expect(isPremiumFaceType(CardType.CORPORATION)).to.eq(true);
    expect(isPremiumFaceType(CardType.CEO)).to.eq(false);
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
    // Sell Patents is a standard project (SP8) — never illustrated.
    expect(cardArtUrl(CardName.SELL_PATENTS_STANDARD_PROJECT)).to.eq(undefined);
    const art = premiumCardArt(CardName.SELL_PATENTS_STANDARD_PROJECT);
    expect(art.url).to.eq(CARD_ART_FALLBACK_URL);
    expect(art.fallback).to.eq(true);
  });

  it('a reimplementation borrows the base card art when it has none of its own', () => {
    // Deimos Down Promo (X31 — no art of its own) reimplements Deimos Down
    // (039, real art), so it resolves to the base card's illustration rather
    // than the generic fallback. Same for the Ares reissue.
    expect(cardArtUrl(CardName.DEIMOS_DOWN)).to.eq('assets/card-images/039.webp');
    expect(cardArtUrl(CardName.DEIMOS_DOWN_PROMO)).to.eq('assets/card-images/039.webp');
    expect(cardArtUrl(CardName.DEIMOS_DOWN_ARES)).to.eq('assets/card-images/039.webp');
    expect(premiumCardArt(CardName.DEIMOS_DOWN_PROMO).fallback).to.eq(false);
    // Great Dam (136) and Magnetic Field Generators (165) reissues too.
    expect(cardArtUrl(CardName.GREAT_DAM_PROMO)).to.eq('assets/card-images/136.webp');
    expect(cardArtUrl(CardName.MAGNETIC_FIELD_GENERATORS_PROMO)).to.eq('assets/card-images/165.webp');
    // Every Ares reissue borrows its base card's art (none have Ares art of
    // their own): Capital (008), Restricted Area (199), Nuclear Zone (097).
    expect(cardArtUrl(CardName.CAPITAL_ARES)).to.eq('assets/card-images/008.webp');
    expect(cardArtUrl(CardName.RESTRICTED_AREA_ARES)).to.eq('assets/card-images/199.webp');
    expect(cardArtUrl(CardName.NUCLEAR_ZONE_ARES)).to.eq('assets/card-images/097.webp');
    // Underworld reissues borrow the base art too: Hackers (125),
    // Hired Raiders (124), Standard Technology (156).
    expect(cardArtUrl(CardName.HACKERS_UNDERWORLD)).to.eq('assets/card-images/125.webp');
    expect(cardArtUrl(CardName.HIRED_RAIDERS_UNDERWORLD)).to.eq('assets/card-images/124.webp');
    expect(cardArtUrl(CardName.STANDARD_TECHNOLOGY_UNDERWORLD)).to.eq('assets/card-images/156.webp');
  });
});

describe('buildPremiumCardViewModel', () => {
  it('throws for out-of-scope card types', () => {
    const ceo = getCards((c) => c.type === CardType.CEO)[0];
    expect(() => buildPremiumCardViewModel(ceo)).to.throw(/outside the premium face scope/);
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

function isSpacer(node: unknown): boolean {
  const n = node as {is?: string, type?: string};
  if (n?.is === 'symbol') {
    return n.type === 'nbsp' || n.type === ' ' || n.type === 'vspace';
  }
  return n?.is === 'item' && n.type === 'nbsp';
}

describe('the OR choice marker is never lost on the face', () => {
  it('Vermin (split per-branch action rows with NO drawn OR) gets a structural orJoin', () => {
    const groups = vmOf(CardName.VERMIN).mechanics.groups;
    const actions = groups.filter((g) => g.kind === 'action');
    expect(actions.length).to.eq(2);
    expect(actions[0].orJoin).to.not.eq(true);
    expect(actions[1].orJoin, 'the second action branch must carry the ИЛИ divider').to.eq(true);
  });

  it('an explicit OR-only row (Aerial Mappers) normalizes into a single orJoin', () => {
    const groups = vmOf(CardName.AERIAL_MAPPERS).mechanics.groups;
    // the or-row itself never leaks as its own group…
    for (const group of groups) {
      const onlyOr = group.nodes.every((n) => isICardRenderSymbol(n));
      expect(onlyOr && group.nodes.length <= 1, 'or-only row leaked as a group').to.not.eq(true);
    }
    expect(groups.filter((g) => g.orJoin === true).length).to.eq(1);
  });

  it('a TRAILING OR inside the action frame (Atmo Collectors) becomes the divider, not a stray glyph', () => {
    const clientCard = getCardOrThrow(CardName.ATMO_COLLECTORS);
    const groups = buildPremiumCardViewModel(clientCard).mechanics.groups;
    const actions = groups.filter((g) => g.kind === 'action');
    expect(actions.length).to.eq(2);
    expect(actions[1].orJoin, 'second action must carry the ИЛИ divider').to.eq(true);
    // the first action's effect result must NOT still render a trailing OR
    const firstEffect = actions[0].nodes.find(isICardRenderEffect)!;
    const result = effectParts(firstEffect).result;
    expect(result.some((n) => isICardRenderSymbol(n) && (n as {type: string}).type === 'OR'),
      'stray OR left in the rendered result').to.eq(false);
  });

  it('a trailing frame OR (Titan Floating Launch-pad) makes the divider without a double marker', () => {
    const groups = vmOf(CardName.TITAN_FLOATING_LAUNCHPAD).mechanics.groups;
    const actions = groups.filter((g) => g.kind === 'action');
    expect(actions.length).to.eq(2);
    expect(actions[1].orJoin).to.eq(true);
  });

  it('a leading edge OR (Sabotage) becomes the divider; interior OR stays inline', () => {
    const groups = vmOf(CardName.SABOTAGE).mechanics.groups;
    // the second row led with an OR → it becomes a divider
    expect(groups.some((g) => g.orJoin === true), 'Sabotage lost its choice marker').to.eq(true);
    // no group renders a leading/trailing bare OR glyph
    for (const group of groups) {
      const first = group.nodes.find((n) => !isSpacer(n));
      const last = [...group.nodes].reverse().find((n) => !isSpacer(n));
      expect(isICardRenderSymbol(first) && (first as {type: string}).type === 'OR', 'leading OR glyph leaked').to.not.eq(true);
      expect(isICardRenderSymbol(last) && (last as {type: string}).type === 'OR', 'trailing OR glyph leaked').to.not.eq(true);
    }
  });

  it('every in-scope multi-action card carries a choice marker at each action junction', () => {
    const SCOPE_ALL = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
    const offenders: Array<string> = [];
    for (const card of getCards((c) => SCOPE_ALL.has(c.module) && isPremiumFaceType(c.type))) {
      const groups = buildPremiumCardViewModel(card).mechanics.groups;
      for (let i = 1; i < groups.length; i++) {
        if (groups[i].kind === 'action' && groups[i - 1].kind === 'action' && groups[i].orJoin !== true) {
          offenders.push(card.name);
        }
      }
    }
    expect(offenders, `action junctions without a choice marker:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('no group renders a stray leading/trailing bare OR glyph, incl. inside effect frames (population sweep)', () => {
    const SCOPE_ALL = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
    const offenders = new Set<string>();
    for (const card of getCards((c) => SCOPE_ALL.has(c.module) && isPremiumFaceType(c.type))) {
      for (const group of buildPremiumCardViewModel(card).mechanics.groups) {
        const first = group.nodes.find((n) => !isSpacer(n));
        const last = [...group.nodes].reverse().find((n) => !isSpacer(n));
        let stray = (isICardRenderSymbol(first) && (first as {type: string}).type === 'OR') ||
          (isICardRenderSymbol(last) && (last as {type: string}).type === 'OR');
        // Inside an effect frame, only a leading/trailing EDGE OR is stray —
        // an interior OR («prod OR titanium», «microbe OR animal») is a
        // legitimate inline choice within one action and stays.
        for (const node of group.nodes) {
          if (isICardRenderEffect(node)) {
            const result = effectParts(node).result.filter((n) => !isSpacer(n));
            const edge = [result[0], result[result.length - 1]];
            if (edge.some((n) => isICardRenderSymbol(n) && (n as {type: string}).type === 'OR')) {
              stray = true;
            }
          }
        }
        if (stray) {
          offenders.add(card.name);
        }
      }
    }
    expect([...offenders], `cards with a stray edge OR glyph:\n${[...offenders].join('\n')}`).to.deep.eq([]);
  });
});

describe('tagClusterPlan (title overlay geometry)', () => {
  it('empty cluster reserves nothing', () => {
    expect(tagClusterPlan(0).width).to.eq(0);
  });
  it('1–2 tags: full-size row', () => {
    expect(tagClusterPlan(1)).to.deep.include({mode: 'row', size: 30, width: 30});
    expect(tagClusterPlan(2)).to.deep.include({mode: 'row', size: 30, width: 64});
  });
  it('3–6 tags: single overlapped row — never a narrower plate', () => {
    const three = tagClusterPlan(3);
    expect(three.mode).to.eq('overlap');
    expect(three.width).to.eq(26 + 2 * 19);
    const six = tagClusterPlan(6);
    expect(six.rows).to.eq(1);
    expect(six.width).to.be.lessThan(100);
  });
  it('7+ tags (fan cards): two compact rows, bounded width', () => {
    const plan = tagClusterPlan(8);
    expect(plan.mode).to.eq('stack');
    expect(plan.rows).to.eq(2);
    expect(plan.width).to.be.lessThan(70);
  });
});

describe('vpVariantOf (VP badge sizing / lower safe reserve)', () => {
  it('fixed values are compact (incl. negatives)', () => {
    expect(vpVariantOf({kind: 'fixed', value: 2})).to.eq('compact');
    expect(vpVariantOf({kind: 'fixed', value: -1})).to.eq('compact');
  });
  it('simple per-item VP is wide; ratios / one-or-more / vermin are formula', () => {
    const base = {kind: 'dynamic' as const, points: 1, target: 1, item: undefined,
      asterisk: false, anyPlayer: false, targetOneOrMore: false, asFraction: false};
    expect(vpVariantOf(base)).to.eq('wide');
    expect(vpVariantOf({...base, target: 2})).to.eq('formula');
    expect(vpVariantOf({...base, targetOneOrMore: true})).to.eq('formula');
    expect(vpVariantOf({kind: 'vermin'})).to.eq('formula');
    expect(vpVariantOf(vmOf(CardName.SEARCH_FOR_LIFE).vp!)).to.eq('formula');
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
  const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
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

describe('corporation premium face', () => {
  it('builds the corporation VM: theme, no cost badge', () => {
    const vm = vmOf(CardName.HELION);
    expect(vm.theme).to.eq('corporation');
    expect(vm.cost, 'corporations have no play cost — starting M€ lives in the mechanics').to.eq(undefined);
    expect(vm.tags).to.deep.eq([Tag.SPACE]);
  });

  it('a corporation WITH real art shows it (Helion — R18); one WITHOUT falls back to the wordmark (Teractor)', () => {
    // Corporations now use their per-card art when it exists, and keep the
    // identity-zone wordmark only when no art is shipped.
    const withArt = vmOf(CardName.HELION);
    expect(withArt.art, 'Helion has real art').to.not.eq(undefined);
    expect(withArt.art?.fallback, 'Helion resolves REAL art, not the generic fallback').to.eq(false);

    const noArt = vmOf(CardName.TERACTOR);
    expect(noArt.art, 'a corp with no art keeps the wordmark identity zone').to.eq(undefined);
  });

  it('flattens the corp box: rows become ordinary groups, no corp-box node leaks (Helion)', () => {
    const groups = vmOf(CardName.HELION).mechanics.groups;
    // the heat-as-M€ effect + the starting resources row (production + 42 M€):
    // on-play «при розыгрыше» is reordered to the BOTTOM, effects above it.
    expect(groups.map((g) => g.kind)).to.deep.eq(['effect', 'plain']);
    for (const group of groups) {
      for (const node of group.nodes) {
        const leaked = node !== undefined && typeof node !== 'string' &&
          (isICardRenderCorpBoxEffect(node) || isICardRenderCorpBoxAction(node) || isICardRenderCorpBoxEffectAction(node));
        expect(leaked, 'corp-box node leaked into a mech group').to.eq(false);
      }
    }
  });

  it('an effect-action corp box yields BOTH an effect and an action group (StormCraft)', () => {
    const kinds = vmOf(CardName.STORMCRAFT_INCORPORATED).mechanics.groups.map((g) => g.kind);
    expect(kinds).to.include('effect');
    expect(kinds).to.include('action');
  });

  // Corporations route by TYPE (module-agnostic — the draft can deal ANY
  // corp), so EVERY corporation in the manifest must build a VM without
  // throwing and with extractable mechanics. A corp landing in the pinned
  // no-mechanics list should be triaged, never silently accepted.
  const CORP_NO_MECHANICS_ACCEPTED = new Set<string>([]);

  it('builds every corporation across ALL modules', () => {
    const corps = getCards((c) => c.type === CardType.CORPORATION);
    expect(corps.length).to.be.greaterThan(50);
    const unexpected: Array<string> = [];
    for (const corp of corps) {
      const vm = buildPremiumCardViewModel(corp);
      if (vm.mechanics.textOnly && !CORP_NO_MECHANICS_ACCEPTED.has(corp.name)) {
        unexpected.push(corp.name);
      }
    }
    expect(unexpected, `corporations without extractable mechanics:\n${unexpected.join('\n')}`).to.deep.eq([]);
  });
});

describe('empty-cause effect trigger splice (Viral Enhancers idiom)', () => {
  it('Viral Enhancers reads as ONE effect group with the tag trigger spliced into its cause', () => {
    // The trigger (plant/microbe/animal tags) is drawn as a standalone ROOT row
    // before an `eb.empty().startEffect` box; the whole graphic is ONE effect,
    // so the tag row must NOT render as a separate mech group.
    const groups = vmOf(CardName.VIRAL_ENHANCERS).mechanics.groups;
    expect(groups.length, 'the standalone tag row must be merged, not a separate group').to.eq(1);
    expect(groups[0].kind).to.eq('effect');
    const effect = groups[0].nodes.find((n) => n !== undefined && typeof n !== 'string' && isICardRenderEffect(n));
    const cause = effectParts(effect as Parameters<typeof effectParts>[0]).cause;
    const tags = cause.filter((n) => n !== undefined && typeof n !== 'string' && 'type' in n && n.type === 'tag');
    expect(tags.length, 'the 3 trigger tags become the effect cause').to.eq(3);
  });

  it('an empty-cause effect with NO preceding trigger row (Earth Catapult) is left unmerged', () => {
    const groups = vmOf(CardName.EARTH_CATAPULT).mechanics.groups;
    expect(groups.length).to.eq(1);
    expect(groups[0].kind).to.eq('effect');
    const effect = groups[0].nodes.find((n) => n !== undefined && typeof n !== 'string' && isICardRenderEffect(n));
    const cause = effectParts(effect as Parameters<typeof effectParts>[0]).cause;
    // its cause carries only the empty spacer — nothing was wrongly spliced in
    expect(cause.every((n) => n !== undefined && typeof n !== 'string' && isICardRenderSymbol(n))).to.eq(true);
  });

  it('an empty-cause effect after ON-PLAY GAINS (not a tag trigger) keeps the gains row separate (Kuiper)', () => {
    // Kuiper draws its starting resources (M€ + titanium production) then an
    // empty-cause action. Those gains are NOT the action's trigger — only a TAG
    // row is (the Viral idiom) — so the splice must NOT eat the starting row: it
    // stays its own group (a wrong face + an untethered «При розыгрыше» otherwise).
    // The on-play gains reorder to the BOTTOM (trailing «при розыгрыше» zone),
    // the action above them.
    const groups = vmOf(CardName.KUIPER_COOPERATIVE).mechanics.groups;
    const starting = groups[groups.length - 1];
    expect(starting.kind, 'starting resources are their own plain group').to.eq('plain');
    expect(starting.graphicId ?? '', 'starting row keeps its graphic id').to.contain('megacredits');
    expect(groups[0].kind, 'the action reads above the on-play zone').to.eq('action');
  });
});

describe('premium face is ICONS-ONLY: prose plainText never renders', () => {
  it('no in-scope premium card bakes a prose (plainText) TEXT node onto its face', () => {
    // `b.plainText(...)` (isBold:false prose — the parenthetical rule restatement
    // Martian Lumber Corp / AI Central / … draw under the icons) must be DROPPED
    // — it belongs in the fullscreen info panel. A MEANINGFUL text label
    // (isBold:true — «X», «+/- 2», whole text-only cards) and the TINY-uppercase
    // vpText fine print are KEPT.
    const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
    const cards = getCards((c) => SCOPE.has(c.module) && isPremiumFaceType(c.type));
    const offenders: Array<string> = [];
    for (const card of cards) {
      for (const group of buildPremiumCardViewModel(card).mechanics.groups) {
        for (const node of group.nodes) {
          if (node !== undefined && typeof node !== 'string' && isICardRenderItem(node) &&
              node.type === CardRenderItemType.TEXT && node.isBold !== true &&
              !(node.size === Size.TINY && node.isUppercase === true)) {
            offenders.push(`${card.name}: «${(node.text ?? '').slice(0, 60)}»`);
          }
        }
      }
    }
    expect(offenders, `prose leaked onto the icons-only premium face:\n${offenders.join('\n')}`).to.deep.eq([]);
  });
});
