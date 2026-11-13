/*
 * NotificationLayer — the App-level surface of the notification center: it reads the module store
 * (`notificationState`), feeds it the signals of the player's view and the two per-generation streams, and draws the
 * feed. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). One prop in (the player's view), no
 * emit, nothing exposed — `App` stands no ref on it.
 *
 * What the feed DECIDES is `notificationIngest` / `notificationState` / `notificationModel` (their own specs, and the
 * consumer harness on the server runner). This spec is the layer's own wiring: it mounts over an honest minimal view
 * without a warning; its first pass and every later view reach the store; the two requests are one pair at a time,
 * re-asked only when the game advanced and by the fallback tick, and gone with the layer; the card it draws is the
 * COMPONENT of the posture (R21 — `<component :is>` is fed the component itself, never a name); the journal opening
 * drains the queue.
 */
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {consoleModeState} from '@/client/console/consoleModeState';
import {journalState} from '@/client/components/journal/journalState';
import {resetTerraformingCelebration} from '@/client/components/gameProgress/terraformingCelebration';
import {resetMaCeremony} from '@/client/components/ma/maCeremonyState';
import {resetQuestCeremony} from '@/client/console/parliament/questCeremony';
import {resetBotTurnAckForTesting} from '@/client/components/marsbot/botTurnAck';
import {resetPresentationLeases} from '@/client/components/presentation/presentationFlow';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {resetNotificationIngest} from '@/client/components/notifications/notificationIngest';
import {notificationState, pushMany, resetNotifications, setTurn} from '@/client/components/notifications/notificationState';
import {NotificationKind, NotificationModel, NOTIFICATION_PRIORITY} from '@/client/components/notifications/notificationTypes';
import ConsoleNotificationCard from '@/client/components/console/ConsoleNotificationCard.vue';
import NotificationCard from '@/client/components/notifications/NotificationCard.vue';
import NotificationLayer from '@/client/components/notifications/NotificationLayer.vue';

type FetchHolder = {fetch: unknown};
type Call = {url: string, signal: AbortSignal};
type Diag = {seeded: boolean, live: ReadonlyArray<{kind: string}>, queued: ReadonlyArray<unknown>};
type DiagHolder = {__conNotifDiag?: () => Diag};

/** The layer's own safe poll rate (its `POLL_INTERVAL_MS`), as the realtime service stretches it right now. */
const tickMs = (): number => realtimePollIntervalMs(2200);

function model(id: string, kind: NotificationKind = 'normal', extra: Partial<NotificationModel> = {}): NotificationModel {
  return {
    id, kind, variant: 'event', priority: NOTIFICATION_PRIORITY[kind], sign: 'neutral', importance: 'ambient', typeLabelKey: 'Event',
    pills: [], detailCount: 0, generation: 1, ttl: kind === 'your-turn' ? 0 : 8000, persistent: kind === 'your-turn', createdAt: 1, ...extra,
  };
}

function view(generation = 1, gameAge = 0): PlayerViewModel {
  const playerView = fakePlayerViewModel();
  playerView.game.generation = generation;
  playerView.game.gameAge = gameAge;
  return playerView;
}

describe('NotificationLayer — the notification center\'s surface', () => {
  let originalFetch: unknown;
  let calls: Array<Call>;
  let clock: ManualFlowClock;
  let wasConsole: boolean;
  const unmounts: Array<() => void> = [];

  /** What stands in the module graph the layer writes — back to «no game yet». */
  function resetFeed(): void {
    resetNotifications();
    resetNotificationIngest();
    resetPresentationLeases();
    resetTerraformingCelebration();
    resetMaCeremony();
    resetQuestCeremony();
    resetBotTurnAckForTesting();
    journalState.open = false;
  }

  beforeEach(() => {
    resetFeed();
    wasConsole = consoleModeState.enabled;
    clock = createManualClock(0);
    setFlowClock(clock);
    calls = [];
    originalFetch = (globalThis as unknown as FetchHolder).fetch;
    // Both streams answer «nothing happened yet»: the log's bare array, the events' coherent pair.
    (globalThis as unknown as FetchHolder).fetch = (url: string, init: {signal: AbortSignal}) => {
      calls.push({url, signal: init.signal});
      const body = url.includes('meta=1') ? {events: [], openEventCorrelations: []} : [];
      return Promise.resolve({json: () => Promise.resolve(body)});
    };
  });

  afterEach(() => {
    // The layer leaves BEFORE its clock does: its poller's tick stands on the clock of this test.
    for (const unmount of unmounts.splice(0)) {
      unmount();
    }
    (globalThis as unknown as FetchHolder).fetch = originalFetch;
    setFlowClock(undefined);
    consoleModeState.enabled = wasConsole;
    resetFeed();
  });

  function mountLayer(playerView: PlayerViewModel = view()) {
    const wrapper = mount(NotificationLayer, {
      props: {playerView},
      // The teleport is stubbed so the layer is read where it is rendered (its target is the document's body).
      global: {...globalConfig.global, stubs: {teleport: true}},
    });
    unmounts.push(() => wrapper.unmount());
    return wrapper;
  }

  it('mounts with an empty feed; its first pass hands the store the viewer and the generation, asks both streams once and seeds the feed', async () => {
    const w = mountLayer();
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.notifications-layer').attributes('aria-live')).to.eq('polite');
    expect(w.find('.notifications-layer').classes()).to.deep.eq(['notifications-layer']);
    expect(w.find('.notifications-layer__stack').element.children).to.have.length(0);
    expect(w.find('.con-notifq').exists()).to.eq(false);
    expect(w.find('.notif-pending').exists()).to.eq(false);

    expect([notificationState.viewerColor, notificationState.lastGeneration, notificationState.turn]).to.deep.eq(['blue', 1, undefined]);
    expect(calls.map((c) => c.url)).to.deep.eq([
      `${apiUrl(paths.API_GAME_LOGS)}?id=p-blue-id&generation=1`,
      `${apiUrl(paths.API_GAME_JOURNAL_EVENTS)}?id=p-blue-id&generation=1&meta=1`,
    ]);
    expect(notificationState.seeded, 'the answer is still in flight').to.eq(false);
    await flushPromises();
    expect(notificationState.seeded, 'the first diff — even an empty one — seeds the feed').to.eq(true);

    // The read-only probe an e2e asks «why did no card arrive» lives exactly as long as the layer.
    const holder = window as unknown as DiagHolder;
    expect(holder.__conNotifDiag?.()).to.include({seeded: true});
    w.unmount();
    expect(holder.__conNotifDiag).to.eq(undefined);
  });

  it('a view that ADVANCED the game is read again — a new pair of requests, the pair before it aborted; a re-commit of the same version asks nothing', async () => {
    const w = mountLayer(view(1, 0));
    await flushPromises();
    expect(calls).to.have.length(2);

    // The same game moment under a new object (a structural-sharing re-swap, a same-state repoll).
    await w.setProps({playerView: view(1, 0)});
    await flushPromises();
    expect(calls, 'the streams cannot have grown').to.have.length(2);

    await w.setProps({playerView: view(2, 5)});
    expect(notificationState.lastGeneration).to.eq(2);
    expect(calls.slice(2).map((c) => c.url.replace(/^.*generation=/, ''))).to.deep.eq(['2', '2&meta=1']);
    expect(calls.map((c) => c.signal.aborted), 'one pair at a time').to.deep.eq([true, true, false, false]);
  });

  it('the fallback tick asks again on its own; an unmounted layer aborts its last pair and polls no more', async () => {
    const w = mountLayer();
    await flushPromises();
    expect(calls).to.have.length(2);

    clock.advance(tickMs());
    expect(calls, 'unconditional — an opponent may have moved a game the viewer\'s own view has not caught up to').to.have.length(4);
    expect(calls.map((c) => c.signal.aborted)).to.deep.eq([true, true, false, false]);

    w.unmount();
    expect(calls.map((c) => c.signal.aborted)).to.deep.eq([true, true, true, true]);
    clock.advance(tickMs() * 3);
    expect(calls).to.have.length(4);
  });

  it('draws the visible model as the CONSOLE card — the component, fed the view\'s players and the viewer — with the queue\'s tail under it; a dismiss hands the place to the next', async () => {
    const playerView = view();
    const w = mountLayer(playerView);
    await flushPromises();
    pushMany([model('a'), model('b'), model('c')]);
    await nextTick();

    const cards = w.findAllComponents(ConsoleNotificationCard);
    expect(cards.map((c) => c.props('notification').id)).to.deep.eq(['a']);
    expect(cards[0].props('players')).to.deep.eq(playerView.players);
    expect(cards[0].props('viewerColor')).to.eq('blue');
    expect(w.find('.notifications-layer__stack .con-notif').exists(), 'the console card\'s own root, not an unknown tag').to.eq(true);
    expect(w.findComponent(NotificationCard).exists()).to.eq(false);
    expect(w.find('.con-notifq__count').text()).to.eq('+2');
    expect(w.find('.con-notifq').classes()).to.not.include('con-notifq--critical');
    expect(w.find('.notif-pending').exists(), 'the clickable pill is the desktop posture\'s').to.eq(false);

    cards[0].vm.$emit('dismiss', 'a');
    await nextTick();
    expect(w.findAllComponents(ConsoleNotificationCard).map((c) => c.props('notification').id)).to.deep.eq(['b']);
    expect(w.find('.con-notifq__count').text()).to.eq('+1');

    w.findComponent(ConsoleNotificationCard).vm.$emit('dismiss', 'b');
    await nextTick();
    w.findComponent(ConsoleNotificationCard).vm.$emit('dismiss', 'c');
    await nextTick();
    expect(w.findComponent(ConsoleNotificationCard).exists()).to.eq(false);
    expect(w.find('.con-notifq').exists(), 'the tail leaves with the last card').to.eq(false);
  });

  it('opening the journal drops the ordinary cards still queued — a hostile one waits on, the visible one stays', async () => {
    const w = mountLayer();
    await flushPromises();
    pushMany([model('a'), model('b'), model('hit', 'negative'), model('c')]);
    await nextTick();
    expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b', 'hit', 'c']);
    expect(w.find('.con-notifq').classes(), 'a loss is waiting').to.include('con-notifq--critical');

    journalState.open = true;
    await nextTick();
    expect(w.find('.notifications-layer').classes()).to.include('notifications-layer--journal-open');
    expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['hit']);
    expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
  });

  it('outside the console posture the same feed is the DESKTOP card: the turn card above it, a card\'s «to journal» and the pending pill both open the journal', async () => {
    consoleModeState.enabled = false;
    const w = mountLayer();
    await flushPromises();
    setTurn(model('turn:your-turn', 'your-turn', {variant: 'your-turn', typeLabelKey: 'Your turn', bodyKey: 'Choose an action'}));
    pushMany([model('a', 'important', {cta: {labelKey: 'To journal', action: 'open-journal'}}), model('hit', 'negative')]);
    await nextTick();

    expect(w.findComponent(ConsoleNotificationCard).exists()).to.eq(false);
    const cards = w.findAllComponents(NotificationCard);
    expect(cards.map((c) => c.props('notification').id), 'the pinned turn card, then the feed').to.deep.eq(['turn:your-turn', 'a']);
    expect(w.find('.con-notifq').exists()).to.eq(false);
    expect(w.find('.notif-pending__count').text()).to.eq('+1');

    // No root event behind the card: the journal itself is the destination, and the card has been answered. Its
    // place goes to the queued loss, which the opening journal never drops.
    await cards[1].find('.notification-card__cta').trigger('click');
    expect(journalState.open).to.eq(true);
    expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['hit']);
    expect(notificationState.turn?.id, 'the turn card is not the feed\'s').to.eq('turn:your-turn');

    journalState.open = false;
    pushMany([model('later', 'important')]);
    await nextTick();
    await w.find('.notif-pending').trigger('click');
    expect(journalState.open).to.eq(true);
  });

  it('a parent\'s ref reaches nothing — the layer exposes no member', async () => {
    const Host = defineComponent({
      render: () => h('div', [h(NotificationLayer, {ref: 'layer', playerView: view()})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: {teleport: true}}});
    unmounts.push(() => host.unmount());
    await flushPromises();
    expect(host.find('.notifications-layer').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.layer ?? {}) as object), 'App mounts it and hands it the view — nothing more').to.deep.eq([]);
  });
});
