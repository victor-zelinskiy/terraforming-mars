import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ViewModel} from '@/common/models/PlayerModel';
import {marsBotOfView, turnCardNames, turnDedupeKey} from '@/client/components/marsbot/marsBotTurnView';
import {trackCells} from '@/client/components/marsbot/marsBotView';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {recordBotTurnsFromView, resetMarsBotArchive} from '@/client/components/marsbot/marsBotTurnArchive';

function view(turn: MarsBotTurn | undefined): ViewModel {
  return {
    players: [
      {color: 'blue', name: 'Human'},
      {color: 'red', name: 'MarsBot', isMarsBot: true},
    ],
    game: {
      automa: {
        difficulty: 'normal',
        tracks: [
          {tags: [Tag.BUILDING], position: 0, maxPosition: 18, layout: [], regressed: []},
          {tags: [Tag.SCIENCE], position: 2, maxPosition: 18, layout: [], regressed: []},
        ],
        actionDeckSize: 3,
        bonusDeckSize: 5,
        bonusDiscard: [],
        recurringBonusCards: [],
        destroyedBonusCards: [],
        playedPile: [],
        floaters: 0,
        lastTurn: turn,
      },
    },
  } as unknown as ViewModel;
}

function turnOf(steps: MarsBotTurn['steps'], id = 1): MarsBotTurn {
  return {id, generation: 1, steps};
}

describe('marsBotTurnView', () => {
  it('resolves the bot participant of a view', () => {
    expect(marsBotOfView(view(undefined))).deep.eq({color: 'red', name: 'MarsBot'});
    expect(marsBotOfView(undefined)).is.undefined;
  });

  it('turnDedupeKey is `color:gen:id`', () => {
    expect(turnDedupeKey(turnOf([{kind: 'pass'}], 2), 'red')).eq('red:1:2');
  });

  it('collects the played project cards (reveal steps + CARD log tokens), ordered + deduped', () => {
    const log = {
      message: '${0} revealed ${1}',
      data: [
        {type: LogMessageDataType.PLAYER, value: 'red'},
        {type: LogMessageDataType.CARD, value: CardName.BIRDS},
      ],
    } as unknown as LogMessage;
    const turn = turnOf([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'log', message: log},
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}},
    ]);
    expect(turnCardNames(turn)).deep.eq([CardName.GENE_REPAIR, CardName.BIRDS]);
  });

  it('trackCells normalizes the JSON null empty slots (the blank-board bug)', () => {
    const track = {
      tags: [Tag.BUILDING],
      position: 1,
      maxPosition: 3,
      layout: [null, 'advance', null, 'tr2'],
      regressed: [2],
    } as unknown as MarsBotTrackModel;
    const cells = trackCells(track);
    expect(cells.map((c) => c.action)).deep.eq([undefined, 'advance', undefined, 'tr2']);
    expect(cells[1].current).is.true;
    expect(cells[2].regressed).is.true;
  });

  it('the archive claims silently on a fresh session and dedups (notification-first detect)', () => {
    resetMarsBotArchive();
    const turn = turnOf([{kind: 'pass'}]);
    const next = view(turn);
    expect(recordBotTurnsFromView(undefined, next)).is.empty;
    expect(recordBotTurnsFromView(next, next)).is.empty;
    const turn2 = turnOf([{kind: 'pass'}], 2);
    const next2 = view(turn2);
    expect(recordBotTurnsFromView(next, next2).map((e) => e.turn)).deep.eq([turn2]);
    expect(recordBotTurnsFromView(next, next2)).is.empty;
    // The archived entry captures difficulty (self-contained journal review).
    expect(recordBotTurnsFromView(view(turnOf([{kind: 'pass'}], 3)), view(turnOf([{kind: 'pass'}], 4)))[0].difficulty).eq('normal');
    resetMarsBotArchive();
  });
});
