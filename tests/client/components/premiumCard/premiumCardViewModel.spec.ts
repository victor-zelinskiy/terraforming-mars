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
import loreTexts from '../../../../assets/text/lore_texts.json';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

function vmOf(name: CardName, overrides: Partial<CardModel> = {}) {
  return buildPremiumCardViewModel(getCardOrThrow(name), model(name, overrides));
}

describe('premiumCardTheme', () => {
  it('maps every card type to a premium theme (nothing legacy is left)', () => {
    expect(premiumThemeFor(CardType.AUTOMATED)).to.eq('emerald');
    expect(premiumThemeFor(CardType.ACTIVE)).to.eq('azure');
    expect(premiumThemeFor(CardType.EVENT)).to.eq('crimson');
    expect(premiumThemeFor(CardType.PRELUDE)).to.eq('prelude');
    expect(premiumThemeFor(CardType.CORPORATION)).to.eq('corporation');
    // Standard projects + standard actions are ONE class (both or neither)
    // and share the neutral engineered theme since desktop-removal wave 2.
    expect(premiumThemeFor(CardType.STANDARD_PROJECT)).to.eq('standard');
    expect(premiumThemeFor(CardType.STANDARD_ACTION)).to.eq('standard');
    // CEOs joined in desktop-removal wave 4 (executive theme + prose zone).
    expect(premiumThemeFor(CardType.CEO)).to.eq('ceo');
    expect(isPremiumFaceType(CardType.EVENT)).to.eq(true);
    expect(isPremiumFaceType(CardType.CORPORATION)).to.eq(true);
    expect(isPremiumFaceType(CardType.STANDARD_PROJECT)).to.eq(true);
    expect(isPremiumFaceType(CardType.STANDARD_ACTION)).to.eq(true);
    expect(isPremiumFaceType(CardType.CEO)).to.eq(true);
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
    // Every REAL card type is premium since wave 4 (standard in wave 2,
    // CEO in wave 4). The one honestly out-of-scope type left is PROXY —
    // a server-side card-like operation, never a rendered face; the VM
    // must keep refusing an unknown type rather than guess a theme.
    const proxyish = {...getCards((c) => c.type === CardType.AUTOMATED)[0], type: CardType.PROXY};
    expect(() => buildPremiumCardViewModel(proxyish)).to.throw(/outside the premium face scope/);
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

  it('standard projects print their REAL cost (Sell Patents an honest «0»); standard actions print none', () => {
    const aquifer = vmOf(CardName.AQUIFER_STANDARD_PROJECT);
    expect(aquifer.theme).to.eq('standard');
    expect(aquifer.cost).to.deep.eq({printed: 18, effective: 18, delta: 0});

    // A declared cost of 0 is a real printed price and must render «0».
    const sellPatents = vmOf(CardName.SELL_PATENTS_STANDARD_PROJECT);
    expect(sellPatents.cost).to.deep.eq({printed: 0, effective: 0, delta: 0});

    // Convert Plants / Convert Heat carry NO printed M€ cost — the manifest's
    // `cost: 0` is only the server Card-base-class default (their constructors
    // take no cost). A badge here would print a phantom «0» over a price that
    // is really 8 plants / 8 heat in the action graphic.
    const convertHeat = vmOf(CardName.CONVERT_HEAT);
    expect(convertHeat.theme).to.eq('standard');
    expect(convertHeat.cost).to.eq(undefined);
    expect(vmOf(CardName.CONVERT_PLANTS).cost).to.eq(undefined);
  });

  it('every standard project/action reads as ONE action group (arrow)', () => {
    for (const name of [CardName.CITY_STANDARD_PROJECT, CardName.GREENERY_STANDARD_PROJECT, CardName.CONVERT_HEAT, CardName.BUILD_COLONY_STANDARD_PROJECT]) {
      const groups = vmOf(name).mechanics.groups;
      expect(groups.filter((g) => g.kind === 'action').length, `${name}: the printed graphic is its action`).to.be.greaterThan(0);
    }
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

  /*
   * The VP RELATION is what the badge prints as a formula — «1 / [jovian]»
   * only reads as «1 per jovian tag» because the view-model said so. Every
   * shape the printed render data can take is pinned here.
   */
  it('classifies the VP relation and its denominator', () => {
    const rel = (name: CardName) => {
      const vp = vmOf(name).vp;
      if (vp?.kind !== 'dynamic') {
        throw new Error(`${name}: expected a dynamic VP`);
      }
      return {relation: vp.relation, per: vp.per, points: vp.points};
    };

    // N per EACH — a tag, a card resource, a tile.
    expect(rel(CardName.WATER_IMPORT_FROM_EUROPA)).to.deep.eq({relation: 'per', per: 1, points: 1});
    expect(rel(CardName.BIRDS)).to.deep.eq({relation: 'per', per: 1, points: 1});
    expect(rel(CardName.CAPITAL)).to.deep.eq({relation: 'per', per: 1, points: 1});
    // …including a NEGATIVE rate.
    expect(rel(CardName.ANCIENT_SHIPYARDS)).to.deep.eq({relation: 'per', per: 1, points: -1});

    // N per EVERY K.
    expect(rel(CardName.ANTS)).to.deep.eq({relation: 'per', per: 2, points: 1});
    expect(rel(CardName.DECOMPOSERS)).to.deep.eq({relation: 'per', per: 3, points: 1});
    expect(rel(CardName.TARDIGRADES)).to.deep.eq({relation: 'per', per: 4, points: 1});
    expect(rel(CardName.SOLARPEDIA)).to.deep.eq({relation: 'per', per: 6, points: 1});

    // «2 VP PER MINING TILE»: the per-one builders copy `points` into
    // `target`, which must NOT be read as a denominator of 2.
    expect(rel(CardName.LUNA_MINING_HUB)).to.deep.eq({relation: 'per', per: 1, points: 2});
    expect(rel(CardName.LUNA_TRAIN_STATION)).to.deep.eq({relation: 'per', per: 1, points: 2});

    // A flat amount behind a threshold — «3 VP if it holds ≥1 science».
    expect(rel(CardName.SEARCH_FOR_LIFE)).to.deep.eq({relation: 'conditional', per: 1, points: 3});

    // A flat amount with no subject on the badge.
    expect(rel(CardName.LAW_SUIT)).to.deep.eq({relation: 'plain', per: 1, points: -1});
    expect(rel(CardName.STING_OPERATION)).to.deep.eq({relation: 'plain', per: 1, points: -2});

    // A bespoke count the badge can only print as «?».
    expect(rel(CardName.AGRICOLA_INC)).to.deep.eq({relation: 'variable', per: 1, points: 0});
    expect(rel(CardName.RED_CITY)).to.deep.eq({relation: 'variable', per: 1, points: 0});
  });

  /*
   * WORKLIST GUARD — every dynamic VP badge in the whole corpus must resolve
   * to a relation, and a «per» relation must expose a denominator ≥ 1. A new
   * card (or a widened expansion scope) that invents a shape this classifier
   * cannot read fails HERE, by name, instead of silently printing an
   * ambiguous «N [icon]» on the face.
   */
  it('every dynamic-VP card in the corpus resolves to a relation', () => {
    const unresolved: Array<string> = [];
    for (const card of getCards(() => true)) {
      if (!isPremiumFaceType(card.type)) {
        continue;
      }
      const vp = buildPremiumCardViewModel(card).vp;
      if (vp?.kind !== 'dynamic') {
        continue;
      }
      const ok = vp.relation === 'per' ?
        Number.isInteger(vp.per) && vp.per >= 1 :
        ['conditional', 'variable', 'plain'].includes(vp.relation);
      if (!ok) {
        unresolved.push(`${card.name} (relation=${vp.relation}, per=${vp.per})`);
      }
      // A subject-less relation must never claim a rate, and a rate must
      // always have a subject to divide.
      if (vp.relation === 'per' && vp.item === undefined) {
        unresolved.push(`${card.name}: 'per' without an item`);
      }
      if ((vp.relation === 'plain' || vp.relation === 'variable') && vp.item !== undefined) {
        unresolved.push(`${card.name}: '${vp.relation}' with an item`);
      }
    }
    expect(unresolved, unresolved.join(', ')).to.deep.eq([]);
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

  it('a LEADING OR inside the action frame (Rotator Impacts) draws ONE divider, not two «или»', () => {
    // The DSL opens the second action box's CAUSE with `or()` («ИЛИ <asteroid>
    // → Venus»). The panel already draws the «ИЛИ» divider between two action
    // groups, so leaving that glyph inline printed the word TWICE — once as the
    // divider, once again inside the box right under it.
    const groups = vmOf(CardName.ROTATOR_IMPACTS).mechanics.groups;
    const actions = groups.filter((g) => g.kind === 'action');
    expect(actions.length).to.eq(2);
    expect(actions[1].orJoin, 'the second action must carry the ИЛИ divider').to.eq(true);
    const cause = effectParts(actions[1].nodes.find(isICardRenderEffect)!).cause;
    expect(cause.some((n) => isICardRenderSymbol(n) && (n as {type: string}).type === 'OR'),
      'the connector is still drawn INSIDE the box — that is the second «или»').to.eq(false);
    // …and the branch itself is intact: the spent asteroid still opens the cause.
    expect(cause.length).to.be.greaterThan(0);
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
    const SCOPE_ALL = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'ceo', 'deltaProject']);
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
    const SCOPE_ALL = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'ceo', 'deltaProject']);
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
            // BOTH rows of the frame: the DSL marks the join between two stacked
            // boxes at either end — leading the 2nd box's CAUSE («ИЛИ <floater>
            // → …») or closing the 1st box's RESULT («… <asteroid> ИЛИ»).
            // Checking only the result is what let Rotator Impacts / Weather
            // Balloons / Icy Impactors / Extractor Balloons print a DOUBLE «или».
            const parts = effectParts(node);
            for (const row of [parts.cause, parts.result]) {
              const drawn = row.filter((n) => !isSpacer(n));
              const edge = [drawn[0], drawn[drawn.length - 1]];
              if (edge.some((n) => isICardRenderSymbol(n) && (n as {type: string}).type === 'OR')) {
                stray = true;
              }
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
  it('a per-one rate is wide; ratios / one-or-more / vermin are formula', () => {
    const base = {kind: 'dynamic' as const, relation: 'per' as const, points: 1, per: 1, target: 1,
      item: undefined, asterisk: false, anyPlayer: false, targetOneOrMore: false, asFraction: false};
    expect(vpVariantOf(base)).to.eq('wide');
    expect(vpVariantOf({...base, per: 2, target: 2})).to.eq('formula');
    expect(vpVariantOf({...base, asterisk: true})).to.eq('formula');
    expect(vpVariantOf({...base, relation: 'conditional', targetOneOrMore: true})).to.eq('formula');
    expect(vpVariantOf({kind: 'vermin'})).to.eq('formula');
    expect(vpVariantOf(vmOf(CardName.SEARCH_FOR_LIFE).vp!)).to.eq('formula');
  });
  it('a subject-less amount («−1», «?») is compact, like a fixed one', () => {
    expect(vpVariantOf(vmOf(CardName.LAW_SUIT).vp!)).to.eq('compact');
    expect(vpVariantOf(vmOf(CardName.AGRICOLA_INC).vp!)).to.eq('compact');
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
  // 'ceo' joined in desktop-removal wave 4 (all L-cards render mechanics).
  const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'ceo', 'deltaProject']);
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

  it('a corporation WITH real art shows it (Helion — R18); one WITHOUT falls back to the wordmark (Beginner Corporation)', () => {
    // Corporations now use their per-card art when it exists, and keep the
    // identity-zone wordmark only when no art is shipped.
    const withArt = vmOf(CardName.HELION);
    expect(withArt.art, 'Helion has real art').to.not.eq(undefined);
    expect(withArt.art?.fallback, 'Helion resolves REAL art, not the generic fallback').to.eq(false);

    const noArt = vmOf(CardName.BEGINNER_CORPORATION);
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

describe('card art coverage — full premium-face scope (project + prelude + corporation + standard)', () => {
  // Every in-scope premium card — project, prelude, corporation AND standard
  // project/action — should resolve to REAL per-card art (never the generic
  // -1.webp fallback), except the pinned procedural-by-design set below. This
  // mirrors the "premium face coverage guard" above but for artwork instead
  // of mechanics, and it deliberately DOES cover corporations (unlike the
  // project+prelude-only `audit_card_art.ts` tool), since a corp within this
  // fork's SCOPE_MODULES is expected to be fully illustrated.
  // The 'ceo' module is deliberately NOT here: no L-card ships art, and the
  // CEO face's procedural identity band (.pcard-ceo-ident) is the INTENDED
  // look of the whole type — resolveArt answers undefined by design, so an
  // art sweep over CEOs would assert a fallback that is not a gap.
  const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);
  // Corporations with NO real illustration to scan — the corp premium face
  // falls back to the wordmark identity zone by design in this case (see
  // "Corporation face" in CLAUDE.md). A newly-added corp landing here should
  // be triaged (is art genuinely missing from the source pack, or was this
  // just never delivered?) — never silently accepted without a reason.
  const NO_ART_ACCEPTED = new Set<string>([
    CardName.BEGINNER_CORPORATION, // the rules/training corp — no printed illustration exists to scan
    // The Hydronetwork's board SUBSYSTEM wearing a card's clothes: `instantiate:
    // false`, never dealt, never in a hand or a tableau (every player shares the
    // track from turn one and advances via a standard action). Like the standard
    // projects above it is board machinery with no printed illustration, so the
    // procedural theme fallback IS its look wherever the client draws it as a
    // source chip. The module's real cards (DP02+) are covered normally.
    CardName.DELTA_PROJECT,
    // Standard projects / standard actions ship PROCEDURAL faces by design —
    // no SP/SA card was ever illustrated (the printed originals are board
    // panels, not cards), so the neutral engineered theme fallback IS the art.
    CardName.CONVERT_PLANTS,
    CardName.CONVERT_HEAT,
    CardName.AQUIFER_STANDARD_PROJECT,
    CardName.CITY_STANDARD_PROJECT,
    CardName.POWER_PLANT_STANDARD_PROJECT,
    CardName.GREENERY_STANDARD_PROJECT,
    CardName.ASTEROID_STANDARD_PROJECT,
    CardName.SELL_PATENTS_STANDARD_PROJECT,
    CardName.BUFFER_GAS_STANDARD_PROJECT,
    CardName.AIR_SCRAPPING_STANDARD_PROJECT,
    CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT,
    CardName.BUILD_COLONY_STANDARD_PROJECT,
  ]);

  it('every in-scope premium card resolves real art', () => {
    const cards = getCards((c) => SCOPE.has(c.module) && isPremiumFaceType(c.type));
    expect(cards.length).to.be.greaterThan(490);
    const missing: Array<string> = [];
    for (const card of cards) {
      if (premiumCardArt(card.name).fallback && !NO_ART_ACCEPTED.has(card.name)) {
        missing.push(`${card.name} (${card.type})`);
      }
    }
    expect(missing, `in-scope cards without real art:\n${missing.join('\n')}`).to.deep.eq([]);
  });
});

describe('card lore coverage — project + prelude + corporation', () => {
  // Lore is keyed by the printed card number. A reimplementation may reuse the
  // source card's lore when it has no entry of its own. Standard projects /
  // standard actions joined the premium face WITHOUT lore by design (board
  // machinery, not flavoured cards) — LORE_CARD_TYPES pins them out.
  const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);
  const LORE_CARD_TYPES = new Set<CardType>([
    CardType.AUTOMATED,
    CardType.ACTIVE,
    CardType.EVENT,
    CardType.PRELUDE,
    CardType.CORPORATION,
  ]);
  const LORE_BY_CARD_NUMBER: Readonly<Record<string, string>> = loreTexts;
  /**
   * In the manifest, but never DEALT — so neither ever reaches a hand, a tableau
   * or the fullscreen viewer, which is where an archive entry is read:
   *  - Beginner Corporation — the rules/training corp;
   *  - Delta Project — the Hydronetwork's board subsystem (`instantiate: false`;
   *    the track is shared from turn one and advanced by a standard action).
   * The module's real cards (DP02+) are covered normally.
   */
  const NEVER_DEALT = new Set<CardName>([CardName.BEGINNER_CORPORATION, CardName.DELTA_PROJECT]);

  function loreTextFor(card: ClientCard, seen = new Set<CardName>()): string | undefined {
    if (seen.has(card.name)) {
      return undefined;
    }
    seen.add(card.name);

    const cardNumber = card.metadata.cardNumber;
    const ownLore = cardNumber === undefined ? undefined : LORE_BY_CARD_NUMBER[cardNumber];
    if (typeof ownLore === 'string' && ownLore.trim() !== '') {
      return ownLore;
    }

    const reimplements = card.metadata.reimplements;
    return reimplements === undefined ? undefined : loreTextFor(getCardOrThrow(reimplements), seen);
  }

  it('every lore text ends with terminal punctuation', () => {
    const missingPunctuation = Object.entries(LORE_BY_CARD_NUMBER)
      .filter(([, text]) => !/[.!?…]$/.test(text.trim()))
      .map(([cardNumber]) => cardNumber);
    expect(missingPunctuation, `lore texts without terminal punctuation:\n${missingPunctuation.join('\n')}`).to.deep.eq([]);
  });

  it('every in-scope project, prelude, and corporation has non-empty lore text', () => {
    const cards = getCards((c) =>
      SCOPE.has(c.module) &&
      LORE_CARD_TYPES.has(c.type) &&
      !NEVER_DEALT.has(c.name),
    );
    expect(cards.length).to.be.greaterThan(490);
    const cardsByNumber = new Map<string, Array<string>>();
    for (const card of cards) {
      const cardNumber = card.metadata.cardNumber;
      if (cardNumber === undefined) {
        continue;
      }
      const names = cardsByNumber.get(cardNumber) ?? [];
      names.push(card.name);
      cardsByNumber.set(cardNumber, names);
    }
    const duplicateNumbers = [...cardsByNumber]
      .filter(([, names]) => names.length > 1)
      .map(([cardNumber, names]) => `${cardNumber}: ${names.join(', ')}`);
    expect(duplicateNumbers, `in-scope cards with duplicate card numbers:\n${duplicateNumbers.join('\n')}`).to.deep.eq([]);

    const missing: Array<string> = [];
    for (const card of cards) {
      const cardNumber = card.metadata.cardNumber;
      const loreText = loreTextFor(card);
      if (typeof loreText !== 'string' || loreText.trim() === '') {
        missing.push(`${card.name} (${card.type}, ${cardNumber ?? 'no card number'})`);
      }
    }
    expect(missing, `in-scope cards without lore text:\n${missing.join('\n')}`).to.deep.eq([]);
  });
});

describe('CEO premium face (desktop-removal wave 4)', () => {
  const ceoCards = () => getCards((c) => c.type === CardType.CEO);

  it('builds the CEO VM: ceo theme, no cost badge, no resource capsule', () => {
    const vm = vmOf(CardName.ASIMOV);
    expect(vm.theme).to.eq('ceo');
    expect(vm.cost, 'a CEO has no play cost — never print a cost badge').to.eq(undefined);
    expect(vm.resource).to.eq(undefined);
  });

  it('the prose zone carries the printed rule (description IS the rule on this type)', () => {
    const vm = vmOf(CardName.ASIMOV);
    expect(vm.prose).to.contain('Once per game, draw 10-X awards');
    // non-CEO types stay icons-only — no prose zone
    expect(vmOf(CardName.COMET).prose).to.eq(undefined);
    expect(vmOf(CardName.HELION).prose).to.eq(undefined);
  });

  it('a CEO without a description falls back to its dropped plainText (Xavier)', () => {
    const vm = vmOf(CardName.XAVIER);
    expect(vm.prose).to.eq('Once per game, gain 2 wild tags for THIS GENERATION.');
  });

  it('printedLayout: authored order survives (Xavier: the OPG row stays ABOVE its post-action effect)', () => {
    const groups = vmOf(CardName.XAVIER).mechanics.groups;
    expect(groups.length).to.eq(2);
    const hasOpg = (g: (typeof groups)[number]) => g.nodes.some((n) =>
      n !== undefined && typeof n !== 'string' && isICardRenderItem(n) && n.type === CardRenderItemType.ARROW_OPG);
    expect(hasOpg(groups[0]), 'the once-per-game row reads first, as printed').to.eq(true);
    expect(groups[1].kind, 'the «AFTER this action» effect reads below it').to.eq('effect');
  });

  it('a CEO face has NO on-play zone — the play rail must never brand an OPG row «при розыгрыше»', () => {
    for (const card of ceoCards()) {
      const mech = buildPremiumCardViewModel(card).mechanics;
      expect(mech.playStart, `${card.name}: playStart must equal groups.length`).to.eq(mech.groups.length);
    }
    // …while a canonical face keeps its play zone (Comet's row IS on-play).
    const comet = vmOf(CardName.COMET).mechanics;
    expect(comet.playStart).to.be.lessThan(comet.groups.length);
  });

  it('every CEO builds a premium VM with extractable mechanics', () => {
    const cards = ceoCards();
    expect(cards.length).to.be.greaterThan(35); // the L-deck (38 CEOs)
    const textOnly: Array<string> = [];
    for (const card of cards) {
      if (buildPremiumCardViewModel(card).mechanics.textOnly) {
        textOnly.push(card.name);
      }
    }
    expect(textOnly, `CEOs without extractable mechanics:\n${textOnly.join('\n')}`).to.deep.eq([]);
  });

  // WORKLIST GUARD — a CEO face may only skip the prose zone when its whole
  // rule lives in effect frames (Gordon, Van Allen — the legacy face printed
  // no description for them either). A NEW CEO arriving without a
  // description and with non-effect rows would say LESS than the legacy
  // face — it fails here by name.
  it('every CEO with non-effect mechanics carries prose', () => {
    const offenders: Array<string> = [];
    for (const card of ceoCards()) {
      const vm = buildPremiumCardViewModel(card);
      if (vm.prose === undefined && vm.mechanics.groups.some((g) => g.kind !== 'effect' && g.kind !== 'corp-effect')) {
        offenders.push(card.name);
      }
    }
    expect(offenders, `CEOs missing their rule prose:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('Duncan (the one VP CEO) resolves the «?» badge', () => {
    const vp = vmOf(CardName.DUNCAN).vp;
    expect(vp?.kind).to.eq('dynamic');
    if (vp?.kind === 'dynamic') {
      expect(vp.relation).to.eq('variable');
    }
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
    // vpText fine print are KEPT. CEO faces drop plainText the same way
    // (Xavier) — their rule prose renders in the DEDICATED `vm.prose` zone,
    // never baked into the mechanics rows.
    const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'ceo', 'deltaProject']);
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
