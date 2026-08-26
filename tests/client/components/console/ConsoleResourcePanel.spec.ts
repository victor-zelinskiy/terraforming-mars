import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {CONSOLE_TAG_ORDER} from '@/client/components/console/consoleTagMatrix';
import {privateScoreState} from '@/client/components/overview/privateScoreState';

const BASE_GAME_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY,
];
const ALL_PRINTED: ReadonlyArray<Tag> = CONSOLE_TAG_ORDER.filter((t) => t !== Tag.EVENT);

const NO_PROTECTION = {megacredits: 'off', steel: 'off', titanium: 'off', plants: 'off', energy: 'off', heat: 'off'} as const;

function fakePlayer(tags: Partial<Record<Tag, number>> = {}, extra: Partial<Record<string, unknown>> = {}): PublicPlayerModel {
  return {
    color: 'red',
    protectedResources: {...NO_PROTECTION},
    protectedProduction: {...NO_PROTECTION},
    protectedCardResources: {},
    megacredits: 12, megacreditProduction: 1,
    steel: 0, steelProduction: 0,
    titanium: 0, titaniumProduction: 0,
    plants: 0, plantProduction: 0,
    energy: 0, energyProduction: 0,
    heat: 0, heatProduction: 0,
    steelValue: 2, titaniumValue: 3,
    canUseHeatAsMegaCredits: false,
    canUseTitaniumAsMegacredits: false,
    canUsePlantsAsMegacredits: false,
    terraformRating: 20,
    victoryPointsBreakdown: {total: 20},
    tags,
    tableau: [],
    ...extra,
  } as unknown as PublicPlayerModel;
}

function mountWith(tags: Partial<Record<Tag, number>>, gameTags: ReadonlyArray<Tag> = BASE_GAME_TAGS) {
  return mount(ConsoleResourcePanel, {
    global: globalConfig.global,
    props: {player: fakePlayer(tags), gameTags: gameTags as Array<Tag>},
  });
}

const cellTags = (w: ReturnType<typeof mountWith>) =>
  w.findAll('.con-tagmx__cell').map((c) => c.attributes('data-tag-cell'));

describe('ConsoleResourcePanel — МЕТКИ tag matrix', () => {
  it('renders EVERY available tag, zeros included and visible', () => {
    const w = mountWith({[Tag.BUILDING]: 2} as Partial<Record<Tag, number>>);
    expect(cellTags(w)).to.have.length(11); // 10 base printed + events
    const zero = w.find('[data-tag-cell="space"]');
    expect(zero.exists()).to.be.true;
    expect(zero.find('.con-tagmx__num').text()).to.eq('0');
  });

  it('marks zero-count cells with the dimmed state, active ones without', () => {
    const w = mountWith({[Tag.BUILDING]: 2} as Partial<Record<Tag, number>>);
    expect(w.find('[data-tag-cell="building"]').classes()).to.not.include('con-tagmx__cell--zero');
    expect(w.find('[data-tag-cell="space"]').classes()).to.include('con-tagmx__cell--zero');
  });

  it('cell order is canonical and unaffected by counts', () => {
    const zeroes = cellTags(mountWith({}));
    const busy = cellTags(mountWith({[Tag.CITY]: 9, [Tag.JOVIAN]: 3} as Partial<Record<Tag, number>>));
    expect(busy).to.deep.eq(zeroes);
    expect(zeroes[0]).to.eq('building');
    expect(zeroes[zeroes.length - 1]).to.eq('event');
  });

  it('a game without an expansion never grows its tags; a full pool shows them all', () => {
    expect(cellTags(mountWith({}))).to.not.include('venus');
    expect(cellTags(mountWith({}, ALL_PRINTED))).to.deep.eq(CONSOLE_TAG_ORDER.map(String));
  });

  it('falls back to the base-game set when gameTags is absent (legacy save)', () => {
    const w = mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {player: fakePlayer({})},
    });
    const tags = cellTags(w);
    expect(tags).to.include('building');
    expect(tags).to.include('event');
    expect(tags).to.not.include('moon');
  });

  it('0 → 1 update keeps the SAME DOM cells — no grid rebuild, no reposition', async () => {
    const w = mountWith({});
    const before = w.findAll('.con-tagmx__cell').map((c) => c.element);
    await w.setProps({player: fakePlayer({[Tag.SCIENCE]: 1} as Partial<Record<Tag, number>>)});
    const after = w.findAll('.con-tagmx__cell');
    expect(after).to.have.length(before.length);
    after.forEach((cell, i) => expect(cell.element).to.eq(before[i]));
    const science = w.find('[data-tag-cell="science"]');
    expect(science.classes()).to.not.include('con-tagmx__cell--zero');
    expect(science.find('.con-tagmx__num').text()).to.eq('1');
  });

  it('renders two- and three-digit counts', () => {
    const w = mountWith({[Tag.EARTH]: 12, [Tag.PLANT]: 132} as Partial<Record<Tag, number>>);
    expect(w.find('[data-tag-cell="earth"] .con-tagmx__num').text()).to.eq('12');
    expect(w.find('[data-tag-cell="plant"] .con-tagmx__num').text()).to.eq('132');
  });
});

/**
 * The INSPECTED-PLAYER context (Information Workspace, Y): while the mode is
 * open the shell overrides the rail's `player` to the inspected seat and
 * passes `own` / `vpHidden`. The VP cell must follow the SEAT's rules: the
 * local «Приватный счёт» pref masks only the OWN seat; the game-level
 * hidden-VP rule masks an inspected opponent.
 */
describe('ConsoleResourcePanel — inspected-player VP masking', () => {
  function mountSeat(extra: {own?: boolean, vpHidden?: boolean} = {}) {
    return mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {player: fakePlayer({}), gameTags: BASE_GAME_TAGS as Array<Tag>, ...extra},
    });
  }

  afterEach(() => {
    // Module state is bundle-shared across specs — restore the pref.
    privateScoreState.enabled = false;
  });

  it('the own seat shows the VP number by default', () => {
    const w = mountSeat();
    expect(w.find('.con-score__cell--vp .con-score__value').text()).to.eq('20');
    expect(w.find('.vp-private').exists()).to.be.false;
  });

  it('the own seat masks under the private-score pref', () => {
    privateScoreState.enabled = true;
    const w = mountSeat();
    expect(w.find('.vp-private').exists()).to.be.true;
    expect(w.find('.con-score__cell--vp .con-score__value').exists()).to.be.false;
  });

  it('an inspected opponent masks by the GAME rule, not by the local pref', () => {
    const hidden = mountSeat({own: false, vpHidden: true});
    expect(hidden.find('.vp-private').exists()).to.be.true;

    // Open-VP game: the opponent's number shows even with the local pref on.
    privateScoreState.enabled = true;
    const open = mountSeat({own: false, vpHidden: false});
    expect(open.find('.vp-private').exists()).to.be.false;
    expect(open.find('.con-score__cell--vp .con-score__value').text()).to.eq('20');
  });

  it('carries the switch-motion anchor (data-insp-fade) on the rail root', () => {
    const w = mountSeat();
    expect(w.find('.con-res').attributes()).to.have.property('data-insp-fade');
  });
});

/**
 * The DEDICATED MarsBot presentation (Information Workspace inspects the bot
 * seat, the shell passes `automa`): the human economy/tag zones swap to the
 * bot's REAL state — the M€ supply (+floaters) with NO production chips, and
 * the printed TAG TRACKS with progress instead of the tag matrix.
 */
describe('ConsoleResourcePanel — the dedicated MarsBot rail', () => {
  const automa = {
    difficulty: 'normal',
    tracks: [
      {tags: [Tag.BUILDING], position: 2, maxPosition: 18, layout: [], regressed: []},
      {tags: [Tag.POWER, Tag.JOVIAN], position: 0, maxPosition: 18, layout: [], regressed: []},
    ],
    actionDeckSize: 10, bonusDeckSize: 7,
    bonusDiscard: [], recurringBonusCards: [], destroyedBonusCards: [],
    playedPile: [], floaters: 3,
  };

  function mountBot() {
    return mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {
        player: fakePlayer({}), gameTags: BASE_GAME_TAGS as Array<Tag>,
        own: false, automa: automa as never,
      },
    });
  }

  it('economy rows: the real M€ supply + floaters, NO production chips', () => {
    const w = mountBot();
    expect(w.find('[data-bot-economy="megacredits"] .con-res__value').text()).to.eq('12');
    expect(w.find('[data-bot-economy="floaters"] .con-res__value').text()).to.eq('3');
    expect(w.findAll('.con-res__prod')).to.have.length(0);
    // The human six-row set is fully replaced, not appended to.
    expect(w.findAll('.con-res__row')).to.have.length(2);
  });

  it('the МЕТКИ zone swaps to the tag tracks (matrix absent)', () => {
    const w = mountBot();
    expect(w.findAll('.con-tagmx__trackrow')).to.have.length(2);
    expect(w.findAll('.con-tagmx__grid')).to.have.length(0);
    expect(w.findAll('.con-tagmx__cell')).to.have.length(0);
  });

  it('a multi-tag track renders EVERY mapped tag medal in one cluster', () => {
    const w = mountBot();
    const rows = w.findAll('.con-tagmx__trackrow');
    expect(rows[1].findAll('.con-tagmx__medal')).to.have.length(2);
    expect(rows[0].findAll('.con-tagmx__medal')).to.have.length(1);
  });

  it('progress reads per-track: fill width + the zero state dim', () => {
    const w = mountBot();
    const rows = w.findAll('.con-tagmx__trackrow');
    expect(rows[0].find('.con-tagmx__trackfill').attributes('style')).to.contain('width: 11%');
    expect(rows[0].find('.con-tagmx__num').text()).to.eq('2');
    expect(rows[0].classes()).to.not.include('con-tagmx__trackrow--zero');
    expect(rows[1].classes()).to.include('con-tagmx__trackrow--zero');
  });

  it('without `automa` the human presentation is untouched', () => {
    const w = mountWith({});
    expect(w.findAll('.con-tagmx__trackrow')).to.have.length(0);
    expect(w.findAll('.con-res__row')).to.have.length(6);
    expect(w.findAll('.con-res__prod').length).to.be.greaterThan(0);
  });
});

/**
 * The VALUE-BADGE layer (railValueModel → ConsoleValueBadge): passive MC-rate
 * coins on the payment resources + VP-coefficient shields on scoring tags.
 * The rows/cells never change their own geometry — the badge is an absolute
 * corner pin, present exactly while the displayed SEAT has the capability.
 */
describe('ConsoleResourcePanel — value badges', () => {
  function mountPlayer(player: PublicPlayerModel, extraProps: Record<string, unknown> = {}) {
    return mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {player, gameTags: BASE_GAME_TAGS as Array<Tag>, ...extraProps},
    });
  }

  it('base game: steel «2» and titanium «3»; M€/plants/energy/heat carry none', () => {
    const w = mountPlayer(fakePlayer());
    expect(w.find('[data-mc-badge="steel"] .con-valbadge__text').text()).to.eq('2');
    expect(w.find('[data-mc-badge="titanium"] .con-valbadge__text').text()).to.eq('3');
    expect(w.find('[data-mc-badge="megacredits"]').exists()).to.be.false;
    expect(w.find('[data-mc-badge="plants"]').exists()).to.be.false;
    expect(w.find('[data-mc-badge="energy"]').exists()).to.be.false;
    expect(w.find('[data-mc-badge="heat"]').exists()).to.be.false;
  });

  it('a modified value shows live, never the base (Advanced Alloys player)', () => {
    const w = mountPlayer(fakePlayer({}, {steelValue: 3, titaniumValue: 4}));
    expect(w.find('[data-mc-badge="steel"] .con-valbadge__text').text()).to.eq('3');
    expect(w.find('[data-mc-badge="titanium"] .con-valbadge__text').text()).to.eq('4');
  });

  it('heat gains the coin only under the standing grant (Helion)', () => {
    const w = mountPlayer(fakePlayer({}, {canUseHeatAsMegaCredits: true, heat: 4}));
    expect(w.find('[data-mc-badge="heat"] .con-valbadge__text').text()).to.eq('1');
  });

  it('Luna Trade Federation titanium reads both rates in the wide pill', () => {
    const w = mountPlayer(fakePlayer({}, {canUseTitaniumAsMegacredits: true}));
    const badge = w.find('[data-mc-badge="titanium"]');
    expect(badge.find('.con-valbadge__text').text()).to.eq('3/2');
    expect(badge.classes()).to.include('con-valbadge--wide');
  });

  it('an aux chip is badged only when its ENABLING card is in the tableau', () => {
    const dirigibles = mountPlayer(
      fakePlayer({}, {tableau: [{name: CardName.DIRIGIBLES, resources: 2}]}),
      {boardVisible: true});
    const badge = dirigibles.find('[data-aux-resource] [data-mc-badge]');
    expect(badge.exists()).to.be.true;
    expect(badge.find('.con-valbadge__text').text()).to.eq('3');

    // Same resource TYPE on a non-payment holder → chip yes, badge no.
    const stormcraft = mountPlayer(
      fakePlayer({}, {tableau: [{name: CardName.STORMCRAFT_INCORPORATED, resources: 3}]}),
      {boardVisible: true});
    expect(stormcraft.find('[data-aux-resource]').exists()).to.be.true;
    expect(stormcraft.find('[data-aux-resource] [data-mc-badge]').exists()).to.be.false;
  });

  it('the aggregated-chip aria names the honest spendable split', () => {
    const w = mountPlayer(
      fakePlayer({}, {tableau: [
        {name: CardName.DIRIGIBLES, resources: 2},
        {name: CardName.STORMCRAFT_INCORPORATED, resources: 3},
      ]}),
      {boardVisible: true});
    const label = w.find('[data-aux-resource] [data-mc-badge]').attributes('aria-label') ?? '';
    expect(label).to.contain('2');
    expect(label).to.contain('5');
  });

  it('a scoring tag carries the VP shield — zero-count cell included', () => {
    const w = mountPlayer(fakePlayer(
      {[Tag.JOVIAN]: 0} as Partial<Record<Tag, number>>,
      {tableau: [{name: CardName.IO_MINING_INDUSTRIES}]}));
    const cell = w.find('[data-tag-cell="jovian"]');
    expect(cell.classes()).to.include('con-tagmx__cell--zero');
    expect(cell.find('[data-tag-vp="jovian"] .con-valbadge__text').text()).to.eq('1');
    // No scoring source → no shield anywhere else.
    expect(w.findAll('.con-valbadge--vp')).to.have.length(1);
  });

  it('a ratio scorer renders the vulgar fraction on its tag', () => {
    const w = mountPlayer(fakePlayer(
      {[Tag.VENUS]: 3} as Partial<Record<Tag, number>>,
      {tableau: [{name: CardName.CULTIVATION_OF_VENUS}]}),
    );
    const wAll = mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {player: fakePlayer(
        {[Tag.VENUS]: 3} as Partial<Record<Tag, number>>,
        {tableau: [{name: CardName.CULTIVATION_OF_VENUS}]}),
      gameTags: ALL_PRINTED as Array<Tag>},
    });
    expect(w.findAll('[data-tag-vp]')).to.have.length(0); // Venus not in base tag set
    expect(wAll.find('[data-tag-vp="venus"] .con-valbadge__text').text()).to.eq('½');
  });

  it('switching the displayed player swaps every badge atomically', async () => {
    const w = mountPlayer(fakePlayer({}, {tableau: [{name: CardName.IO_MINING_INDUSTRIES}]}));
    expect(w.find('[data-mc-badge="steel"] .con-valbadge__text').text()).to.eq('2');
    expect(w.find('[data-tag-vp="jovian"]').exists()).to.be.true;

    await w.setProps({player: fakePlayer({}, {color: 'blue', steelValue: 3, canUseHeatAsMegaCredits: true})});
    expect(w.find('[data-mc-badge="steel"] .con-valbadge__text').text()).to.eq('3');
    expect(w.find('[data-mc-badge="heat"] .con-valbadge__text').text()).to.eq('1');
    expect(w.find('[data-tag-vp="jovian"]').exists()).to.be.false;
    // A seat switch is a context change — never a value pulse.
    expect(w.findAll('.con-valbadge--pulse')).to.have.length(0);
  });

  it('a value change pulses; mount alone never does', async () => {
    const w = mountPlayer(fakePlayer());
    expect(w.findAll('.con-valbadge--pulse')).to.have.length(0);
    await w.setProps({player: fakePlayer({}, {steelValue: 3})});
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(w.find('[data-mc-badge="steel"]').classes()).to.include('con-valbadge--pulse');
  });

  it('the badge is a passive layer: aria label present, no focusable control', () => {
    const w = mountPlayer(fakePlayer());
    const badge = w.find('[data-mc-badge="steel"]');
    expect(badge.attributes('aria-label')).to.contain('M€');
    expect(badge.attributes('role')).to.eq('img');
    expect(badge.element.querySelector('button, [tabindex]')).to.eq(null);
  });

  it('the MarsBot rail carries no badges (the Automa has no economy of rates)', () => {
    const automa = {
      difficulty: 'normal',
      tracks: [{tags: [Tag.BUILDING], position: 2, maxPosition: 18, layout: [], regressed: []}],
      actionDeckSize: 10, bonusDeckSize: 7,
      bonusDiscard: [], recurringBonusCards: [], destroyedBonusCards: [],
      playedPile: [], floaters: 3,
    };
    const w = mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {
        player: fakePlayer(), gameTags: BASE_GAME_TAGS as Array<Tag>,
        own: false, automa: automa as never,
      },
    });
    expect(w.findAll('.con-valbadge')).to.have.length(0);
  });

  it('full house: every badge kind at once, one per host, stable data hooks', () => {
    const w = mountPlayer(
      fakePlayer(
        {[Tag.JOVIAN]: 2} as Partial<Record<Tag, number>>,
        {
          steelValue: 3, titaniumValue: 4,
          canUseHeatAsMegaCredits: true, canUsePlantsAsMegacredits: true,
          tableau: [
            {name: CardName.IO_MINING_INDUSTRIES},
            {name: CardName.DIRIGIBLES, resources: 1},
            {name: CardName.PSYCHROPHILES, resources: 2},
            {name: CardName.CARBON_NANOSYSTEMS, resources: 0},
          ],
        }),
      {boardVisible: true});
    expect(w.findAll('.con-res__row [data-mc-badge]')).to.have.length(4); // steel/ti/plants/heat
    expect(w.findAll('.con-res-aux__cell [data-mc-badge]')).to.have.length(3); // floaters/microbes/graphene
    expect(w.findAll('[data-tag-vp]')).to.have.length(1);
  });
});

/**
 * The PROTECTION layer (railProtectionModel → ConsoleProtectionMark): the
 * printed shield pinned to a guarded stock. It is passive, it is per SEAT
 * (an inspected opponent shows THEIR shields), and it never claims more than
 * the rules give — a halved effect and a partly-shielded chip each read as
 * their own material.
 */
describe('ConsoleResourcePanel — protection marks', () => {
  const NONE = NO_PROTECTION;

  function mountPlayer(player: PublicPlayerModel, extraProps: Record<string, unknown> = {}) {
    return mount(ConsoleResourcePanel, {
      global: globalConfig.global,
      props: {player, gameTags: BASE_GAME_TAGS as Array<Tag>, ...extraProps},
    });
  }

  it('an unprotected rail carries no shield anywhere', () => {
    const w = mountPlayer(fakePlayer());
    expect(w.findAll('.con-shieldmark')).to.have.length(0);
  });

  it('protected plants: a FULL shield on the plants row only', () => {
    const w = mountPlayer(fakePlayer({}, {
      protectedResources: {...NONE, plants: 'on'},
      plants: 7,
      tableau: [{name: CardName.PROTECTED_HABITATS}],
    }));
    const shield = w.find('[data-protection="plants"]');
    expect(shield.exists()).to.be.true;
    expect(shield.attributes('data-protection-kind')).to.eq('full');
    expect(w.findAll('.con-shieldmark')).to.have.length(1);
    // The mark states the RULE, not just «protected». (The unit runner has no
    // RU bundle: translateText yields the English key, which IS the source text.)
    expect(shield.attributes('aria-label')).to.contain('Opponents cannot remove it');
  });

  it('Botanical Experience: a HALF shield whose label says «lose half, rounded up»', () => {
    const w = mountPlayer(fakePlayer({}, {
      protectedResources: {...NONE, plants: 'half'},
      plants: 7,
      tableau: [{name: CardName.BOTANICAL_EXPERIENCE}],
    }));
    const shield = w.find('[data-protection="plants"]');
    expect(shield.attributes('data-protection-kind')).to.eq('half');
    expect(shield.find('.con-shieldmark__half').exists()).to.be.true;
    expect(shield.find('.con-shieldmark__check').exists()).to.be.false;
    expect(shield.attributes('aria-label')).to.contain('lose half of it, rounded up');
  });

  it('production protection rides the CHIP, not the icon', () => {
    const w = mountPlayer(fakePlayer({}, {
      protectedResources: {...NONE, steel: 'on', titanium: 'on'},
      protectedProduction: {...NONE, steel: 'on', titanium: 'on'},
      tableau: [{name: CardName.LUNAR_SECURITY_STATIONS}],
    }));
    expect(w.findAll('[data-protection="steel"]')).to.have.length(1);
    const prodMark = w.find('[data-protection-production="steel"]');
    expect(prodMark.exists()).to.be.true;
    expect(prodMark.element.closest('.con-res__prod')).to.not.eq(null);
    expect(prodMark.attributes('aria-label')).to.contain('Opponents cannot reduce it');
    // Two stocks + two productions, nothing else.
    expect(w.findAll('.con-shieldmark')).to.have.length(4);
  });

  it('an aux chip is shielded by the blanket type protection', () => {
    const w = mountPlayer(fakePlayer({}, {
      protectedCardResources: {Animal: 'on', Microbe: 'on'},
      tableau: [{name: CardName.PROTECTED_HABITATS}, {name: CardName.BIRDS, resources: 3}],
    }), {boardVisible: true});
    const shield = w.find('.con-res-aux__cell [data-protection]');
    expect(shield.exists()).to.be.true;
    expect(shield.attributes('data-protection-kind')).to.eq('full');
  });

  it('a mixed chip reads PARTIAL and its label names the split', () => {
    const w = mountPlayer(fakePlayer({}, {
      tableau: [{name: CardName.PETS, resources: 4, protectedResources: true}, {name: CardName.BIRDS, resources: 3}],
    }), {boardVisible: true});
    const shield = w.find('.con-res-aux__cell [data-protection]');
    expect(shield.attributes('data-protection-kind')).to.eq('partial');
    const label = shield.attributes('aria-label') ?? '';
    expect(label).to.contain('4');
    expect(label).to.contain('7');
  });

  it('an ordinary holder gets a chip but no shield', () => {
    const w = mountPlayer(fakePlayer({}, {tableau: [{name: CardName.BIRDS, resources: 3}]}), {boardVisible: true});
    expect(w.find('.con-res-aux__cell').exists()).to.be.true;
    expect(w.find('.con-res-aux__cell [data-protection]').exists()).to.be.false;
  });

  it('switching to an inspected opponent swaps the shields with the seat', async () => {
    const w = mountPlayer(fakePlayer({}, {protectedResources: {...NONE, plants: 'on'}, plants: 4}));
    expect(w.find('[data-protection="plants"]').exists()).to.be.true;
    await w.setProps({player: fakePlayer({}, {color: 'blue'}), own: false});
    expect(w.findAll('.con-shieldmark')).to.have.length(0);
    await w.setProps({player: fakePlayer({}, {
      color: 'green',
      protectedProduction: {megacredits: 'on', steel: 'on', titanium: 'on', plants: 'on', energy: 'on', heat: 'on'},
      tableau: [{name: CardName.PRIVATE_SECURITY}],
    }), own: false});
    expect(w.findAll('[data-protection-production]')).to.have.length(6);
    expect(w.findAll('[data-protection]')).to.have.length(0);
  });

  it('the mark is passive: role=img, a label, no focusable control', () => {
    const w = mountPlayer(fakePlayer({}, {protectedResources: {...NONE, plants: 'on'}}));
    const shield = w.find('[data-protection="plants"]');
    expect(shield.attributes('role')).to.eq('img');
    expect((shield.attributes('aria-label') ?? '').length).to.be.greaterThan(0);
    expect(shield.element.querySelector('button, [tabindex]')).to.eq(null);
  });

  it('the MarsBot rail carries no shields', () => {
    const automa = {
      difficulty: 'normal',
      tracks: [{tags: [Tag.BUILDING], position: 1, maxPosition: 18, layout: [], regressed: []}],
      actionDeckSize: 10, bonusDeckSize: 7,
      bonusDiscard: [], recurringBonusCards: [], destroyedBonusCards: [],
      playedPile: [], floaters: 2,
    };
    const w = mountPlayer(
      fakePlayer({}, {protectedResources: {...NONE, plants: 'on'}}),
      {own: false, automa: automa as never});
    expect(w.findAll('.con-shieldmark')).to.have.length(0);
  });
});
