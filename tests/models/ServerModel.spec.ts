import {expect} from 'chai';
import {Banker} from '../../src/server/awards/Banker';
import {IAward} from '../../src/server/awards/IAward';
import {IGame} from '../../src/server/IGame';
import {Mayor} from '../../src/server/milestones/Mayor';
import {Resource} from '../../src/common/Resource';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {Server} from '../../src/server/models/ServerModel';
import {testAutomaMultiplayerGame} from '../automa/AutomaTestGame';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Phase} from '../../src/common/Phase';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {SelfReplicatingRobots} from '../../src/server/cards/promo/SelfReplicatingRobots';
import {CardName} from '../../src/common/cards/CardName';
import {newProjectCard} from '../../src/server/createCard';

describe('ServerModel', () => {
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  function createTestGame(showOtherPlayersVP: boolean) {
    [game, player, player2] = testGame(2, {showOtherPlayersVP});
    // Claim milestone
    const milestone = new Mayor();

    game.claimedMilestones.push({
      player: player,
      milestone: milestone,
    });

    // Fund awards
    const award: IAward = new Banker();
    game.fundAward(player, award);

    // Set second player to win Banker award
    player2.production.add(Resource.MEGACREDITS, 10);

    // Our testing player will be 2nd Banker in the game
    player.production.add(Resource.MEGACREDITS, 7);
  }

  // The console top-HUD draw pile renders GameModel.deckSize — it must be
  // the DRAW pile alone (never draw+discard), tracking removals live.
  it('deckSize is the authoritative project draw-pile size', () => {
    createTestGame(false);
    expect(Server.getPlayerModel(player).game.deckSize).eq(game.projectDeck.drawPile.length);
    game.projectDeck.discardPile.push(game.projectDeck.drawOrThrow(game));
    game.projectDeck.discardPile.push(game.projectDeck.drawOrThrow(game));
    const model = Server.getPlayerModel(player).game;
    expect(model.deckSize).eq(game.projectDeck.drawPile.length);
    expect(model.deckSize + 2).eq(game.projectDeck.drawPile.length + game.projectDeck.discardPile.length);
  });

  it('Should always return current player\'s VP', () => {
    createTestGame(false);
    const response = Server.getPlayerModel(player);
    expect(response.thisPlayer.victoryPointsBreakdown.total).eq(25);
    expect(response.thisPlayer.victoryPointsBreakdown.milestones).eq(5);
    expect(response.players[0].victoryPointsBreakdown.total).eq(25);
    expect(response.players[1].victoryPointsBreakdown.total).eq(0);
  });

  it('Should return all players\' VP', () => {
    createTestGame(true);
    const response = Server.getPlayerModel(player);
    expect(response.thisPlayer.victoryPointsBreakdown.total).eq(25);
    expect(response.players[0].victoryPointsBreakdown.total).eq(25);
    expect(response.players[0].victoryPointsBreakdown.milestones).eq(5);
    expect(response.players[1].victoryPointsBreakdown.total).eq(25);
    expect(response.players[1].victoryPointsBreakdown.awards).eq(5);
  });

  it('The MarsBot seat\'s VP is OPEN mid-game even in hidden-VP mode (its state is table-public)', () => {
    // Two humans + the bot, showOtherPlayersVP OFF: the human opponent's
    // breakdown stays zeroed, the bot's is real — every input to the bot's
    // score (tracks, tiles, M€, played pile) is open information by the
    // Automa rules, so hiding the derived number only produced a fake 0
    // next to its real TR in the live Information workspace.
    const [botGame, humans, bot] = testAutomaMultiplayerGame(2, {showOtherPlayersVP: false});
    botGame.phase = Phase.ACTION;
    const response = Server.getPlayerModel(humans[0]);
    const botSeat = response.players.find((p) => p.isMarsBot === true);
    const otherHuman = response.players.find((p) => p.color === humans[1].color);
    expect(botSeat, 'the bot has a seat in the model').is.not.undefined;
    expect(botSeat!.victoryPointsBreakdown.total, 'the bot\'s live score is real (TR base at minimum)')
      .eq(bot.getVictoryPoints().total).and.greaterThan(0);
    expect(otherHuman!.victoryPointsBreakdown.total, 'a human opponent keeps the hidden-VP contract').eq(0);
  });

  it('Should include globalParameterSteps at game end', () => {
    createTestGame(false);
    // Simulate players contributing to global parameters
    player.globalParameterSteps[GlobalParameter.TEMPERATURE] = 5;
    player.globalParameterSteps[GlobalParameter.OXYGEN] = 3;
    player.globalParameterSteps[GlobalParameter.OCEANS] = 2;

    player2.globalParameterSteps[GlobalParameter.TEMPERATURE] = 2;
    player2.globalParameterSteps[GlobalParameter.OXYGEN] = 6;

    game.phase = Phase.END;

    const response = Server.getPlayerModel(player);

    // Current player should always see their globalParameterSteps
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(5);
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.OXYGEN]).eq(3);
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.OCEANS]).eq(2);

    // Other players' globalParameterSteps should be visible at game end
    const otherPlayer = response.players.find((p) => p.id === player2.id);
    expect(otherPlayer).is.not.undefined;
    expect(otherPlayer!.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(2);
    expect(otherPlayer!.globalParameterSteps[GlobalParameter.OXYGEN]).eq(6);
  });

  it('Should not include globalParameterSteps during game', () => {
    createTestGame(false);
    player.globalParameterSteps[GlobalParameter.TEMPERATURE] = 5;
    player2.globalParameterSteps[GlobalParameter.OXYGEN] = 3;

    game.phase = Phase.ACTION;

    const response = Server.getPlayerModel(player);

    // Current player should see their own steps
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(5);

    // Other players' steps should be empty during game (player id is undefined during game)
    const otherPlayer = response.players.find((p) => p.color === player2.color && p.name === player2.name);
    expect(otherPlayer).is.not.undefined;
    expect(Object.keys(otherPlayer!.globalParameterSteps).length).eq(0);
  });

  it('Should include globalParameterSteps when showOtherPlayersVP is true', () => {
    createTestGame(true);
    player.globalParameterSteps[GlobalParameter.TEMPERATURE] = 4;
    player2.globalParameterSteps[GlobalParameter.OXYGEN] = 7;

    game.phase = Phase.ACTION;

    const response = Server.getPlayerModel(player);

    // With showOtherPlayersVP, all players' steps should be visible
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(4);

    const otherPlayer = response.players.find((p) => p.color === player2.color && p.name === player2.name);
    expect(otherPlayer).is.not.undefined;
    expect(otherPlayer!.globalParameterSteps[GlobalParameter.OXYGEN]).eq(7);
  });

  it('serializes pendingInitialActions as card names (empty by default)', () => {
    createTestGame(false);
    // No corp first action owed in a default test game.
    expect(Server.getPlayerModel(player).pendingInitialActions).deep.eq([]);

    const corp = new TharsisRepublic();
    player.pendingInitialActions.push(corp);
    expect(Server.getPlayerModel(player).pendingInitialActions).deep.eq([corp.name]);
  });

  it('serializes Self-replicating Robots hosted cards: flag + discounted cost + reasons', () => {
    [game, player, player2] = testGame(2);
    const srr = new SelfReplicatingRobots();
    player.playedCards.push(srr);
    const hosted = newProjectCard(CardName.LUNAR_BEAM)!;
    hosted.resourceCount = 2;
    srr.targetCards.push(hosted);

    // Affordable: plenty of M€, no reasons; discount baked into calculatedCost.
    player.megaCredits = 30;
    const ownModel = Server.getPlayerModel(player);
    const hostedModels = ownModel.thisPlayer.selfReplicatingRobotsCards;
    expect(hostedModels).has.length(1);
    expect(hostedModels[0].name).eq(CardName.LUNAR_BEAM);
    expect(hostedModels[0].isSelfReplicatingRobotsCard).is.true;
    expect(hostedModels[0].resources).eq(2);
    // getCardCost applies the SRR discount (= the resources on the card).
    expect(hostedModels[0].calculatedCost).eq(player.getCardCost(hosted));
    expect(hostedModels[0].unplayableReasons ?? []).has.length(0);

    // Unaffordable: the OWN model carries structured unplayable reasons so the
    // hand overlay shows a proper rules block, not a misleading "not your turn".
    player.megaCredits = 0;
    const brokeModel = Server.getPlayerModel(player);
    expect((brokeModel.thisPlayer.selfReplicatingRobotsCards[0].unplayableReasons ?? []).length).greaterThan(0);

    // The OPPONENT's view of the same hosted card never carries reasons.
    const opponentView = Server.getPlayerModel(player2);
    const fromOpponent = opponentView.players.find((p) => p.color === player.color)!.selfReplicatingRobotsCards;
    expect(fromOpponent).has.length(1);
    expect(fromOpponent[0].unplayableReasons).is.undefined;
  });

  // The drafted shelf is the viewer's OWN mid-draft evaluation surface: the
  // console's inspect zone and the wait popover speak the requirement voice
  // over it, so `draftedCards` must carry the structured reasons — with the
  // same subject-player evaluation the hand gets.
  it('serializes draftedCards with unplayableReasons for the viewer', () => {
    [game, player] = testGame(1);
    const lakeMarineris = newProjectCard(CardName.LAKE_MARINERIS)!; // requires 0°C
    player.draftedCards.push(lakeMarineris);

    const model = Server.getPlayerModel(player);
    expect(model.draftedCards).has.length(1);
    const drafted = model.draftedCards[0];
    expect(drafted.name).eq(CardName.LAKE_MARINERIS);
    expect((drafted.unplayableReasons ?? []).some((r) => r.requirement === true)).is.true;
  });

  // The console rail's passive MC-value badges read the standing payment
  // grants OFF THE PUBLIC MODEL (no active prompt) — the model must mirror
  // the exact engine flags Player.payingAmount charges by, for every seat.
  it('mirrors the standing payment-capability flags onto the public model', () => {
    createTestGame(false);
    let model = Server.getPlayerModel(player);
    expect(model.thisPlayer.canUseHeatAsMegaCredits).is.false;
    expect(model.thisPlayer.canUseTitaniumAsMegacredits).is.false;
    expect(model.thisPlayer.canUsePlantsAsMegacredits).is.false;

    // The engine flag, not a card name: Helion, Ambient and any future grant
    // all set the same field the model mirrors.
    player.canUseHeatAsMegaCredits = true;
    player.canUseTitaniumAsMegacredits = true;
    player.canUsePlantsAsMegacredits = true;
    model = Server.getPlayerModel(player);
    expect(model.thisPlayer.canUseHeatAsMegaCredits).is.true;
    expect(model.thisPlayer.canUseTitaniumAsMegacredits).is.true;
    expect(model.thisPlayer.canUsePlantsAsMegacredits).is.true;

    // Public on every seat (an inspected opponent's rail shows THEIR grants).
    const opponentView = Server.getPlayerModel(player2);
    const fromOpponent = opponentView.players.find((p) => p.color === player.color)!;
    expect(fromOpponent.canUseHeatAsMegaCredits).is.true;
    expect(fromOpponent.canUseTitaniumAsMegacredits).is.true;
    expect(fromOpponent.canUsePlantsAsMegacredits).is.true;
  });
});
