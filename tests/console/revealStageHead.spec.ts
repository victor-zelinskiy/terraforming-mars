import {expect} from 'chai';
import {cellBonusIcons, revealSourceReading, revealStageHead, RevealStageHeadInput} from '../../src/client/console/revealStageHead';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {GlobalParameter} from '../../src/common/GlobalParameter';

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

  it('the Venus 8 % names its scale; a party\'s action / a law take the host\'s translated name; nothing invented', () => {
    expect(revealSourceReading({type: 'globalParameter', parameter: GlobalParameter.VENUS})?.nameKey).eq('Venus scale bonus');
    expect(revealSourceReading({type: 'globalParameter', parameter: GlobalParameter.OXYGEN})).is.undefined;
    expect(revealSourceReading({type: 'resolution', resolution: 'X'}, undefined, 'Открытая торговля')).deep.eq(
      {labelKey: 'Source', nameKey: '', nameText: 'Открытая торговля', icons: [], inspectable: false});
    expect(revealSourceReading({type: 'other'})).is.undefined;
    expect(revealSourceReading(undefined)).is.undefined;
  });

  it('every printed card-draw bonus has its icon (the cell\'s face never loses the reward that just lifted off it)', () => {
    expect(cellBonusIcons([SpaceBonus.DRAW_CARD, SpaceBonus.TITANIUM, SpaceBonus.PLANT, SpaceBonus.HEAT])).deep.eq(
      ['resource_icon--cards', 'resource_icon--titanium', 'resource_icon--plants', 'resource_icon--heat']);
  });
});
