/*
 * CardList — the «Cards List» page (`/cards`): every card, global event, colony, milestone, award and agenda of the
 * game behind one set of filters. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its filters
 * are ONE model read off the location hash and written back to it whole (R4 — the one `data()` of the client that
 * returned a computed object: `reactive(hashToModel(…))` + `toRefs`), so this spec is about that round trip: what the
 * page shows for a hash, that a control writes the model the hash is built from (on the list's own owned timer), and
 * that the lists follow the filters. The faces themselves are stand-ins — each has a spec of its own. It exposes
 * nothing: `App` mounts it by route and stands no ref on it.
 */
import {expect} from 'chai';
import {flushPromises, mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import {APP_NAME} from '@/common/constants';
import {CardName} from '@/common/cards/CardName';
import {GAME_MODULES} from '@/common/cards/GameModule';
import {ColonyModel} from '@/common/models/ColonyModel';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {hashToModel, modelToHash} from '@/client/components/cardlist/CardListModel';
import CardList from '@/client/components/cardlist/CardList.vue';

// The page renders ~1 500 faces: each is a stand-in that says which one it is and what the page handed it.
const CardStub = defineComponent({
  props: {
    card: {type: Object as PropType<{name: CardName}>, required: true},
    autoTall: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'card-stub', 'data-name': this.card.name, 'data-tall': String(this.autoTall)});
  },
});
const ColonyStub = defineComponent({
  props: {colony: {type: Object as PropType<ColonyModel>, required: true}},
  render() {
    return h('i', {'class': 'colony-stub', 'data-name': this.colony.name, 'data-active': String(this.colony.isActive)});
  },
});
const STUBS = {Card: CardStub, Colony: ColonyStub, GlobalEvent: true, Milestone: true, Award: true, TurmoilAgendaContainer: true, PreferencesIcon: true};

// Every mount builds the page's search index over every card of the game, and every filter re-sorts them all: each
// test carries the RENDER's budget (seconds on a loaded machine), never mocha's 2 s of logic.
describe('CardList — the cards list page', () => {
  let clock: ManualFlowClock;
  let mounted: Array<VueWrapper>;

  function mountList(hash = ''): VueWrapper {
    window.location.hash = hash;
    const wrapper = mount(CardList, {...globalConfig, attachTo: document.body, global: {...globalConfig.global, stubs: STUBS}});
    mounted.push(wrapper);
    return wrapper;
  }
  const shownCards = (wrapper: VueWrapper) => wrapper.findAll('.card-stub').map((c) => c.attributes('data-name') as CardName);
  const hidden = (wrapper: VueWrapper, selector: string) => (wrapper.find(selector).element as HTMLElement).style.display === 'none';
  const label = (wrapper: VueWrapper, selector: string) => wrapper.find(selector).text().replace(/\s+/g, ' ');

  beforeEach(() => {
    // The page syncs the hash on an owned timer of the flow kernel: the spec drives the kernel's clock.
    clock = createManualClock(0);
    setFlowClock(clock);
    mounted = [];
  });
  afterEach(() => {
    // (unmounted before the real clock is back: the list's timer stands on the manual one)
    for (const wrapper of mounted) {
      wrapper.unmount();
    }
    setFlowClock(undefined);
    window.location.hash = '';
  });

  it('with no hash: every list on show, the filters at rest, the filter field focused, the page titled', async () => {
    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.classes()).to.deep.eq(['card-list-container', 'language-' + getPreferences().lang]);
    expect(wrapper.find('h1').text()).to.eq(translateText('Cards List'));
    expect(document.title).to.eq(`${translateText('Cards List')} | ${translateText(APP_NAME)}`);

    const filter = wrapper.find('input.filter');
    expect(document.activeElement, 'the page opens ready to type').to.eq(filter.element);
    expect((filter.element as HTMLInputElement).value).to.eq('');
    expect(filter.attributes('placeholder')).to.eq(translateText('filter'));

    expect(label(wrapper, '#namesOnlyToggle')).to.eq(translateText('Names only'));
    expect(label(wrapper, '#sort-order')).to.contain(translateText('A-Z'));
    expect(label(wrapper, '#show-vps-only')).to.eq(translateText('all'));
    expect(hidden(wrapper, '#selections'), 'the advanced filters are folded').to.eq(true);
    expect(GAME_MODULES.map((module) => (wrapper.find(`[id="${module}-checkbox"]`).element as HTMLInputElement).checked), 'a box per module, all ticked')
      .to.deep.eq(GAME_MODULES.map(() => true));

    const sections = wrapper.findAll('section');
    expect(sections.length).to.eq(10);
    expect(sections.map((s) => (s.element as HTMLElement).style.display), 'no list is empty').to.deep.eq(sections.map(() => ''));
    const projects = sections[0].findAll('.cardbox > .card-stub').map((c) => c.attributes('data-name') as CardName);
    expect(projects).to.include.members([CardName.ASTEROID, CardName.ANTS, CardName.BIRDS]);
    expect(projects, 'A–Z by the translated name').to.deep.eq(
      [...projects].map((name) => ({name, text: translateText(name)})).sort((a, b) => a.text.localeCompare(b.text)).map((e) => e.name));
    expect(sections[1].findAll('.card-stub').map((c) => c.attributes('data-name')), 'corporations').to.include(CardName.ECOLINE);
    expect(wrapper.findAll('.card-stub').map((c) => c.attributes('data-tall')).every((tall) => tall === 'false')).to.eq(true);
    expect(wrapper.findAll('.colony-stub').map((c) => c.attributes('data-active')).every((active) => active === 'true'), 'colonies show their track').to.eq(true);
    expect(wrapper.findAll('global-event-stub').length).to.be.greaterThan(0);
    expect(wrapper.findAll('milestone-stub').length).to.be.greaterThan(0);
    expect(wrapper.findAll('award-stub').length).to.be.greaterThan(0);
    expect(wrapper.findAll('turmoil-agenda-container-stub').length).to.be.greaterThan(0);
    expect(wrapper.find('.free-floating-preferences-icon > preferences-icon-stub').exists()).to.eq(true);
  }).timeout(30_000); // the one mount of the WHOLE list (~1 500 stand-ins)

  it('reads its filters off the location hash: the text, the folded panel, the order', async () => {
    const wrapper = mountList('#Asteroid~d!1');
    await flushPromises();

    expect((wrapper.find('input.filter').element as HTMLInputElement).value).to.eq('Asteroid');
    expect(hidden(wrapper, '#selections'), '«!» opens the advanced filters').to.eq(false);
    expect(label(wrapper, '#advanced-search-collapser')).to.eq(translateText('Advanced «'));
    expect(label(wrapper, '#sort-order'), '«1» orders by card number').to.contain(translateText('0-9'));

    const shown = shownCards(wrapper);
    expect(shown).to.include.members([CardName.ASTEROID, CardName.BIG_ASTEROID]);
    expect(shown.every((name) => name.toLocaleUpperCase().includes('ASTEROID')), 'names only: nothing else is listed').to.eq(true);
    const projects = wrapper.findAll('section')[0].findAll('.card-stub').map((c) => c.attributes('data-name') as CardName);
    const numbers = projects.map((name) => getCardOrThrow(name).metadata.cardNumber ?? '');
    expect(numbers, 'by card number').to.deep.eq([...numbers].sort((a, b) => a.localeCompare(b)));
  }).timeout(15_000);

  it('a control writes the ONE model the hash is built from — synced on the list\'s own timer, never at once', async () => {
    const wrapper = mountList('#Asteroid');
    await flushPromises();
    expect(window.location.hash, 'nothing is written at mount').to.eq('#Asteroid');
    clock.advance(200);
    const atRest = modelToHash(hashToModel('#Asteroid'));
    expect(window.location.hash, 'the first sync spells the hash out in full').to.eq(atRest);

    await wrapper.find('input.filter').setValue('Ants');
    await wrapper.find('#namesOnlyToggle').trigger('click');
    await wrapper.find('#advanced-search-collapser').trigger('click');
    await wrapper.find('[id="venus-checkbox"]').setValue(false);
    expect(window.location.hash, 'not before the next sync').to.eq(atRest);
    expect(label(wrapper, '#namesOnlyToggle')).to.eq(translateText('Full text'));
    expect(hidden(wrapper, '#selections')).to.eq(false);

    clock.advance(100);

    const model = hashToModel('');
    model.filterText = 'Ants';
    model.namesOnly = false;
    model.showAdvanced = true;
    model.expansions.venus = false;
    expect(window.location.hash).to.eq(modelToHash(model));
    // …and the hash it wrote is the page it shows: a reload lands on the same filters.
    const again = hashToModel(window.location.hash);
    expect([again.filterText, again.namesOnly, again.showAdvanced, again.expansions.venus, again.expansions.base]).to.deep.eq(['Ants', false, true, false, true]);

    // The sync re-arms itself for as long as the page stands, and ends with it.
    await wrapper.find('#sort-order').trigger('click');
    clock.advance(100);
    model.sortOrder = '1';
    expect(window.location.hash).to.eq(modelToHash(model));
    wrapper.unmount();
    expect(clock.pending(), 'no timer of the list outlives it').to.eq(0);
  }).timeout(15_000);

  it('the lists follow the filters: victory points, tall cards, colony tracks, a whole row inverted', async () => {
    // «Titan» names cards of both kinds (some score, some do not) and two colonies: every list below has something to lose.
    const wrapper = mountList('#Titan');
    await flushPromises();
    const all = shownCards(wrapper);
    const scoring = (name: CardName) => getCardOrThrow(name).victoryPoints !== undefined;
    expect(all.some(scoring) && !all.every(scoring), 'the probe set holds both kinds').to.eq(true);

    await wrapper.find('#show-vps-only').trigger('click');
    expect(label(wrapper, '#show-vps-only')).to.eq(translateText('+VPs'));
    expect(shownCards(wrapper)).to.deep.eq(all.filter(scoring));
    await wrapper.find('#show-vps-only').trigger('click');
    expect(label(wrapper, '#show-vps-only')).to.eq(translateText('-VPs'));
    expect(shownCards(wrapper)).to.deep.eq(all.filter((name) => !scoring(name)));
    await wrapper.find('#show-vps-only').trigger('click');
    expect(label(wrapper, '#show-vps-only')).to.eq(translateText('all'));
    expect(shownCards(wrapper)).to.deep.eq(all);

    await wrapper.find('#tall-cards').trigger('click');
    expect(wrapper.findAll('.card-stub').map((c) => c.attributes('data-tall')), 'every face is re-rendered tall').to.deep.eq(all.map(() => 'true'));

    const colonies = () => wrapper.findAll('.colony-stub').map((c) => c.attributes('data-active'));
    expect(colonies().length).to.be.greaterThan(0);
    expect(colonies().every((active) => active === 'true'), 'colonies show their track').to.eq(true);
    await wrapper.find('#show-metadata').trigger('click');
    expect(colonies().length).to.be.greaterThan(0);
    expect(colonies().every((active) => active === 'false'), 'colonies without their track').to.eq(true);

    // «-» on the expansions row un-ticks every module: no card and no colony belongs to none — and an empty list folds.
    const invertModules = wrapper.findAll('.selection-row')[0].find('button');
    await invertModules.trigger('click');
    expect(GAME_MODULES.map((module) => (wrapper.find(`[id="${module}-checkbox"]`).element as HTMLInputElement).checked)).to.deep.eq(GAME_MODULES.map(() => false));
    expect(shownCards(wrapper)).to.deep.eq([]);
    expect(colonies()).to.deep.eq([]);
    expect(wrapper.findAll('section').slice(0, 7).map((s) => (s.element as HTMLElement).style.display), 'an empty list folds its heading').to.deep.eq(
      ['none', 'none', 'none', 'none', 'none', 'none', 'none']);
    await invertModules.trigger('click');
    expect(shownCards(wrapper), 'and back').to.deep.eq(all);

    // «-» on the types row flips every type box: the card lists go whatever the modules say, and the colony tiles with them.
    await wrapper.findAll('.selection-row')[1].find('button').trigger('click');
    expect((wrapper.find('[id="automated-cardType-checkbox"]').element as HTMLInputElement).checked).to.eq(false);
    expect(shownCards(wrapper)).to.deep.eq([]);
    expect(colonies(), 'colony tiles are a type too').to.deep.eq([]);
  }).timeout(15_000);

  it('a parent\'s ref reaches nothing — the page exposes no member', async () => {
    const Host = defineComponent({
      render: () => h('div', [h(CardList, {ref: 'list'})]),
    });
    window.location.hash = '#Asteroid';
    const host = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
    mounted.push(host);
    await flushPromises();

    expect(host.find('.card-list-container').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.list ?? {}) as object), 'the route mounts it; nothing calls into it').to.deep.eq([]);
  }).timeout(15_000);
});
