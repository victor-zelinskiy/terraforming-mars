/*
 * PREMIUM CARD VIEW-MODEL — the pure normalization layer between the domain
 * (static `ClientCard` manifest + live `CardModel` state) and the premium
 * face components. NO Vue, NO DOM, NO i18n imports — unit-testable under the
 * server mocha runner; translation-dependent bits (title tier, aria label)
 * are computed in the components from the raw pieces this VM provides.
 *
 * Chain:  CardModel + ClientCard  →  buildPremiumCardViewModel  →  PremiumCard.vue
 */

import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {GameModule} from '@/common/cards/GameModule';
import {Tag} from '@/common/cards/Tag';
import {PartyName} from '@/common/turmoil/PartyName';
import {CardRequirementDescriptor, requirementType} from '@/common/cards/CardRequirementDescriptor';
import {RequirementType} from '@/common/cards/RequirementType';
import {CardRenderDynamicVictoryPoints} from '@/common/cards/render/CardRenderDynamicVictoryPoints';
import {ICardRenderItem} from '@/common/cards/render/Types';
import {premiumCardArt, PremiumCardArt} from '@/client/cards/cardArt';
import {PremiumTheme, premiumThemeFor} from './premiumCardTheme';
import {buildMechanics, collectDroppedProse, MechanicsVM} from './mechanicsModel';
import {tagClusterPlan, TagClusterPlan} from './tagLayout';
import {standardResourceIconUrl, tagIconUrl} from './premiumCardIcons';

export type PremiumCostVM = {
  printed: number;
  effective: number;
  /** effective − printed; negative = discount chip («−4»), positive = surcharge. */
  delta: number;
};

export type NormalizedRequirement = {
  type: RequirementType;
  comparator: 'min' | 'max';
  value: number;
  suffix: '' | '%' | '°C';
  /** Resolved icon asset URL (undefined → the text label carries the meaning). */
  iconUrl?: string;
  tag?: Tag;
  party?: PartyName;
  /** Binary requirements (party / chairman / plants-removed) draw no number. */
  isBinary: boolean;
  /** «minus» overlay for the plants-removed requirement. */
  negation: boolean;
  /** Red accent — the requirement counts ALL players. */
  all: boolean;
  /** Fallback label when no icon exists (exotic expansion requirements). */
  label?: string;
};

/**
 * How a dynamic VP badge relates its NUMBER to its SUBJECT — the one thing a
 * player must never have to guess from adjacency alone («1 [jovian]» reads as
 * «one jovian tag» just as easily as «1 VP per jovian tag»). Derived ONCE
 * here from the printed render data; the badge renders the relation, it never
 * re-derives it.
 *
 *   per         — `points` VP for every `per` units of `item`
 *                 → «N / [icon]» (per one) · «N / K [icon]» (per K)
 *   conditional — `points` VP if the card holds AT LEAST ONE `item`
 *                 (Search for Life) → «[icon] : N» — a flat amount, NOT a rate
 *   variable    — a bespoke rule decides the amount (Agricola Inc, Red City,
 *                 Duncan) → «?»
 *   plain       — a flat amount with no subject on the badge (Law Suit's −1
 *                 taken from any player) → «N»
 */
export type PremiumVpRelation = 'per' | 'conditional' | 'variable' | 'plain';

export type PremiumVpVM =
  | {kind: 'fixed', value: number}
  | {kind: 'dynamic', relation: PremiumVpRelation, points: number, per: number,
     target: number, item?: ICardRenderItem,
     asterisk: boolean, anyPlayer: boolean, targetOneOrMore: boolean, asFraction: boolean}
  | {kind: 'vermin'};

/**
 * The VP badge's SIZE variant — drives both the badge's own proportions and
 * the mechanics panel's bottom-right safe reserve (`pcard--vp-<variant>`).
 * Deterministic from the VM (never DOM-measured), and keyed to the WIDEST
 * content each class can print:
 *   compact — a bare number or «?» («2», «−1»);
 *   wide    — one operator: «N / [icon]»;
 *   formula — two operands around the operator: «N / K [icon]»,
 *             «[icon] : N» (one-or-more) and the Vermin special.
 * The reserve each class buys is tuned in premium_card.less — read the note
 * there before changing these buckets.
 */
export type PremiumVpVariant = 'compact' | 'wide' | 'formula';

export function vpVariantOf(vp: PremiumVpVM): PremiumVpVariant {
  if (vp.kind === 'fixed') {
    return 'compact';
  }
  if (vp.kind === 'vermin') {
    return 'formula';
  }
  switch (vp.relation) {
  case 'plain':
  case 'variable':
    // Nothing but a numeral / «?» — the same footprint as a fixed amount.
    return 'compact';
  case 'conditional':
    return 'formula';
  case 'per':
    return vp.per > 1 || vp.asterisk ? 'formula' : 'wide';
  }
}

export type PremiumCardVM = {
  name: CardName;
  slug: string;
  type: CardType;
  theme: PremiumTheme;
  /** English name — the render layer translates (and derives the title tier). */
  title: string;
  cost?: PremiumCostVM;
  tags: ReadonlyArray<Tag>;
  tagCluster: TagClusterPlan;
  requirements: ReadonlyArray<NormalizedRequirement>;
  /** Undefined only for a corporation with NO real art (its identity zone hosts the wordmark instead). */
  art?: PremiumCardArt;
  mechanics: MechanicsVM;
  vp?: PremiumVpVM;
  /** The expansion medallion. 'automa' is the MarsBot pseudo-module — the
   *  bot corporations' own stamp (see marsBotCorpPremiumVm.ts). */
  expansion: GameModule | 'automa';
  compatibility: ReadonlyArray<GameModule>;
  /** The bottom resource capsule. `iconUrl` overrides the CardResource icon
   *  for a token outside the card-resource families (the Ecoline bot
   *  corporation stores PLANTS — a standard resource — on its card). */
  resource?: {type: CardResource, amount: number, isSrr: boolean, iconUrl?: string};
  /**
   * The PROSE RULE zone (CEO faces only) — the one deliberate exception to
   * the icons-only face. A CEO's `metadata.description` IS the rule (the
   * render row only sketches it: `opgArrow()` + an asterisk), so the face
   * prints it under the mechanics. English text (an i18n key) — the render
   * layer translates and picks the length tier. Falls back to the render
   * data's dropped `plainText` prose (Xavier authors its rule that way), so
   * this face can never say less than the legacy one it replaces.
   */
  prose?: string;
};

/**
 * Types whose face prints the M€ cost badge. STANDARD_PROJECT declares a REAL
 * printed cost (`StandardProjectCard` requires one — Sell Patents' honest «0»
 * included). STANDARD_ACTION does NOT: its constructor takes no cost at all,
 * and the `cost: 0` the client manifest carries is only the server `Card.cost`
 * getter's default — a badge there would print a phantom «0» on Convert
 * Plants / Convert Heat, whose real price is plants/heat in the graphic.
 */
const COSTED_TYPES: ReadonlyArray<CardType> = [CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT, CardType.STANDARD_PROJECT];

function slugOf(name: CardName): string {
  return name.toLowerCase().replaceAll(' ', '-');
}

/**
 * Art for the face. Projects/preludes ALWAYS resolve (the shared fallback is
 * baked in, so the reserved art viewport is never an empty frame). A
 * CORPORATION or a CEO resolves ONLY to REAL per-card art — when it has
 * none, art is undefined so PremiumCard renders that type's own identity
 * zone instead: the corp brand wordmark (PremiumCorpIdentity), or the CEO's
 * procedural executive band (`.pcard-ceo-ident` — no CEO ships art today,
 * so the band is the INTENDED face of the whole type, not a degradation).
 */
function resolveArt(name: CardName, identityZoneType: boolean): PremiumCardArt | undefined {
  const art = premiumCardArt(name);
  return identityZoneType && art.fallback ? undefined : art;
}

function buildCost(clientCard: ClientCard, model: CardModel | undefined): PremiumCostVM | undefined {
  if (!COSTED_TYPES.includes(clientCard.type) || clientCard.cost === undefined) {
    return undefined;
  }
  const printed = clientCard.cost;
  const effective = model?.calculatedCost ?? printed;
  return {printed, effective, delta: effective - printed};
}

function buildTags(clientCard: ClientCard, model: CardModel | undefined): Array<Tag> {
  const tags = clientCard.tags.map((tag) =>
    (tag === Tag.CLONE && model?.cloneTag !== undefined) ? model.cloneTag : tag);
  if (clientCard.type === CardType.EVENT) {
    tags.push(Tag.EVENT);
  }
  return tags;
}

const GLOBALS = 'assets/global-parameters';
const TILES = 'assets/tiles';
const RES = 'assets/resources';
const MISC = 'assets/misc';

type RequirementRender = {value: (d: CardRequirementDescriptor) => number, iconUrl?: string, suffix?: '%' | '°C', binary?: boolean, label?: string};

const REQUIREMENT_RENDER: Partial<Record<RequirementType, RequirementRender>> = {
  [RequirementType.OXYGEN]: {value: (d) => d.oxygen ?? 0, iconUrl: `${GLOBALS}/oxygen.png`, suffix: '%'},
  [RequirementType.TEMPERATURE]: {value: (d) => d.temperature ?? 0, iconUrl: `${GLOBALS}/temperature.png`, suffix: '°C'},
  [RequirementType.VENUS]: {value: (d) => d.venus ?? 0, iconUrl: `${GLOBALS}/venus.png`, suffix: '%'},
  [RequirementType.OCEANS]: {value: (d) => d.oceans ?? d.count ?? 1, iconUrl: `${TILES}/ocean.png`},
  [RequirementType.TR]: {value: (d) => d.tr ?? 0, iconUrl: `${RES}/tr.png`},
  [RequirementType.GREENERIES]: {value: (d) => d.greeneries ?? d.count ?? 1, iconUrl: `${TILES}/greenery_no_O2.png`},
  [RequirementType.CITIES]: {value: (d) => d.cities ?? d.count ?? 1, iconUrl: `${TILES}/city.png`},
  [RequirementType.COLONIES]: {value: (d) => d.colonies ?? d.count ?? 1, iconUrl: `${TILES}/colony.png`},
  [RequirementType.FLOATERS]: {value: (d) => d.floaters ?? d.count ?? 1, iconUrl: `${RES}/floater.png`},
  [RequirementType.RESOURCE_TYPES]: {value: (d) => d.resourceTypes ?? d.count ?? 1, iconUrl: `${RES}/wild.png`},
  [RequirementType.TAG]: {value: (d) => d.count ?? 1},
  [RequirementType.PRODUCTION]: {value: (d) => d.count ?? 1},
  [RequirementType.REMOVED_PLANTS]: {value: () => 0, iconUrl: `${RES}/plant.png`, binary: true},
  [RequirementType.PARTY]: {value: () => 0, binary: true},
  [RequirementType.CHAIRMAN]: {value: () => 0, iconUrl: `${MISC}/chairman.png`, binary: true},
  [RequirementType.PARTY_LEADERS]: {value: (d) => d.partyLeader ?? d.count ?? 1, iconUrl: `${MISC}/delegate.png`},
  // Hydronetwork track progress (Dutch Mountains): the module's own medallion
  // is the ONE established glyph of the track — the same mark the DP cards
  // carry in their expansion corner, so «[Гидросеть] ≥ 4» reads as track
  // progress and can never be mistaken for an energy price or an action count.
  [RequirementType.DELTA_POSITION]: {value: (d) => d.deltaPosition ?? d.count ?? 1, iconUrl: 'assets/expansion_icons/expansion_icon_deltaProject.png'},
};

export function normalizeRequirement(descriptor: CardRequirementDescriptor): NormalizedRequirement {
  const type = requirementType(descriptor);
  const render = REQUIREMENT_RENDER[type];
  let iconUrl = render?.iconUrl;
  if (type === RequirementType.TAG && descriptor.tag !== undefined) {
    iconUrl = tagIconUrl(descriptor.tag);
  }
  if (type === RequirementType.PRODUCTION && descriptor.production !== undefined) {
    iconUrl = standardResourceIconUrl(descriptor.production);
  }
  // Exotic requirement with neither an icon nor a bespoke branch → keep the
  // meaning as a text label (never silently dropped).
  const label = (render === undefined) ? type : (descriptor.text ?? undefined);
  return {
    type,
    comparator: descriptor.max === true ? 'max' : 'min',
    value: render?.value(descriptor) ?? descriptor.count ?? 1,
    suffix: render?.suffix ?? '',
    iconUrl,
    tag: descriptor.tag,
    party: descriptor.party,
    isBinary: render?.binary === true,
    negation: type === RequirementType.REMOVED_PLANTS,
    all: descriptor.all === true,
    label,
  };
}

/**
 * Classify a printed dynamic-VP block into its REAL rule shape.
 *
 * `CardRenderDynamicVictoryPoints` is a render record, not a semantic one:
 * `target` doubles as both «the denominator» and, for the per-one builders,
 * a copy of `points` (`DynamicVictoryPoints.moonMiningTile` / `.any` set
 * `target = points`). The legacy face already collapsed exactly those two
 * shapes to «per one» (`target === points || target === 1`); this keeps the
 * same reading and simply names it.
 */
function vpRelationOf(dyn: CardRenderDynamicVictoryPoints): {relation: PremiumVpRelation, per: number} {
  // Search for Life: «3 VP if this card holds AT LEAST ONE science resource».
  // A flat amount behind a threshold — never a rate.
  if (dyn.targetOneOrMore === true) {
    return {relation: 'conditional', per: 1};
  }
  if (dyn.item === undefined) {
    // `DynamicVictoryPoints.questionmark()` — the amount is bespoke (counted
    // by the card's own getVictoryPoints), so the badge can only print «?».
    if (dyn.points === 0 && dyn.target === 0) {
      return {relation: 'variable', per: 1};
    }
    // A flat amount with no subject to divide by (Law Suit's «−1 from ANY player»).
    return {relation: 'plain', per: 1};
  }
  // A real denominator is a target that is BOTH greater than one AND distinct
  // from the amount — anything else is the per-one form.
  const per = dyn.target > 1 && dyn.target !== dyn.points ? dyn.target : 1;
  return {relation: 'per', per};
}

function buildVp(metadata: ClientCard['metadata']): PremiumVpVM | undefined {
  const vp = metadata.victoryPoints;
  if (vp === undefined) {
    return undefined;
  }
  if (typeof vp === 'number') {
    return {kind: 'fixed', value: vp};
  }
  const dyn: CardRenderDynamicVictoryPoints = vp;
  if (dyn.vermin === true) {
    return {kind: 'vermin'};
  }
  const {relation, per} = vpRelationOf(dyn);
  return {
    kind: 'dynamic',
    relation,
    per,
    points: dyn.points,
    target: dyn.target,
    item: dyn.item,
    asterisk: dyn.asterisk === true,
    anyPlayer: dyn.anyPlayer === true,
    targetOneOrMore: dyn.targetOneOrMore === true,
    asFraction: dyn.asFraction === true,
  };
}

function buildResource(clientCard: ClientCard, model: CardModel | undefined): PremiumCardVM['resource'] {
  const isSrr = model?.isSelfReplicatingRobotsCard === true;
  if (isSrr) {
    return {type: CardResource.RESOURCE_CUBE, amount: model?.resources ?? 0, isSrr: true};
  }
  if (clientCard.resourceType !== undefined) {
    return {type: clientCard.resourceType, amount: model?.resources ?? 0, isSrr: false};
  }
  return undefined;
}

/**
 * The CEO prose rule (see `PremiumCardVM.prose`): the printed description,
 * else the render data's own dropped `plainText` (Xavier). Other types keep
 * the icons-only face — their descriptions live in overlays / the info panel.
 */
function buildProse(clientCard: ClientCard): string | undefined {
  if (clientCard.type !== CardType.CEO) {
    return undefined;
  }
  const description = clientCard.metadata.description;
  const text = typeof description === 'string' ? description : description?.text;
  if (text !== undefined && text.trim() !== '') {
    return text;
  }
  return collectDroppedProse(clientCard.metadata.renderData);
}

/**
 * Build the premium face view-model.
 * `model` is optional — static proxies (console deal flyers) pass only the
 * manifest card and get the pristine printed face.
 */
export function buildPremiumCardViewModel(clientCard: ClientCard, model?: CardModel): PremiumCardVM {
  const theme = premiumThemeFor(clientCard.type);
  if (theme === undefined) {
    throw new Error(`buildPremiumCardViewModel: ${clientCard.name} (${clientCard.type}) is outside the premium face scope`);
  }
  const tags = buildTags(clientCard, model);
  const vp = buildVp(clientCard.metadata);
  const isCorporation = clientCard.type === CardType.CORPORATION;
  const isCeo = clientCard.type === CardType.CEO;
  return {
    name: clientCard.name,
    slug: slugOf(clientCard.name),
    type: clientCard.type,
    theme,
    title: clientCard.name,
    cost: buildCost(clientCard, model),
    tags,
    tagCluster: tagClusterPlan(tags.length),
    requirements: (clientCard.requirements ?? []).map(normalizeRequirement),
    // Projects/preludes always get an art viewport (fallback baked in);
    // corporations and CEOs show real art if they have it, else their own
    // identity zone (resolveArt returns undefined then — corp wordmark /
    // CEO executive band).
    art: resolveArt(clientCard.name, isCorporation || isCeo),
    // The printed VP fine print (vpText) leaves the FACE for dynamic-VP
    // cards — the rule is a card-information VP block now (the icons-only
    // face keeps the compact VP badge formula). CEO faces keep their
    // AUTHORED row order + no on-play zone (printedLayout).
    mechanics: buildMechanics(clientCard.metadata.renderData, {
      dropVpText: vp !== undefined && vp.kind !== 'fixed',
      printedLayout: isCeo,
    }),
    vp,
    expansion: clientCard.module,
    compatibility: clientCard.compatibility,
    resource: buildResource(clientCard, model),
    prose: buildProse(clientCard),
  };
}
