/*
 * CARD INFORMATION GENERATOR (build-time, chained into make:cards).
 *
 * Builds the structured `CardInformation` for every in-scope card from the
 * CANONICAL sources — never by parsing prose at runtime:
 *
 *   requirements      ← CardRequirementDescriptor[] (template texts; the
 *                       descriptors also drive the requirements bar, so the
 *                       text can never drift from the graphic);
 *   immediate         ← the executable `behavior` (texts with baked numbers
 *                       — generated text can never lie about the rules);
 *                       bespoke cards fall back to the curated registry or
 *                       a seeded single block from the (requirement-stripped)
 *                       printed description;
 *   effects / actions ← the render-DSL effect/action nodes' co-located
 *                       descriptions (already localized in ru/cards.json;
 *                       the 'Effect: '/'Action: ' prefix is display-stripped
 *                       by the client, per the established fork pattern);
 *   victory points    ← the vpText node when present (canonical printed
 *                       wording), else generated from the countable shape;
 *                       plain numeric VP produces NO block (self-explanatory
 *                       badge, per the task).
 *
 * Graphic linkage: content-derived row ids from the SHARED
 * `deriveGraphicIds` (common/cards/render/cardGraphicIds.ts) — the client
 * renderer resolves the same ids from the same renderData.
 *
 * Outputs (written by writeCardInfoArtifacts):
 *   - `information` attached to each exported ClientCard's metadata;
 *   - src/locales/ru/card_info.json — generated ru for generated texts;
 *   - src/genfiles/cardInfoAudit.json — the per-card audit matrix.
 */

import * as fs from 'fs';
import {ICard} from '../../cards/ICard';
import {GameModule} from '../../../common/cards/GameModule';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';
import {CardInformation, CardInfoBlock, CardInfoGroup} from '../../../common/cards/CardInformation';
import {CardRequirementDescriptor, requirementType} from '../../../common/cards/CardRequirementDescriptor';
import {RequirementType} from '../../../common/cards/RequirementType';
import {deriveGraphicIds, GraphicBlockRef} from '../../../common/cards/render/cardGraphicIds';
import {isICardRenderEffect, isICardRenderItem, isICardRenderRoot, ItemType} from '../../../common/cards/render/Types';
import {CardRenderItemType} from '../../../common/cards/render/CardRenderItemType';
import {Size} from '../../../common/cards/render/Size';
import {Behavior} from '../../behavior/Behavior';
import {CURATED_CARD_INFO, CURATED_SPECIAL_VP, MANUAL_RU} from './curatedCardInfo';
import {
  plural, quantGen, ruResourceAcc, ruResourceProdGen, ruCardResourceAcc, ruTagGen,
  TAG_WORD_QGEN, OCEAN_TILE_QGEN, CITY_TILE_QGEN, GREENERY_TILE_QGEN, COLONY_QGEN,
  FLOATER_QGEN, RESOURCE_TYPE_QGEN, CARD_ACC,
} from './ruText';

const SCOPE_MODULES: ReadonlySet<GameModule> = new Set(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);
const SCOPE_TYPES: ReadonlySet<CardType> = new Set([CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT, CardType.PRELUDE]);

/* ── collectors ─────────────────────────────────────────────────────── */

type AuditEntry = {
  name: string;
  module: GameModule;
  type: CardType;
  status: 'ok' | 'curated' | 'seeded' | 'needs-curation';
  blocks: number;
  requirementBlocks: number;
  unlinkedBlocks: Array<string>;
  notes: Array<string>;
};

const ruPairs = new Map<string, string>();
const missingRu = new Set<string>();
const audit: Array<AuditEntry> = [];
let existingRuKeys: Set<string> | undefined;

function loadExistingRuKeys(): Set<string> {
  if (existingRuKeys === undefined) {
    existingRuKeys = new Set<string>();
    const dir = 'src/locales/ru';
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json') || file === 'card_info.json') {
        continue;
      }
      const json = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'));
      for (const key of Object.keys(json)) {
        existingRuKeys.add(key);
      }
    }
  }
  return existingRuKeys;
}

/** Register a generated en→ru pair (skipped when the key is already translated elsewhere). */
function t(en: string, ru: string): string {
  if (!loadExistingRuKeys().has(en)) {
    ruPairs.set(en, ru);
  }
  return en;
}

/** Register a DSL-sourced key (must already exist in ru; audited otherwise). */
function existing(en: string): string {
  if (!loadExistingRuKeys().has(en) && !ruPairs.has(en)) {
    if (MANUAL_RU[en] !== undefined) {
      ruPairs.set(en, MANUAL_RU[en]);
    } else {
      missingRu.add(en);
    }
  }
  return en;
}

/* ── requirement blocks ─────────────────────────────────────────────── */

const EN_RESOURCE: Readonly<Record<Resource, [string, string]>> = {
  [Resource.MEGACREDITS]: ['M€', 'M€'],
  [Resource.STEEL]: ['steel', 'steel'],
  [Resource.TITANIUM]: ['titanium', 'titanium'],
  [Resource.PLANTS]: ['plant', 'plants'],
  [Resource.ENERGY]: ['energy', 'energy'],
  [Resource.HEAT]: ['heat', 'heat'],
};

function enCount(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function requirementBlock(descriptor: CardRequirementDescriptor, dup: number, notes: Array<string>): CardInfoBlock | undefined {
  const type = requirementType(descriptor);
  const max = descriptor.max === true;
  const anyPlayer = descriptor.all === true;
  const suffixEn = anyPlayer ? ' (any player).' : '.';
  const suffixRu = anyPlayer ? ' (у любых игроков).' : '.';
  let en: string;
  let ru: string;
  let qualifier = '';

  switch (type) {
  case RequirementType.OXYGEN: {
    const v = descriptor.oxygen ?? 0;
    en = max ? `Requires an oxygen level of at most ${v}%.` : `Requires an oxygen level of at least ${v}%.`;
    ru = max ? `Требуется уровень кислорода не более ${v}%.` : `Требуется уровень кислорода не менее ${v}%.`;
    break;
  }
  case RequirementType.TEMPERATURE: {
    const v = descriptor.temperature ?? 0;
    en = max ? `Requires a temperature of at most ${v}°C.` : `Requires a temperature of at least ${v}°C.`;
    ru = max ? `Требуется температура не выше ${v} °C.` : `Требуется температура не ниже ${v} °C.`;
    break;
  }
  case RequirementType.VENUS: {
    const v = descriptor.venus ?? 0;
    en = max ? `Requires Venus terraforming of at most ${v}%.` : `Requires Venus terraforming of at least ${v}%.`;
    ru = max ? `Требуется терраформирование Венеры не более ${v}%.` : `Требуется терраформирование Венеры не менее ${v}%.`;
    break;
  }
  case RequirementType.TR: {
    const v = descriptor.tr ?? 0;
    en = max ? `Requires a terraform rating of at most ${v}.` : `Requires a terraform rating of at least ${v}.`;
    ru = max ? `Требуется РТ не более ${v}.` : `Требуется РТ не менее ${v}.`;
    break;
  }
  case RequirementType.OCEANS: {
    const n = descriptor.oceans ?? descriptor.count ?? 1;
    en = max ? `Requires at most ${enCount(n, 'ocean tile', 'ocean tiles')}${suffixEn}` : `Requires at least ${enCount(n, 'ocean tile', 'ocean tiles')}${suffixEn}`;
    ru = `${max ? 'Требуется не более' : 'Требуется не менее'} ${n} ${quantGen(n, OCEAN_TILE_QGEN)}${suffixRu}`;
    break;
  }
  case RequirementType.TAG: {
    const tag = descriptor.tag as Tag;
    const n = descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, `${tag} tag`, `${tag} tags`)}${suffixEn}`;
    ru = `Требуется не менее ${n} ${quantGen(n, TAG_WORD_QGEN)} ${ruTagGen(tag)}${suffixRu}`;
    qualifier = `:${tag}`;
    break;
  }
  case RequirementType.PRODUCTION: {
    const res = descriptor.production as Resource;
    const n = descriptor.count ?? 1;
    en = `Requires ${EN_RESOURCE[res][1]} production of at least ${n}.`;
    ru = `Требуется производство ${ruResourceProdGen(res)} не менее ${n}.`;
    qualifier = `:${res}`;
    break;
  }
  case RequirementType.CITIES: {
    const n = descriptor.cities ?? descriptor.count ?? 1;
    if (descriptor.nextTo === true) {
      notes.push('requirement-nextTo: verify wording');
      en = `Requires at least ${enCount(n, 'city tile', 'city tiles')} adjacent${suffixEn}`;
      ru = `Требуется не менее ${n} ${quantGen(n, CITY_TILE_QGEN)} по соседству${suffixRu}`;
    } else {
      en = `Requires at least ${enCount(n, 'city tile', 'city tiles')}${suffixEn}`;
      ru = `Требуется не менее ${n} ${quantGen(n, CITY_TILE_QGEN)}${suffixRu}`;
    }
    break;
  }
  case RequirementType.GREENERIES: {
    const n = descriptor.greeneries ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'greenery tile', 'greenery tiles')}${suffixEn}`;
    ru = `Требуется не менее ${n} ${quantGen(n, GREENERY_TILE_QGEN)}${suffixRu}`;
    break;
  }
  case RequirementType.COLONIES: {
    const n = descriptor.colonies ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'colony', 'colonies')}${suffixEn}`;
    ru = `Требуется не менее ${n} ${quantGen(n, COLONY_QGEN)}${suffixRu}`;
    break;
  }
  case RequirementType.FLOATERS: {
    const n = descriptor.floaters ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'floater', 'floaters')}.`;
    ru = `Требуется не менее ${n} ${quantGen(n, FLOATER_QGEN)}.`;
    break;
  }
  case RequirementType.RESOURCE_TYPES: {
    const n = descriptor.resourceTypes ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'resource type', 'resource types')}.`;
    ru = `Требуется не менее ${n} ${quantGen(n, RESOURCE_TYPE_QGEN)}.`;
    break;
  }
  case RequirementType.REMOVED_PLANTS: {
    en = 'Requires that plants were removed from any player this generation.';
    ru = 'Требуется, чтобы в этом поколении у любого игрока были удалены растения.';
    break;
  }
  default:
    notes.push(`requirement type '${type}' not templated`);
    return undefined;
  }

  return {
    id: `req:${type}${qualifier}${dup > 1 ? `~${dup}` : ''}`,
    kind: 'requirement',
    text: t(en, ru),
    graphicId: `req:${type}${qualifier}${dup > 1 ? `~${dup}` : ''}`,
  };
}

/* ── immediate blocks from behavior ─────────────────────────────────── */

type Pending = {block: CardInfoBlock, tokens: ReadonlyArray<string>};

function enResourceCount(res: Resource, n: number): string {
  const [one, many] = EN_RESOURCE[res];
  return `${n} ${n === 1 ? one : many}`;
}

function enCardResource(res: CardResource, n: number): string {
  const noun = res.toLowerCase();
  return n === 1 ? noun : (noun.endsWith('s') ? noun : `${noun}s`);
}

function behaviorBlocks(card: ICard, notes: Array<string>): Array<Pending> | undefined {
  const b: Behavior | undefined = (card as {behavior?: Behavior}).behavior;
  if (b === undefined) {
    return undefined;
  }
  const out: Array<Pending> = [];
  let complex = false;
  const push = (id: string, en: string, ru: string, tokens: ReadonlyArray<string>) => {
    out.push({block: {id: `mech:${id}`, kind: 'immediate', text: t(en, ru)}, tokens});
  };
  const numeric = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

  if (b.spend !== undefined) {
    for (const [key, raw] of Object.entries(b.spend)) {
      const n = numeric(raw);
      const res = key as Resource;
      if (n === undefined || EN_RESOURCE[res] === undefined) {
        complex = true;
        continue;
      }
      push(`spend.${key}`, `Spend ${enResourceCount(res, n)}.`, `Потратьте ${n} ${ruResourceAcc(res, n)}.`, [key]);
    }
  }
  if (b.production !== undefined) {
    for (const [key, raw] of Object.entries(b.production)) {
      const n = numeric(raw);
      const res = key as Resource;
      if (n === undefined || n === 0 || EN_RESOURCE[res] === undefined) {
        if (n === undefined) {
          complex = true;
          notes.push(`production.${key} is countable`);
        }
        continue;
      }
      const steps = Math.abs(n);
      const stepsEn = steps === 1 ? '1 step' : `${steps} steps`;
      if (n > 0) {
        push(`production.${key}`,
          `Increase your ${EN_RESOURCE[res][1]} production ${stepsEn}.`,
          `Увеличьте своё производство ${ruResourceProdGen(res)} на ${steps}.`,
          [`production(${key}`, 'production(']);
      } else {
        push(`production.${key}`,
          `Decrease your ${EN_RESOURCE[res][1]} production ${stepsEn}.`,
          `Уменьшите своё производство ${ruResourceProdGen(res)} на ${steps}.`,
          [`production(${key}`, 'production(']);
      }
    }
  }
  if (b.stock !== undefined) {
    for (const [key, raw] of Object.entries(b.stock)) {
      const n = numeric(raw);
      const res = key as Resource;
      if (n === undefined || n === 0 || EN_RESOURCE[res] === undefined) {
        if (n === undefined) {
          complex = true;
          notes.push(`stock.${key} is countable`);
        }
        continue;
      }
      if (n > 0) {
        push(`stock.${key}`, `Gain ${enResourceCount(res, n)}.`, `Получите ${n} ${ruResourceAcc(res, n)}.`, [key]);
      } else {
        push(`stock.${key}`, `Lose ${enResourceCount(res, -n)}.`, `Потеряйте ${-n} ${ruResourceAcc(res, -n)}.`, [key]);
      }
    }
  }
  if (b.standardResource !== undefined) {
    const n = typeof b.standardResource === 'number' ? b.standardResource : b.standardResource.count;
    const same = typeof b.standardResource === 'object' && b.standardResource.same === true;
    const enTail = same ? ' (all of the same kind)' : '';
    const ruTail = same ? ' (одного вида)' : '';
    const word = plural(n, ['стандартный ресурс', 'стандартных ресурса', 'стандартных ресурсов']);
    push('standardResource',
      `Gain ${n} standard ${n === 1 ? 'resource' : 'resources'} of your choice${enTail}.`,
      `Получите ${n} ${word} на выбор${ruTail}.`, ['wild']);
  }
  if (b.tr !== undefined) {
    const n = numeric(b.tr);
    if (n === undefined) {
      complex = true;
      notes.push('tr is countable');
    } else if (n !== 0) {
      if (n > 0) {
        push('tr', `Gain ${n} TR.`, `Получите ${n} РТ.`, ['tr']);
      } else {
        push('tr', `Lose ${-n} TR.`, `Потеряйте ${-n} РТ.`, ['tr']);
      }
    }
  }
  if (b.global !== undefined) {
    const g = b.global;
    if (g.temperature !== undefined) {
      push('global.temperature',
        `Raise the temperature ${g.temperature === 1 ? '1 step' : `${g.temperature} steps`}.`,
        `Повысьте температуру на ${g.temperature}.`, ['temperature']);
    }
    if (g.oxygen !== undefined) {
      push('global.oxygen',
        `Raise the oxygen level ${g.oxygen === 1 ? '1 step' : `${g.oxygen} steps`}.`,
        `Повысьте уровень кислорода на ${g.oxygen}.`, ['oxygen']);
    }
    if (g.venus !== undefined) {
      push('global.venus',
        `Raise Venus ${g.venus === 1 ? '1 step' : `${g.venus} steps`}.`,
        `Повысьте Венеру на ${g.venus}.`, ['venus']);
    }
  }
  if (b.ocean !== undefined) {
    push('tile.ocean', 'Place an ocean tile.', 'Разместите тайл океана.', ['oceans', 'tile-ocean']);
  }
  if (b.city !== undefined) {
    push('tile.city', 'Place a city tile.', 'Разместите тайл города.', ['city', 'tile-city']);
  }
  if (b.greenery !== undefined) {
    push('tile.greenery', 'Place a greenery tile.', 'Разместите тайл озеленения.', ['greenery', 'tile-greenery']);
  }
  if (b.tile !== undefined) {
    push('tile.special', 'Place a special tile.', 'Разместите особый тайл.', ['tile-']);
  }
  if (b.drawCard !== undefined) {
    if (typeof b.drawCard === 'number') {
      push('drawCard',
        `Draw ${b.drawCard === 1 ? '1 card' : `${b.drawCard} cards`}.`,
        `Возьмите ${b.drawCard} ${plural(b.drawCard, CARD_ACC)}.`, ['cards']);
    } else {
      complex = true;
      notes.push('drawCard is structured (keep/pay/filter)');
    }
  }
  if (b.addResources !== undefined) {
    const n = numeric(b.addResources);
    const res = card.resourceType;
    if (n === undefined || res === undefined) {
      complex = true;
      notes.push('addResources is countable / no resourceType');
    } else {
      push('addResources',
        `Add ${n} ${enCardResource(res, n)} to this card.`,
        `Добавьте ${n} ${ruCardResourceAcc(res, n)} на эту карту.`,
        [`res-${res.toLowerCase().replaceAll(' ', '-')}`]);
    }
  }
  if (b.addResourcesToAnyCard !== undefined) {
    const list = Array.isArray(b.addResourcesToAnyCard) ? b.addResourcesToAnyCard : [b.addResourcesToAnyCard];
    list.forEach((entry, i) => {
      const n = numeric(entry.count);
      const res = entry.type;
      if (n === undefined || res === undefined) {
        complex = true;
        notes.push('addResourcesToAnyCard entry is complex');
        return;
      }
      const tagEn = entry.tag !== undefined ? ` ${entry.tag}` : '';
      const tagRu = entry.tag !== undefined ? ` с меткой ${ruTagGen(entry.tag)}` : '';
      push(`addToAny.${i}`,
        `Add ${n} ${enCardResource(res, n)} to any${tagEn} card.`,
        `Добавьте ${n} ${ruCardResourceAcc(res, n)} на любую карту${tagRu}.`,
        [`res-${res.toLowerCase().replaceAll(' ', '-')}`]);
    });
  }
  if (b.removeAnyPlants !== undefined) {
    const n = b.removeAnyPlants;
    push('removeAnyPlants',
      `Remove up to ${n} plants from any player.`,
      `Удалите до ${n} ${plural(n, ['растения', 'растений', 'растений'])} у любого игрока.`, ['plants']);
  }
  if (b.decreaseAnyProduction !== undefined) {
    const {type, count} = b.decreaseAnyProduction;
    const n = numeric(count) ?? 1;
    push('decreaseAnyProduction',
      `Decrease any ${EN_RESOURCE[type][1]} production ${n === 1 ? '1 step' : `${n} steps`}.`,
      `Уменьшите производство ${ruResourceProdGen(type)} любого игрока на ${n}.`,
      [`production(${type}`, 'production(']);
  }
  if (b.colonies !== undefined) {
    if (b.colonies.buildColony !== undefined) {
      push('colonies.build', 'Place a colony.', 'Постройте колонию.', ['colonies']);
    }
    if (b.colonies.addTradeFleet !== undefined) {
      push('colonies.fleet', 'Gain a trade fleet.', 'Получите торговый флот.', ['trade_fleet']);
    }
  }
  if (b.or !== undefined) {
    complex = true;
    notes.push('behavior.or (choice) — needs curation');
  }
  if (b.turmoil !== undefined || b.moon !== undefined || b.underworld !== undefined) {
    complex = true;
    notes.push('out-of-scope expansion behavior keys present');
  }

  if (complex) {
    notes.push('behavior-partial');
  }
  return out;
}

/* ── DSL effect/action + vpText extraction ──────────────────────────── */

function effectDescriptionOf(row: ReadonlyArray<ItemType>): string | undefined {
  // The effect node's co-located description is the trailing string of rows[2].
  for (const node of row) {
    if (node !== undefined && typeof node !== 'string' && isICardRenderEffect(node)) {
      const tail = node.rows[2] ?? [];
      for (let i = tail.length - 1; i >= 0; i--) {
        const item = tail[i];
        if (typeof item === 'string' && item.length > 0) {
          return item;
        }
      }
    }
  }
  return undefined;
}

function findVpText(card: ICard): string | undefined {
  const root = card.metadata.renderData;
  if (root === undefined || !isICardRenderRoot(root)) {
    return undefined;
  }
  for (const row of root.rows) {
    for (const node of row) {
      if (node !== undefined && typeof node !== 'string' && isICardRenderItem(node) &&
          node.type === CardRenderItemType.TEXT &&
          node.size === Size.TINY && node.isUppercase === true &&
          node.text !== undefined) {
        return node.text;
      }
    }
  }
  return undefined;
}

/* ── description seeding (bespoke fallback) ─────────────────────────── */

function descriptionText(card: ICard): string | undefined {
  const d = card.metadata.description;
  if (d === undefined) {
    return undefined;
  }
  return typeof d === 'string' ? d : d.text;
}

const REQUIREMENT_SENTENCE = /^(Requires?|It must|Oxygen must|Temperature must|Venus must|Must have)([^.]*\.|[^.]*$)\s*/;

function stripRequirementSentences(text: string, hasRequirements: boolean): string {
  if (!hasRequirements) {
    return text;
  }
  let out = text;
  while (REQUIREMENT_SENTENCE.test(out)) {
    out = out.replace(REQUIREMENT_SENTENCE, '');
  }
  return out.trim();
}

/* ── the per-card builder ───────────────────────────────────────────── */

export function buildCardInformation(card: ICard, module: GameModule): CardInformation | undefined {
  if (!SCOPE_MODULES.has(module) || !SCOPE_TYPES.has(card.type)) {
    return undefined;
  }
  const notes: Array<string> = [];
  const groups: Array<CardInfoGroup> = [];
  const graphics = deriveGraphicIds(card.metadata.renderData);
  const unlinked: Array<string> = [];

  /* requirements */
  const requirements = card.requirements ?? [];
  const reqBlocks: Array<CardInfoBlock> = [];
  const reqSeen = new Map<string, number>();
  for (let i = 0; i < requirements.length; i++) {
    const descriptor = requirements[i];
    // A `cities {nextTo}` + `oceans` PAIR is ONE indivisible condition
    // («a city adjacent to an ocean») drawn as one composite graphic —
    // one composite block, not two misleading halves.
    const next = requirements[i + 1];
    if (descriptor.cities !== undefined && descriptor.nextTo === true &&
        next !== undefined && next.oceans !== undefined) {
      const any = descriptor.all === true;
      reqBlocks.push({
        id: 'req:city-next-to-ocean',
        kind: 'requirement',
        text: t(
          any ? 'Requires a city tile (any player) adjacent to an ocean.' : 'Requires that you have a city tile adjacent to an ocean.',
          any ? 'Требуется тайл города (любого игрока) рядом с океаном.' : 'Требуется ваш тайл города рядом с океаном.'),
        graphicId: 'req:city-next-to-ocean',
      });
      i++; // consume the oceans half
      continue;
    }
    const type = requirementType(descriptor);
    const n = (reqSeen.get(type) ?? 0) + 1;
    reqSeen.set(type, n);
    const block = requirementBlock(descriptor, n, notes);
    if (block !== undefined) {
      reqBlocks.push(block);
    }
  }
  if (reqBlocks.length > 0) {
    groups.push({kind: 'requirements', id: 'requirements', blocks: reqBlocks});
  }

  /* immediate mechanics */
  let status: AuditEntry['status'] = 'ok';
  const curated = CURATED_CARD_INFO[card.name];
  let immediate: Array<CardInfoBlock> = [];
  const curatedGroups: Array<CardInfoGroup> = [];
  if (curated !== undefined) {
    status = 'curated';
    curated.blocks.forEach((entry, i) => {
      const kind = entry.kind ?? 'immediate';
      const block: CardInfoBlock = {
        id: `mech:curated.${i}`,
        kind,
        text: t(entry.en, entry.ru),
        graphicId: entry.tokens !== undefined ? matchGraphic(graphics, entry.tokens) : undefined,
      };
      // Ongoing rules drawn as raw rows (no effect node) get their own group.
      if (kind === 'effect' || kind === 'action') {
        curatedGroups.push({kind, id: `curated:${kind}:${i}`, blocks: [block]});
      } else {
        immediate.push(block);
      }
    });
  } else {
    const pending = behaviorBlocks(card, notes);
    const hasBespoke = hasBespokePlay(card);
    if (pending !== undefined && pending.length > 0 && !hasBespoke && !notes.includes('behavior-partial')) {
      immediate = pending.map((p) => ({
        ...p.block,
        graphicId: matchGraphic(graphics, p.tokens),
      }));
    } else if (pending !== undefined && pending.length > 0) {
      // Declarative part + a bespoke remainder → keep the canonical blocks,
      // flag for curation (the bespoke part is not yet described).
      immediate = pending.map((p) => ({...p.block, graphicId: matchGraphic(graphics, p.tokens)}));
      status = 'needs-curation';
    } else {
      // Fully bespoke — seed a single block from the printed description
      // (requirement sentences stripped: they live in requirement blocks).
      // Text-only rows (the vpText fine print) are NOT mechanic graphics.
      const mechRows = graphics.filter((g) => g.kind === 'row' && !g.tokens.every((token) => token === 'text' || token === 'plate'));
      const description = descriptionText(card);
      const cleaned = description === undefined ? '' : stripRequirementSentences(description, requirements.length > 0);
      if (cleaned.length > 0) {
        immediate = [{
          id: 'mech:description',
          kind: 'immediate',
          text: existing(cleaned),
          graphicId: mechRows.length === 1 ? mechRows[0].id : undefined,
        }];
        status = mechRows.length <= 1 ? 'seeded' : 'needs-curation';
      } else if (mechRows.length > 0) {
        status = 'needs-curation';
        notes.push('no text source for graphic rows');
      }
    }
  }
  if (immediate.length > 0) {
    groups.push({kind: 'immediate', id: 'immediate', blocks: immediate});
  }
  groups.push(...curatedGroups);
  for (const block of [...immediate, ...curatedGroups.flatMap((g) => g.blocks)]) {
    if (block.graphicId === undefined && block.kind !== 'note') {
      unlinked.push(block.id);
    }
  }

  /* effects & actions from the DSL nodes */
  const root = card.metadata.renderData;
  if (root !== undefined && isICardRenderRoot(root)) {
    const described = new Set(graphics
      .filter((g) => (g.kind === 'effect' || g.kind === 'action') && effectDescriptionOf(root.rows[g.rowIndex]) !== undefined)
      .map((g) => g.kind));
    for (const ref of graphics) {
      if (ref.kind !== 'effect' && ref.kind !== 'action') {
        continue;
      }
      const description = effectDescriptionOf(root.rows[ref.rowIndex]);
      if (description === undefined) {
        // A description-less node whose SIBLING of the same kind carries the
        // text is a multi-row drawing of ONE mechanic (Titan Floating
        // Launch-pad) — silently part of the described group.
        if (!described.has(ref.kind)) {
          notes.push(`no co-located description for ${ref.id}`);
        }
        continue;
      }
      groups.push({
        kind: ref.kind,
        id: ref.id,
        blocks: [{
          id: `${ref.kind}:${ref.id.slice(2)}`,
          kind: ref.kind,
          text: existing(description),
          graphicId: ref.id,
        }],
      });
    }
  }

  /* special victory points */
  const vp = card.victoryPoints;
  if (vp !== undefined && typeof vp !== 'number') {
    const vpText = findVpText(card);
    let text: string | undefined;
    if (vpText !== undefined) {
      text = existing(vpText);
    } else if (vp === 'special') {
      const curatedVp = CURATED_SPECIAL_VP[card.name];
      if (curatedVp !== undefined) {
        text = t(curatedVp.en, curatedVp.ru);
      } else {
        notes.push('special VP without vpText or curated text');
      }
    } else if (typeof vp === 'object' && 'resourcesHere' in vp && card.resourceType !== undefined) {
      // The one countable shape without a printed vpText — generate it.
      const per = (vp as {per?: number}).per ?? 1;
      const res = card.resourceType;
      if (per === 1) {
        text = t(`1 VP for each ${enCardResource(res, 1)} on this card.`,
          `1 ПО за ${ruVpEach(res)} на этой карте.`);
      } else {
        text = t(`1 VP per ${per} ${enCardResource(res, per)} on this card.`,
          `1 ПО за каждые ${per} ${ruCardResourceAcc(res, per)} на этой карте.`);
      }
    } else {
      notes.push('countable VP without vpText — add a curated VP text');
    }
    if (text !== undefined) {
      groups.push({
        kind: 'victory-points',
        id: 'vp',
        blocks: [{id: 'vp', kind: 'victory-points', text, graphicId: 'vp'}],
      });
    }
  }

  audit.push({
    name: card.name,
    module,
    type: card.type,
    status,
    blocks: groups.reduce((acc, g) => acc + g.blocks.length, 0),
    requirementBlocks: reqBlocks.length,
    unlinkedBlocks: unlinked,
    notes,
  });

  return groups.length > 0 ? {groups} : undefined;
}

/** «за каждое животное / каждую бактерию / каждый астероид» — gendered EACH forms. */
const RU_VP_EACH: Partial<Record<CardResource, string>> = {
  [CardResource.ANIMAL]: 'каждое животное',
  [CardResource.MICROBE]: 'каждую бактерию',
  [CardResource.SCIENCE]: 'каждый жетон науки',
  [CardResource.FLOATER]: 'каждый аэростат',
  [CardResource.ASTEROID]: 'каждый астероид',
  [CardResource.FIGHTER]: 'каждый истребитель',
  [CardResource.CAMP]: 'каждый лагерь',
  [CardResource.DISEASE]: 'каждую болезнь',
  [CardResource.PRESERVATION]: 'каждый жетон сохранения',
  [CardResource.HYDROELECTRIC_RESOURCE]: 'каждый гидроресурс',
};

function ruVpEach(resource: CardResource): string {
  return RU_VP_EACH[resource] ?? `каждый ресурс (${resource})`;
}

function hasBespokePlay(card: ICard): boolean {
  const proto = Object.getPrototypeOf(card);
  return typeof proto.bespokePlay === 'function' && proto.bespokePlay !== Object.getPrototypeOf(proto).bespokePlay &&
    Object.prototype.hasOwnProperty.call(proto, 'bespokePlay');
}

function matchGraphic(graphics: ReadonlyArray<GraphicBlockRef>, tokens: ReadonlyArray<string>): string | undefined {
  for (const ref of graphics) {
    if (ref.kind !== 'row') {
      continue;
    }
    for (const wanted of tokens) {
      if (ref.tokens.some((have) => have === wanted || have.startsWith(wanted))) {
        return ref.id;
      }
    }
  }
  return undefined;
}

/* ── artifacts ──────────────────────────────────────────────────────── */

export function writeCardInfoArtifacts(): void {
  const sortedRu = Object.fromEntries([...ruPairs.entries()].sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync('src/locales/ru/card_info.json', JSON.stringify(sortedRu, null, 2) + '\n');

  const summary = {
    total: audit.length,
    byStatus: audit.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    requirementBlocks: audit.reduce((acc, e) => acc + e.requirementBlocks, 0),
    totalBlocks: audit.reduce((acc, e) => acc + e.blocks, 0),
    cardsWithUnlinkedBlocks: audit.filter((e) => e.unlinkedBlocks.length > 0).map((e) => e.name),
    missingRu: [...missingRu].sort(),
    needsCuration: audit.filter((e) => e.status === 'needs-curation').map((e) => e.name),
    seeded: audit.filter((e) => e.status === 'seeded').map((e) => e.name),
  };
  fs.writeFileSync('src/genfiles/cardInfoAudit.json', JSON.stringify({summary, cards: audit}, null, 1) + '\n');
  console.log(`card info: ${audit.length} cards, ${summary.totalBlocks} blocks ` +
    `(${summary.requirementBlocks} requirements); status: ${JSON.stringify(summary.byStatus)}; ` +
    `missing ru: ${summary.missingRu.length}; needs curation: ${summary.needsCuration.length}`);
}
