import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {CONSOLE_TAG_ORDER} from '@/client/components/console/consoleTagMatrix';

const BASE_GAME_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY,
];
const ALL_PRINTED: ReadonlyArray<Tag> = CONSOLE_TAG_ORDER.filter((t) => t !== Tag.EVENT);

function fakePlayer(tags: Partial<Record<Tag, number>> = {}): PublicPlayerModel {
  return {
    color: 'red',
    megacredits: 12, megacreditProduction: 1,
    steel: 0, steelProduction: 0,
    titanium: 0, titaniumProduction: 0,
    plants: 0, plantProduction: 0,
    energy: 0, energyProduction: 0,
    heat: 0, heatProduction: 0,
    terraformRating: 20,
    victoryPointsBreakdown: {total: 20},
    tags,
    tableau: [],
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
