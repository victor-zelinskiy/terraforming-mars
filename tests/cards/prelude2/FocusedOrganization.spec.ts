import {expect} from 'chai';
import {FocusedOrganization} from '../../../src/server/cards/prelude2/FocusedOrganization';
import {testGame} from '../../TestGame';
import {Units} from '../../../src/common/Units';
import {runAllActions} from '../../TestingUtils';
import {SelectResource} from '../../../src/server/inputs/SelectResource';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SolBank} from '../../../src/server/cards/pathfinders/SolBank';
import {cast} from '../../../src/common/utils/utils';
import {addressVerdict, promptAddressOf} from '../../../src/common/inputs/preselectAddress';
import {AddressableInput} from '../../../src/common/inputs/preselectAddress';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {withPreselectAddresses} from '../../../src/server/models/preselectAddresses';
import {SelectResourceModel} from '../../../src/common/models/PlayerInputModel';
import {InputResponse} from '../../../src/common/inputs/InputResponse';

describe('FocusedOrganization', () => {
  it('play', () => {
    const card = new FocusedOrganization();
    const [game, player] = testGame(1);

    card.play(player);
    runAllActions(game);
    expect(player.cardsInHand).has.length(1);

    const selectResources = cast(player.popWaitingFor(), SelectResource);
    expect(selectResources.include).has.length(6);
    // The play's «?» is the declarative one — a GAIN of this card's, addressed role `resource`.
    expect(selectResources.gainAmount).eq(1);
    expect(promptAddressOf(selectResources as unknown as AddressableInput).role).eq('resource');
    selectResources.cb('plants');
    expect(player.stock.asUnits()).deep.eq(Units.of({plants: 1}));

    runAllActions(game);
    cast(player.popWaitingFor(), undefined);
  });

  const canActRuns = [
    {cardsInHand: 0, resources: 0, expected: false, reason: 'No cards in hand'},
    {cardsInHand: 1, resources: 0, expected: false, reason: 'No standard resources to spend'},
    {cardsInHand: 0, resources: 1, expected: false, reason: 'No cards in hand'},
    {cardsInHand: 1, resources: 1, expected: true, reason: undefined},
  ] as const;
  for (const run of canActRuns) {
    it('canAct + its ONE named blocker (the hand first): ' + JSON.stringify(run), () => {
      const card = new FocusedOrganization();
      const [/* game */, player] = testGame(1);

      if (run.cardsInHand === 1) {
        player.drawCard();
      }
      player.megaCredits = run.resources;
      expect(card.canAct(player)).eq(run.expected);
      expect(card.actionUnavailableReason(player)?.message).eq(run.reason);
    });
  }

  it('action — a SEQUENCE of three addressable prompts: spend → discard (→ draw) → gain', () => {
    const card = new FocusedOrganization();
    const [game, player] = testGame(1);

    const firstCard = game.projectDeck.drawOrThrow(game);
    const secondCard = game.projectDeck.drawOrThrow(game);
    player.cardsInHand = [firstCard, secondCard];
    player.megaCredits = 5;
    player.plants = 3;
    const discards = game.projectDeck.discardPile.length;

    const spend = cast(card.action(player), SelectResource);
    // Only a resource the player HOLDS is offered; the prompt says it SPENDS.
    expect(spend.include).deep.eq(['megacredits', 'plants']);
    expect(spend.spendAmount).eq(1);
    expect(spend.gainAmount).is.undefined;
    expect(promptAddressOf(spend as unknown as AddressableInput)).deep.eq({role: 'spend', source: {kind: 'card', card: card.name}});

    const discard = cast(spend.cb('plants'), SelectCard);
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 5, plants: 2}));
    expect(discard.cards).to.have.members([firstCard, secondCard]);
    expect(promptAddressOf(discard as unknown as AddressableInput)).deep.eq({role: 'discard', source: {kind: 'card', card: card.name}});

    const gain = cast(discard.cb([firstCard]), SelectResource);
    expect(player.cardsInHand).does.not.contain(firstCard);
    expect(game.projectDeck.discardPile).has.length(discards + 1);
    expect(game.projectDeck.discardPile).contains(firstCard);
    expect(player.cardsInHand).contains(secondCard);
    // The draw lands BEFORE the gain is asked.
    expect(player.cardsInHand).has.length(2);
    expect(gain.include).has.length(6);
    expect(gain.gainAmount).eq(1);
    expect(promptAddressOf(gain as unknown as AddressableInput)).deep.eq({role: 'resource', source: {kind: 'card', card: card.name}});

    gain.cb('titanium');
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 5, titanium: 1, plants: 2}));
  });

  it('the two «?» never trade answers — a spend answer is FOREIGN to the gain prompt and back', () => {
    const card = new FocusedOrganization();
    const [/* game */, player] = testGame(1);
    player.drawCard();
    player.plants = 1;
    const spendModel = card.actionPreview(player).branches[0].steps[0];
    const spend = cast(card.action(player), SelectResource);
    expect(spendModel.kind).eq('input');
    const gainStamped = {role: 'resource', source: {kind: 'card' as const, card: card.name}};
    expect(addressVerdict(gainStamped, spend as unknown as AddressableInput)).eq('foreign');
    expect(addressVerdict({role: 'spend', source: gainStamped.source}, spend as unknown as AddressableInput)).eq('own');
  });

  it('preview = execution: spend, discard, gain — in that order, each addressed by its role', () => {
    const card = new FocusedOrganization();
    const [/* game */, player] = testGame(1);
    player.drawCard();
    player.drawCard();
    player.heat = 2;
    const preview = withPreselectAddresses(card.actionPreview(player));
    const branch = preview.branches[0];
    expect(branch.available).is.true;
    expect(branch.index).eq(-1);
    const steps = branch.steps;
    expect(steps.map((s) => s.kind)).deep.eq(['input', 'input', 'input']);
    const [spend, discard, gain] = steps.map((s) => s.kind === 'input' ? s : undefined);
    expect(spend?.input.type).eq('resource');
    expect((spend?.input as SelectResourceModel).spendAmount).eq(1);
    expect((spend?.input as SelectResourceModel).include).deep.eq(['heat']);
    expect(spend?.for?.role).eq('spend');
    expect(discard?.input.type).eq('card');
    expect(discard?.for?.role).eq('discard');
    expect((gain?.input as SelectResourceModel).amount).eq(1);
    expect(gain?.for?.role).eq('resource');
    expect(branch.effects.map((e) => `${e.direction}:${e.icon}:${e.amount}`)).deep.eq(['cost:wild:1', 'gain:cards:1', 'gain:wild:1']);
  });

  it('a blocked action previews no step and names its reason', () => {
    const card = new FocusedOrganization();
    const [/* game */, player] = testGame(1);
    player.heat = 2;
    const branch = card.actionPreview(player).branches[0];
    expect(branch.available).is.false;
    expect(branch.steps).deep.eq([]);
    expect(branch.unavailableReason).eq('No cards in hand');
  });

  it('ONE POST — the three addressed answers replay onto their own prompts', () => {
    const card = new FocusedOrganization();
    const [game, player] = testGame(1);
    player.playedCards.push(card);
    const kept = game.projectDeck.drawOrThrow(game);
    const thrown = game.projectDeck.drawOrThrow(game);
    player.cardsInHand = [kept, thrown];
    player.plants = 2;
    const preview = withPreselectAddresses(card.actionPreview(player));
    const [spendStep, discardStep, gainStep] = preview.branches[0].steps;
    const addressOf = (step: typeof spendStep) => step.kind === 'input' ? step.for : undefined;

    player.defer(card.action(player));
    runAllActions(game);
    const batch: Array<InputResponse> = [
      {type: 'resource', resource: 'plants', for: addressOf(spendStep)} as InputResponse,
      {type: 'card', cards: [thrown.name], for: addressOf(discardStep)} as InputResponse,
      {type: 'resource', resource: 'heat', for: addressOf(gainStep)} as InputResponse,
    ];
    replayBatch(player, batch);
    runAllActions(game);

    expect(parkedBatchTailLength(player)).eq(0);

    expect(player.getWaitingFor()).is.undefined;
    expect(player.plants).eq(1);
    expect(player.heat).eq(1);
    expect(player.cardsInHand).contains(kept);
    expect(player.cardsInHand).does.not.contain(thrown);
    expect(player.cardsInHand).has.length(2);
    expect(game.projectDeck.discardPile).contains(thrown);
    // ONE typed line names the whole action.
    const line = game.gameLog[game.gameLog.length - 1];
    expect(line.message).eq('${0} spends 1 ${1}, discards ${2}, draws a card and gains 1 ${3}');
  });

  it('Compatible with Sol Bank', () => {
    const card = new FocusedOrganization();
    const solBank = new SolBank();
    const [game, player] = testGame(1, {pathfindersExpansion: true});
    player.playedCards.push(solBank);

    const firstCard = game.projectDeck.drawOrThrow(game);
    const secondCard = game.projectDeck.drawOrThrow(game);
    player.cardsInHand = [firstCard, secondCard];
    player.megaCredits = 5;
    player.plants = 3;

    // Spending plants feeds nothing…
    const spendPlants = cast(card.action(player), SelectResource);
    cast(spendPlants.cb('plants'), SelectCard);
    runAllActions(game);
    expect(solBank.resourceCount).eq(0);

    // …spending M€ feeds the bank.
    const spendMegacredits = cast(card.action(player), SelectResource);
    cast(spendMegacredits.cb('megacredits'), SelectCard);
    runAllActions(game);
    expect(solBank.resourceCount).eq(1);
  });
});
