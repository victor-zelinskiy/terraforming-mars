import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  __resetGameTransportForTesting, startGameTransport, submitInput, TransportRoot, undeliveredQuestionSince,
} from '@/client/console/transport/gameTransport';
import {Phase} from '@/common/Phase';
import {ViewModel} from '@/common/models/PlayerModel';
import {WaitingForModel} from '@/common/models/WaitingForModel';

/**
 * THE POLL CHAIN CANNOT DIE WITH ITS REQUEST — AND IT KEEPS THE SERVER'S WORD APART FROM THE VIEW
 * (docs/claude/console/freeze-zero/PLAN.md §4 — `gameTransport.waitForUpdate` / `takePollAnswer`).
 *
 * The chain is the game's fallback liveness: off the player's own turn it is the ONLY thing that ever brings their
 * next question. Its re-arm was the last statement of the answer's handler — any throw above it (a body that is not
 * a model, a refresh that threw), or a request with no terminal event at all, ended the chain for good, in silence,
 * and a player watched «the other seat's turn» for ever. The properties below are what can no longer happen.
 */
describe('the poll chain', () => {
  /** The slice of `XMLHttpRequest` the transport's poll uses — every request made is kept, and ended by the spec. */
  class FakeXhr {
    public static sent: Array<FakeXhr> = [];
    public url = '';
    public status = 0;
    public response: unknown = null;
    public timeout = 0;
    public responseType = '';
    public aborted = false;
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public ontimeout: (() => void) | null = null;
    public open(_method: string, url: string): void {
      this.url = url;
    }
    public send(): void {
      FakeXhr.sent.push(this);
    }
    public abort(): void {
      this.aborted = true;
    }
    public answer(model: unknown, status = 200): void {
      this.status = status;
      this.response = model;
      this.onload?.();
    }
  }

  let clock: ManualFlowClock;
  let root: TransportRoot & {updates: number, alerts: Array<{title: string, dismiss: () => void}>, updateThrows: boolean};
  let realXhr: typeof XMLHttpRequest;
  let realFetch: typeof fetch;
  let warn: typeof console.warn;
  let error: typeof console.error;
  let warned: Array<string>;

  const view = (waitingFor?: unknown): ViewModel =>
    ({id: 'p-viewer', runId: 'run-1', waitingFor, game: {phase: Phase.ACTION, gameAge: 4, undoCount: 0}}) as unknown as ViewModel;
  const answer = (result: WaitingForModel['result']): WaitingForModel => ({result, waitingFor: [], changed: false});
  const last = (): FakeXhr => FakeXhr.sent[FakeXhr.sent.length - 1];

  beforeEach(() => {
    __resetGameTransportForTesting();
    clock = createManualClock(0);
    setFlowClock(clock);
    warned = [];
    warn = console.warn;
    error = console.error;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
    console.error = () => {};
    FakeXhr.sent = [];
    realXhr = globalThis.XMLHttpRequest;
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
    realFetch = globalThis.fetch;
    globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;
    root = {
      playerView: view(),
      playerkey: 0,
      playersWaitingFor: [],
      isServerSideRequestInProgress: false,
      updates: 0,
      alerts: [],
      updateThrows: false,
      updatePlayer() {
        this.updates++;
        if (this.updateThrows) {
          throw new Error('the refresh could not start');
        }
      },
      showAlert(title: string, _message: string, cb: () => void = () => {}) {
        this.alerts.push({title, dismiss: cb});
      },
    };
    startGameTransport(root);
    // The chain's first look is a timer of the transport's scope: one interval later the first request leaves.
    clock.advance(1_000);
    expect(FakeXhr.sent, 'the chain asks').to.have.length(1);
  });

  afterEach(() => {
    __resetGameTransportForTesting();
    setFlowClock(undefined);
    globalThis.XMLHttpRequest = realXhr;
    globalThis.fetch = realFetch;
    console.warn = warn;
    console.error = error;
  });

  it('an ordinary answer: the page does what the server said, and the next look is armed', () => {
    last().answer(answer('WAIT'));
    expect(root.updates).to.eq(0);
    clock.advance(1_000);
    expect(FakeXhr.sent).to.have.length(2);
    last().answer(answer('GO'));
    expect(root.updates, 'their question appeared: the view is fetched').to.eq(1);
    clock.advance(1_000);
    expect(FakeXhr.sent).to.have.length(3);
    expect(warned).to.deep.eq([]);
  });

  it('an answer whose TAKING THROWS does not end the chain — said, and the next look is armed all the same', () => {
    root.updateThrows = true;
    last().answer(answer('GO'));
    expect(warned.filter((line) => line.startsWith('[transport] the poll\'s answer could not be taken — Error: the refresh could not start'))).to.have.length(1);
    clock.advance(1_000);
    expect(FakeXhr.sent, 'the chain went on').to.have.length(2);
  });

  it('a body that is NOT a model (a proxy\'s page, an empty 200) is a failed answer — never a dead chain', () => {
    last().answer(null);
    last().answer('<html>');
    expect(warned.filter((line) => line.includes('not a waiting-for model'))).to.have.length(2);
    expect(root.updates).to.eq(0);
    clock.advance(1_000);
    expect(FakeXhr.sent.length).to.be.greaterThan(1);
  });

  it('a request with NO TERMINAL EVENT AT ALL — no answer, no error, no timeout — is cut and asked again past its bound', () => {
    const lost = last();
    clock.advance(19_999);
    expect(FakeXhr.sent, 'inside the bound the request has the floor').to.have.length(1);
    clock.advance(1);
    expect(lost.aborted, 'the request nobody ends is cut').to.eq(true);
    expect(warned.filter((line) => line.startsWith('[transport] the poll never ended'))).to.have.length(1);
    expect(FakeXhr.sent, 'and the chain asks again, at once').to.have.length(2);
    // …and a late event of the request that was cut changes nothing.
    lost.onload?.();
    expect(FakeXhr.sent).to.have.length(2);
  });

  it('the request\'s own TIMEOUT asks again at once, and an ERROR hands the chain to the alert — a wait on the player, in plain view', () => {
    last().ontimeout?.();
    expect(FakeXhr.sent).to.have.length(2);
    last().onerror?.();
    expect(root.alerts.map((a) => a.title)).to.deep.eq(['Error fetching state']);
    // The alert owns the chain: nothing asks behind it (no second alert piles up while the player reads the first)…
    clock.advance(120_000);
    expect(FakeXhr.sent).to.have.length(2);
    expect(warned).to.deep.eq([]);
    // …and its dismissal re-arms.
    root.alerts[0].dismiss();
    clock.advance(1_000);
    expect(FakeXhr.sent).to.have.length(3);
  });

  describe('the server\'s word, kept apart from the view', () => {
    it('GO while the applied view asks nothing is a DEBT — dated from the first time it was said of that view', () => {
      expect(undeliveredQuestionSince()).to.eq(0);
      last().answer(answer('GO'));
      const since = undeliveredQuestionSince();
      expect(since).to.be.greaterThan(0);
      // Said again of the SAME view: the same debt, the same date.
      clock.advance(1_000);
      last().answer(answer('GO'));
      expect(undeliveredQuestionSince()).to.eq(since);
    });

    it('…and it is SPENT by the question arriving, by the view being replaced, by the server taking it back', () => {
      last().answer(answer('GO'));
      expect(undeliveredQuestionSince()).to.be.greaterThan(0);
      // The view the server spoke of arrives — with the question.
      root.playerView = view({type: 'or', options: []});
      expect(undeliveredQuestionSince(), 'delivered').to.eq(0);
      // A view that replaces the one the word was said of spends the word, question or not (the next poll says it again).
      root.playerView = view();
      expect(undeliveredQuestionSince(), 'another view: the word must be said of THIS one').to.eq(0);
      clock.advance(1_000);
      last().answer(answer('GO'));
      expect(undeliveredQuestionSince()).to.be.greaterThan(0);
      clock.advance(1_000);
      last().answer(answer('WAIT'));
      expect(undeliveredQuestionSince(), 'the server waits for somebody else now').to.eq(0);
    });

    it('a view that asks is never a debt, whatever the poll says — nor is anything while the player\'s own submit is on the wire', () => {
      root.playerView = view({type: 'option', promptId: 7});
      last().answer(answer('GO'));
      expect(undeliveredQuestionSince()).to.eq(0);
      root.playerView = view();
      clock.advance(1_000);
      last().answer(answer('GO'));
      expect(undeliveredQuestionSince()).to.be.greaterThan(0);
      // The player answers (a submit leaves): what the poll last said is spent — it says it again if it still holds.
      root.playerView = view({type: 'option', promptId: 8});
      submitInput({type: 'option'});
      root.playerView = view();
      expect(undeliveredQuestionSince()).to.eq(0);
    });
  });
});
