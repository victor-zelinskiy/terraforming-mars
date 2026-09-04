import raw_settings from '@/genfiles/settings.json';
import {paths} from '@/common/app/paths';
import {
  ServerMessageType,
  clientHello,
  clientPing,
  parseServerMessage,
  serializeMessage,
  subscribeCampaign,
  unsubscribeCampaign,
} from '@/common/realtime/Protocol';
import {realtimeClientEnabled} from '@/client/components/realtime/realtimeConfig';

/**
 * THE CAMPAIGN PUSH CHANNEL — one WebSocket per (server, campaign), saying
 * only «this campaign's document changed» (a carryover confirmed, the next
 * mission launched, a result committed).
 *
 * The lobbyChannel shape, deliberately: pooled by key, revision-cursor
 * payloads only (the model itself stays name-scoped behind `api/campaign`),
 * and GRACEFUL AGAINST AN OLDER SERVER — a host that predates the campaign
 * room answers the subscribe with an ERROR; the channel records that once,
 * stops retrying, and reports itself un-healthy, which is precisely the
 * signal `campaignState` uses to keep its short poll. Nothing breaks, it
 * degrades to what it was before.
 *
 * This channel is what makes the interlude's readiness flow live: a non-host
 * who confirmed their carryover stands in the waiting state and AUTO-JOINS
 * the mission the moment the host launches it — without waiting for a poll.
 */

const clientVersion: string = (raw_settings as {head?: string}).head ?? 'dev';

const PING_INTERVAL_MS = 25_000;
/** A pong older than this means the socket is not carrying anything. */
const PONG_STALE_MS = 60_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 20_000;

export type CampaignChannelStatus = 'disabled' | 'connecting' | 'open' | 'reconnecting' | 'unsupported';

export type CampaignChannelHandle = {
  /** Drop this subscriber; the socket closes when it was the last one. */
  close(): void;
};

type Listener = (rev: number) => void;
/** «This channel's ability to carry pushes changed» — connect / drop / reject. */
type HealthListener = () => void;

type Channel = {
  key: string,
  wsBase: string,
  campaignId: string,
  socket: WebSocket | undefined,
  status: CampaignChannelStatus,
  listeners: Set<Listener>,
  healthListeners: Set<HealthListener>,
  subscribed: boolean,
  /** Highest revision this channel has seen (resume cursor on reconnect). */
  rev: number | undefined,
  lastPongAt: number | undefined,
  attempts: number,
  pingTimer: number | undefined,
  reconnectTimer: number | undefined,
  /** The server rejected the campaign subscription — an older build. */
  unsupported: boolean,
  closed: boolean,
};

const channels = new Map<string, Channel>();

function now(): number {
  return Date.now();
}

function channelKey(wsBase: string, campaignId: string): string {
  return wsBase + '::' + campaignId;
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
    window.clearInterval(channel.pingTimer);
    channel.pingTimer = undefined;
  }
  if (channel.reconnectTimer !== undefined) {
    window.clearTimeout(channel.reconnectTimer);
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
    send(channel, subscribeCampaign(channel.campaignId, channel.rev));
    break;
  case ServerMessageType.PONG:
    channel.lastPongAt = now();
    break;
  case ServerMessageType.CAMPAIGN_SUBSCRIBED:
    channel.subscribed = true;
    channel.lastPongAt = now();
    channel.rev = message.rev;
    notifyHealth(channel);
    break;
  case ServerMessageType.CAMPAIGN_INVALIDATED:
    channel.lastPongAt = now();
    channel.rev = message.rev;
    notify(channel, message.rev);
    break;
  case ServerMessageType.ERROR:
    // The only request this channel ever makes is the campaign subscription,
    // so an error means this server has no such room (or campaign). Degrade
    // to polling.
    if (!channel.subscribed) {
      channel.unsupported = true;
      channel.status = 'unsupported';
      closeSocket(channel);
      notifyHealth(channel);
    }
    break;
  case ServerMessageType.PROTOCOL_INCOMPATIBLE:
    channel.unsupported = true;
    channel.status = 'unsupported';
    closeSocket(channel);
    notifyHealth(channel);
    break;
  default:
    break;
  }
}

function notify(channel: Channel, rev: number): void {
  for (const listener of [...channel.listeners]) {
    try {
      listener(rev);
    } catch (err) {
      console.warn('campaignChannel: listener failed', err);
    }
  }
}

/** Announce a health TRANSITION — the owner re-arms its fallback poll on it. */
function notifyHealth(channel: Channel): void {
  for (const listener of [...channel.healthListeners]) {
    try {
      listener();
    } catch (err) {
      console.warn('campaignChannel: health listener failed', err);
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
      socket.send(serializeMessage(unsubscribeCampaign()));
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
    const wasCarrying = channel.subscribed;
    channel.socket = undefined;
    channel.subscribed = false;
    clearTimers(channel);
    scheduleReconnect(channel);
    if (wasCarrying) {
      notifyHealth(channel);
    }
  };
}

function destroy(channel: Channel): void {
  channel.closed = true;
  closeSocket(channel);
  channels.delete(channel.key);
}

/**
 * Subscribe to a campaign's push room on a server. Returns a handle whose
 * `close()` drops THIS subscriber; the socket lives while at least one
 * remains. Safe against a server with no gateway/room — the channel simply
 * never becomes healthy, and the caller's fallback poll stays in charge.
 */
export function openCampaignChannel(wsBase: string, campaignId: string, onInvalidate: Listener, onHealthChange?: HealthListener): CampaignChannelHandle {
  if (!realtimeClientEnabled() || wsBase === '' || campaignId === '') {
    return {close: () => {}};
  }
  const key = channelKey(wsBase, campaignId);
  let channel = channels.get(key);
  if (channel === undefined) {
    channel = {
      key,
      wsBase,
      campaignId,
      socket: undefined,
      status: 'connecting',
      listeners: new Set(),
      healthListeners: new Set(),
      subscribed: false,
      rev: undefined,
      lastPongAt: undefined,
      attempts: 0,
      pingTimer: undefined,
      reconnectTimer: undefined,
      unsupported: false,
      closed: false,
    };
    channels.set(key, channel);
    connect(channel);
  }
  const owner = channel;
  owner.listeners.add(onInvalidate);
  if (onHealthChange !== undefined) {
    owner.healthListeners.add(onHealthChange);
  }
  let released = false;
  return {
    close: () => {
      if (released) {
        return;
      }
      released = true;
      owner.listeners.delete(onInvalidate);
      if (onHealthChange !== undefined) {
        owner.healthListeners.delete(onHealthChange);
      }
      if (owner.listeners.size === 0) {
        destroy(owner);
      }
    },
  };
}

/**
 * True when this campaign's channel is CARRYING pushes right now: subscribed
 * and heard from recently. The input to the caller's poll cadence — a healthy
 * channel earns the long interval, anything else the short one.
 */
export function campaignChannelHealthy(wsBase: string, campaignId: string): boolean {
  const channel = channels.get(channelKey(wsBase, campaignId));
  if (channel === undefined || !channel.subscribed || channel.socket === undefined) {
    return false;
  }
  if (channel.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  return channel.lastPongAt !== undefined && now() - channel.lastPongAt < PONG_STALE_MS;
}

/** Diagnostics readout. */
export function campaignChannelStatus(wsBase: string, campaignId: string): CampaignChannelStatus | undefined {
  return channels.get(channelKey(wsBase, campaignId))?.status;
}

/** Tests: drop every channel + timer (module state is shared across specs). */
export function resetCampaignChannelsForTesting(): void {
  for (const channel of [...channels.values()]) {
    destroy(channel);
  }
  channels.clear();
}
