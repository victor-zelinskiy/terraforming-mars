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

type ViewOverrides = {id?: string, gameAge?: number, undoCount?: number, energy?: number};

function viewWith(cards: ReadonlyArray<CardName>, overrides: ViewOverrides = {}): PlayerViewModel {
  return {
    id: overrides.id ?? 'p-spec-preview-id',
    game: {gameAge: overrides.gameAge ?? 12, undoCount: overrides.undoCount ?? 0},
    thisPlayer: {
      tableau: cards.map((name) => ({name})),
      actionsThisGeneration: [],
      megacredits: 20, steel: 0, titanium: 0, plants: 0,
      energy: overrides.energy ?? 0, heat: 0, terraformRating: 20,
      megacreditProduction: 0, steelProduction: 1, titaniumProduction: 0,
      plantProduction: 0, energyProduction: 0, heatProduction: 0,
    },
    waitingFor: undefined,
  } as unknown as PlayerViewModel;
}

async function drain(pending: Array<PendingFetch>): Promise<void> {
  while (pending.length > 0) {
    pending.shift()?.resolve(previewBody('x'));
    await tick();
  }
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

  it('SPENDING A RESOURCE invalidates the cache (a branch is gated on the stock)', async () => {
    // REGRESSION («Фактотум»). Its first branch is available iff
    // `player.energy === 0`. The player opened the workspace holding energy
    // (branch refused: «Только когда у вас нет энергии»), went and SPENT that
    // energy, and came back on their next turn — the tableau, the server's
    // activatable set and the track position were all unchanged, so the same
    // cached preview was served and the activation stayed refused for the rest
    // of the game. The key is the SERVER'S state version now, so the whole
    // family of "a preview reads state nobody listed" is closed at once.
    const before = viewWith(ACTION_CARDS, {energy: 4, gameAge: 30});
    ensureActionPreviews(before);
    const keyBefore = actionPreviewStore.key;
    await drain(pending);
    expect(started, 'every action source answered once').eq(ACTION_CARDS.length);

    // The energy is gone — and the server counted the action that spent it.
    ensureActionPreviews(viewWith(ACTION_CARDS, {energy: 0, gameAge: 31}));
    expect(actionPreviewStore.key, 'the state moved, so the key must').not.eq(keyBefore);
    await drain(pending);
    expect(started, 'and every spent verdict is re-asked').eq(ACTION_CARDS.length * 2);
    for (const name of ACTION_CARDS) {
      expect(actionPreviewStore.versions[name], name).eq(actionPreviewStore.key);
    }
  });

  it('the SERVER STATE VERSION alone invalidates it — no structural term needed', async () => {
    // The general half of the same rule: whatever the preview happened to read
    // (a global parameter, an opponent's tableau, a card the client models as
    // nothing at all), a server-side change moves `gameAge`/`undoCount`.
    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 40}));
    const keyBefore = actionPreviewStore.key;
    await drain(pending);

    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 41}));
    expect(actionPreviewStore.key).not.eq(keyBefore);
    await drain(pending);
    expect(started, 'a bare version bump re-asks everything').eq(ACTION_CARDS.length * 2);

    // …and an UNDO is a state change too, even when nothing else moved.
    const keyAfterAge = actionPreviewStore.key;
    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 41, undoCount: 1}));
    expect(actionPreviewStore.key).not.eq(keyAfterAge);
  });

  it('a re-ask does NOT blank the grid — the old answers paint until replaced', async () => {
    // The other half of the same change. The key now moves on ANY server-side
    // change, opponents' turns included, and the Action Center is read during
    // those on purpose. Wiping the cache on every bump would strip each tile's
    // branch refinement and re-rank the status sort several times per opponent
    // turn — the «jumping tiles» this store exists to remove.
    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 50}));
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('old'));
      await tick();
    }
    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 51}));
    for (const name of ACTION_CARDS) {
      expect(actionPreviewStore.previews[name]?.card, name).eq('old'); // still painting
      expect(actionPreviewStore.versions[name], `${name} is marked stale`).not.eq(actionPreviewStore.key);
    }

    // …and each is replaced the moment its own answer lands.
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('fresh'));
      await tick();
    }
    for (const name of ACTION_CARDS) {
      expect(actionPreviewStore.previews[name]?.card, name).eq('fresh');
      expect(actionPreviewStore.versions[name]).eq(actionPreviewStore.key);
    }
  });

  it('a stale entry never survives its own FAILED refetch', async () => {
    // The escape hatch that would recreate the bug: if a refetch fails, the
    // entry it was replacing must not go on answering forever. It degrades to
    // the permissive confirm-only fallback instead — activation is never
    // blocked by a lost request, and no spent verdict outlives its refetch.
    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 60}));
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('old'));
      await tick();
    }
    ensureActionPreviews(viewWith(ACTION_CARDS, {gameAge: 61}));
    while (pending.length > 0) {
      pending.shift()?.resolve(undefined); // a server error / a lost answer
      await tick();
    }
    for (const name of ACTION_CARDS) {
      expect(actionPreviewStore.previews[name]?.card, name).not.eq('old');
      expect(actionPreviewStore.previews[name]?.branches[0]?.available, name).eq(true);
      expect(actionPreviewStore.versions[name]).eq(actionPreviewStore.key);
    }
  });

  it('an ordinary track move INVALIDATES the cache (a preview carries the route)', async () => {
    // REGRESSION: Storm Surge Barrier's preview carries the SERVER's whole
    // verdict on a Hydronetwork move — from, to, the landing stage. An
    // ordinary advance on the track changes none of the other fingerprint
    // terms, so the cached offer survived a real move and the card's door then
    // opened on a spent route: the marker animated 5→6 while the server moved
    // 7→8 and paid the other stage's reward.
    const before = viewWith(ACTION_CARDS);
    ensureActionPreviews(before);
    const keyBefore = actionPreviewStore.key;
    await drain(pending);
    expect(actionPreviewStore.previews[ACTION_CARDS[0]]).not.eq(undefined);

    const after = viewWith(ACTION_CARDS);
    (after.thisPlayer as unknown as {deltaProject: unknown}).deltaProject = {position: 7, stops: []};
    ensureActionPreviews(after);

    expect(actionPreviewStore.key, 'the track position is part of the fingerprint').not.eq(keyBefore);
    expect(
      actionPreviewStore.versions[ACTION_CARDS[0]],
      'and the spent offer is marked stale + re-asked',
    ).not.eq(actionPreviewStore.key);
    await drain(pending);
    expect(started, 'every preview re-asked').eq(ACTION_CARDS.length * 2);
  });

  it('the same position is NOT a change (a poll replay stays a no-op)', async () => {
    const seated = () => {
      const v = viewWith(ACTION_CARDS);
      (v.thisPlayer as unknown as {deltaProject: unknown}).deltaProject = {position: 3, stops: []};
      return v;
    };
    ensureActionPreviews(seated());
    const key = actionPreviewStore.key;
    while (pending.length > 0) {
      pending.shift()?.resolve(previewBody('x'));
      await tick();
    }
    ensureActionPreviews(seated());
    expect(actionPreviewStore.key).eq(key);
    expect(started).eq(ACTION_CARDS.length); // nothing refetched
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
