import {expect} from 'chai';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armHandPlayPrewarm,
  cancelHandPlayPrewarm,
  resetHandPlayPrewarm,
  storeHandPlayPreview,
  takeHandPlayPreview,
  handPlayVersionOf,
} from '@/client/console/consoleHandPlayPrewarm';
import {gameStateVersion} from '@/client/console/gameStateVersion';

/** A minimal view carrying exactly what the version key reads. */
function view(gameAge: number, undoCount = 0, id = 'p-test'): PlayerViewModel {
  return {id, game: {gameAge, undoCount}} as unknown as PlayerViewModel;
}

function preview(tag: string): ActionPreview {
  return {branches: [], title: tag} as unknown as ActionPreview;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 1));

describe('consoleHandPlayPrewarm — the focus-dwell preparation pipeline', () => {
  afterEach(() => resetHandPlayPrewarm());

  it('a warmed preview is a synchronous HIT for the same card and game state', async () => {
    const v = view(7);
    armHandPlayPrewarm(v, 'AI Central', () => Promise.resolve(preview('warm')), 0);
    await tick(); // dwell 0 → fetch fires on the next macrotask
    await tick();
    const read = takeHandPlayPreview(v, 'AI Central');
    expect(read.hit).to.eq(true);
    expect((read.preview as {title?: string} | undefined)?.title).to.eq('warm');
  });

  /**
   * CORRECTNESS OVER WARMTH: an entry fetched under one game state must never
   * dress a later one — resources, discounts and requirements may have moved.
   * The entry is not patched; it simply stops matching.
   */
  it('a game-state change INVALIDATES the preparation (version-keyed, never patched)', async () => {
    const v7 = view(7);
    armHandPlayPrewarm(v7, 'AI Central', () => Promise.resolve(preview('stale')), 0);
    await tick();
    await tick();
    expect(takeHandPlayPreview(view(8), 'AI Central').hit).to.eq(false);
    expect(takeHandPlayPreview(view(7, 1), 'AI Central').hit).to.eq(false);
    expect(takeHandPlayPreview(v7, 'AI Central').hit).to.eq(true);
  });

  /**
   * LATEST FOCUS WINS: riffling across the hand re-arms the dwell each time,
   * so intermediate cards never fetch at all — only the card the player
   * settles on costs a request.
   */
  it('re-arming cancels the pending dwell — riffled-past cards never fetch', async () => {
    const v = view(3);
    const fetched: Array<string> = [];
    const loader = (name: string) => () => {
      fetched.push(name);
      return Promise.resolve(preview(name));
    };
    armHandPlayPrewarm(v, 'First', loader('First'), 50);
    armHandPlayPrewarm(v, 'Second', loader('Second'), 50);
    armHandPlayPrewarm(v, 'Third', loader('Third'), 0);
    await tick();
    await tick();
    expect(fetched).to.deep.eq(['Third']);
    expect(takeHandPlayPreview(v, 'First').hit).to.eq(false);
    expect(takeHandPlayPreview(v, 'Third').hit).to.eq(true);
  });

  it('cancel kills the pending dwell outright (leaving the hand mid-dwell)', async () => {
    const v = view(3);
    let fetches = 0;
    armHandPlayPrewarm(v, 'AI Central', () => {
      fetches++;
      return Promise.resolve(preview('x'));
    }, 0);
    cancelHandPlayPrewarm();
    await tick();
    await tick();
    expect(fetches).to.eq(0);
    expect(takeHandPlayPreview(v, 'AI Central').hit).to.eq(false);
  });

  it('an already-warm card does not re-fetch for the same game state', async () => {
    const v = view(4);
    let fetches = 0;
    const loader = () => {
      fetches++;
      return Promise.resolve(preview('once'));
    };
    armHandPlayPrewarm(v, 'AI Central', loader, 0);
    await tick();
    await tick();
    armHandPlayPrewarm(v, 'AI Central', loader, 0);
    await tick();
    await tick();
    expect(fetches).to.eq(1);
  });

  it('the composer\'s own fetch feeds the cache (a re-open remounts warm)', () => {
    const v = view(5);
    storeHandPlayPreview(v, 'Birds', preview('live'));
    expect(takeHandPlayPreview(v, 'Birds').hit).to.eq(true);
    // …including an honest «no preview» result: undefined is a valid answer,
    // and re-fetching it would be the same round-trip for the same nothing.
    storeHandPlayPreview(v, 'Empty', undefined);
    const read = takeHandPlayPreview(v, 'Empty');
    expect(read.hit).to.eq(true);
    expect(read.preview).to.eq(undefined);
  });

  it('reset clears everything (game switch / shell unmount)', () => {
    const v = view(6);
    storeHandPlayPreview(v, 'Birds', preview('gone'));
    resetHandPlayPrewarm();
    expect(takeHandPlayPreview(v, 'Birds').hit).to.eq(false);
  });

  it('the version key reads player + gameAge + undoCount — nothing else', () => {
    // The SHARED stamp (`gameStateVersion`), not a private recipe: this cache
    // and the action-preview store must go stale on the same events, so the
    // format belongs to that one function.
    expect(handPlayVersionOf(view(7, 2, 'me'))).to.eq(gameStateVersion({id: 'me', game: {gameAge: 7, undoCount: 2}}));
    // The counters are LABELLED (`a`/`u`) so a key in a log or a failure
    // message says which one moved.
    expect(handPlayVersionOf(view(7, 2, 'me'))).to.eq('me|a7|u2');
  });
});
