import {BoardName} from '../../../common/boards/BoardName';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {BotTokenKind, MarsBotTrackRole, TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {MARSBOT_BOARDS, MarsBotMapProfile, marsBotMapProfile} from '../boards/MarsBotMapProfile';
import {BotCriterion, TrackRef} from './BotMARule';
import {botAwardRule, botMilestoneRule} from './botMAInterpreter';
import {libraryRows, rowDistance, rowKey} from './matRowLibrary';
import {MAT_ROLE_ORDER, matViolations} from './matLaw';

/**
 * THE MAT GENERATOR — `generateBotMat(context) → GeneratedMat` (docs/claude/marsbot-dynamic-ma-framework.md §3.3, the
 * prompt's § Генератор). A PURE, DETERMINISTIC function of its input: the game's milestone and award names, the map,
 * the expansions. No `Math.random`, no game state; the same input gives the same mat byte for byte.
 *
 * «Minimal edit of the proven»: the BASE is the map's own MarsBot board (a map without one — Hollandia — takes Tharsis,
 * as the A&M module tells it to); the set's criteria choose the TAG TOPOLOGY (which track the Jovian, City and Microbe
 * tags ride); rows are taken WHOLE from the ten static boards; the result must pass the law of the six boards
 * (`matLaw.ts`); a short, closed list of named micro-repairs keeps the set's own laws (no jump into a threshold).
 * Every step is written into the `MatReport`.
 */

/** Bumped whenever the generator's output for some input changes — a save keeps the mat it was dealt. */
export const MAT_GENERATOR_VERSION = 1;

type PairedRole = 'science' | 'power' | 'earth';

/** Which track each FLOATING tag rides (RB-C p.8 moves them from map to map; the rest never move). */
export type MatTopology = {
  readonly id: string;
  readonly jovian: PairedRole;
  readonly city: PairedRole;
  readonly microbe: 'bio' | 'science';
};

const FLOATING_ROLES: ReadonlyArray<PairedRole> = ['science', 'power', 'earth'];

function tagsOf(role: MarsBotTrackRole, t: MatTopology): Array<Tag> {
  const tags: Array<Tag> = [];
  switch (role) {
  case 'building': return [Tag.BUILDING];
  case 'space': return [Tag.SPACE];
  case 'event': return [Tag.EVENT];
  case 'venus': return [Tag.VENUS];
  case 'science': tags.push(Tag.SCIENCE); break;
  case 'power': tags.push(Tag.POWER); break;
  case 'earth': tags.push(Tag.EARTH); break;
  case 'bio': tags.push(Tag.PLANT, Tag.ANIMAL); break;
  }
  if (t.jovian === role) {
    tags.push(Tag.JOVIAN);
  }
  if (t.city === role) {
    tags.push(Tag.CITY);
  }
  if (t.microbe === role) {
    tags.push(Tag.MICROBE);
  }
  return tags;
}

/**
 * The topologies a mat may take: every assignment of the floating tags whose seven ROW KEYS the library actually
 * holds (a role + tag set no static board prints cannot be built from whole rows — earth alone, a triple science).
 * Ordered, so a tie is broken the same way every time.
 */
export const MAT_TOPOLOGIES: ReadonlyArray<MatTopology> = (() => {
  const out: Array<MatTopology> = [];
  for (const jovian of FLOATING_ROLES) {
    for (const city of FLOATING_ROLES) {
      for (const microbe of ['bio', 'science'] as const) {
        if (city === jovian) {
          continue;
        }
        const t: MatTopology = {id: `J:${jovian} C:${city} M:${microbe}`, jovian, city, microbe};
        if (MAT_ROLE_ORDER.every((role) => libraryRows(rowKey(role, tagsOf(role, t))).length > 0)) {
          out.push(t);
        }
      }
    }
  }
  return out;
})();

/** The topology a static board prints. */
export function topologyOf(tracks: ReadonlyArray<TrackDefinition>): MatTopology {
  const riding = (tag: Tag) => tracks.find((track) => track.tags.includes(tag))?.role;
  const id = `J:${riding(Tag.JOVIAN)} C:${riding(Tag.CITY)} M:${riding(Tag.MICROBE)}`;
  const found = MAT_TOPOLOGIES.find((t) => t.id === id);
  if (found === undefined) {
    throw new Error(`A static board with an unknown topology: ${id}`);
  }
  return found;
}

const PRODUCTION_ROLE: Record<Resource, MarsBotTrackRole> = {
  [Resource.MEGACREDITS]: 'event', [Resource.STEEL]: 'building', [Resource.TITANIUM]: 'space',
  [Resource.PLANTS]: 'bio', [Resource.ENERGY]: 'power', [Resource.HEAT]: 'earth',
};

/** The role a ref resolves to under a topology (undefined = a tag no track carries). */
export function roleOf(ref: TrackRef, t: MatTopology): MarsBotTrackRole | undefined {
  if ('role' in ref) {
    return ref.role;
  }
  if ('production' in ref) {
    return PRODUCTION_ROLE[ref.production];
  }
  return [...MAT_ROLE_ORDER, 'venus' as const].find((role) => tagsOf(role, t).includes(ref.tag));
}

/** The roles a criterion READS under a topology («every track» readings read none in particular). */
export function criterionRoles(criterion: BotCriterion, t: MatTopology): Array<MarsBotTrackRole> {
  const roles = new Set<MarsBotTrackRole>();
  const add = (ref: TrackRef) => {
    const role = roleOf(ref, t);
    if (role !== undefined) {
      roles.add(role);
    }
  };
  switch (criterion.kind) {
  case 'track':
    add(criterion.track);
    break;
  case 'tracks':
    if (typeof criterion.of !== 'string') {
      criterion.of.forEach(add);
    }
    break;
  case 'allOf':
    for (const part of criterion.of) {
      criterionRoles(part.criterion, t).forEach((r) => roles.add(r));
    }
    break;
  default:
    break;
  }
  return [...roles];
}

/** The floating tags a ref names (a tag-criterion's «own» tags — the rest of its track is noise). */
function ownTags(criterion: BotCriterion): Array<Tag> {
  const tags: Array<Tag> = [];
  const add = (ref: TrackRef) => {
    if ('tag' in ref) {
      tags.push(ref.tag);
    }
  };
  if (criterion.kind === 'track') {
    add(criterion.track);
  } else if (criterion.kind === 'tracks' && typeof criterion.of !== 'string') {
    criterion.of.forEach(add);
  }
  return tags;
}

const FLOATING_TAGS: ReadonlyArray<Tag> = [Tag.JOVIAN, Tag.CITY, Tag.MICROBE];

type SetRule = {name: string, kind: 'milestone' | 'award', criterion: BotCriterion, target?: number, pair?: readonly [Tag, Tag]};

function setRules(milestones: ReadonlyArray<string>, awards: ReadonlyArray<string>): Array<SetRule> {
  const rules: Array<SetRule> = [];
  for (const name of milestones) {
    const rule = botMilestoneRule(name);
    if (rule !== undefined) {
      rules.push({name, kind: 'milestone', criterion: rule.randomSetCriterion ?? rule.criterion,
        target: typeof rule.target === 'number' ? rule.target : undefined, pair: rule.pair});
    }
  }
  for (const name of awards) {
    const rule = botAwardRule(name);
    if (rule !== undefined) {
      rules.push({name, kind: 'award', criterion: rule.criterion});
    }
  }
  return rules;
}

/**
 * How badly a topology serves a set — the law of pairs (checklist §A): two criteria do not share a track if it can be
 * helped (two milestones: 10, anything else: 2 a pair), a tag criterion prefers a track carrying no OTHER floating tag
 * (1 a tag), a criterion's declared pairing is kept (3).
 */
export function topologyPenalty(rules: ReadonlyArray<SetRule>, t: MatTopology): {penalty: number, shares: Array<{role: MarsBotTrackRole, names: Array<string>}>} {
  const readers = new Map<MarsBotTrackRole, Array<SetRule>>();
  let penalty = 0;
  for (const rule of rules) {
    for (const role of criterionRoles(rule.criterion, t)) {
      readers.set(role, [...(readers.get(role) ?? []), rule]);
    }
    for (const tag of ownTags(rule.criterion)) {
      const role = roleOf({tag}, t);
      if (role !== undefined) {
        penalty += tagsOf(role, t).filter((other) => FLOATING_TAGS.includes(other) && !ownTags(rule.criterion).includes(other)).length;
      }
    }
    if (rule.pair !== undefined && roleOf({tag: rule.pair[0]}, t) !== roleOf({tag: rule.pair[1]}, t)) {
      penalty += 3;
    }
  }
  const shares: Array<{role: MarsBotTrackRole, names: Array<string>}> = [];
  for (const [role, list] of readers) {
    const m = list.filter((r) => r.kind === 'milestone').length;
    const a = list.length - m;
    penalty += (m * (m - 1) / 2) * 10 + (m * a + a * (a - 1) / 2) * 2;
    if (list.length > 1) {
      shares.push({role, names: list.map((r) => r.name)});
    }
  }
  return {penalty, shares};
}

type Assembly = {
  readonly tracks: ReadonlyArray<TrackDefinition>;
  readonly sources: ReadonlyArray<BoardName>;
  readonly rowsReplaced: number;
  readonly distance: number;
};

const assemblies = new Map<string, Assembly | undefined>();

function* combos<T>(lists: ReadonlyArray<ReadonlyArray<T>>): Generator<Array<T>> {
  if (lists.length === 0) {
    yield [];
    return;
  }
  for (const head of lists[0]) {
    for (const rest of combos(lists.slice(1))) {
      yield [head, ...rest];
    }
  }
}

/**
 * The lawful mat closest to the base under a topology, from WHOLE library rows — cached per (base, topology): the set
 * does not change which rows fit. Phase A keeps every row whose key the topology does not change; phase B (an era
 * mismatch — Tharsis' old Venus icons beside a v1.16 row) lets every role pick its nearest lawful row.
 */
function assemble(base: MarsBotMapProfile, t: MatTopology): Assembly | undefined {
  const cacheKey = `${base.boardName}|${t.id}`;
  if (assemblies.has(cacheKey)) {
    return assemblies.get(cacheKey);
  }
  const candidatesFor = (phase: 'A' | 'B') => MAT_ROLE_ORDER.map((role, i) => {
    const baseRow = base.tracks[i];
    const key = rowKey(role, tagsOf(role, t));
    const rows = [...libraryRows(key)].sort((a, b) => rowDistance(a.definition, baseRow) - rowDistance(b.definition, baseRow));
    const baseFits = rowKey(baseRow.role, baseRow.tags) === key;
    if (baseFits && phase === 'A') {
      return [{definition: baseRow, board: base.boardName}];
    }
    const list = rows.map((r) => ({definition: r.definition, board: r.boards[0]}));
    if (baseFits) {
      list.unshift({definition: baseRow, board: base.boardName});
    }
    return list.filter((r, k) => list.findIndex((o) => o.definition === r.definition) === k).slice(0, phase === 'A' ? 4 : 3);
  });
  let best: Assembly | undefined;
  for (const phase of ['A', 'B'] as const) {
    const all = [...combos(candidatesFor(phase))]
      .map((rows) => ({rows, distance: rows.reduce((d, r, i) => d + rowDistance(r.definition, base.tracks[i]), 0)}))
      .sort((a, b) => a.distance - b.distance);
    for (const {rows, distance} of all) {
      const tracks = rows.map((r) => r.definition);
      if (matViolations(tracks).length === 0) {
        best = {
          tracks,
          sources: rows.map((r) => r.board),
          rowsReplaced: rows.filter((r, i) => r.definition !== base.tracks[i]).length,
          distance,
        };
        break;
      }
    }
    if (best !== undefined) {
      break;
    }
  }
  assemblies.set(cacheKey, best);
  return best;
}

/** Everything the generator reads — and nothing else. */
export type MatContext = {
  readonly boardName: BoardName;
  readonly milestones: ReadonlyArray<string>;
  readonly awards: ReadonlyArray<string>;
  readonly venus: boolean;
  readonly colonies: boolean;
};

export type MatReport = {
  readonly base: BoardName;
  /** True when the map has no MarsBot board of its own and the base is Tharsis (the A&M module's rule). */
  readonly baseIsFallback: boolean;
  readonly baseTopology: string;
  readonly topology: string;
  readonly penalty: number;
  readonly rows: ReadonlyArray<{readonly role: MarsBotTrackRole, readonly source: BoardName, readonly replaced: boolean}>;
  /** Cells differing from the base board (rows + repairs). */
  readonly distance: number;
  /** Every micro-repair, named: `swap <role> <i>↔<j> (<why>)`, `token <role> <i> <action>`, `colony <role> <i>`. */
  readonly repairs: ReadonlyArray<string>;
  /** Tracks two or more criteria of the set read — stated, never hidden. */
  readonly shares: ReadonlyArray<{readonly role: MarsBotTrackRole, readonly names: ReadonlyArray<string>}>;
  /** Per criterion of the set: the tracks it reads and, for a single-track milestone, its threshold cell. */
  readonly criteria: ReadonlyArray<{readonly name: string, readonly kind: 'milestone' | 'award',
    readonly roles: ReadonlyArray<MarsBotTrackRole>, readonly threshold?: {readonly role: MarsBotTrackRole, readonly cell: number}}>;
};

export type GeneratedMat = {
  readonly version: number;
  readonly base: BoardName;
  readonly topology: string;
  /** The seven Martian tracks, role order. */
  readonly tracks: ReadonlyArray<TrackDefinition>;
  /** Microbe on the science track → the Venus row whose microbe cell follows it (Vastitas Nova's). */
  readonly venusRow: 'shared' | 'microbe-on-science';
  readonly report: MatReport;
};

/** The map's own profile, or Tharsis for a map with no MarsBot board (Hollandia — the A&M module's «Tharsis board»). */
export function matBase(boardName: BoardName): {profile: MarsBotMapProfile, fallback: boolean} {
  const own = MARSBOT_BOARDS.includes(boardName);
  return {profile: marsBotMapProfile(own ? boardName : BoardName.THARSIS), fallback: !own};
}

/** Token cells per kind a set asks for: ≥ the milestone's threshold + a margin, Hoverlord's shape (1 single + doubles). */
const TOKEN_DEMAND: ReadonlyArray<{milestone: string, kind: BotTokenKind, singles: number, doubles: number}> = [
  {milestone: 'Dataminer', kind: 'data', singles: 1, doubles: 4}, // 9 ≥ 7
  {milestone: 'Aeronaut', kind: 'fighter', singles: 1, doubles: 2}, // 5 ≥ 4
];

/** The milestones / awards whose colony count the A&M module backs with colony cubes (space #7, #10 and power #8). */
const COLONY_NAMES: ReadonlyArray<string> = ['Pioneer', 'Pioneer4', 'Colonizer', 'Constructor'];
const COLONY_CELLS: ReadonlyArray<{role: MarsBotTrackRole, at: number}> = [{role: 'space', at: 7}, {role: 'space', at: 10}, {role: 'power', at: 8}];

/** The order token cells are spread over the rows — the paired rows first, the three single rows last. */
const TOKEN_ROW_ORDER: ReadonlyArray<MarsBotTrackRole> = ['science', 'power', 'earth', 'bio', 'event', 'space', 'building'];

export function generateBotMat(context: MatContext): GeneratedMat {
  const {profile: base, fallback} = matBase(context.boardName);
  const baseTopology = topologyOf(base.tracks);
  const rules = setRules(context.milestones, context.awards);

  let chosen: {t: MatTopology, assembly: Assembly, penalty: number, total: number, index: number} | undefined;
  MAT_TOPOLOGIES.forEach((t, index) => {
    const assembly = assemble(base, t);
    if (assembly === undefined) {
      return;
    }
    const {penalty} = topologyPenalty(rules, t);
    const total = 2 * penalty + assembly.rowsReplaced;
    if (chosen === undefined || total < chosen.total ||
        (total === chosen.total && (assembly.rowsReplaced < chosen.assembly.rowsReplaced ||
          (assembly.rowsReplaced === chosen.assembly.rowsReplaced && index < chosen.index)))) {
      chosen = {t, assembly, penalty, total, index};
    }
  });
  if (chosen === undefined) {
    throw new Error(`No lawful mat for ${context.boardName}`);
  }
  const {t, assembly} = chosen;
  const layouts: Array<Array<TrackAction | undefined>> = assembly.tracks.map((track) => [...track.layout]);
  const repairs: Array<string> = [];
  const roleIndex = (role: MarsBotTrackRole) => MAT_ROLE_ORDER.indexOf(role);

  // THRESHOLD CELLS — a single-track milestone's target cell, on the track its ref resolves to.
  const thresholds: Array<{name: string, role: MarsBotTrackRole, cell: number}> = [];
  for (const rule of rules) {
    if (rule.kind !== 'milestone' || rule.target === undefined) {
      continue;
    }
    const refs = rule.criterion.kind === 'track' ? [rule.criterion.track] :
      rule.criterion.kind === 'tracks' && rule.criterion.op === 'max' && typeof rule.criterion.of !== 'string' ? rule.criterion.of : [];
    for (const ref of refs) {
      const role = roleOf(ref, t);
      if (role !== undefined && role !== 'venus' && rule.target >= 2 && rule.target <= 18) {
        thresholds.push({name: rule.name, role, cell: rule.target});
      }
    }
  }
  const protectedCell = (role: MarsBotTrackRole, i: number) => thresholds.some((th) => th.role === role && th.cell - 1 === i);
  const firstEmpty = (role: MarsBotTrackRole, from: number, to: number): number | undefined => {
    const row = layouts[roleIndex(role)];
    for (let i = from; i <= to; i++) {
      if (row[i] === undefined && !protectedCell(role, i)) {
        return i;
      }
    }
    return undefined;
  };

  // COLONY CELLS — the A&M module's cubes for a colony-counting criterion, in printed form (Amazonis' `colony5`).
  const colonyNames = [...context.milestones, ...context.awards].filter((n) => COLONY_NAMES.includes(n));
  // A base that already prints a colony cell (Utopia / Arabia's free colony, Amazonis' cubes) backs colonies itself.
  if (context.colonies && colonyNames.length > 0 && !layouts.some((row) => row.includes('colony5') || row.includes('colony'))) {
    for (const {role, at} of COLONY_CELLS) {
      const row = layouts[roleIndex(role)];
      let placed: number | undefined;
      for (let d = 0; d <= 4 && placed === undefined; d++) {
        for (const i of d === 0 ? [at] : [at - d, at + d]) {
          if (i >= 1 && i <= 17 && row[i] === undefined && !protectedCell(role, i)) {
            placed = i;
            break;
          }
        }
      }
      if (placed !== undefined) {
        row[placed] = 'colony5';
        repairs.push(`colony ${role} ${placed} (${colonyNames.join(', ')})`);
      }
    }
  }

  // TOKEN CELLS — decision R8: a «resources on cards» milestone gets its tokens on the mat, spread over the rows.
  for (const demand of TOKEN_DEMAND) {
    if (!context.milestones.includes(demand.milestone)) {
      continue;
    }
    const cells: Array<TrackAction> = [
      ...new Array<TrackAction>(demand.doubles).fill(`token2_${demand.kind}`),
      ...new Array<TrackAction>(demand.singles).fill(`token_${demand.kind}`),
    ];
    cells.forEach((action, k) => {
      for (let r = 0; r < TOKEN_ROW_ORDER.length; r++) {
        const role = TOKEN_ROW_ORDER[(k + r) % TOKEN_ROW_ORDER.length];
        const i = firstEmpty(role, 3 + (k % 3) * 3, 15);
        if (i !== undefined) {
          layouts[roleIndex(role)][i] = action;
          repairs.push(`token ${role} ${i} ${action}`);
          return;
        }
      }
    });
  }

  // NO JUMP (decision R3): the cell before a milestone's threshold is never an «advance» — the player who reads the bot
  // at «N − 1 / N» must not watch it claim on one push. The repair is a swap inside the row with the nearest empty cell.
  for (const th of thresholds) {
    const row = layouts[roleIndex(th.role)];
    const i = th.cell - 1;
    if (row[i] !== 'advance') {
      continue;
    }
    let target: number | undefined;
    for (let d = 1; d <= 17 && target === undefined; d++) {
      for (const j of [i - d, i + d]) {
        if (j >= 1 && j <= 17 && row[j] === undefined && !protectedCell(th.role, j)) {
          target = j;
          break;
        }
      }
    }
    if (target !== undefined) {
      row[target] = 'advance';
      row[i] = undefined;
      repairs.push(`swap ${th.role} ${i}↔${target} (no jump into ${th.name} at ${th.cell})`);
    }
  }

  const tracks: Array<TrackDefinition> = assembly.tracks.map((track, i) => ({...track, layout: layouts[i]}));
  const violations = matViolations(tracks);
  if (violations.length > 0) {
    throw new Error(`The generator built an unlawful mat for ${context.boardName}: ${violations.join('; ')}`);
  }
  const distance = tracks.reduce((d, track, i) => d + rowDistance(track, base.tracks[i]), 0);
  const {shares} = topologyPenalty(rules, t);
  return {
    version: MAT_GENERATOR_VERSION,
    base: base.boardName,
    topology: t.id,
    tracks,
    venusRow: t.microbe === 'science' ? 'microbe-on-science' : 'shared',
    report: {
      base: base.boardName,
      baseIsFallback: fallback,
      baseTopology: baseTopology.id,
      topology: t.id,
      penalty: chosen.penalty,
      rows: MAT_ROLE_ORDER.map((role, i) => ({role, source: assembly.sources[i], replaced: assembly.tracks[i] !== base.tracks[i]})),
      distance,
      repairs,
      shares,
      criteria: rules.map((rule) => ({
        name: rule.name,
        kind: rule.kind,
        roles: criterionRoles(rule.criterion, t),
        threshold: thresholds.find((th) => th.name === rule.name),
      })),
    },
  };
}
