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
 *                       bespoke cards declare CO-LOCATED texts in their own
 *                       file (`metadata.infoText`) or fall back to a seeded
 *                       single block from the (requirement-stripped)
 *                       printed description;
 *   effects / actions ← the render-DSL effect/action nodes' co-located
 *                       descriptions (the 'Effect: '/'Action: ' prefix is
 *                       display-stripped by the client, per the established
 *                       fork pattern);
 *   victory points    ← a `victory-points` infoText entry, else the vpText
 *                       node (canonical printed wording), else generated
 *                       from the countable shape; plain numeric VP produces
 *                       NO block (self-explanatory badge).
 *
 * LOCALIZATION PRINCIPLE: every text this generator emits (and every
 * `infoText` a card file declares) is ENGLISH ONLY — the text IS the i18n
 * key. Translations live exclusively in the locale jsons
 * (src/locales/<lang>/card_info.json for generated/authored keys; the DSL
 * strings are already in <lang>/cards.json). The generator only VALIDATES
 * coverage for the enforced locales and reports gaps in the audit — adding
 * a new language never touches this code.
 *
 * Graphic linkage: content-derived row ids from the SHARED
 * `deriveGraphicIds` (common/cards/render/cardGraphicIds.ts) — the client
 * renderer resolves the same ids from the same renderData.
 *
 * Outputs (written by writeCardInfoArtifacts):
 *   - `information` attached to each exported ClientCard's metadata;
 *   - src/genfiles/cardInfoAudit.json — the per-card audit matrix
 *     (`needsCuration` + `missingTranslations` are the worklists).
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
import {deriveGraphicIds, nodeGraphicToken, GraphicBlockRef} from '../../../common/cards/render/cardGraphicIds';
import {isICardRenderEffect, isICardRenderItem, isICardRenderRoot, ItemType} from '../../../common/cards/render/Types';
import {CardRenderItemType} from '../../../common/cards/render/CardRenderItemType';
import {Size} from '../../../common/cards/render/Size';
import {Behavior} from '../../behavior/Behavior';

const SCOPE_MODULES: ReadonlySet<GameModule> = new Set(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
const SCOPE_TYPES: ReadonlySet<CardType> = new Set([CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT, CardType.PRELUDE]);

/** Locales whose card-information coverage is ENFORCED (audited). */
const ENFORCED_LOCALES: ReadonlyArray<string> = ['ru'];

/* ── collectors ─────────────────────────────────────────────────────── */

type AuditEntry = {
  name: string;
  module: GameModule;
  type: CardType;
  status: 'ok' | 'authored' | 'seeded' | 'needs-curation';
  blocks: number;
  requirementBlocks: number;
  unlinkedBlocks: Array<string>;
  notes: Array<string>;
};

const usedKeys = new Set<string>();
const audit: Array<AuditEntry> = [];
const localeKeys = new Map<string, Set<string>>();

function keysOfLocale(lang: string): Set<string> {
  let keys = localeKeys.get(lang);
  if (keys === undefined) {
    keys = new Set<string>();
    const dir = `src/locales/${lang}`;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const json = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'));
      for (const key of Object.keys(json)) {
        keys.add(key);
      }
    }
    localeKeys.set(lang, keys);
  }
  return keys;
}

/** Register an emitted English key (coverage is validated per enforced locale). */
function key(en: string): string {
  usedKeys.add(en);
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
  const suffix = descriptor.all === true ? ' (any player).' : '.';
  let en: string;
  let qualifier = '';

  switch (type) {
  case RequirementType.OXYGEN: {
    const v = descriptor.oxygen ?? 0;
    en = max ? `Requires an oxygen level of at most ${v}%.` : `Requires an oxygen level of at least ${v}%.`;
    break;
  }
  case RequirementType.TEMPERATURE: {
    const v = descriptor.temperature ?? 0;
    en = max ? `Requires a temperature of at most ${v}°C.` : `Requires a temperature of at least ${v}°C.`;
    break;
  }
  case RequirementType.VENUS: {
    const v = descriptor.venus ?? 0;
    en = max ? `Requires Venus terraforming of at most ${v}%.` : `Requires Venus terraforming of at least ${v}%.`;
    break;
  }
  case RequirementType.TR: {
    const v = descriptor.tr ?? 0;
    en = max ? `Requires a terraform rating of at most ${v}.` : `Requires a terraform rating of at least ${v}.`;
    break;
  }
  case RequirementType.OCEANS: {
    const n = descriptor.oceans ?? descriptor.count ?? 1;
    en = `${max ? 'Requires at most' : 'Requires at least'} ${enCount(n, 'ocean tile', 'ocean tiles')}${suffix}`;
    break;
  }
  case RequirementType.TAG: {
    const tag = descriptor.tag as Tag;
    const n = descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, `${tag} tag`, `${tag} tags`)}${suffix}`;
    qualifier = `:${tag}`;
    break;
  }
  case RequirementType.PRODUCTION: {
    const res = descriptor.production as Resource;
    const n = descriptor.count ?? 1;
    en = `Requires ${EN_RESOURCE[res][1]} production of at least ${n}.`;
    qualifier = `:${res}`;
    break;
  }
  case RequirementType.CITIES: {
    const n = descriptor.cities ?? descriptor.count ?? 1;
    if (descriptor.nextTo === true) {
      notes.push('requirement-nextTo: verify wording');
      en = `Requires at least ${enCount(n, 'city tile', 'city tiles')} adjacent${suffix}`;
    } else {
      en = `Requires at least ${enCount(n, 'city tile', 'city tiles')}${suffix}`;
    }
    break;
  }
  case RequirementType.GREENERIES: {
    const n = descriptor.greeneries ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'greenery tile', 'greenery tiles')}${suffix}`;
    break;
  }
  case RequirementType.COLONIES: {
    const n = descriptor.colonies ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'colony', 'colonies')}${suffix}`;
    break;
  }
  case RequirementType.FLOATERS: {
    const n = descriptor.floaters ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'floater', 'floaters')}.`;
    break;
  }
  case RequirementType.RESOURCE_TYPES: {
    const n = descriptor.resourceTypes ?? descriptor.count ?? 1;
    en = `Requires at least ${enCount(n, 'resource type', 'resource types')}.`;
    break;
  }
  case RequirementType.REMOVED_PLANTS: {
    en = 'Requires that plants were removed from any player this generation.';
    break;
  }
  default:
    notes.push(`requirement type '${type}' not templated`);
    return undefined;
  }

  return {
    id: `req:${type}${qualifier}${dup > 1 ? `~${dup}` : ''}`,
    kind: 'requirement',
    text: key(en),
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
  const push = (id: string, en: string, tokens: ReadonlyArray<string>) => {
    out.push({block: {id: `mech:${id}`, kind: 'immediate', text: key(en)}, tokens});
  };
  const numeric = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

  if (b.spend !== undefined) {
    for (const [k, raw] of Object.entries(b.spend)) {
      const n = numeric(raw);
      const res = k as Resource;
      if (n === undefined || EN_RESOURCE[res] === undefined) {
        complex = true;
        continue;
      }
      push(`spend.${k}`, `Spend ${enResourceCount(res, n)}.`, [k]);
    }
  }
  if (b.production !== undefined) {
    for (const [k, raw] of Object.entries(b.production)) {
      const n = numeric(raw);
      const res = k as Resource;
      if (n === undefined || n === 0 || EN_RESOURCE[res] === undefined) {
        if (n === undefined) {
          complex = true;
          notes.push(`production.${k} is countable`);
        }
        continue;
      }
      const steps = Math.abs(n) === 1 ? '1 step' : `${Math.abs(n)} steps`;
      push(`production.${k}`,
        n > 0 ? `Increase your ${EN_RESOURCE[res][1]} production ${steps}.` : `Decrease your ${EN_RESOURCE[res][1]} production ${steps}.`,
        [`production(${k}`, 'production(']);
    }
  }
  if (b.stock !== undefined) {
    for (const [k, raw] of Object.entries(b.stock)) {
      const n = numeric(raw);
      const res = k as Resource;
      if (n === undefined || n === 0 || EN_RESOURCE[res] === undefined) {
        if (n === undefined) {
          complex = true;
          notes.push(`stock.${k} is countable`);
        }
        continue;
      }
      push(`stock.${k}`, n > 0 ? `Gain ${enResourceCount(res, n)}.` : `Lose ${enResourceCount(res, -n)}.`, [k]);
    }
  }
  if (b.standardResource !== undefined) {
    const n = typeof b.standardResource === 'number' ? b.standardResource : b.standardResource.count;
    const same = typeof b.standardResource === 'object' && b.standardResource.same === true;
    push('standardResource',
      `Gain ${n} standard ${n === 1 ? 'resource' : 'resources'} of your choice${same ? ' (all of the same kind)' : ''}.`,
      ['wild']);
  }
  if (b.tr !== undefined) {
    const n = numeric(b.tr);
    if (n === undefined) {
      complex = true;
      notes.push('tr is countable');
    } else if (n !== 0) {
      push('tr', n > 0 ? `Gain ${n} TR.` : `Lose ${-n} TR.`, ['tr']);
    }
  }
  if (b.global !== undefined) {
    const g = b.global;
    if (g.temperature !== undefined) {
      push('global.temperature', `Raise the temperature ${g.temperature === 1 ? '1 step' : `${g.temperature} steps`}.`, ['temperature']);
    }
    if (g.oxygen !== undefined) {
      push('global.oxygen', `Raise the oxygen level ${g.oxygen === 1 ? '1 step' : `${g.oxygen} steps`}.`, ['oxygen']);
    }
    if (g.venus !== undefined) {
      push('global.venus', `Raise Venus ${g.venus === 1 ? '1 step' : `${g.venus} steps`}.`, ['venus']);
    }
  }
  if (b.ocean !== undefined) {
    push('tile.ocean', 'Place an ocean tile.', ['oceans', 'tile-ocean']);
  }
  if (b.city !== undefined) {
    push('tile.city', 'Place a city tile.', ['city', 'tile-city']);
  }
  if (b.greenery !== undefined) {
    push('tile.greenery', 'Place a greenery tile.', ['greenery', 'tile-greenery']);
  }
  if (b.tile !== undefined) {
    push('tile.special', 'Place a special tile.', ['tile-']);
  }
  if (b.drawCard !== undefined) {
    if (typeof b.drawCard === 'number') {
      push('drawCard', `Draw ${b.drawCard === 1 ? '1 card' : `${b.drawCard} cards`}.`, ['cards']);
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
      push('addResources', `Add ${n} ${enCardResource(res, n)} to this card.`, [`res-${res.toLowerCase().replaceAll(' ', '-')}`]);
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
      const tag = entry.tag !== undefined ? ` ${entry.tag}` : '';
      push(`addToAny.${i}`, `Add ${n} ${enCardResource(res, n)} to any${tag} card.`, [`res-${res.toLowerCase().replaceAll(' ', '-')}`]);
    });
  }
  if (b.removeAnyPlants !== undefined) {
    push('removeAnyPlants', `Remove up to ${b.removeAnyPlants} plants from any player.`, ['plants']);
  }
  if (b.decreaseAnyProduction !== undefined) {
    const {type, count} = b.decreaseAnyProduction;
    const n = numeric(count) ?? 1;
    push('decreaseAnyProduction',
      `Decrease any ${EN_RESOURCE[type][1]} production ${n === 1 ? '1 step' : `${n} steps`}.`,
      [`production(${type}`, 'production(']);
  }
  if (b.colonies !== undefined) {
    if (b.colonies.buildColony !== undefined) {
      push('colonies.build', 'Place a colony.', ['colonies']);
    }
    if (b.colonies.addTradeFleet !== undefined) {
      push('colonies.fleet', 'Gain a trade fleet.', ['trade_fleet']);
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
      reqBlocks.push({
        id: 'req:city-next-to-ocean',
        kind: 'requirement',
        text: key(descriptor.all === true ?
          'Requires a city tile (any player) adjacent to an ocean.' :
          'Requires that you have a city tile adjacent to an ocean.'),
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
  const authored = card.metadata.infoText;
  let vpTextOverride: string | undefined;
  let immediate: Array<CardInfoBlock> = [];
  const authoredGroups: Array<CardInfoGroup> = [];
  if (authored !== undefined) {
    status = 'authored';
    authored.forEach((entry, i) => {
      const kind = entry.kind ?? 'immediate';
      if (kind === 'victory-points') {
        vpTextOverride = entry.text;
        return;
      }
      const match = entry.tokens !== undefined ? matchGraphic(graphics, entry.tokens, card.metadata.renderData) : {};
      const block: CardInfoBlock = {
        id: `mech:authored.${i}`,
        kind,
        text: key(entry.text),
        ...match,
      };
      // Ongoing rules drawn as raw rows (no effect node) get their own group.
      if (kind === 'effect' || kind === 'action') {
        authoredGroups.push({kind, id: `authored:${kind}:${i}`, blocks: [block]});
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
        ...matchGraphic(graphics, p.tokens, card.metadata.renderData),
      }));
    } else if (pending !== undefined && pending.length > 0) {
      // Declarative part + a bespoke remainder → keep the canonical blocks,
      // flag for curation (the bespoke part is not yet described).
      immediate = pending.map((p) => ({...p.block, ...matchGraphic(graphics, p.tokens, card.metadata.renderData)}));
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
          text: key(cleaned),
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
  groups.push(...authoredGroups);
  for (const block of [...immediate, ...authoredGroups.flatMap((g) => g.blocks)]) {
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
          text: key(description),
          graphicId: ref.id,
        }],
      });
    }
  }

  /* special victory points */
  const vp = card.victoryPoints;
  if (vp !== undefined && typeof vp !== 'number') {
    const vpText = vpTextOverride ?? findVpText(card);
    let text: string | undefined;
    if (vpText !== undefined) {
      text = key(vpText);
    } else if (typeof vp === 'object' && 'resourcesHere' in vp && card.resourceType !== undefined) {
      // The one countable shape without a printed vpText — generate it.
      const per = (vp as {per?: number}).per ?? 1;
      const res = card.resourceType;
      text = key(per === 1 ?
        `1 VP for each ${enCardResource(res, 1)} on this card.` :
        `1 VP per ${per} ${enCardResource(res, per)} on this card.`);
    } else {
      notes.push('special/countable VP without a text source — author a victory-points infoText');
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

function hasBespokePlay(card: ICard): boolean {
  const proto = Object.getPrototypeOf(card);
  return typeof proto.bespokePlay === 'function' &&
    Object.prototype.hasOwnProperty.call(proto, 'bespokePlay');
}

type GraphicMatch = {graphicId?: string, graphicNode?: string};

/**
 * Match a block's wanted tokens to a graphic ROW, and — within it — to the
 * EXACT top-level node that produced the matching token (`graphicNode`, via
 * the shared `nodeGraphicToken` derivation). The node is what the fullscreen
 * annotation layer tethers to: a row hosting several mechanics gives each
 * block its own semantic anchor instead of one ambiguous section anchor.
 */
function matchGraphic(graphics: ReadonlyArray<GraphicBlockRef>, tokens: ReadonlyArray<string>, renderData: ICard['metadata']['renderData']): GraphicMatch {
  const root = renderData !== undefined && isICardRenderRoot(renderData) ? renderData : undefined;
  for (const ref of graphics) {
    if (ref.kind !== 'row') {
      continue;
    }
    for (const wanted of tokens) {
      if (ref.tokens.some((have) => have === wanted || have.startsWith(wanted))) {
        return {graphicId: ref.id, graphicNode: matchRowNode(root?.rows[ref.rowIndex], wanted)};
      }
    }
  }
  return {};
}

/** The first row node whose token matches — same rule as the row match. */
function matchRowNode(row: ReadonlyArray<ItemType> | undefined, wanted: string): string | undefined {
  if (row === undefined) {
    return undefined;
  }
  for (const node of row) {
    const token = nodeGraphicToken(node);
    if (token !== undefined && (token === wanted || token.startsWith(wanted))) {
      return token;
    }
  }
  return undefined;
}

/* ── artifacts ──────────────────────────────────────────────────────── */

export function writeCardInfoArtifacts(): void {
  // LOCALIZATION VALIDATION only — the generator never writes locale files.
  const missingTranslations: Record<string, Array<string>> = {};
  for (const lang of ENFORCED_LOCALES) {
    const keys = keysOfLocale(lang);
    const missing = [...usedKeys].filter((k) => !keys.has(k)).sort();
    if (missing.length > 0) {
      missingTranslations[lang] = missing;
    }
  }

  const summary = {
    total: audit.length,
    byStatus: audit.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    requirementBlocks: audit.reduce((acc, e) => acc + e.requirementBlocks, 0),
    totalBlocks: audit.reduce((acc, e) => acc + e.blocks, 0),
    cardsWithUnlinkedBlocks: audit.filter((e) => e.unlinkedBlocks.length > 0).map((e) => e.name),
    missingTranslations,
    needsCuration: audit.filter((e) => e.status === 'needs-curation').map((e) => e.name),
    seeded: audit.filter((e) => e.status === 'seeded').map((e) => e.name),
  };
  fs.writeFileSync('src/genfiles/cardInfoAudit.json', JSON.stringify({summary, cards: audit}, null, 1) + '\n');
  const missingCount = Object.values(missingTranslations).reduce((acc, list) => acc + list.length, 0);
  console.log(`card info: ${audit.length} cards, ${summary.totalBlocks} blocks ` +
    `(${summary.requirementBlocks} requirements); status: ${JSON.stringify(summary.byStatus)}; ` +
    `missing translations: ${missingCount}; needs curation: ${summary.needsCuration.length}`);
}
