import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `awaited` = the server is waiting on the VIEWER (their chip reads active). */
function view(opts: {awaited?: boolean, isTerraformed?: boolean} = {}): PlayerViewModel {
  const awaited = opts.awaited ?? true;
  const players = [
    {color: 'red', name: 'Вы', actionsTakenThisRound: 0, isActive: awaited, isWaitingForInput: awaited},
    {color: 'green', name: 'Оппонент', actionsTakenThisRound: 0, isActive: !awaited, isWaitingForInput: !awaited},
  ];
  return {
    thisPlayer: players[0],
    players,
    runId: '',
    game: {
      temperature: -20,
      oxygenLevel: 3,
      oceans: 2,
      venusScaleLevel: 0,
      generation: 3,
      deckSize: 100,
      phase: Phase.ACTION,
      passedPlayers: [],
      isTerraformed: opts.isTerraformed ?? false,
      lastSoloGeneration: 14,
      gameOptions: {expansions: {venus: false}},
    },
  } as unknown as PlayerViewModel;
}

function mountStrip(engageMs: number, opts: {awaited?: boolean, isTerraformed?: boolean} = {}) {
  return mount(ConsoleStatusStrip, {
    global: {
      ...globalConfig.global,
      stubs: {AnimatedMetricValue: true, ConsoleFlipValue: true, ConsoleProjectDeck: true},
    },
    props: {playerView: view(opts), attentionPending: false, attentionEngageMs: engageMs},
  });
}

describe('ConsoleStatusStrip attention beacon', () => {
  it('idle: no attention class, no beacon', () => {
    const w = mountStrip(5);
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });

  it('engages only after the debounce, on the VIEWER chip only', async () => {
    const w = mountStrip(5);
    await w.setProps({attentionPending: true});
    // Immediately after the raw signal: still off (debounce pending).
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    await sleep(25);
    await w.vm.$nextTick();
    const chips = w.findAll('.con-status__player');
    expect(chips[0].classes()).to.include('con-status__player--attention');
    expect(chips[1].classes()).to.not.include('con-status__player--attention');
    // The beacon badge lives inside the viewer chip.
    expect(chips[0].find('.con-status__beacon').exists()).to.be.true;
    expect(chips[1].find('.con-status__beacon').exists()).to.be.false;
  });

  it('releases INSTANTLY when the raw signal drops (the CTA card took over)', async () => {
    const w = mountStrip(5);
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.true;
    await w.setProps({attentionPending: false});
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
  });

  it('a transient flicker shorter than the debounce never engages', async () => {
    const w = mountStrip(50);
    await w.setProps({attentionPending: true});
    await sleep(5);
    await w.setProps({attentionPending: false});
    await sleep(80);
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });

  // A decision can be OWED while the table is still busy elsewhere (the corp
  // first action during another player's preludes; a minimized start
  // workspace). The player is then free to walk the interface, and an alarm
  // would demand something they cannot do — while the chip's own pill says
  // «ОЖИДАЕТ», which the flash flatly contradicted.
  it('stays silent while the viewer\'s status is NOT answerable', async () => {
    const w = mountStrip(5, {awaited: false});
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });

  it('lights the INSTANT the status turns answerable (the debounce is spent)', async () => {
    const w = mountStrip(5, {awaited: false});
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__beacon').exists()).to.be.false;
    // The server hands the viewer their turn: no second debounce — the pending
    // half has been engaged all along.
    await w.setProps({playerView: view({awaited: true})});
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.true;
    expect(w.find('.con-status__beacon').exists()).to.be.true;
  });

  it('goes quiet again if the status stops being answerable', async () => {
    const w = mountStrip(5);
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__beacon').exists()).to.be.true;
    await w.setProps({playerView: view({awaited: false})});
    await w.vm.$nextTick();
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });
});

// The FINAL generation is signalled by COLOUR ONLY (the --final gold on the
// same element): the label stays the ordinary «GEN.» — same text, same box,
// zero layout shift, never an added word/badge/icon. The English key IS the
// i18n key, so asserting the raw label also pins every locale: a locale can
// only translate the ONE ordinary key.
describe('ConsoleStatusStrip generation label', () => {
  it('ordinary generation: the «GEN.» label without the final marker class', () => {
    const w = mountStrip(5);
    const gen = w.find('.con-status__gen');
    expect(gen.exists()).to.be.true;
    expect(gen.find('.con-status__gen-label').text()).to.equal('GEN.');
    expect(gen.classes()).to.not.include('con-status__gen--final');
  });

  it('FINAL generation: the SAME «GEN.» label — colour class is the whole signal', () => {
    const w = mountStrip(5, {isTerraformed: true});
    const gen = w.find('.con-status__gen');
    expect(gen.classes()).to.include('con-status__gen--final');
    // Same text, no added word — «ФИНАЛЬНОЕ» (or any other marker) may not
    // reappear in any locale: the one key rendered is the ordinary one.
    expect(gen.find('.con-status__gen-label').text()).to.equal('GEN.');
    expect(gen.text()).to.not.match(/FINAL/i);
    // No extra badge/icon nodes joined the block for the final state.
    expect(gen.findAll('.con-status__gen-label').length).to.equal(1);
  });
});


// ── The GENERIC PENDING-EVENTS SIGNAL (the permanent top-bar slot) ───────────
// A PERMANENT compact instrument after «ПКЛ.»: dormant low-contrast «0» at
// all times, the waiting contrast + the real count ONLY after the backlog has
// waited CONTINUOUSLY through the 500 ms dwell (no active card + non-empty
// queue + delivery genuinely blocked). Purely presentational — the real
// delivery/FIFO never waits on it.
import {notificationState, resetNotifications, pushTransient} from '@/client/components/notifications/notificationState';
import {NOTIFICATION_PRIORITY} from '@/client/components/notifications/notificationTypes';
import {closeRevealViewer, revealViewerState} from '@/client/components/notifications/revealViewerState';
import {resetPresentationLeases} from '@/client/components/presentation/presentationFlow';

function queuedModel(id: string) {
  return {
    id, kind: 'normal' as const, variant: 'event' as const,
    priority: NOTIFICATION_PRIORITY['normal'], sign: 'neutral' as const,
    importance: 'ambient' as const, typeLabelKey: 'Event', pills: [],
    detailCount: 0, generation: 1, ttl: 6800, persistent: false, createdAt: 1,
  };
}

describe('ConsoleStatusStrip pending-events signal (.con-status__evq)', () => {
  beforeEach(() => {
    resetNotifications();
    resetPresentationLeases();
    closeRevealViewer();
    notificationState.seeded = true;
  });
  afterEach(() => {
    closeRevealViewer();
    resetNotifications();
  });

  function mountEvq(dwellMs = 20, coalesceMs = 20) {
    return mount(ConsoleStatusStrip, {
      global: {
        ...globalConfig.global,
        stubs: {AnimatedMetricValue: true, ConsoleFlipValue: true, ConsoleProjectDeck: true},
      },
      props: {playerView: view(), attentionPending: false, pendingEngageMs: dwellMs, pendingCoalesceMs: coalesceMs},
    });
  }

  function countText(w: ReturnType<typeof mountEvq>): string {
    return w.find('.con-status__evq-count').text().trim();
  }

  it('the slot is PERMANENT: dormant «0» with the glyph, never hidden, never resized', () => {
    const w = mountEvq();
    const evq = w.find('.con-status__evq');
    expect(evq.exists(), 'the slot is always in the DOM').to.be.true;
    expect(evq.classes()).to.not.include('con-status__evq--on');
    expect(countText(w)).to.equal('0');
    expect(w.find('.con-status__evq-glyph').text()).to.equal('◈');
  });

  it('a backlog that waits out the FULL dwell (blocked, no active card) shows the real count', async () => {
    const w = mountEvq(20);
    revealViewerState.open = true; // delivery genuinely blocked
    notificationState.queue.push(queuedModel('q1'), queuedModel('q2'));
    await w.vm.$nextTick();
    // Inside the dwell: still dormant «0».
    expect(w.find('.con-status__evq--on').exists()).to.be.false;
    expect(countText(w)).to.equal('0');
    await sleep(45);
    await w.vm.$nextTick();
    expect(w.find('.con-status__evq--on').exists()).to.be.true;
    // Engagement shows the ACTUAL count at once — never a 0→1→2 replay.
    expect(countText(w)).to.equal('2');
  });

  it('a blocker shorter than the dwell NEVER lights the slot (the timer is cancelled)', async () => {
    const w = mountEvq(60);
    revealViewerState.open = true;
    notificationState.queue.push(queuedModel('q1'));
    await w.vm.$nextTick();
    await sleep(15);
    // The blocker clears BEFORE the dwell expires — the raw state falls
    // (promoteFromQueue presents the card on the freed broadcast).
    closeRevealViewer();
    await w.vm.$nextTick();
    await sleep(90);
    await w.vm.$nextTick();
    expect(w.find('.con-status__evq--on').exists(), 'no post-hoc flash after the boundary').to.be.false;
    expect(countText(w)).to.equal('0');
    // …and the delivery itself was never delayed by the visual dwell.
    expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['q1']);
  });

  it('the dwell expiry RE-CHECKS the live conditions — a queue that emptied stays dormant', async () => {
    const w = mountEvq(25);
    revealViewerState.open = true;
    notificationState.queue.push(queuedModel('q1'));
    await w.vm.$nextTick();
    // The event leaves the queue before the dwell fires (drained elsewhere).
    notificationState.queue.splice(0);
    await w.vm.$nextTick();
    await sleep(50);
    await w.vm.$nextTick();
    expect(w.find('.con-status__evq--on').exists()).to.be.false;
    expect(countText(w)).to.equal('0');
  });

  it('while a card is ACTIVE the slot rests at «0» — the backlog belongs to «ДАЛЬШЕ +N»', async () => {
    const w = mountEvq(15);
    pushTransient(queuedModel('shown')); // presents (delivery open at this point)
    revealViewerState.open = true; // a blocker rises AFTER the card is up
    notificationState.queue.push(queuedModel('q1'));
    await sleep(40);
    await w.vm.$nextTick();
    expect(notificationState.transient.length, 'a card is active').to.be.greaterThan(0);
    expect(w.find('.con-status__evq--on').exists()).to.be.false;
    expect(countText(w)).to.equal('0');
  });

  it('rapid enqueues COALESCE: one calm update to the latest truth, never 1→2→3 churn', async () => {
    const w = mountEvq(15, 40);
    revealViewerState.open = true;
    notificationState.queue.push(queuedModel('q1'));
    await sleep(35);
    await w.vm.$nextTick();
    expect(countText(w)).to.equal('1');
    // Two more land in quick succession — the display holds, then jumps once.
    notificationState.queue.push(queuedModel('q2'));
    await w.vm.$nextTick();
    notificationState.queue.push(queuedModel('q3'));
    await w.vm.$nextTick();
    expect(countText(w), 'inside the coalescing window the digit holds').to.equal('1');
    await sleep(60);
    await w.vm.$nextTick();
    expect(countText(w)).to.equal('3');
  });

  it('delivery resuming returns the slot to dormant «0» IMMEDIATELY (no coalesce lag)', async () => {
    const w = mountEvq(15, 500);
    revealViewerState.open = true;
    notificationState.queue.push(queuedModel('q1'));
    await sleep(35);
    await w.vm.$nextTick();
    expect(w.find('.con-status__evq--on').exists()).to.be.true;
    closeRevealViewer(); // freed → the card presents in the same broadcast
    await w.vm.$nextTick();
    expect(w.find('.con-status__evq--on').exists()).to.be.false;
    expect(countText(w), 'the return to dormant never waits on the coalescing window').to.equal('0');
    expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['q1']);
  });

  it('caps the readable count at 9+ (fixed cell, tabular — no width change)', async () => {
    const w = mountEvq(15);
    revealViewerState.open = true;
    for (let i = 0; i < 12; i++) {
      notificationState.queue.push(queuedModel(`q${i}`));
    }
    await sleep(35);
    await w.vm.$nextTick();
    expect(countText(w)).to.equal('9+');
    expect((w.vm as unknown as {pendingCountText: string}).pendingCountText).to.equal('9+');
  });

  it('the glyph is the notification diamond — never a card/deck metaphor', () => {
    const w = mountEvq();
    expect(w.find('.con-status__evq-glyph').text()).to.equal('◈');
  });

  it('the visual layer never mutates the queue or delays FIFO (read-only by construction)', async () => {
    const w = mountEvq(500); // a dwell far longer than the test
    revealViewerState.open = true;
    notificationState.queue.push(queuedModel('q1'), queuedModel('q2'));
    await w.vm.$nextTick();
    closeRevealViewer();
    await w.vm.$nextTick();
    // The queue promoted on the freed broadcast — with the dwell still armed
    // and the slot silent: the indicator observed, it never gated.
    expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['q1']);
    expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['q2']);
    expect(w.find('.con-status__evq--on').exists()).to.be.false;
  });
});
