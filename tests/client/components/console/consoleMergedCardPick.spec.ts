import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';
import {playedCategoryState, resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
import {resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {CardName} from '@/common/cards/CardName';

/**
 * The «Разыграно» TABLEAU PICK screen — the surface that serves the merged
 * card pick (Astra Mechanica «return UP TO 2 events»):
 *
 *  - a MULTI pick ACCUMULATES, so the screen must advertise the COMMIT: the
 *    trigger that sends the selection is named ON the N/max counter (without
 *    it the player toggles cards with no idea how to finish);
 *  - a card's ✓ band must ride the SAME lift as the card, or the focus rise
 *    moves the card out from under its own badge.
 *
 * (The composer half — the two slots collapsing into ONE row titled by the
 * branch's merged prompt — is guarded server-side in
 * `tests/models/cardPlayPreview.spec.ts`: the branch carries the merged title
 * and it equals the LIVE SelectCard's ask. ConsolePlayCardConfirm itself
 * cannot be imported under mochapack.)
 */

const EVENTS = [CardName.ASTEROID, CardName.BIG_ASTEROID, CardName.FLOODING];
const MERGED_TITLE = 'Select up to 2 events to return to your hand';

function mountPickScreen() {
  return mount(ConsolePlayedCategoryView, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {ConsolePlayedCardLite: true, GamepadGlyph: {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'}},
    },
    props: {cards: EVENTS.map((name) => ({name})) as any},
  });
}

describe('console · the tableau pick screen', () => {
  afterEach(() => {
    resetPlayedCategoryView();
    resetConsolePlayedUi();
  });

  function enterPick(min: number, max: number, selected: Array<CardName> = []) {
    playedCategoryState.phase = 'open';
    playedCategoryState.names = [...EVENTS];
    playedCategoryState.pick = {
      title: MERGED_TITLE, buttonLabel: 'Select',
      selectable: [...EVENTS], disabled: [], reasons: {},
      min, max, selected: [], faceDown: [],
      source: {kicker: 'Play card', card: CardName.ASTRA_MECHANICA},
    } as any;
    playedCategoryState.pickSelected = [...selected];
  }

  it('a MULTI pick advertises the commit on the counter (the trigger is named)', () => {
    enterPick(0, 2, [CardName.ASTEROID]);
    const w = mountPickScreen();
    const cta = w.find('.con-played-cat__pickcta');
    expect(cta.exists(), 'the counter carries the commit CTA').to.be.true;
    expect(cta.find('.con-played-cat__pickcount').text().replace(/\s/g, '')).to.eq('1/2');
    expect(cta.find('.glyph-stub').exists(), 'the CONTROL is named by its glyph').to.be.true;
    expect(cta.find('.con-played-cat__pickcta-label').text()).to.not.eq('');
    w.unmount();
  });

  it('the CTA lights up only while the count is a valid answer', () => {
    enterPick(2, 2, [CardName.ASTEROID]);
    const w = mountPickScreen();
    expect(w.find('.con-played-cat__pickcta--ready').exists(), '1 of 2 is not sendable yet').to.be.false;
    playedCategoryState.pickSelected = [CardName.ASTEROID, CardName.BIG_ASTEROID];
    return w.vm.$nextTick().then(() => {
      expect(w.find('.con-played-cat__pickcta--ready').exists()).to.be.true;
      w.unmount();
    });
  });

  it('a SINGLE pick shows no counter CTA (one press resolves it)', () => {
    enterPick(1, 1);
    const w = mountPickScreen();
    expect(w.find('.con-played-cat__pickcta').exists()).to.be.false;
    w.unmount();
  });

  it('the ✓ band lives INSIDE the card\'s lift — the focus rise moves both', () => {
    enterPick(0, 2, [CardName.ASTEROID]);
    const w = mountPickScreen();
    const lift = w.find('.con-played-cat__lift');
    expect(lift.exists(), 'the focus-transform target exists').to.be.true;
    const band = w.find('.con-cards__pickband');
    expect(band.exists()).to.be.true;
    // The band and the card face share ONE transformed ancestor — that is what
    // stops the card from jumping out from under its own badge.
    const host = band.element.parentElement as HTMLElement;
    expect(host.classList.contains('con-played-cat__lift')).to.be.true;
    expect(host.querySelector('.con-played-cat__face'), 'the face rides the same lift').to.not.be.null;
    w.unmount();
  });
});
