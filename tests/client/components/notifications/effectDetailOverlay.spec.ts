/*
 * EffectDetailOverlay — the per-effect DETAIL modal a «сработал эффект» notification opens. App mounts it once; the
 * notification card drives it through the module state (`effectDetailState`). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). Two props in (the viewer's id, the players), no emit, nothing exposed; the spec is
 * what it renders off the module state, the three ways it closes, and the one request it makes. No mount below hands
 * it a translator or a directive — the overlay brings its own — and a Vue warning fails the test.
 */
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePublicPlayerModel} from '../testHelpers';
import {paths} from '@/common/app/paths';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {$t} from '@/client/directives/i18n';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {playerEffects} from '@/client/components/effects/effectExtraction';
import {closeEffectDetail, effectDetailState, openEffectDetail} from '@/client/components/notifications/effectDetailState';
import EffectDetailOverlay from '@/client/components/notifications/EffectDetailOverlay.vue';

// The details panel is the «Эффекты» overlay's own (large) surface; this spec reads what the modal HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PanelStub = defineComponent({
  name: 'EffectDetailsPanel',
  props: ['entry', 'effectCount', 'siblingIcons', 'stat', 'card', 'loading'],
  render: () => h('i', {class: 'panel-stub'}),
});

function overlay(props: {viewerId?: string, players?: ReadonlyArray<PublicPlayerModel>} = {}) {
  return mount(EffectDetailOverlay, {
    props,
    global: {
      // The teleport is stubbed so the modal is read where it is rendered (its target is the document's body).
      stubs: {teleport: true, EffectDetailsPanel: PanelStub},
      config: globalConfig.global.config,
    },
  });
}

describe('EffectDetailOverlay — the effect detail modal', () => {
  const PLAYERS = [
    fakePublicPlayerModel({color: 'red', name: 'Victor'}),
    fakePublicPlayerModel({color: 'blue', name: 'Nastya'}),
  ];
  let realFetch: typeof fetch;
  let requests: Array<string> = [];
  let answer: ReadonlyArray<unknown> = [];
  let waiting: Array<() => void> = [];

  function resetState(): void {
    closeEffectDetail();
    effectDetailState.cardName = undefined;
    effectDetailState.ownerColor = undefined;
  }

  beforeEach(() => {
    resetState();
    requests = [];
    answer = [];
    waiting = [];
    realFetch = globalThis.fetch;
    // The server is a stub that answers when the test lets it — no request ever leaves the process.
    globalThis.fetch = ((url: string) => {
      requests.push(String(url));
      return new Promise<Response>((resolve) => {
        waiting.push(() => resolve({ok: true, json: () => Promise.resolve(answer)} as unknown as Response));
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    // Module state is bundle-shared: the state the modal reads and the global it calls are put back.
    globalThis.fetch = realFetch;
    resetState();
  });

  it('stays out of the page until the module state opens it — then names the effect\'s owner and hands the panel the card\'s effect', async () => {
    const w = overlay({players: PLAYERS});
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.effect-detail-modal-overlay').exists()).to.eq(false);

    openEffectDetail(CardName.SPACE_STATION, 'red');
    await nextTick();
    const dialog = w.find('.effect-detail-modal-overlay > .effect-detail-modal');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-modal')).to.eq('true');
    // The copy is the modal's own: its `v-i18n` on the kicker, its `$t` on the close button's label.
    expect(w.find('.effect-detail-modal__kicker').attributes('tm-has-i18n')).to.eq('true');
    expect(w.find('.effect-detail-modal__close').attributes('aria-label')).to.eq($t('Close'));

    const owner = w.find('.effect-detail-modal__owner');
    expect(owner.classes()).to.include('player_translucent_bg_color_red');
    expect(owner.find('.journal-player__dot').classes()).to.include('player_bg_color_red');
    expect(owner.find('.journal-player__name').text()).to.eq('Victor');

    // ONE effect: no tabs, and the panel gets that effect with nothing beside it.
    const effects = playerEffects([{name: CardName.SPACE_STATION}]);
    expect(effects).to.have.length(1);
    expect(w.find('.effect-detail-modal__tabs').exists()).to.eq(false);
    const panel = w.findComponent(PanelStub);
    expect(panel.props('entry').key).to.eq(effects[0].key);
    expect(panel.props('effectCount')).to.eq(1);
    expect(panel.props('siblingIcons')).to.deep.eq([]);
    expect(panel.props('card')).to.deep.eq({name: CardName.SPACE_STATION});
    expect(panel.props('stat')).to.eq(undefined);
    expect(panel.props('loading')).to.eq(false);
    expect(requests, 'no viewer — no request').to.deep.eq([]);
  });

  it('a card with several effects gets a tab per effect — the pressed one is the effect shown, the others lend their icons as siblings', async () => {
    const w = overlay({players: PLAYERS});
    const effects = playerEffects([{name: CardName.CARBON_NANOSYSTEMS}]);
    expect(effects).to.have.length(2);
    const activeTabs = () => w.findAll('.effect-detail-modal__tab').map((tab) => tab.classes().includes('effect-detail-modal__tab--active'));

    openEffectDetail(CardName.CARBON_NANOSYSTEMS, undefined);
    await nextTick();
    expect(w.find('.effect-detail-modal__owner').exists(), 'no owner colour — no chip').to.eq(false);
    expect(w.findAll('.effect-detail-modal__tab').map((tab) => tab.text())).to.deep.eq(['1', '2']);
    expect(activeTabs()).to.deep.eq([true, false]);
    expect(w.findComponent(PanelStub).props('effectCount')).to.eq(2);
    expect(w.findComponent(PanelStub).props('entry').key).to.eq(effects[0].key);
    expect(w.findComponent(PanelStub).props('siblingIcons')).to.deep.eq([...effects[1].signature.icons]);

    await w.findAll('.effect-detail-modal__tab')[1].trigger('click');
    expect(activeTabs()).to.deep.eq([false, true]);
    expect(w.findComponent(PanelStub).props('entry').key).to.eq(effects[1].key);
    expect(w.findComponent(PanelStub).props('siblingIcons')).to.deep.eq([...effects[0].signature.icons]);

    // Opened again, it starts from the first effect.
    closeEffectDetail();
    await nextTick();
    expect(w.find('.effect-detail-modal-overlay').exists()).to.eq(false);
    openEffectDetail(CardName.CARBON_NANOSYSTEMS, undefined);
    await nextTick();
    expect(activeTabs()).to.deep.eq([true, false]);
    expect(w.findComponent(PanelStub).props('entry').key).to.eq(effects[0].key);
  });

  it('closes by its ✕, by a press on the backdrop itself and by Escape — and stops listening once it has left', async () => {
    const w = overlay();
    const reopen = async (): Promise<void> => {
      openEffectDetail(CardName.SPACE_STATION, undefined);
      await nextTick();
    };

    await reopen();
    await w.find('.effect-detail-modal__close').trigger('click');
    expect(effectDetailState.open).to.eq(false);
    expect(w.find('.effect-detail-modal-overlay').exists()).to.eq(false);

    await reopen();
    await w.find('.effect-detail-modal').trigger('click');
    expect(effectDetailState.open, 'a press INSIDE the dialog is not a press on the backdrop').to.eq(true);
    await w.find('.effect-detail-modal-overlay').trigger('click');
    expect(effectDetailState.open).to.eq(false);

    await reopen();
    window.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Enter'}));
    expect(effectDetailState.open, 'another key closes nothing').to.eq(true);
    window.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape'}));
    expect(effectDetailState.open).to.eq(false);
    await nextTick();

    // Gone while open, its key listener is gone with it.
    await reopen();
    w.unmount();
    window.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape'}));
    expect(effectDetailState.open, 'nobody listens after the unmount').to.eq(true);
  });

  it('with a viewer it asks the server for the OWNER\'s effect stats on every opening, shows the wait, and hands the panel the card\'s row', async () => {
    const row = {sourceKey: 'card:' + CardName.SPACE_STATION, kind: 'card', card: CardName.SPACE_STATION, triggerCount: 3};
    answer = [{sourceKey: 'card:' + CardName.EARTH_OFFICE, kind: 'card', card: CardName.EARTH_OFFICE, triggerCount: 1}, row];
    const w = overlay({viewerId: 'p viewer', players: PLAYERS});
    expect(requests, 'closed, it asks nothing').to.deep.eq([]);

    openEffectDetail(CardName.SPACE_STATION, 'blue');
    await nextTick();
    expect(requests).to.deep.eq([`${apiUrl(paths.API_GAME_EFFECT_STATS)}?id=p%20viewer&color=blue`]);
    expect(w.findComponent(PanelStub).props('loading')).to.eq(true);
    expect(w.findComponent(PanelStub).props('stat')).to.eq(undefined);

    waiting.forEach((answerNow) => answerNow());
    await flushPromises();
    expect(w.findComponent(PanelStub).props('loading')).to.eq(false);
    expect(w.findComponent(PanelStub).props('stat')).to.deep.eq(row);

    // An effect with no owner asks nothing — and the earlier answer does not outlive its opening.
    closeEffectDetail();
    await nextTick();
    openEffectDetail(CardName.SPACE_STATION, undefined);
    await nextTick();
    expect(requests).to.have.length(1);
    expect(w.findComponent(PanelStub).props('stat')).to.eq(undefined);
    expect(w.findComponent(PanelStub).props('loading')).to.eq(false);
  });
});
