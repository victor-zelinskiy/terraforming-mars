import {BoardName} from '../../../common/boards/BoardName';
import {Tag} from '../../../common/cards/Tag';
import {MarsBotTrackRole, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../boards/MarsBotMapProfile';

/**
 * THE ROW LIBRARY — every Martian track row of the ten static MarsBot boards, keyed by ROLE + TAG SET. A row is taken
 * WHOLE (docs/claude/marsbot-dynamic-ma-framework.md §3.3): each one was balanced by people, and the cells that follow
 * a pairing (the City tag brings its extra cities, a paired track its end) travel with it.
 *
 * Pure data, computed once from the static profiles; never a hand table.
 */
export type LibraryRow = {
  /** `role:tag/tag` with the tags SORTED — the key a topology asks for. */
  readonly key: string;
  readonly definition: TrackDefinition;
  /** The boards printing exactly this row (identical layout + tags), in profile order — the first one names it. */
  readonly boards: ReadonlyArray<BoardName>;
};

export function rowKey(role: MarsBotTrackRole, tags: ReadonlyArray<Tag>): string {
  return `${role}:${[...tags].sort().join('/')}`;
}

let library: Map<string, Array<LibraryRow>> | undefined;

/** Every row of the library under a key (empty = no static board prints that role with those tags). */
export function libraryRows(key: string): ReadonlyArray<LibraryRow> {
  if (library === undefined) {
    library = new Map();
    for (const board of MARSBOT_BOARDS) {
      for (const definition of marsBotMapProfile(board).tracks) {
        const key = rowKey(definition.role, definition.tags);
        const rows = library.get(key) ?? [];
        const same = rows.find((r) => JSON.stringify(r.definition.layout) === JSON.stringify(definition.layout));
        if (same !== undefined) {
          (same.boards as Array<BoardName>).push(board);
        } else {
          rows.push({key, definition, boards: [board]});
        }
        library.set(key, rows);
      }
    }
  }
  return library.get(key) ?? [];
}

/** Cells in which two rows of one role differ — the distance a replacement costs. */
export function rowDistance(a: TrackDefinition, b: TrackDefinition): number {
  let d = 0;
  for (let i = 0; i < Math.max(a.layout.length, b.layout.length); i++) {
    if (a.layout[i] !== b.layout[i]) {
      d++;
    }
  }
  return d;
}
