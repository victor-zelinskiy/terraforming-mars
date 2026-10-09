import {expect} from 'chai';
import {ShipmentToEarth} from '../../../src/server/cards/promo/ShipmentToEarth';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';
import {formatMessage} from '../../TestingUtils';

describe('ShipmentToEarth', () => {
  const canPlayRuns = [
    {plants: 2, steel: 3, expected: false},
    {plants: 3, steel: 2, expected: false},
    {plants: 3, steel: 3, expected: true},
  ] as const;
  for (const run of canPlayRuns) {
    it('canPlay: ' + JSON.stringify(run), () => {
      const card = new ShipmentToEarth();
      const [/* game */, player] = testGame(2);

      player.megaCredits = card.cost;
      player.plants = run.plants;
      player.steel = run.steel;

      expect(player.canPlay(card)).eq(run.expected);
    });
  }

  it('play', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);

    player.plants = 5;
    player.steel = 4;
    player.tagsForTest = {earth: 3};
    const tr = player.terraformRating;

    cast(card.play(player), undefined);

    expect(player.plants).eq(2);
    expect(player.steel).eq(1);
    expect(player.terraformRating).eq(tr + 3);
    expect(player.megaCredits).eq(6);
  });

  it('play: no Earth tags — the shipment and the TR still happen, no M€', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);

    player.plants = 3;
    player.steel = 3;
    const tr = player.terraformRating;

    cast(card.play(player), undefined);

    expect(player.plants).eq(0);
    expect(player.steel).eq(0);
    expect(player.terraformRating).eq(tr + 3);
    expect(player.megaCredits).eq(0);
  });

  it('the shipment leaves through the stock (the journal sees it)', () => {
    const card = new ShipmentToEarth();
    const [game, player] = testGame(2);
    player.plants = 3;
    player.steel = 3;
    game.gameLog.length = 0;

    cast(card.play(player), undefined);

    const lines = game.gameLog.map(formatMessage);
    expect(lines.some((line) => line.includes('plants')), lines.join('\n')).is.true;
    expect(lines.some((line) => line.includes('steel')), lines.join('\n')).is.true;
  });

  it('unplayableReason names ONE blocker, in the printed order', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);

    player.plants = 2;
    player.steel = 2;
    expect(card.unplayableReason(player)).deep.eq({type: 'resource', message: 'Not enough plants', resource: 'plants', current: 2});

    player.plants = 3;
    expect(card.unplayableReason(player)).deep.eq({type: 'resource', message: 'Not enough steel', resource: 'steel', current: 2});

    player.steel = 3;
    expect(card.unplayableReason(player)).is.undefined;
  });

  it('cardPlayPreview shows the whole trade: the shipment as costs, the TR and the M€ as gains', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    player.plants = 5;
    player.steel = 4;
    player.tagsForTest = {earth: 3};
    const tr = player.terraformRating;

    const preview = card.cardPlayPreview(player);
    expect(preview.kind).eq('bespoke');
    expect(preview.branches).has.length(1);
    const effects = preview.branches[0].effects;

    const costs = effects.filter((e) => e.direction === 'cost');
    expect(costs.map((e) => [e.icon, e.amount, e.current, e.resulting])).deep.eq([
      ['plants', 3, 5, 2],
      ['steel', 3, 4, 1],
    ]);

    const gains = effects.filter((e) => e.direction === 'gain');
    const trChip = gains.find((e) => e.icon === 'tr');
    expect(trChip?.amount).eq(3);
    expect(trChip?.current).eq(tr);
    expect(trChip?.resulting).eq(tr + 3);
    const mcChip = gains.find((e) => e.icon === 'megacredits');
    expect(mcChip?.amount, 'two M€ per Earth tag, three tags').eq(6);
  });
});
