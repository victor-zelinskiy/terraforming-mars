import raw_settings from '@/genfiles/settings.json';
import {paths} from '@/common/app/paths';
import {
  ServerMessageType,
  clientHello,
  clientPing,
  parseServerMessage,
  serializeMessage,
  subscribeLobby,
  unsubscribeLobby,
} from '@/common/realtime/Protocol';
import {realtimeClientEnabled} from '@/client/components/realtime/realtimeConfig';

/**
 * THE LOBBY PUSH CHANNEL — one WebSocket per SERVER, saying only «the set of
 * games here changed».
 *
 * Why a separate module from `realtimeService`: that one is a SINGLETON bound to
 * the game the page is playing (participant token, game room, resume cursor).
 * The lobby is the opposite shape — no participant, no game, and possibly
 * SEVERAL servers at once: in host-as-server mode «Мои партии» lists this
 * device's own embedded server plus every LAN host discovered over mDNS
 * (docs/EMBEDDED_SERVER.md §6), and each of them has its own lobby.
 *
 * So the channel is keyed by `wsBase` and POOLED: two subscribers of the same
 * base share one socket, and the socket closes when the last one leaves.
 *
 * WHAT IT CARRIES. `LOBBY_INVALIDATED {revision}` — a counter, never data. The
 * listing itself is still fetched over REST (`api/games/joinable`), which is
 * what keeps it name-scoped. A subscriber therefore learns nothing it could not
 * learn by polling; the channel only removes the WAITING.
 *
 * GRACEFUL AGAINST AN OLDER SERVER. A host that predates the lobby room answers
 * the subscribe with an ERROR; the channel records that once, stops retrying the
 * subscription, and reports itself un-healthy — which is precisely the signal
 * `lobbyState` uses to keep polling that source at the short interval. Nothing
 * breaks, it just degrades to what it was before.
 */

const clientVersion: string = (raw_settings as {head?: string}).head ?? 'dev';

const PING_INTERVAL_MS = 25_000;
/** A pong older than this means the socket is not carrying anything. */
const PONG_STALE_MS = 60_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 20_000;

export type LobbyChannelStatus = 'disabled' | 'connecting' | 'open' | 'reconnecting' | 'unsupported';

export type LobbyChannelHandle = {
  /** Drop this subscriber; the socket closes when it was the last one. */
  close(): void;
};

type Listener = (revision: number) => void;

type Channel = {
  wsBase: string;
  socket: WebSocket | undefined;
  status: LobbyChannelStatus;
  listeners: Set<Listener>;
  subscribed: boolean;
  /** Highest revision this channel has seen (resume cursor on reconnect). */
  revision: number | undefined;
  lastPongAt: number | undefined;
  attempts: number;
  pingTimer: number | undefined;
  reconnectTimer: number | undefined;
  /** The server rejected the lobby subscription — an older build. */
  unsupported: boolean;
  closed: boolean;
};

const channels = new Map<string, Channel>();

function now(): number {
  return Date.now();
}

function url(wsBase: string): string {
  return `${wsBase.replace(/\/+$/, '')}/${paths.WEBSOCKET}`;
}

function send(channel: Channel, message: Parameters<typeof serializeMessage>[0]): void {
  const socket = channel.socket;
  if (socket === undefined || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    socket.send(serializeMessage(message));
  } catch {
    // A dead socket is handled by its own close/error path.
  }
}

function clearTimers(channel: Channel): void {
  if (channel.pingTimer !== undefined) {
    clearInterval(channel.pingTimer);
    channel.pingTimer = undefined;
  }
  if (channel.reconnectTimer !== undefined) {
    clearTimeout(channel.reconnectTimer);
    channel.reconnectTimer = undefined;
  }
}

function scheduleReconnect(channel: Channel): void {
  if (channel.closed || channel.unsupported || channel.reconnectTimer !== undefined) {
    return;
  }
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, channel.attempts), RECONNECT_MAX_MS);
  channel.attempts++;
  channel.status = 'reconnecting';
  channel.reconnectTimer = window.setTimeout(() => {
    channel.reconnectTimer = undefined;
    connect(channel);
  }, delay);
}

function onMessage(channel: Channel, raw: string): void {
  const message = parseServerMessage(raw);
  if (message === undefined) {
    return;
  }
  switch (message.type) {
  case ServerMessageType.HELLO:
    // The hello is the moment the socket is proven usable — subscribe now,
    // carrying the last revision we know so a gap re-syncs immediately.
    send(channel, subscribeLobby(channel.revision));
    break;
  case ServerMessageType.PONG:
    channel.lastPongAt = now();
    break;
  case ServerMessageType.LOBBY_SUBSCRIBED:
    channel.subscribed = true;
    channel.lastPongAt = now();
    channel.revision = message.revision;
    break;
  case ServerMessageType.LOBBY_INVALIDATED:
    channel.lastPongAt = now();
    channel.revision = message.revision;
    notify(channel, message.revision);
    break;
  case ServerMessageType.ERROR:
    // The only request this channel ever makes is the lobby subscription, so an
    // error means this server does not have the room. Degrade to polling.
    if (!channel.subscribed) {
      channel.unsupported = true;
      channel.status = 'unsupported';
      closeSocket(channel);
    }
    break;
  case ServerMessageType.PROTOCOL_INCOMPATIBLE:
    channel.unsupported = true;
    channel.status = 'unsupported';
    closeSocket(channel);
    break;
  default:
    break;
  }
}

function notify(channel: Channel, revision: number): void {
  for (const listener of [...channel.listeners]) {
    try {
      listener(revision);
    } catch (err) {
      console.warn('lobbyChannel: listener failed', err);
    }
  }
}

function closeSocket(channel: Channel): void {
  const socket = channel.socket;
  channel.socket = undefined;
  channel.subscribed = false;
  clearTimers(channel);
  if (socket === undefined) {
    return;
  }
  try {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(serializeMessage(unsubscribeLobby()));
    }
    socket.close();
  } catch {
    // Already gone.
  }
}

function connect(channel: Channel): void {
  if (channel.closed || channel.unsupported || channel.socket !== undefined) {
    return;
  }
  if (typeof WebSocket === 'undefined') {
    channel.status = 'unsupported';
    return;
  }
  channel.status = channel.attempts === 0 ? 'connecting' : 'reconnecting';
  let socket: WebSocket;
  try {
    socket = new WebSocket(url(channel.wsBase));
  } catch {
    scheduleReconnect(channel);
    return;
  }
  channel.socket = socket;
  socket.onopen = () => {
    if (channel.socket !== socket) {
      return;
    }
    channel.status = 'open';
    channel.attempts = 0;
    channel.lastPongAt = now();
    send(channel, clientHello(clientVersion, undefined));
    channel.pingTimer = window.setInterval(() => send(channel, clientPing()), PING_INTERVAL_MS);
  };
  socket.onmessage = (event) => {
    if (channel.socket === socket && typeof event.data === 'string') {
      onMessage(channel, event.data);
    }
  };
  socket.onerror = () => {
    // The close handler does the reconnect bookkeeping.
  };
  socket.onclose = () => {
    if (channel.socket !== socket) {
      return;
    }
    channel.socket = undefined;
    channel.subscribed = false;
    clearTimers(channel);
    scheduleReconnect(channel);
  };
}

function destroy(channel: Channel): void {
  channel.closed = true;
  closeSocket(channel);
  channels.delete(channel.wsBase);
}

/**
 * Subscribe to a server's lobby. Returns a handle whose `close()` drops THIS
 * subscriber; the underlying socket lives as long as at least one remains.
 * Safe to call for a base that has no realtime gateway — it simply never
 * becomes healthy, and the caller's fallback poll stays in charge.
 */
export function openLobbyChannel(wsBase: string, onInvalidate: Listener): LobbyChannelHandle {
  if (!realtimeClientEnabled() || wsBase === '') {
    return {close: () => {}};
  }
  let channel = channels.get(wsBase);
  if (channel === undefined) {
    channel = {
      wsBase,
      socket: undefined,
      status: 'connecting',
      listeners: new Set(),
      subscribed: false,
      revision: undefined,
      lastPongAt: undefined,
      attempts: 0,
      pingTimer: undefined,
      reconnectTimer: undefined,
      unsupported: false,
      closed: false,
    };
    channels.set(wsBase, channel);
    connect(channel);
  }
  const owner = channel;
  owner.listeners.add(onInvalidate);
  let released = false;
  return {
    close: () => {
      if (released) {
        return;
      }
      released = true;
      owner.listeners.delete(onInvalidate);
      if (owner.listeners.size === 0) {
        destroy(owner);
      }
    },
  };
}

/**
 * True when this base's channel is CARRYING pushes right now: subscribed and
 * heard from recently. This is the input to the caller's poll cadence — a
 * healthy channel earns the long interval, anything else the short one.
 */
export function lobbyChannelHealthy(wsBase: string): boolean {
  const channel = channels.get(wsBase);
  if (channel === undefined || !channel.subscribed || channel.socket === undefined) {
    return false;
  }
  if (channel.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  return channel.lastPongAt !== undefined && now() - channel.lastPongAt < PONG_STALE_MS;
}

/** Diagnostics readout (the System surface's realtime panel). */
export function lobbyChannelStatus(wsBase: string): LobbyChannelStatus | undefined {
  return channels.get(wsBase)?.status;
}

/** Tests: drop every channel + timer (module state is shared across specs). */
export function resetLobbyChannelsForTesting(): void {
  for (const channel of [...channels.values()]) {
    destroy(channel);
  }
  channels.clear();
}
