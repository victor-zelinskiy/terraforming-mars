import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import BoardCellInfoPopover from '@/client/components/board/BoardCellInfoPopover.vue';
import {boardInfoState, configureBoardInfo} from '@/client/components/board/boardInfoState';
import {BoardName} from '@/common/boards/BoardName';
import {BoardCellInfo, BoardCellStatus} from '@/common/boards/BoardInformationFacts';

// A curated lore cell (getSpecialCellInfo): Apollinaris Mons on Terra Cimmeria Nova.
const APOLLINARIS = {spaceId: '27', boardName: BoardName.TERRA_CIMMERIA_NOVA};

function setupCell(status: BoardCellStatus, opts: {spaceId?: string, boardName?: BoardName} = {}): void {
  boardInfoState.spaceId = (opts.spaceId ?? APOLLINARIS.spaceId) as (typeof boardInfoState)['spaceId'];
  configureBoardInfo({participantId: 'p', color: 'red', boardName: opts.boardName ?? APOLLINARIS.boardName, players: []});
  boardInfoState.info = {space: boardInfoState.spaceId, status, facts: []} as BoardCellInfo;
}

function vm(): any {
  return mount(BoardCellInfoPopover, {...globalConfig}).vm;
}

describe('BoardCellInfoPopover — lore-cell identity is empty-only', () => {
  afterEach(() => {
    boardInfoState.info = undefined;
    boardInfoState.spaceId = undefined;
  });

  it('an EMPTY lore cell shows its geographic name', () => {
    setupCell({content: 'empty', header: 'Empty land'});
    expect(vm().headerTitle).to.eq('Apollinaris Mons');
  });

  it('a lore cell COVERED by an ordinary city is just a city — no lore name, no "counts as"', () => {
    setupCell({content: 'city', header: 'City', special: false, countsAs: ['city'], ownerColor: 'green'});
    const c = vm();
    expect(c.headerTitle, 'header is the ordinary tile, not the lore name').to.eq('City');
    expect(c.countsAsLabels, 'no redundant "counts as: City" on an ordinary city').to.deep.eq([]);
    expect(c.tileName).to.be.undefined;
  });

  it('a genuine composite SPECIAL tile keeps its name + counts-as (not a lore cell)', () => {
    // A non-lore space id → loreInfo undefined; a special composite tile.
    setupCell(
      {content: 'city', header: 'Special city', special: true, countsAs: ['city', 'ocean'], tileLabel: 'New Holland'},
      {spaceId: '01', boardName: BoardName.THARSIS});
    const c = vm();
    expect(c.headerTitle).to.eq('Special city');
    expect(c.countsAsLabels).to.deep.eq(['City', 'Ocean']);
    expect(c.tileName).to.eq('New Holland');
  });
});
