/*
 * NotificationCard — one card of the desktop notification feed (its host is `NotificationLayer`, outside the console
 * posture). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Three props in (the live
 * notification, the players, the viewer's colour), five events out (`dismiss` · `toggle` · `cta` · `cta-secondary` ·
 * `cancel`), nothing exposed. The spec is what it renders for a model, what each control emits, the your-turn card's
 * «persistent until the player moves» countdown (window listeners it adds and takes back as the SAME function), and
 * the passive-effect chip (R11: its own element read through a template ref). A Vue warning fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePublicPlayerModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {JournalChildVM} from '@/client/components/journal/journalEventChild';
import {closeEffectDetail, effectDetailState} from '@/client/components/notifications/effectDetailState';
import {LiveNotification, NOTIFICATION_PRIORITY, NOTIFICATION_TTL} from '@/client/components/notifications/notificationTypes';
import NotificationCard from '@/client/components/notifications/NotificationCard.vue';

// The popover and the journal's breakdown row have specs of their own; this one reads what the CARD hands them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const PopoverStub = defineComponent({
  name: 'EffectPreviewPopover',
  props: ['name', 'anchor', 'visible'],
  render: () => h('i', {class: 'popover-stub'}),
});
const ChildRowStub = defineComponent({
  name: 'JournalChildRow',
  props: ['vm', 'players'],
  render: () => h('i', {class: 'row-stub'}),
});

const PLAYERS: ReadonlyArray<PublicPlayerModel> = [
  fakePublicPlayerModel({color: 'blue', name: 'Vik', plants: 5}),
  fakePublicPlayerModel({color: 'red', name: 'Ada'}),
];

/** 09:05 local time — the card prints the hour and the minute of the model's `createdAt`. */
const AT = new Date(2026, 0, 1, 9, 5).getTime();

function live(over: Partial<LiveNotification> = {}): LiveNotification {
  return {
    id: 'g7', kind: 'normal', variant: 'play-card', priority: NOTIFICATION_PRIORITY.normal, sign: 'neutral', importance: 'ambient',
    typeLabelKey: 'Card played', actor: 'red', pills: [], detailCount: 0, ttl: NOTIFICATION_TTL.normal, persistent: false,
    createdAt: AT, generation: 3, expanded: false, correlationId: 7, ...over,
  };
}

function mountCard(notification: LiveNotification) {
  return mount(NotificationCard, {
    props: {notification, players: PLAYERS, viewerColor: 'blue'},
    global: {...globalConfig.global, stubs: {EffectPreviewPopover: PopoverStub, JournalChildRow: ChildRowStub}},
  });
}

const A_ROW = {source: {kind: 'card', card: CardName.ANTS}, chips: [], bucket: 'effect'} as unknown as JournalChildVM;

type Listen = (type: string, fn: unknown, options?: unknown) => void;
const ACTIVITY = ['keydown', 'pointerdown', 'pointermove', 'wheel'];

describe('NotificationCard — one card of the desktop feed', () => {
  afterEach(() => {
    closeEffectDetail();
    effectDetailState.cardName = undefined;
    effectDetailState.ownerColor = undefined;
  });

  it('renders the model: its kind and variant, the type label, the hour, the headline\'s tokens, the actor\'s rail and its lifetime', async () => {
    const w = mountCard(live({
      header: {timestamp: 0, message: '${0} played a card', data: [{type: LogMessageDataType.PLAYER, value: 'red'}]},
    }));
    expect(w.classes()).to.include.members(['notification-card', 'notification-card--normal', 'notification-card--variant-play-card']);
    expect(w.classes()).to.not.include('notification-card--expandable');
    expect(w.attributes('aria-label')).to.eq('Card played');
    expect(w.find('.notification-card__type-label').text()).to.eq('Card played');
    expect(w.find('.notification-card__glyph').text()).to.eq('◈');
    expect(w.find('.notification-card__time').text()).to.eq('09:05');
    expect(w.find('.notification-card__headline .journal-player__name').text()).to.eq('Ada');
    expect(w.find('.notification-card__headline').text()).to.contain('played a card');
    expect(w.find('.notification-card__meta').exists(), 'the generation line is the turn card\'s').to.eq(false);
    // «What an opponent did» wears the actor's colour on its rail; a prestige variant keeps its own accent.
    expect(w.find('.notification-card__rail').classes()).to.include('player_bg_color_red');

    const progress = w.find('.notification-card__progress');
    expect((progress.element as HTMLElement).style.animationDuration).to.eq(`${NOTIFICATION_TTL.normal}ms`);
    await progress.trigger('animationend');
    await w.find('.notification-card__close').trigger('click');
    expect(w.emitted('dismiss'), 'the lifetime running out, then the close button').to.deep.eq([['g7'], ['g7']]);
    expect(w.emitted('toggle'), 'a card with no breakdown does not expand').to.eq(undefined);

    await w.setProps({notification: live({variant: 'milestone', kind: 'important', typeLabelKey: 'Milestone claimed'})});
    expect(w.find('.notification-card__rail').classes()).to.deep.eq(['notification-card__rail']);
    expect(w.find('.notification-card__glyph').text()).to.eq('🏆');
    expect(w.attributes('aria-label')).to.eq('Milestone claimed');
  });

  it('tints each impact pill by its sign and frame; a card with a breakdown expands on a click and folds on «Collapse»', async () => {
    const pills = [{icon: 'megacredits', text: '+3'}, {icon: 'plants', text: '−2'}, {icon: 'energy', text: '+1', production: true}];
    const w = mountCard(live({pills, childVMs: [A_ROW, A_ROW], detailCount: 2}));
    const chips = w.findAll('.notification-card__pills .notification-card__chip');
    expect(chips.map((c) => c.find('.notification-card__chip-amt').text())).to.deep.eq(['+3', '−2', '+1']);
    expect(chips[0].classes()).to.include('notification-card__chip--pos');
    expect(chips[1].classes()).to.include('notification-card__chip--neg');
    expect(chips[2].classes(), 'a production delta is framed, never tinted by its sign').to.include('notification-card__chip--prod');
    expect(chips[2].classes()).to.not.include('notification-card__chip--pos');

    expect(w.classes()).to.include('notification-card--expandable');
    expect(w.find('.notification-card__more-count').text()).to.eq('2');
    expect(w.find('.notification-card__detail').exists()).to.eq(false);
    await w.trigger('click');
    await w.find('.notification-card__more-pill').trigger('click');
    expect(w.emitted('toggle'), 'the card itself, then the pill — one event each').to.deep.eq([['g7'], ['g7']]);

    // The host owns `expanded`: it hands the model back opened.
    await w.setProps({notification: live({pills, childVMs: [A_ROW, A_ROW], detailCount: 2, expanded: true})});
    expect(w.classes()).to.include('notification-card--expanded');
    expect(w.findAllComponents(ChildRowStub).map((r) => r.props('vm'))).to.deep.eq([A_ROW, A_ROW]);
    expect(w.find('.notification-card__more-pill').exists()).to.eq(false);
    await w.find('.notification-card__less').trigger('click');
    expect(w.emitted('toggle')).to.have.length(3);
  });

  it('each footer action emits its own event with the notification — and never the card\'s toggle', async () => {
    const notification = live({
      childVMs: [A_ROW], detailCount: 1,
      cta: {labelKey: 'To journal', action: 'open-journal'},
      secondaryCta: {labelKey: 'Inspect', action: 'expand-theater'},
      cancelCta: {labelKey: 'Cancel', action: 'cancel'},
    });
    const w = mountCard(notification);
    const buttons = w.findAll('.notification-card__foot .notification-card__cta');
    expect(buttons.map((b) => b.text())).to.deep.eq(['Cancel', 'Inspect', 'To journal']);
    expect(buttons[2].classes(), 'the journal is a calm destination').to.include('notification-card__cta--ghost');
    for (const button of buttons) {
      await button.trigger('click');
    }
    expect(w.emitted('cancel')).to.deep.eq([[notification]]);
    expect(w.emitted('cta-secondary')).to.deep.eq([[notification]]);
    expect(w.emitted('cta')).to.deep.eq([[notification]]);
    expect(w.emitted('toggle')).to.eq(undefined);
  });

  it('a hostile loss names who caused it, what the viewer lost and the value before → after — and hides the pills that would say it twice', () => {
    const w = mountCard(live({
      kind: 'negative', variant: 'destroy', typeLabelKey: 'Resources destroyed',
      pills: [{icon: 'plants', text: '−3'}],
      negative: {attacker: 'red', sourceCard: CardName.ASTEROID, scope: 'stock', transfer: false, loss: [{icon: 'plants', text: '−3'}]},
    }));
    expect(w.find('.notification-card__neg-cause .journal-player__name').text()).to.eq('Ada');
    expect(w.findAll('.notification-card__neg-flow .notification-card__chip--neg').map((c) => c.text())).to.deep.eq(['−3']);
    expect(w.find('.notification-card__neg-arrow').exists(), 'destroyed, not moved').to.eq(false);
    expect(w.find('.notification-card__neg-tag').text()).to.eq('from stock');
    // The viewer (blue) holds 5 plants AFTER the loss of 3.
    expect(w.find('.notification-card__neg-ba').text()).to.eq('8 → 5');
    expect(w.find('.notification-card__pills').exists()).to.eq(false);
  });

  it('the YOUR-TURN card stands until the player moves: real pointer travel or a key arms a 3 s lifetime, and the listeners it added are the ones it takes back', async () => {
    const target = window as unknown as {addEventListener: Listen, removeEventListener: Listen};
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    const added: Array<[string, unknown]> = [];
    const removed: Array<[string, unknown]> = [];
    target.addEventListener = (type, fn, options) => {
      if (ACTIVITY.includes(type)) {
        added.push([type, fn]);
      }
      add.call(window, type, fn, options);
    };
    target.removeEventListener = (type, fn, options) => {
      if (ACTIVITY.includes(type)) {
        removed.push([type, fn]);
      }
      remove.call(window, type, fn, options);
    };
    try {
      const turn = live({id: 'turn:your-turn', kind: 'your-turn', variant: 'your-turn', typeLabelKey: 'Your turn', actor: undefined, bodyKey: 'Choose an action', ttl: 0, persistent: true});
      const w = mountCard(turn);
      expect(w.find('.notification-card__meta').text()).to.eq('Generation 3');
      expect(w.find('.notification-card__turn-line').text()).to.eq('Choose an action');
      expect(w.find('.notification-card__close').exists(), 'a persistent card has no close button').to.eq(false);
      expect(w.find('.notification-card__progress').exists()).to.eq(false);
      expect(added.map(([type]) => type).sort()).to.deep.eq(ACTIVITY);
      expect(new Set(added.map(([, fn]) => fn)).size, 'one handler for the four signals').to.eq(1);

      const move = (x: number, y: number) => window.dispatchEvent(new window.MouseEvent('pointermove', {clientX: x, clientY: y}));
      move(100, 100); // the first sample is only the origin
      move(102, 101); // a settle, under the threshold
      await nextTick();
      expect(w.find('.notification-card__progress').exists(), 'a 2 px jitter is not activity').to.eq(false);
      expect(removed).to.deep.eq([]);

      move(110, 100);
      await nextTick();
      expect((w.find('.notification-card__progress').element as HTMLElement).style.animationDuration).to.eq('3000ms');
      // Armed once — the card stops listening the moment it did, with the very function it had added.
      expect(removed.map(([type]) => type).sort()).to.deep.eq(ACTIVITY);
      expect(removed.every(([, fn]) => fn === added[0][1])).to.eq(true);

      // An ACTION-REQUIRED card is persistent too, and never arms: it listens to nothing.
      added.length = 0;
      const required = mountCard(live({id: 'turn:action-required', kind: 'action-required', variant: 'action-required', typeLabelKey: 'Action required', actor: undefined, prompt: 'Select a card to discard', ttl: 0, persistent: true}));
      expect(added).to.deep.eq([]);
      window.dispatchEvent(new window.Event('keydown'));
      await nextTick();
      expect(required.find('.notification-card__prompt').text()).to.eq('Select a card to discard');
      expect(required.find('.notification-card__progress').exists()).to.eq(false);

      // A turn card removed before the player moved takes its listeners with it.
      removed.length = 0;
      const second = mountCard(turn);
      const handler = added[0][1];
      second.unmount();
      expect(removed.map(([type]) => type).sort()).to.deep.eq(ACTIVITY);
      expect(removed.every(([, fn]) => fn === handler)).to.eq(true);
    } finally {
      target.addEventListener = add;
      target.removeEventListener = remove;
    }
  });

  it('a fired passive is a chip: hovering it hands the popover the card and the chip\'s own rect, a click opens the effect\'s details', async () => {
    const w = mountCard(live({variant: 'passive-effect', typeLabelKey: 'Effect triggered', effectSource: {kind: 'card', card: CardName.SPACE_STATION}}));
    const chip = w.find('.notification-card__effect-chip');
    expect(chip.find('.notification-card__effect-name').text()).to.eq(CardName.SPACE_STATION);
    const popover = w.findComponent(PopoverStub);
    expect([popover.props('name'), popover.props('visible'), popover.props('anchor')]).to.deep.eq([CardName.SPACE_STATION, false, undefined]);

    const rect = {x: 600, y: 200, left: 600, top: 200, width: 40, height: 20, right: 640, bottom: 220, toJSON: () => ({})};
    (chip.element as HTMLElement).getBoundingClientRect = () => rect;
    await chip.trigger('mouseenter');
    expect(popover.props('visible')).to.eq(true);
    expect(popover.props('anchor')).to.deep.eq(rect);
    await chip.trigger('mouseleave');
    expect(popover.props('visible')).to.eq(false);

    expect(effectDetailState.open).to.eq(false);
    await chip.trigger('click');
    expect([effectDetailState.open, effectDetailState.cardName, effectDetailState.ownerColor]).to.deep.eq([true, CardName.SPACE_STATION, 'red']);
    expect(w.emitted('toggle'), 'the chip\'s click is its own').to.eq(undefined);

    // A passive of an enacted RESOLUTION has no card: this card draws no chip for it and the popover gets no name.
    await w.setProps({notification: live({variant: 'passive-effect', typeLabelKey: 'Effect triggered', effectSource: {kind: 'resolution', resolution: 'rx01'}})});
    expect(w.find('.notification-card__effect-chip').exists()).to.eq(false);
    expect(w.findComponent(PopoverStub).props('name')).to.eq(undefined);
  });

  it('a parent\'s ref reaches nothing — the card exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(NotificationCard, {ref: 'card', notification: live(), players: PLAYERS, viewerColor: 'blue'})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: {EffectPreviewPopover: PopoverStub, JournalChildRow: ChildRowStub}}});
    expect(host.find('.notification-card').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.card ?? {}) as object), 'the layer drives it by props and hears it by events').to.deep.eq([]);
  });
});
