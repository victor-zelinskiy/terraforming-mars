import {Tag} from '../../common/cards/Tag';
import {Resource} from '../../common/Resource';
import {
  MarsBotTrackRole,
  TrackAction,
  TrackDefinition,
  MARSBOT_MAX_TRACK_POSITION,
} from '../../common/automa/AutomaTypes';

/** Result of advancing a track. */
export type AdvanceResult =
  | {type: 'action', action: TrackAction}
  | {type: 'none'}
  | {type: 'maxed'};

/** Runtime state for a single MarsBot track. */
export class MarsBotTrack {
  public position: number = 0;
  /** Positions that were regressed from and not yet re-advanced to. Actions on these are skipped. */
  public regressedPositions: Set<number> = new Set();

  constructor(public readonly definition: TrackDefinition) {}

  /** Last position of this track (18 for the standard tracks, 12 for the Venus track). */
  public get maxPosition(): number {
    return this.definition.maxPosition ?? MARSBOT_MAX_TRACK_POSITION;
  }

  public canAdvance(): boolean {
    return this.position < this.maxPosition;
  }

  /** Advance the track by 1. */
  public advance(): AdvanceResult {
    if (!this.canAdvance()) {
      return {type: 'maxed'};
    }
    this.position++;
    if (this.regressedPositions.has(this.position)) {
      this.regressedPositions.delete(this.position);
      return {type: 'none'};
    }
    const action = this.definition.layout[this.position];
    return action !== undefined ? {type: 'action', action} : {type: 'none'};
  }

  /** Regress the track by 1 (from human decreasing MarsBot production). */
  public regress(): void {
    if (this.position > 0) {
      this.regressedPositions.add(this.position);
      this.position--;
    }
  }

  /** Get the action at the next position without advancing. Returns undefined if at max or no action. */
  public peek(): TrackAction | undefined {
    if (!this.canAdvance()) {
      return undefined;
    }
    return this.definition.layout[this.position + 1];
  }
}

/** The MarsBot board with tracks. Handles tag-to-track mapping and track state. */
export class MarsBotBoard {
  public readonly tracks: ReadonlyArray<MarsBotTrack>;
  private readonly tagToTrack: Map<Tag, number>;
  private readonly roleToTrack: Map<MarsBotTrackRole, number>;
  private readonly productionToTrack: Map<Resource, number>;

  constructor(public readonly data: ReadonlyArray<TrackDefinition>) {
    this.tracks = data.map((def) => new MarsBotTrack(def));
    this.tagToTrack = new Map();
    this.roleToTrack = new Map();
    this.productionToTrack = new Map();
    for (let i = 0; i < data.length; i++) {
      for (const tag of data[i].tags) {
        this.tagToTrack.set(tag, i);
      }
      this.roleToTrack.set(data[i].role, i);
      for (const production of data[i].productions) {
        this.productionToTrack.set(production, i);
      }
    }
  }

  public getTrackIndexForTag(tag: Tag): number | undefined {
    return this.tagToTrack.get(tag);
  }

  /**
   * The index of the track holding this canonical ROLE — how every rule that
   * names a track resolves it, on any map (see {@link MarsBotTrackRole}).
   * `undefined` only for a role this board does not have (`venus` without
   * Venus Next).
   */
  public getTrackIndexOfRole(role: MarsBotTrackRole): number | undefined {
    return this.roleToTrack.get(role);
  }

  /** As {@link getTrackIndexOfRole}, but for a role the board is known to have. */
  public trackIndexOfRoleOrThrow(role: MarsBotTrackRole): number {
    const index = this.roleToTrack.get(role);
    if (index === undefined) {
      throw new Error(`MarsBot board has no '${role}' track`);
    }
    return index;
  }

  public getTrackOfRole(role: MarsBotTrackRole): MarsBotTrack | undefined {
    const index = this.roleToTrack.get(role);
    return index === undefined ? undefined : this.tracks[index];
  }

  /**
   * «Decrease MarsBot's X production → regress its Y track» (rulebook pp.4–5).
   * Derived from the board's own `productions` declarations, so the mapping is
   * whatever the printed board says — never a tag pairing (Hellas moves the
   * Jovian TAG without moving any production) and never a row index.
   */
  public getTrackIndexForProduction(resource: Resource): number | undefined {
    return this.productionToTrack.get(resource);
  }

  /** Check if a tag is mapped to any track. */
  public hasTrackForTag(tag: Tag): boolean {
    return this.tagToTrack.has(tag);
  }

  /** Index of the least-advanced track (first index if tied). */
  public getLeastAdvancedTrackIndex(): number {
    let minPos = this.tracks[0].position;
    let minIndex = 0;
    for (let i = 1; i < this.tracks.length; i++) {
      if (this.tracks[i].position < minPos) {
        minPos = this.tracks[i].position;
        minIndex = i;
      }
    }
    return minIndex;
  }

  /** Index of the most-advanced track (first index if tied). */
  public getMostAdvancedTrackIndex(): number {
    let maxPos = this.tracks[0].position;
    let maxIndex = 0;
    for (let i = 1; i < this.tracks.length; i++) {
      if (this.tracks[i].position > maxPos) {
        maxPos = this.tracks[i].position;
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  /** Index of the most-advanced track that hasn't reached max, or undefined if all maxed. */
  public getMostAdvancedNonMaxedTrackIndex(): number | undefined {
    let maxPos = -1;
    let maxIndex: number | undefined;
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.tracks[i].position > maxPos && this.tracks[i].canAdvance()) {
        maxPos = this.tracks[i].position;
        maxIndex = i;
      }
    }
    return maxIndex;
  }
}
