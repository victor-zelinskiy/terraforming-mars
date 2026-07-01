import prometheus from 'prom-client';
import {GameId} from '@/common/Types';
import {ServerMessage, gameStateInvalidated} from '@/common/realtime/Protocol';

/**
 * Realtime game rooms.
 *
 * The hub owns the `gameId -> subscribers` map. It is deliberately kept free of
 * any import of `GameLoader` (the token -> game lookup is INJECTED via a
 * resolver). That keeps this module a leaf so that Phase 3 can have
 * `GameLoader.saveGame` call `RealtimeHub.getInstance().invalidate(...)` WITHOUT
 * creating an import cycle (GameLoader -> RealtimeHub -> GameLoader).
 *
 * Phase 2 scope: subscribe / unsubscribe / disconnect + room bookkeeping. There
 * is NO broadcast here yet — `invalidate(...)` arrives in Phase 3.
 */

export interface SubscriptionTarget {
  gameId: GameId;
  gameAge: number;
  undoCount: number;
}

/** Resolves a private participant token to the game it may join (or undefined). */
export type SubscriptionResolver = (participantId: string) => Promise<SubscriptionTarget | undefined>;

/** The minimal shape the hub needs from a connection (RealtimeConnection fits). */
export interface RealtimeSubscriber {
  readonly id: number;
  gameId: GameId | undefined;
  participantId: string | undefined;
  send(message: ServerMessage): void;
}

/** A "the game changed" event, derived from the persisted game (Phase 3). */
export interface GameInvalidation {
  gameId: GameId;
  gameAge: number;
  undoCount: number;
  phase?: string;
}

export interface SubscribeResult {
  ok: boolean;
  gameId?: GameId;
  gameAge?: number;
  undoCount?: number;
  roomSize?: number;
}

const metrics = {
  rooms: new prometheus.Gauge({
    name: 'realtime_rooms',
    help: 'Number of realtime game rooms with at least one subscriber',
    registers: [prometheus.register],
  }),
  subscribers: new prometheus.Gauge({
    name: 'realtime_subscribers',
    help: 'Number of realtime connections currently subscribed to a game',
    registers: [prometheus.register],
  }),
  invalidations: new prometheus.Counter({
    name: 'realtime_invalidations_total',
    help: 'Total game-state invalidations broadcast to at least one subscriber',
    registers: [prometheus.register],
  }),
};

/** Safe default until a resolver is configured: reject every subscription. */
const rejectAllResolver: SubscriptionResolver = () => Promise.resolve(undefined);

export class RealtimeHub {
  private static instance: RealtimeHub | undefined;

  private readonly rooms = new Map<GameId, Set<RealtimeSubscriber>>();
  private resolver: SubscriptionResolver = rejectAllResolver;

  public static getInstance(): RealtimeHub {
    if (RealtimeHub.instance === undefined) {
      RealtimeHub.instance = new RealtimeHub();
    }
    return RealtimeHub.instance;
  }

  public static newInstanceForTesting(resolver: SubscriptionResolver): RealtimeHub {
    const hub = new RealtimeHub();
    hub.resolver = resolver;
    return hub;
  }

  /** Wire the production (GameLoader-backed) lookup. Called from server.ts. */
  public configureResolver(resolver: SubscriptionResolver): void {
    this.resolver = resolver;
  }

  public async subscribe(subscriber: RealtimeSubscriber, participantId: string): Promise<SubscribeResult> {
    const target = await this.resolver(participantId);
    if (target === undefined) {
      return {ok: false};
    }
    // A connection subscribes to exactly one game — drop any prior room first.
    this.removeFromRoom(subscriber);
    subscriber.gameId = target.gameId;
    subscriber.participantId = participantId;
    let room = this.rooms.get(target.gameId);
    if (room === undefined) {
      room = new Set<RealtimeSubscriber>();
      this.rooms.set(target.gameId, room);
    }
    room.add(subscriber);
    this.updateMetrics();
    return {ok: true, gameId: target.gameId, gameAge: target.gameAge, undoCount: target.undoCount, roomSize: room.size};
  }

  public unsubscribe(subscriber: RealtimeSubscriber): void {
    this.removeFromRoom(subscriber);
    this.updateMetrics();
  }

  /** Same as unsubscribe; named for the socket-close path for readability. */
  public handleDisconnect(subscriber: RealtimeSubscriber): void {
    this.removeFromRoom(subscriber);
    this.updateMetrics();
  }

  /**
   * Broadcast a "game changed" invalidation to every subscriber of the game.
   * No-op (returns 0) when nobody is listening, so we never serialize for an
   * empty room. Returns the number of subscribers notified.
   */
  public invalidate(update: GameInvalidation): number {
    const room = this.rooms.get(update.gameId);
    if (room === undefined || room.size === 0) {
      return 0;
    }
    const message = gameStateInvalidated(update.gameId, update.gameAge, update.undoCount, update.phase);
    for (const subscriber of room) {
      subscriber.send(message);
    }
    metrics.invalidations.inc();
    return room.size;
  }

  public roomSize(gameId: GameId): number {
    return this.rooms.get(gameId)?.size ?? 0;
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  private removeFromRoom(subscriber: RealtimeSubscriber): void {
    const gameId = subscriber.gameId;
    if (gameId === undefined) {
      return;
    }
    const room = this.rooms.get(gameId);
    if (room !== undefined) {
      room.delete(subscriber);
      if (room.size === 0) {
        this.rooms.delete(gameId);
      }
    }
    subscriber.gameId = undefined;
  }

  private updateMetrics(): void {
    metrics.rooms.set(this.rooms.size);
    let subscribers = 0;
    for (const room of this.rooms.values()) {
      subscribers += room.size;
    }
    metrics.subscribers.set(subscribers);
  }
}
