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
import {buildMechanics, MechanicsVM} from './mechanicsModel';
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

export type PremiumVpVM =
  | {kind: 'fixed', value: number}
  | {kind: 'dynamic', points: number, target: number, item?: ICardRenderItem,
     asterisk: boolean, anyPlayer: boolean, targetOneOrMore: boolean, asFraction: boolean}
  | {kind: 'vermin'};

/**
 * The VP badge's SIZE variant — drives both the badge's own proportions and
 * the mechanics panel's bottom-right safe reserve (`pcard--vp-<variant>`).
 * Deterministic from the VM (never DOM-measured):
 *   compact — a plain number («2», «−1»);
 *   wide    — a short «N[icon]» expression;
 *   formula — «N/M[icon]», one-or-more and the Vermin special.
 */
export type PremiumVpVariant = 'compact' | 'wide' | 'formula';

export function vpVariantOf(vp: PremiumVpVM): PremiumVpVariant {
  if (vp.kind === 'fixed') {
    return 'compact';
  }
  if (vp.kind === 'vermin') {
    return 'formula';
  }
  if (vp.target > 1 || vp.targetOneOrMore || vp.asterisk) {
    return 'formula';
  }
  return 'wide';
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
  /** Undefined for corporations — their identity zone hosts the wordmark logo, never art. */
  art?: PremiumCardArt;
  mechanics: MechanicsVM;
  vp?: PremiumVpVM;
  expansion: GameModule;
  compatibility: ReadonlyArray<GameModule>;
  resource?: {type: CardResource, amount: number, isSrr: boolean};
};

const PROJECT_TYPES: ReadonlyArray<CardType> = [CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT];

function slugOf(name: CardName): string {
  return name.toLowerCase().replaceAll(' ', '-');
}

function buildCost(clientCard: ClientCard, model: CardModel | undefined): PremiumCostVM | undefined {
  if (!PROJECT_TYPES.includes(clientCard.type) || clientCard.cost === undefined) {
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
  return {
    kind: 'dynamic',
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
    // Corporations have no card art by design — the identity zone renders the
    // existing wordmark logo (CardCorporationLogo) instead.
    art: isCorporation ? undefined : premiumCardArt(clientCard.name),
    // The printed VP fine print (vpText) leaves the FACE for dynamic-VP
    // cards — the rule is a card-information VP block now (the icons-only
    // face keeps the compact VP badge formula).
    mechanics: buildMechanics(clientCard.metadata.renderData, {dropVpText: vp !== undefined && vp.kind !== 'fixed'}),
    vp,
    expansion: clientCard.module,
    compatibility: clientCard.compatibility,
    resource: buildResource(clientCard, model),
  };
}
