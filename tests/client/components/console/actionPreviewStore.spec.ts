import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {actionPreviewStore, ensureActionPreviews, resetActionPreviews} from '@/client/console/actionPreviewStore';

/*
 * REGRESSION (Steam Deck perf iteration 1): the RT-wheel pre-warm used to fire
 * one fetch per action source in a single synchronous burst (10-20 late game),
 * which on the Deck's embedded server competed with the wheel's own entry
 * animation for the same APU. The store now drains the same set through a
 * BOUNDED window (4 at a time). These specs pin: the bound, the refill, the
 * eventual completeness, and the stale-key drop.
 */

type PendingFetch = {url: string, resolve: (body: unknown) => void};

// Seven base-game ACTIVE cards with printed actions (stable manifest facts).
const ACTION_CARDS = [
  CardName.LIVESTOCK,
  CardName.PREDATORS,
  CardName.BIRDS,
  CardName.ANTS,
  CardName.TARDIGRADES,
  CardName.FISH,
  CardName.SMALL_ANIMALS,
];

function viewWith(cards: ReadonlyArray<CardName>, id = 'p-spec-preview-id'): PlayerViewModel {
  return {
    id,
    thisPlayer: {
      tableau: cards.map((name) => ({name})),
      actionsThisGeneration: [],
    },
    waitingFor: undefined,
  } as unknown as PlayerViewModel;
}

function previewBody(card: string) {
  return {card, isCorporation: false, kind: 'dynamic', branches: []};
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('actionPreviewStore (bounded pre-warm fan-out)', () => {
  let pending: Array<PendingFetch>;
  let started: number;
  const globalAny = globalThis as {fetch?: unknown};
  const originalFetch = globalAny.fetch;

  beforeEach(() => {
    resetActionPreviews();
    pending = [];
    started = 0;
    globalAny.fetch = (url: string, init?: {signal?: AbortSignal}) => new Promise((resolve, reject) => {
      started++;
      pending.push({url, resolve: (body: unknown) => resolve({ok: true, json: () => Promise.resolve(body)})});
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  });

  afterEach(() => {
    // Module state is BUNDLE-SHARED in mochapack — leave nothing behind.
    globalAny.fetch = originalFetch;
    resetActionPreviews();
  });

  it('starts at most 4 fetches at once and refills as responses land', async () => {
    ensureActionPreviews(viewWith(ACTION_CARDS));
    expect(started).eq(4);

    const first = pending.shift();
    expect(first).not.eq(undefined);
    first?.resolve(previewBody('x'));
    await tick();
    expect(started).eq(5); // one landed → one more started

    // Drain everything — every card ends up cached.
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('x'));
      await tick();
    }
    expect(started).eq(ACTION_CARDS.length);
    for (const name of ACTION_CARDS) {
      expect(actionPreviewStore.previews[name], name).not.eq(undefined);
    }
  });

  it('ensure() is idempotent while requests are queued or in flight', async () => {
    const view = viewWith(ACTION_CARDS);
    ensureActionPreviews(view);
    ensureActionPreviews(view);
    ensureActionPreviews(view);
    expect(started).eq(4); // no double-fetch, no queue duplication
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('x'));
      await tick();
    }
    expect(started).eq(ACTION_CARDS.length);
  });

  it('a fingerprint change aborts stale requests and drops the stale queue', async () => {
    ensureActionPreviews(viewWith(ACTION_CARDS));
    expect(started).eq(4);
    const stale = [...pending];
    pending = [];

    // The state moved on (different tableau → different fingerprint): the 4
    // stale requests are ABORTED at the socket, freeing the window for the
    // fresh key's 2 fetches — fresh data never queues behind garbage.
    ensureActionPreviews(viewWith([CardName.LIVESTOCK, CardName.BIRDS]));
    await tick();
    expect(started).eq(6);

    // A stale answer landing anyway is a no-op (its promise already rejected).
    for (const p of stale) {
      p.resolve(previewBody('stale'));
    }
    await tick();
    await tick();
    for (const name of [CardName.PREDATORS, CardName.ANTS, CardName.TARDIGRADES]) {
      expect(actionPreviewStore.previews[name], name).eq(undefined);
    }
    // …and the old queue never runs: no new fetches beyond the fresh key's.
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('x'));
      await tick();
    }
    expect(started).eq(6);
    expect(actionPreviewStore.previews[CardName.LIVESTOCK]).not.eq(undefined);
    expect(actionPreviewStore.previews[CardName.BIRDS]).not.eq(undefined);
  });
});
