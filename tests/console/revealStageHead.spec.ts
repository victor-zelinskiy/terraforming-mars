import {expect} from 'chai';
import {cellBonusIcons, revealSourceReading, revealStageHead, RevealStageHeadInput} from '../../src/client/console/revealStageHead';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {PartyName} from '../../src/common/turmoil/PartyName';

/**
 * TR57 «НАГРАДА ВНЕ WORKSPACE» — the received-cards head is ONE reading in both hosts. The form it replaced said
 * «Получены карты» twice (a kicker and a title), added a boilerplate subtitle and a source chip that never named the
 * cell; the workspace's stage said it once. One function now writes the words for both, and the only difference is
 * what the host already shows beside the cards.
 */
function input(over: Partial<RevealStageHeadInput> = {}): RevealStageHeadInput {
  return {host: 'scene', cards: 2, search: false, source: {type: 'tile', spaceId: '38'}, cellBonuses: [SpaceBonus.DRAW_CARD, SpaceBonus.DRAW_CARD], sourceOnStage: false, ...over};
}

describe('revealStageHead — the words of «вы получили карты», one reading for both hosts', () => {
  it('the sentence is said ONCE, singular for one card, plural for several — no kicker, no subtitle exist in the reading', () => {
    expect(revealStageHead(input({cards: 1})).titleKey).eq('Card received');
    expect(revealStageHead(input({cards: 2})).titleKey).eq('Cards received');
    expect(Object.keys(revealStageHead(input())).sort()).deep.eq(['badges', 'titleKey']);
  });

  it('the scene NAMES the paying cell by its printed bonuses, then counts: «КЛЕТКА ПОЛЯ [card][card] · ПОЛУЧЕНО 2»', () => {
    const head = revealStageHead(input());
    expect(head.badges.map((b) => b.kind)).deep.eq(['source', 'received']);
    const source = head.badges[0];
    expect(source).deep.include({kind: 'source'});
    if (source.kind === 'source') {
      expect(source.reading).deep.eq({labelKey: 'Board cell', nameKey: '', icons: ['resource_icon--cards', 'resource_icon--cards'], inspectable: false});
    }
    expect(head.badges[1]).deep.eq({kind: 'received', count: 2});
  });

  it('one card: the title is singular and there is no count badge — only the source', () => {
    const head = revealStageHead(input({cards: 1, cellBonuses: [SpaceBonus.STEEL, SpaceBonus.DRAW_CARD]}));
    expect(head.badges.map((b) => b.kind)).deep.eq(['source']);
  });

  it('the SAME batch inside a workspace says the same words without the source — the host stands it on stage', () => {
    const scene = revealStageHead(input());
    const embedded = revealStageHead(input({host: 'embedded'}));
    expect(embedded.titleKey).eq(scene.titleKey);
    expect(embedded.badges).deep.eq(scene.badges.filter((b) => b.kind !== 'source'));
    // …and a scene whose host already stands the source card says nothing of it either.
    expect(revealStageHead(input({source: {type: 'card', cardName: CardName.BIRDS}, sourceOnStage: true})).badges.map((b) => b.kind)).deep.eq(['received']);
  });

  it('…but a LAW\'S answer hosted in a PLAY\'S workspace is named — the stage carries the played card, not the law', () => {
    const law = input({host: 'embedded', cards: 1, source: {type: 'resolution', resolution: 'RDX_URBAN'}, cellBonuses: undefined, fallbackName: 'Городское развитие'});
    expect(revealStageHead(law).badges.map((b) => b.kind), 'not foreign: the workspace carries it').deep.eq([]);
    const head = revealStageHead({...law, foreignSource: true});
    expect(head.titleKey).eq('Card received');
    expect(head.badges).deep.eq([{kind: 'source', reading: {labelKey: 'Source', nameKey: '', nameText: 'Городское развитие', icons: [], inspectable: false}}]);
    // A scene keeps its own rule — `foreignSource` is the embedded host's statement alone.
    expect(revealStageHead({...law, host: 'scene', sourceOnStage: true, foreignSource: true}).badges).deep.eq([]);
  });

  it('a batch the RULES discarded (К-5) says so — never «Получена карта», no count; the source stays', () => {
    const head = revealStageHead(input({cards: 1, discarded: true, source: {type: 'colony', colonyName: ColonyName.PLUTO}}));
    expect(head.titleKey).eq('Discarded: no other card in hand');
    expect(head.badges.map((b) => b.kind)).deep.eq(['source']);
  });

  it('«ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»: a merged batch names EVERY cause with its share, in dealing order, in both hosts', () => {
    const segments = [
      {source: {type: 'card', cardName: CardName.RESEARCH}, count: 2},
      {source: {type: 'card', cardName: CardName.OLYMPUS_CONFERENCE}, count: 1},
      {source: {type: 'card', cardName: CardName.MARS_UNIVERSITY}, count: 1},
    ] as const;
    const embedded = revealStageHead(input({host: 'embedded', cards: 4, source: segments[0].source, segments: [...segments], sourceOnStage: true}));
    expect(embedded.titleKey).eq('Cards received');
    expect(embedded.badges).deep.eq([
      {kind: 'received', count: 4},
      {kind: 'source', reading: {labelKey: 'Source', nameKey: CardName.RESEARCH, icons: [], inspectable: true}, count: 2},
      {kind: 'source', reading: {labelKey: 'Source', nameKey: CardName.OLYMPUS_CONFERENCE, icons: [], inspectable: true}, count: 1},
      {kind: 'source', reading: {labelKey: 'Source', nameKey: CardName.MARS_UNIVERSITY, icons: [], inspectable: true}, count: 1},
    ]);
    // The scene says the same — and a cell among the causes keeps its printed face.
    const scene = revealStageHead(input({cards: 2, segments: [{source: {type: 'tile', spaceId: '38'}, count: 1}, {source: {type: 'card', cardName: CardName.MARS_UNIVERSITY}, count: 1}]}));
    expect(scene.badges.map((b) => b.kind)).deep.eq(['received', 'source', 'source']);
    expect(scene.badges[1]).deep.include({count: 1});
    if (scene.badges[1].kind === 'source') {
      expect(scene.badges[1].reading.icons).deep.eq(['resource_icon--cards', 'resource_icon--cards']);
    }
    // Two runs of ONE cause (a search beside its own plain draw) are one share; one cause reads as before.
    expect(revealStageHead(input({cards: 3, source: segments[0].source, segments: [{source: segments[0].source, count: 2}, {source: segments[0].source, count: 1}]})).badges.map((b) => b.kind)).deep.eq(['source', 'received']);
  });

  it('NO SILENT LOSS — every cause of a merged batch stands with its share, a party\'s passive by the party (2026-11-01)', () => {
    // The owner's TV: a city on a card-bonus cell under a ruling Mars First — «ПОЛУЧЕНО 2» over ONE chip, because the
    // party's segment had no name this module could give it and was dropped.
    const head = revealStageHead(input({cards: 2, segments: [
      {source: {type: 'tile', spaceId: '38'}, count: 1},
      {source: {type: 'party', party: PartyName.MARS, passive: true}, count: 1},
    ]}));
    expect(head.badges).deep.eq([
      {kind: 'received', count: 2},
      {kind: 'source', reading: {labelKey: 'Board cell', nameKey: '', icons: ['resource_icon--cards', 'resource_icon--cards'], inspectable: false}, count: 1},
      {kind: 'source', reading: {labelKey: 'Party', nameKey: 'party name: Mars First', icons: [], inspectable: false}, count: 1},
    ]);
    // …and every card knows the chip of the cause that dealt it (dealing order = card order).
    expect(head.causeByCard).deep.eq([1, 2]);
    // A cause nobody can name still stands — «ЭФФЕКТ +1» — so the chips always add up to the count.
    const unnamed = revealStageHead(input({cards: 3, segments: [
      {source: {type: 'card', cardName: CardName.RESEARCH}, count: 2},
      {source: undefined, count: 1},
    ]}));
    expect(unnamed.badges.filter((b) => b.kind === 'source').map((b) => b.kind === 'source' ? b.count : 0)).deep.eq([2, 1]);
    expect(unnamed.badges[2]).deep.eq({kind: 'source', reading: {labelKey: 'Source', nameKey: 'Effect', icons: [], inspectable: false}, count: 1});
    expect(unnamed.causeByCard).deep.eq([1, 1, 2]);
    // A batch-wide fallback name is the batch's ONE cause's — never pinned on an unnamed segment of a merge.
    expect(revealStageHead(input({cards: 2, fallbackName: 'Чужое имя', segments: [
      {source: {type: 'tile', spaceId: '38'}, count: 1}, {source: {type: 'other'}, count: 1},
    ]})).badges[2]).deep.include({count: 1}).and.nested.include({'reading.nameKey': 'Effect'});
    // Two runs of one cause fold into one chip, and both its cards point at it.
    expect(revealStageHead(input({cards: 3, segments: [
      {source: {type: 'card', cardName: CardName.RESEARCH}, count: 1},
      {source: {type: 'tile', spaceId: '38'}, count: 1},
      {source: {type: 'card', cardName: CardName.RESEARCH}, count: 1},
    ]})).causeByCard).deep.eq([1, 2, 1]);
  });

  it('a filtered search states its tally instead of the count; a settlement table its places and its own title', () => {
    expect(revealStageHead(input({search: true})).badges.map((b) => b.kind)).deep.eq(['source', 'search']);
    const table = revealStageHead(input({host: 'embedded', table: {income: 1, total: 2}}));
    expect(table.titleKey).eq('Trade income · a bonus card per settlement');
    expect(table.badges).deep.eq([{kind: 'settlements', total: 2}]);
    expect(revealStageHead(input({host: 'embedded', table: {income: 0, total: 3}})).titleKey).eq('Owner bonus · one card per settlement');
  });
});

describe('revealSourceReading — where the cards came from, in the player\'s words', () => {
  it('a card source is its name, inspectable (L3); a colony its name; a cell its printed face', () => {
    expect(revealSourceReading({type: 'card', cardName: CardName.BIRDS})).deep.eq({labelKey: 'Source', nameKey: CardName.BIRDS, icons: [], inspectable: true});
    expect(revealSourceReading({type: 'colony', colonyName: ColonyName.LUNA})).deep.eq({labelKey: 'Source', nameKey: ColonyName.LUNA, icons: [], inspectable: false});
    expect(revealSourceReading({type: 'tile', spaceId: '36'}, [SpaceBonus.STEEL, SpaceBonus.DRAW_CARD])?.icons).deep.eq(['resource_icon--steel', 'resource_icon--cards']);
  });

  it('a cell the board does not describe (no spaceId, no printable bonus) falls back to the honest generic', () => {
    expect(revealSourceReading({type: 'tile'})).deep.eq({labelKey: 'Source', nameKey: 'Tile bonus', icons: [], inspectable: false});
    expect(revealSourceReading({type: 'tile', spaceId: '07'}, [SpaceBonus.OCEAN])?.nameKey).eq('Tile bonus');
  });

  it('the Venus 8 % and Amazonis Planitia\'s oxygen 7 % name their scale; a party\'s action / a law take the host\'s translated name; nothing invented', () => {
    expect(revealSourceReading({type: 'globalParameter', parameter: GlobalParameter.VENUS})?.nameKey).eq('Venus scale bonus');
    expect(revealSourceReading({type: 'globalParameter', parameter: GlobalParameter.OXYGEN})?.nameKey).eq('Oxygen scale bonus');
    expect(revealSourceReading({type: 'globalParameter', parameter: GlobalParameter.TEMPERATURE})).is.undefined;
    expect(revealSourceReading({type: 'resolution', resolution: 'X'}, undefined, 'Открытая торговля')).deep.eq(
      {labelKey: 'Source', nameKey: '', nameText: 'Открытая торговля', icons: [], inspectable: false});
    expect(revealSourceReading({type: 'other'})).is.undefined;
    // A party's ACTION and its PASSIVE are different things the player did or did not do.
    expect(revealSourceReading({type: 'party', party: PartyName.REDS})).deep.eq({labelKey: 'Party action', nameKey: 'party name: Reds', icons: [], inspectable: false});
    expect(revealSourceReading({type: 'party', party: PartyName.MARS, passive: true})?.labelKey).eq('Party');
    // A law names itself through the host's manifest reader when it has one.
    expect(revealSourceReading({type: 'resolution', resolution: 'X'}, undefined, undefined, (id) => `law ${id}`)).deep.eq(
      {labelKey: 'Resolution', nameKey: 'law X', icons: [], inspectable: false});
    expect(revealSourceReading(undefined)).is.undefined;
  });

  it('every printed card-draw bonus has its icon (the cell\'s face never loses the reward that just lifted off it)', () => {
    expect(cellBonusIcons([SpaceBonus.DRAW_CARD, SpaceBonus.TITANIUM, SpaceBonus.PLANT, SpaceBonus.HEAT])).deep.eq(
      ['resource_icon--cards', 'resource_icon--titanium', 'resource_icon--plants', 'resource_icon--heat']);
  });
});
