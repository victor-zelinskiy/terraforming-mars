import {expect} from 'chai';
import {Recession} from '../../../src/server/cards/prelude2/Recession';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {PrivateSecurity} from '../../../src/server/cards/pathfinders/PrivateSecurity';
import {MonsInsurance} from '../../../src/server/cards/promo/MonsInsurance';
import {ActionPreviewStep, TableImpactStep} from '../../../src/common/models/ActionPreviewModel';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {Resource} from '../../../src/common/Resource';
import {IPlayer} from '../../../src/server/IPlayer';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';

function tableImpactOf(card: Recession, player: IPlayer): TableImpactStep | undefined {
  const steps: ReadonlyArray<ActionPreviewStep> = card.cardPlayPreview(player).branches?.[0]?.steps ?? [];
  return steps.find((s): s is TableImpactStep => s.kind === 'tableImpact');
}

function skippedEvents(game: IGame) {
  return game.events.events.filter((e) => e.type === 'effect-skipped');
}

describe('Recession', () => {
  let card: Recession;
  let player: TestPlayer;
  let player2: TestPlayer;
  let player3: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Recession();
    [game, player, player2, player3] = testGame(3);
  });

  // Upstream's rule, kept: an opponent at the −5 floor keeps the card in hand (the print asks the step of EACH one).
  const canPlayRuns = [
    {production: [0, 0, 0], expected: true},
    {production: [0, -4, 0], expected: true},
    {production: [-5, 0, 0], expected: true},
    {production: [0, -5, 0], expected: false},
  ] as const;
  for (const run of canPlayRuns) {
    it('canPlay ' + JSON.stringify(run), () => {
      player.production.override({megacredits: run.production[0]});
      player2.production.override({megacredits: run.production[1]});
      player3.production.override({megacredits: run.production[2]});
      expect(player.canPlay(card)).eq(run.expected);
    });
  }

  it('play', () => {
    player.megaCredits = 4;
    player2.megaCredits = 8;
    player3.megaCredits = 3;

    cast(card.play(player), undefined);
    runAllActions(game);

    expect(player.megaCredits).eq(14);
    expect(player2.megaCredits).eq(3);
    expect(player3.megaCredits).eq(0);
    expect(player.production.megacredits).eq(0);
    expect(player2.production.megacredits).eq(-1);
    expect(player3.production.megacredits).eq(-1);
  });

  it('a locked card NAMES the seat at the floor, with its colour (invariant 2)', () => {
    player3.production.override({megacredits: -5});
    expect(card.unplayableReason(player)).deep.eq({
      type: 'production',
      message: '${0}: M€ production is already at −5',
      params: [player3.name],
      resource: Resource.MEGACREDITS,
      seat: {name: player3.name, color: player3.color},
    });
    expect(unplayableReasons(player, card).map((r) => r.message)).contains('${0}: M€ production is already at −5');
    player3.production.override({megacredits: 0});
    expect(card.unplayableReason(player)).is.undefined;
  });

  it('every loss is ATTRIBUTED to the player — the victim\'s two events carry `from`', () => {
    player2.megaCredits = 20;
    player.playCard(card);
    runAllActions(game);
    const victim = game.events.events.filter((e) => e.player === player2.color && (e.type === 'resource-changed' || e.type === 'production-changed'));
    // The printed order: the M€ first, then the production — one chain, the card and its owner as the source.
    expect(victim.map((e) => e.type)).deep.eq(['resource-changed', 'production-changed']);
    for (const e of victim) {
      expect(e.source, e.type).deep.eq({kind: 'card', card: card.name, owner: player.color});
    }
  });

  describe('Private Security — the production is spared and NAMED (invariant 4)', () => {
    beforeEach(() => {
      player2.playedCards.push(new PrivateSecurity());
      player2.megaCredits = 20;
    });

    it('the production stays, the M€ go, the skip is recorded with its reason', () => {
      card.play(player);
      runAllActions(game);
      expect(player2.production.megacredits).eq(0);
      expect(player2.megaCredits).eq(15);
      expect(player3.production.megacredits).eq(-1);
      const skipped = skippedEvents(game);
      expect(skipped).has.length(1);
      expect(skipped[0].impact?.skipped?.reason).eq('Production is protected');
      expect(skipped[0].impact?.skipped?.label).eq('M€ production of ${0}');
    });

    it('a protected seat AT THE FLOOR still locks the card — the floor is the upstream human gate, read before any protection', () => {
      player2.production.override({megacredits: -5});
      // The floor is a HUMAN fact upstream reads regardless of protection — the print still asks the step of them.
      expect(player.canPlay(card)).is.false;
    });

    it('the preview says the same before the press: the row keeps M€ only and names the spared step', () => {
      const step = tableImpactOf(card, player);
      const row = step?.rows.find((r) => r.color === player2.color);
      expect(row?.impact.changes).deep.eq([{icon: 'megacredits', from: 20, to: 15, scope: 'stock'}]);
      expect(row?.skipped).deep.eq({scope: 'production', icon: 'megacredits', amount: 1, reason: 'Production is protected'});
    });
  });

  it('the preview shows EVERY victim with `current → resulting` of both scopes, in the table order', () => {
    player2.megaCredits = 30;
    player2.production.override({megacredits: 1});
    player3.megaCredits = 3;
    const step = tableImpactOf(card, player);
    expect(step?.title).eq('Opponents');
    expect(step?.rows.map((r) => r.color)).deep.eq([player2.color, player3.color]);
    expect(step?.rows[0].impact.changes).deep.eq([
      {icon: 'megacredits', from: 30, to: 25, scope: 'stock'},
      {icon: 'megacredits', from: 1, to: 0, scope: 'production', steps: 1},
    ]);
    // A victim with 3 M€ loses 3, never 5 — the row says it.
    expect(step?.rows[1].impact.changes[0]).deep.eq({icon: 'megacredits', from: 3, to: 0, scope: 'stock'});
    // The +10 rides the behavior's own chip.
    expect(card.cardPlayPreview(player).branches?.[0].effects.map((e) => [e.direction, e.icon, e.amount])).deep.eq([['gain', 'megacredits', 10]]);
  });

  it('the preview is read-only', () => {
    player2.megaCredits = 30;
    const before = JSON.stringify(game.serialize());
    card.cardPlayPreview(player);
    expect(JSON.stringify(game.serialize())).eq(before);
  });

  it('Mons Insurance: the owner attacks and pays each victim by upstream\'s bookkeeping (per attributed loss)', () => {
    player.playedCards.push(new MonsInsurance());
    game.monsInsuranceOwner = player;
    player.megaCredits = 20;
    player2.megaCredits = 10;
    player3.megaCredits = 10;
    card.play(player);
    runAllActions(game);
    // Each victim: −5 M€, −1 production, and the insurer's compensation for each of the two attributed losses
    // (`resolveInsurance` from Production.add and from Stock.deduct) — 3 M€ apiece, paid by the attacker.
    expect(player2.megaCredits).eq(10 - 5 + 3 + 3);
    expect(player3.megaCredits).eq(10 - 5 + 3 + 3);
    expect(player.megaCredits).eq(20 + 10 - 12);
  });

  describe('solo — no opponent', () => {
    it('only the +10, and the preview says so', () => {
      const [soloGame, solo] = testGame(1);
      expect(solo.canPlay(card)).is.true;
      solo.megaCredits = 0;
      card.play(solo);
      runAllActions(soloGame);
      expect(solo.megaCredits).eq(10);
      const steps = card.cardPlayPreview(solo).branches?.[0].steps ?? [];
      expect(steps).deep.eq([{kind: 'note', noteKind: 'generic', text: 'No opponents — only the +10 M€'}]);
    });
  });

  describe('MarsBot — hit through its own doors', () => {
    it('the supply loses 5 through removeFromBot, the M€ track regresses, the card is never locked by the bot', () => {
      const [botGame, human, bot] = testAutomaGame();
      const track = botGame.automa!.board.tracks[botGame.automa!.board.getTrackIndexForProduction(Resource.MEGACREDITS)!];
      track.position = 3;
      bot.megaCredits = 12;
      // The bot's placeholder production at the floor never locks the card (it has no production).
      bot.production.override({megacredits: -5});
      expect(human.canPlay(card)).is.true;
      expect(card.unplayableReason(human)).is.undefined;

      const row = tableImpactOf(card, human)?.rows.find((r) => r.color === bot.color);
      expect(row?.impact.changes.map((c) => [c.scope, c.from, c.to])).deep.eq([['stock', 12, 7], ['track', 3, 2]]);
      expect(row?.skipped).is.undefined;

      card.play(human);
      runAllActions(botGame);
      expect(bot.megaCredits).eq(7);
      expect(track.position).eq(2);
    });

    it('a track that cannot regress is a NAMED skip — before and after the press', () => {
      const [botGame, human, bot] = testAutomaGame();
      const track = botGame.automa!.board.tracks[botGame.automa!.board.getTrackIndexForProduction(Resource.MEGACREDITS)!];
      track.position = 0;
      bot.megaCredits = 2;
      const row = tableImpactOf(card, human)?.rows.find((r) => r.color === bot.color);
      expect(row?.impact.changes.map((c) => [c.scope, c.from, c.to])).deep.eq([['stock', 2, 0]]);
      expect(row?.skipped?.reason).eq('The track cannot regress');

      card.play(human);
      runAllActions(botGame);
      expect(bot.megaCredits).eq(0);
      expect(track.position).eq(0);
      expect(skippedEvents(botGame).map((e) => e.impact?.skipped?.reason)).deep.eq(['The track cannot regress']);
    });
  });
});
