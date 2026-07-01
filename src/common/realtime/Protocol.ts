/**
 * Realtime WebSocket protocol — SHARED between server and client.
 *
 * Phase 1 scope (transport + diagnostics only): a versioned envelope, a
 * hello handshake, and a heartbeat. There is deliberately NO game
 * subscription, NO invalidation, and NO command transport here yet — those
 * arrive in later phases and extend the message unions below.
 *
 * This module is intentionally free of any Node- or browser-specific API (no
 * `ws`, no `window`) so both sides import the exact same types + guards. The
 * server MUST treat every incoming message as untrusted and validate it via
 * `parseClientMessage` before acting on it.
 */

/** Bump ONLY on a breaking wire change. Both sides compare against this. */
export const REALTIME_PROTOCOL_VERSION = 1;

export const ClientMessageType = {
  HELLO: 'CLIENT_HELLO',
  PING: 'PING',
  SUBSCRIBE: 'SUBSCRIBE_GAME',
  UNSUBSCRIBE: 'UNSUBSCRIBE_GAME',
} as const;
export type ClientMessageType = typeof ClientMessageType[keyof typeof ClientMessageType];

export const ServerMessageType = {
  HELLO: 'SERVER_HELLO',
  PONG: 'PONG',
  ERROR: 'ERROR',
  PROTOCOL_INCOMPATIBLE: 'PROTOCOL_INCOMPATIBLE',
  SUBSCRIBED: 'SUBSCRIBED',
} as const;
export type ServerMessageType = typeof ServerMessageType[keyof typeof ServerMessageType];

/** Fields present on every message in either direction. */
export interface BaseMessage {
  protocolVersion: number;
  ts: number;
  /** Echoes a client request when the server is replying to a specific one. */
  correlationId?: string;
}

// ---- Client -> Server -------------------------------------------------------

export interface ClientHelloMessage extends BaseMessage {
  type: typeof ClientMessageType.HELLO;
  /** Build id of the client (settings.head), for diagnostics only. */
  clientVersion: string;
  /**
   * The same private `?id=` token the REST API uses (playerId / spectatorId).
   * Optional in Phase 1 (no rooms yet); it is only logged. Room membership and
   * authorization land in Phase 2.
   */
  participantId?: string;
}

export interface ClientPingMessage extends BaseMessage {
  type: typeof ClientMessageType.PING;
}

export interface SubscribeGameMessage extends BaseMessage {
  type: typeof ClientMessageType.SUBSCRIBE;
  /** The private `?id=` token; the server resolves it to a game room. */
  participantId: string;
}

export interface UnsubscribeGameMessage extends BaseMessage {
  type: typeof ClientMessageType.UNSUBSCRIBE;
}

export type ClientMessage =
  | ClientHelloMessage
  | ClientPingMessage
  | SubscribeGameMessage
  | UnsubscribeGameMessage;

// ---- Server -> Client -------------------------------------------------------

export interface ServerHelloMessage extends BaseMessage {
  type: typeof ServerMessageType.HELLO;
  /** Build id of the server (runId), for diagnostics. */
  serverVersion: string;
}

export interface ServerPongMessage extends BaseMessage {
  type: typeof ServerMessageType.PONG;
}

export interface ServerErrorMessage extends BaseMessage {
  type: typeof ServerMessageType.ERROR;
  code: string;
  message: string;
}

export interface ProtocolIncompatibleMessage extends BaseMessage {
  type: typeof ServerMessageType.PROTOCOL_INCOMPATIBLE;
  serverProtocolVersion: number;
}

export interface SubscribedMessage extends BaseMessage {
  type: typeof ServerMessageType.SUBSCRIBED;
  /**
   * Current authoritative version cursor of the subscribed game. In Phase 2 the
   * client only RECORDS these (a baseline for the Phase 5 resume model); it does
   * NOT refresh on them. The raw gameId is deliberately NOT sent.
   */
  gameAge: number;
  undoCount: number;
}

export type ServerMessage =
  | ServerHelloMessage
  | ServerPongMessage
  | ServerErrorMessage
  | ProtocolIncompatibleMessage
  | SubscribedMessage;

// ---- Builders ---------------------------------------------------------------

function envelope(now: number, correlationId?: string): BaseMessage {
  const base: BaseMessage = {protocolVersion: REALTIME_PROTOCOL_VERSION, ts: now};
  if (correlationId !== undefined) {
    base.correlationId = correlationId;
  }
  return base;
}

export function clientHello(clientVersion: string, participantId: string | undefined, now: number = Date.now()): ClientHelloMessage {
  return {...envelope(now), type: ClientMessageType.HELLO, clientVersion, participantId};
}

export function clientPing(now: number = Date.now()): ClientPingMessage {
  return {...envelope(now), type: ClientMessageType.PING};
}

export function subscribeGame(participantId: string, correlationId?: string, now: number = Date.now()): SubscribeGameMessage {
  return {...envelope(now, correlationId), type: ClientMessageType.SUBSCRIBE, participantId};
}

export function unsubscribeGame(correlationId?: string, now: number = Date.now()): UnsubscribeGameMessage {
  return {...envelope(now, correlationId), type: ClientMessageType.UNSUBSCRIBE};
}

export function serverHello(serverVersion: string, correlationId?: string, now: number = Date.now()): ServerHelloMessage {
  return {...envelope(now, correlationId), type: ServerMessageType.HELLO, serverVersion};
}

export function serverPong(correlationId?: string, now: number = Date.now()): ServerPongMessage {
  return {...envelope(now, correlationId), type: ServerMessageType.PONG};
}

export function serverError(code: string, message: string, correlationId?: string, now: number = Date.now()): ServerErrorMessage {
  return {...envelope(now, correlationId), type: ServerMessageType.ERROR, code, message};
}

export function protocolIncompatible(now: number = Date.now()): ProtocolIncompatibleMessage {
  return {...envelope(now), type: ServerMessageType.PROTOCOL_INCOMPATIBLE, serverProtocolVersion: REALTIME_PROTOCOL_VERSION};
}

export function subscribed(gameAge: number, undoCount: number, correlationId?: string, now: number = Date.now()): SubscribedMessage {
  return {...envelope(now, correlationId), type: ServerMessageType.SUBSCRIBED, gameAge, undoCount};
}

// ---- Serialization + validation --------------------------------------------

export function serializeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Minimal envelope shape every message must satisfy. */
function hasEnvelope(value: Record<string, unknown>): boolean {
  return typeof value.type === 'string' && typeof value.protocolVersion === 'number';
}

/**
 * Parse + validate an inbound CLIENT message. Returns `undefined` for anything
 * malformed or of an unknown type — the server should reply with an ERROR and
 * never throw on bad input.
 */
export function parseClientMessage(raw: string): ClientMessage | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !hasEnvelope(parsed)) {
    return undefined;
  }
  switch (parsed.type) {
  case ClientMessageType.HELLO:
    if (typeof parsed.clientVersion !== 'string') {
      return undefined;
    }
    if (parsed.participantId !== undefined && typeof parsed.participantId !== 'string') {
      return undefined;
    }
    return parsed as unknown as ClientHelloMessage;
  case ClientMessageType.PING:
    return parsed as unknown as ClientPingMessage;
  case ClientMessageType.SUBSCRIBE:
    return typeof parsed.participantId === 'string' ? (parsed as unknown as SubscribeGameMessage) : undefined;
  case ClientMessageType.UNSUBSCRIBE:
    return parsed as unknown as UnsubscribeGameMessage;
  default:
    return undefined;
  }
}

/**
 * Parse + validate an inbound SERVER message (client side). Returns `undefined`
 * for anything malformed or unknown — the client should ignore it defensively.
 */
export function parseServerMessage(raw: string): ServerMessage | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !hasEnvelope(parsed)) {
    return undefined;
  }
  switch (parsed.type) {
  case ServerMessageType.HELLO:
    return typeof parsed.serverVersion === 'string' ? (parsed as unknown as ServerHelloMessage) : undefined;
  case ServerMessageType.PONG:
    return parsed as unknown as ServerPongMessage;
  case ServerMessageType.ERROR:
    return (typeof parsed.code === 'string' && typeof parsed.message === 'string') ? (parsed as unknown as ServerErrorMessage) : undefined;
  case ServerMessageType.PROTOCOL_INCOMPATIBLE:
    return parsed as unknown as ProtocolIncompatibleMessage;
  case ServerMessageType.SUBSCRIBED:
    return (typeof parsed.gameAge === 'number' && typeof parsed.undoCount === 'number') ? (parsed as unknown as SubscribedMessage) : undefined;
  default:
    return undefined;
  }
}
