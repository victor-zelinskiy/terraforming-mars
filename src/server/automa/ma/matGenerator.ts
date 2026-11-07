import {BoardName} from '../../../common/boards/BoardName';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {BotTokenKind, MarsBotTrackRole, TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {MARSBOT_BOARDS, MarsBotMapProfile, marsBotMapProfile} from '../boards/MarsBotMapProfile';
import {BotCriterion, PlacementBias, PlacementStepId, TrackRef} from './BotMARule';
import {PlacementRegionId} from './placementRegions';
import {cellArrivals, DeckTagMix} from './matPressure';
import {botAwardRule, botMilestoneRule} from './botMAInterpreter';
import {libraryRows, rowDistance, rowKey} from './matRowLibrary';
import {MAT_ROLE_ORDER, matBody, matTail, matViolations} from './matLaw';

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
export const MAT_GENERATOR_VERSION = 2;

/**
 * THE PRESSURE WINDOW — the expected generation (the pressure model's own units, `matPressure.ts`) at which a
 * single-track milestone's threshold cell may be reached: the span the model gives the six OFFICIAL boards' own track
 * criteria at its late end (C. Forester 14.4…14.6 with the deck's mix — docs/AUTOMA_DATA_AUDIT.md §22.6), so no official
 * row is ever moved for its own set; at
 * its early end the A&M module's own calibrations (Spacefarer 4 ↔ space 4 on the Tharsis row, gen 6.0) sit below the six
 * boards' earliest (Rim Settler 6.8) and are official too — only a criterion faster than any official one is slowed.
 */
export const PRESSURE_WINDOW = {min: 5.0, max: 15.0};
const PRESSURE_MAX_MOVES = 3;

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

type SetRule = {name: string, kind: 'milestone' | 'award', criterion: BotCriterion, target?: number, pair?: readonly [Tag, Tag],
  placement?: PlacementBias};

function setRules(milestones: ReadonlyArray<string>, awards: ReadonlyArray<string>): Array<SetRule> {
  const rules: Array<SetRule> = [];
  for (const name of milestones) {
    const rule = botMilestoneRule(name);
    if (rule !== undefined) {
      rules.push({name, kind: 'milestone', criterion: rule.randomSetCriterion ?? rule.criterion,
        target: typeof rule.target === 'number' ? rule.target : undefined, pair: rule.pair, placement: rule.placement});
    }
  }
  for (const name of awards) {
    const rule = botAwardRule(name);
    if (rule !== undefined) {
      rules.push({name, kind: 'award', criterion: rule.criterion, placement: rule.placement});
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
  /** The game's project deck as printed-tag occurrences per card — the pressure model's flow. Absent = no pressure layer. */
  readonly deckTags?: DeckTagMix;
};

/**
 * The PLACEMENT a generated mat plays (the map layer): the tiebreaker steps in order, by stable id, and the regions
 * whose spaces count one more reward icon for tiebreakers. Serializable — the profile rebuilds the functions.
 */
export type MatPlacement = {
  readonly steps: ReadonlyArray<'oceans' | 'reward-icons' | PlacementStepId | `region:${PlacementRegionId}`>;
  readonly iconBonus: ReadonlyArray<PlacementRegionId>;
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
    readonly roles: ReadonlyArray<MarsBotTrackRole>, readonly threshold?: {readonly role: MarsBotTrackRole, readonly cell: number},
    /** The pressure model's expected generation of the threshold cell (with a deck mix). */
    readonly arrival?: number}>;
  /** The placement the set's tile criteria asked for, each step / bonus named by the rule that asked. */
  readonly placement: ReadonlyArray<string>;
};

export type GeneratedMat = {
  readonly version: number;
  readonly base: BoardName;
  readonly topology: string;
  /** The seven Martian tracks, role order. */
  readonly tracks: ReadonlyArray<TrackDefinition>;
  /** Microbe on the science track → the Venus row whose microbe cell follows it (Vastitas Nova's). */
  readonly venusRow: 'shared' | 'microbe-on-science';
  /** The map layer — tiebreakers and «+1 icon» regions from the set ∩ the map. */
  readonly placement: MatPlacement;
  readonly report: MatReport;
};

/**
 * THE MAP LAYER (the prompt's § Генератор, п. 8): the tiebreakers and the «+1 icon» bullets come from the SET — each
 * tile-counting rule declares its bias with the very region predicate its award counts (`BotMARule.placement`).
 * Order: the oceans (unless a rule lowers them — Highlander) → the set's steps before the icons, in row order (a
 * milestone's region, Hellas' Polar place) → the reward icons (+1 for every bonus region a space is in) → the steps
 * after the icons (an award's region, Elysium's Southern place) → the lowered oceans. The map's special cells (the
 * poles, Viking, the coves, `colony5`) stay the map's own rules (`AutomaPlacementBonus`).
 */
function placementOf(rules: ReadonlyArray<SetRule>): {placement: MatPlacement, named: Array<string>, competing?: PlacementBias} {
  const before: Array<PlacementStepId> = [];
  const after: Array<MatPlacement['steps'][number]> = [];
  const iconBonus: Array<PlacementRegionId> = [];
  const named: Array<string> = [];
  let lowerOceans = false;
  // ONE rule may COMPETE with the icons (a step before them, a «+1 icon», oceans lowered) — as on every official board,
  // each of which prints at most one. Stacked, they make the bot stop covering icons and stop earning its ocean bonus
  // (the yield the band holds — §22.6: 54 of 300 sets fell under it before this cap). The first one in row order keeps
  // its official form; every later one takes the after-the-icons place (Elysium's form) — still a preference, now only
  // among equal icons.
  let competing: string | undefined;
  let competingBias: PlacementBias | undefined;
  const addAfter = (step: MatPlacement['steps'][number], why: string) => {
    if (!after.includes(step) && !before.includes(step as PlacementStepId)) {
      after.push(step);
    }
    named.push(`${step} after the icons (${why})`);
  };
  for (const rule of rules) {
    const bias = rule.placement;
    if (bias === undefined) {
      continue;
    }
    if (bias.mode === 'step-after-icons') {
      addAfter(bias.step, rule.name);
      continue;
    }
    if (competing !== undefined) {
      const demoted = `${rule.name} — ${competing} already competes with the icons`;
      if (bias.mode === 'step-before-icons') {
        addAfter(bias.step, demoted);
      } else if (bias.mode === 'icon-bonus') {
        addAfter(`region:${bias.region}`, demoted);
      } else {
        named.push(`oceans stay first (${demoted})`);
      }
      continue;
    }
    competing = rule.name;
    competingBias = bias;
    switch (bias.mode) {
    case 'step-before-icons':
      before.push(bias.step);
      named.push(`${bias.step} before the icons (${rule.name})`);
      break;
    case 'icon-bonus':
      iconBonus.push(bias.region);
      named.push(`+1 icon ${bias.region} (${rule.name})`);
      break;
    case 'lower-oceans':
      lowerOceans = true;
      named.push(`oceans below the icons (${rule.name})`);
      break;
    }
  }
  const steps: Array<MatPlacement['steps'][number]> = [
    ...(lowerOceans ? [] : ['oceans' as const]), ...before, 'reward-icons', ...after, ...(lowerOceans ? ['oceans' as const] : []),
  ];
  return {placement: {steps, iconBonus}, named, competing: competingBias};
}

/**
 * THE YIELD COMPENSATION of a rule competing with the icons (the owner's decision, 2026-11-06 — «A + компенсация»): a
 * bot chasing a tile award's region forgoes covered icons and its ocean bonus (the bench: 46 of 300 such sets fell
 * under the band's mat M€). The mat gives the yield back in kind — MORE tiles within the game: the latest tile cells
 * (city / greenery / ocean) of the rows no criterion reads move onto their row's earliest empty cells (the law's «swap
 * two cells inside a row» — every count stays put), as many as the bias costs (`compensationSwaps`).
 */
/**
 * Swaps per competing bias — sized by the deficit the bench measured for each (docs/AUTOMA_DATA_AUDIT.md §22.6: mean
 * mat-M€ below the sets with no competing rule): Polar Region −9.1, the edge «+1 icon» −7.1, the lowered oceans −5.3,
 * Suburbian −3.1, the equatorial rows −3.0, the own city −2.6; the volcanoes −0.6 and the special tiles 0 need none.
 */
function compensationSwaps(bias: PlacementBias): number {
  switch (bias.mode) {
  case 'step-before-icons':
    return bias.step === 'polar-region' ? 1 : 0;
  case 'icon-bonus':
    return bias.region === 'edge' ? 1 : 0;
  case 'lower-oceans':
    return 0;
  case 'step-after-icons':
    return 0;
  }
}
const TILE_CELLS: ReadonlyArray<TrackAction> = ['city', 'greenery', 'ocean'];

function lastEmptyBefore(row: ReadonlyArray<TrackAction | undefined>, before: number, protectedCell: (i: number) => boolean): number | undefined {
  for (let i = Math.min(before - 1, 17); i >= 1; i--) {
    if (row[i] === undefined && !protectedCell(i)) {
      return i;
    }
  }
  return undefined;
}

/**
 * The map's own printed board — or, for a map that prints none, the board it BORROWS (Hollandia's profile names Tharsis,
 * the A&M module's «Tharsis board»; a map with no profile at all takes Tharsis too). `fallback` says the base is a loan.
 */
export function matBase(boardName: BoardName): {profile: MarsBotMapProfile, fallback: boolean} {
  const profile = MARSBOT_BOARDS.includes(boardName) ? marsBotMapProfile(boardName) : undefined;
  if (profile !== undefined && profile.borrowedBoard === undefined) {
    return {profile, fallback: false};
  }
  return {profile: marsBotMapProfile(profile?.borrowedBoard ?? BoardName.THARSIS), fallback: true};
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
  const {profile: printed, fallback} = matBase(context.boardName);
  // An EXTENDED base (Amazonis Planitia) is assembled by its law-formed BODY; the map's late reserve is handed back
  // to every row at the end, whatever row the topology chose for it (`matLaw.matBody` / `matTail`).
  const base: MarsBotMapProfile = {...printed, tracks: printed.tracks.map(matBody)};
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

  // PRESSURE (decision R3 — the threshold never moves; the MAT does): a single-track milestone whose threshold cell the
  // deck's tag flow reaches outside the window gets an «advance» moved INTO its row before the threshold (too late) or
  // OUT of it (too early), taken from / given to a row no criterion of the set reads. The law's counts stay put.
  const arrivals = new Map<string, number>();
  if (context.deckTags !== undefined) {
    const mix = context.deckTags;
    const readRoles = new Set(rules.flatMap((r) => criterionRoles(r.criterion, t)));
    const donors = MAT_ROLE_ORDER.filter((role) => !readRoles.has(role));
    const arrivalOf = (th: {role: MarsBotTrackRole, cell: number}) =>
      cellArrivals({...assembly.tracks[roleIndex(th.role)], layout: layouts[roleIndex(th.role)]}, mix)[th.cell];
    for (const th of thresholds) {
      const row = layouts[roleIndex(th.role)];
      const guard = (i: number) => protectedCell(th.role, i) || i >= th.cell - 1;
      for (let move = 0; move < PRESSURE_MAX_MOVES; move++) {
        const arrival = arrivalOf(th);
        if (arrival > PRESSURE_WINDOW.max) {
          const into = lastEmptyBefore(row, th.cell - 1, guard);
          // The donor is the LATEST «advance» of a row no criterion reads — the step that buys the least on its own row.
          const donor = donors.map((role) => ({role, i: layouts[roleIndex(role)].lastIndexOf('advance')}))
            .filter((d) => d.i > 0).sort((a, b) => b.i - a.i)[0];
          if (into === undefined || donor === undefined) {
            break;
          }
          layouts[roleIndex(donor.role)][donor.i] = undefined;
          row[into] = 'advance';
          repairs.push(`pressure ${donor.role} ${donor.i} → ${th.role} ${into} (${th.name} at ${th.cell}: gen ${arrival.toFixed(1)})`);
        } else if (arrival < PRESSURE_WINDOW.min) {
          const out = row.findIndex((a, i) => a === 'advance' && i < th.cell - 1);
          const donor = donors.map((role) => ({role, i: lastEmptyBefore(layouts[roleIndex(role)], 18, (i) => protectedCell(role, i)) ?? -1}))
            .find((d) => d.i > 0);
          if (out < 1 || donor === undefined) {
            break;
          }
          row[out] = undefined;
          layouts[roleIndex(donor.role)][donor.i] = 'advance';
          repairs.push(`pressure ${th.role} ${out} → ${donor.role} ${donor.i} (${th.name} at ${th.cell}: gen ${arrival.toFixed(1)})`);
        } else {
          break;
        }
      }
      arrivals.set(th.name, arrivalOf(th));
    }
  }

  const {placement, named, competing} = placementOf(rules);
  // The base map's OWN rule costs nothing — the base was balanced with it (Hellas' Polar Region, Utopia's edge icon).
  const native = competing !== undefined && (
    (competing.mode === 'step-before-icons' && base.placementTiebreakers.some((tb) => tb.id === competing.step)) ||
    (competing.mode === 'icon-bonus' && base.iconBonusRegion === competing.region));
  if (competing !== undefined && !native) {
    const readRoles = new Set(rules.flatMap((r) => criterionRoles(r.criterion, t)));
    const rows = (['space', 'building', 'event', 'bio', 'earth', 'power', 'science'] as const).filter((role) => !readRoles.has(role));
    let swaps = compensationSwaps(competing);
    for (const role of rows) {
      const row = layouts[roleIndex(role)];
      while (swaps > 0) {
        let late = -1;
        for (let i = 17; i >= 12; i--) {
          const cell = row[i];
          if (cell !== undefined && TILE_CELLS.includes(cell)) {
            late = i;
            break;
          }
        }
        let early = -1;
        for (let i = 2; i <= 9; i++) {
          if (row[i] === undefined && !protectedCell(role, i)) {
            early = i;
            break;
          }
        }
        if (late < 0 || early < 0) {
          break;
        }
        row[early] = row[late];
        row[late] = undefined;
        repairs.push(`compensate ${role} ${late}→${early} (${row[early]} — a rule competes with the icons)`);
        swaps--;
      }
      if (swaps === 0) {
        break;
      }
    }
  }
  const tracks: Array<TrackDefinition> = assembly.tracks.map((track, i) => {
    const tail = matTail(printed.tracks[i]);
    return tail.length === 0 ?
      {...track, layout: layouts[i]} :
      {...track, layout: [...layouts[i], ...tail], maxPosition: printed.tracks[i].maxPosition};
  });
  const violations = matViolations(tracks);
  if (violations.length > 0) {
    throw new Error(`The generator built an unlawful mat for ${context.boardName}: ${violations.join('; ')}`);
  }
  const distance = tracks.reduce((d, track, i) => d + rowDistance(track, printed.tracks[i]), 0);
  const {shares} = topologyPenalty(rules, t);
  return {
    version: MAT_GENERATOR_VERSION,
    base: base.boardName,
    topology: t.id,
    tracks,
    venusRow: t.microbe === 'science' ? 'microbe-on-science' : 'shared',
    placement,
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
        arrival: arrivals.get(rule.name),
      })),
      placement: named,
    },
  };
}
