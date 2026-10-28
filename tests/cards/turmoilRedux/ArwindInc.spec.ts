import {expect} from 'chai';
import {ARWIND_FIGHTERS_PER_STEP, ArwindInc} from '../../../src/server/cards/turmoilRedux/ArwindInc';
import {MinorityRepresentation} from '../../../src/server/cards/turmoilRedux/MinorityRepresentation';
import {MarsArmyShips} from '../../../src/server/cards/turmoilRedux/MarsArmyShips';
import {AquiferStandardProject} from '../../../src/server/cards/base/standardProjects/AquiferStandardProject';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {ARWIND_FIGHTER_VALUE} from '../../../src/common/constants';
import {DEFAULT_PAYMENT_VALUES, Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {ActionPreview, ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {AndOptionsModel, SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {playPreviewWithTableQuestions} from '../../../src/server/models/tableQuestions';
import {SelectPaymentDeferred} from '../../../src/server/deferredActions/SelectPaymentDeferred';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {replayBatch, parkedBatchTailLength} from '../../../src/server/inputs/deferredInputBatch';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {isActionMenuTitle} from '../../../src/common/inputs/actionMenuTitles';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR78 — ARWIND INC.: 38 M€ + 1 titanium production, the Space tag, a fighter holder; the action «add a fighter to ANY
 * card»; a fighter per STEP of the Career, answered per WALK (`ICard.onAgendaWalked` — the four engines are pinned in
 * tests/parliament/AgendaWalkHook.spec.ts); the fighters HERE pay 4 M€ for a Space tag (`arwindFighters`). Every rule
 * reading of the card file's header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: ArwindInc};

function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new ArwindInc();
  player.playedCards.push(card);
  return {game, player, opponent, parliament: game.parliament!, card};
}

function spaceCard(cost: number, tags: Array<Tag> = [Tag.SPACE]): IProjectCard {
  return fakeCard({name: 'Space probe' as CardName, cost, tags});
}

const tableSteps = (preview: ActionPreview): Array<ActionPreviewStep & {kind: 'input'}> =>
  (preview.preSteps ?? []).filter((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.reaction !== undefined);

describe('ArwindInc', () => {
  describe('rule 0 — the card as printed', () => {
    it('a corporation for 38 M€, the Space tag, a fighter holder, no VP, no first action — TR78, the first new corporation', () => {
      const card = new ArwindInc();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(38);
      expect(card.tags).deep.eq([Tag.SPACE]);
      expect(card.resourceType).eq(CardResource.FIGHTER);
      expect(card.victoryPoints).is.undefined;
      expect(card.initialActionText).is.undefined;
      expect(card.metadata.cardNumber).eq('TR78');
      expect(card.metadata.reimplements, 'a NEW corporation borrows no classic card').is.undefined;
      expect(newCorporationCardNumber(CardName.ARWIND_INC)).eq('TR78');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS[0]).deep.include({name: 'Arwind Inc.', authored: CardName.ARWIND_INC});
      expect(Object.keys(TURMOIL_REDUX_CARD_MANIFEST.corporationCards)).to.include(CardName.ARWIND_INC);
    });

    it('the play: 1 titanium production', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      const card = new ArwindInc();
      player.playCorporationCard(card);
      expect(player.production.titanium).eq(1);
      expect(player.megaCredits).eq(38);
    });
  });

  describe('rule 1 — the action: a fighter on ANY holder, this card included, never chosen for you', () => {
    it('ONE holder (this card): still a pick of one; the fighter lands here', () => {
      const t = table();
      expect(t.card.canAct(t.player)).is.true;
      t.card.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.getWaitingFor(), SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.ARWIND_INC]);
      t.player.process({type: 'card', cards: [CardName.ARWIND_INC]});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(ARWIND_FIGHTERS_PER_STEP);
    });

    it('several holders: every OWN fighter holder is a candidate, a rival\'s never', () => {
      const t = table();
      const ships = new MarsArmyShips();
      t.player.playedCards.push(ships);
      t.opponent.playedCards.push(new MarsArmyShips());
      const step = actionPreview(t.player, t.card).branches[0].steps.find((s) => s.kind === 'input');
      expect(step?.kind).eq('input');
      const model = (step as {input: SelectCardModel}).input;
      expect(model.cards.map((c) => c.name)).to.have.members([CardName.ARWIND_INC, CardName.MARS_ARMY_SHIPS]);
      t.card.action(t.player);
      runAllActions(t.game);
      t.player.process({type: 'card', cards: [CardName.MARS_ARMY_SHIPS]});
      runAllActions(t.game);
      expect(ships.resourceCount).eq(1);
      expect(t.card.resourceCount).eq(0);
    });
  });

  describe('rules 2 · 3 · 5 — a walk of the Career owes a fighter per step: the asker alone lands them; a second holder makes ONE question the composer pre-selects', () => {
    function walker(t: Table): MinorityRepresentation {
      t.parliament.agenda.set(t.player.id, 0);
      const card = new MinorityRepresentation();
      t.player.cardsInHand.push(card);
      t.player.megaCredits = 20;
      return card;
    }

    it('the corporation alone: the forecast is EXACT — «+2 [fighter] on this card» — no question, and the play lands them', () => {
      const t = table();
      const card = walker(t);
      const preview = playPreviewWithTableQuestions(t.player, card);
      expect(tableSteps(preview), 'no question to pre-select').deep.eq([]);
      const fact = preview.forecast?.facts.find((f) => f.source.name === CardName.ARWIND_INC);
      expect(fact?.certainty).eq('exact');
      expect(fact?.effects[0]).deep.include({direction: 'gain', icon: 'fighter', amount: 2, host: CardName.ARWIND_INC});
      t.player.playCard(card, Payment.EMPTY);
      runAllActions(t.game);
      expect(t.player.getWaitingFor()?.agendaWalkPrompt, 'nothing is asked').is.undefined;
      expect(t.card.resourceCount, 'two steps, two fighters, landed with the play').eq(2);
    });

    it('a second holder: the composer carries ONE question for the whole walk — the LAYOUT of 2 fighters, addressed to the corporation', () => {
      const t = table();
      t.player.playedCards.push(new MarsArmyShips());
      const card = walker(t);
      const steps = tableSteps(playPreviewWithTableQuestions(t.player, card));
      expect(steps.map((s) => s.reaction?.card), 'ONE question — never one per step').deep.eq([CardName.ARWIND_INC]);
      const [step] = steps;
      expect(step.for).deep.eq({role: 'and', source: {kind: 'corporation', card: CardName.ARWIND_INC}});
      const input = step.input as AndOptionsModel;
      expect(input.type).eq('and');
      expect(input.agendaWalkPrompt).deep.eq({source: CardName.ARWIND_INC, reason: 'card', from: 0, to: 2, card: CardName.MINORITY_REPRESENTATION});
      expect(input.cardResourceDistributionPrompt?.amount).eq(2);
      expect(input.cardResourceDistributionPrompt?.cards.map((c) => c.name)).deep.eq([CardName.ARWIND_INC, CardName.MARS_ARMY_SHIPS]);
    });

    it('the ONE POST lands the layout on its own prompt — nothing is asked after the press', () => {
      const t = table();
      const ships = new MarsArmyShips();
      t.player.playedCards.push(ships);
      const card = walker(t);
      const steps = tableSteps(playPreviewWithTableQuestions(t.player, card));
      expect(steps).has.length(1);
      t.player.takeAction();
      const menu = cast(t.player.getWaitingFor(), OrOptions);
      const index = menu.options.findIndex((o) => o.title === 'Play project card');
      replayBatch(t.player, [
        {type: 'or', index, response: {type: 'projectCard', card: card.name, payment: Payment.of({megacredits: t.player.getCardCost(card)})}},
        {type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 1}], for: steps[0].for} as unknown as InputResponse,
      ]);
      runAllActions(t.game);
      const wf = cast(t.player.getWaitingFor(), OrOptions);
      expect(isActionMenuTitle(typeof wf.title === 'string' ? wf.title : wf.title.message), 'no question left').is.true;
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(t.card.resourceCount, 'one fighter here').eq(1);
      expect(ships.resourceCount, 'one on Mars Army Ships').eq(1);
      expect(t.parliament.agendaOf(t.player)).eq(2);
    });

    it('no answer in the batch: the question stands LIVE (the layout the console hosts in the hand)', () => {
      const t = table();
      t.player.playedCards.push(new MarsArmyShips());
      const card = walker(t);
      t.player.playCard(card, Payment.EMPTY);
      runAllActions(t.game);
      const wf = t.player.getWaitingFor();
      expect(wf?.type).eq('and');
      expect(wf?.agendaWalkPrompt).deep.include({reason: 'card', from: 0, to: 2});
    });

    it("a rival's walk asks this table nothing — the engine asks only the walking seat's own table", () => {
      const t = table();
      const card = new MinorityRepresentation();
      t.opponent.cardsInHand.push(card);
      t.opponent.megaCredits = 20;
      t.parliament.agenda.set(t.opponent.id, 0);
      expect(tableSteps(playPreviewWithTableQuestions(t.opponent, card))).deep.eq([]);
    });
  });

  describe('rule 4 — the fighters HERE pay 4 M€ for a card with a PRINTED Space tag', () => {
    it('the unit: one entry, this card, a flat 4', () => {
      expect(SPENDABLE_CARD_RESOURCES).to.include('arwindFighters');
      expect(CARD_FOR_SPENDABLE_RESOURCE.arwindFighters).eq(CardName.ARWIND_INC);
      expect(DEFAULT_PAYMENT_VALUES.arwindFighters).eq(ARWIND_FIGHTER_VALUE);
      expect(ARWIND_FIGHTER_VALUE).eq(4);
      const t = table();
      t.card.resourceCount = 3;
      expect(t.player.getSpendable('arwindFighters')).eq(3);
    });

    it('the gate: a Space card opens the lane; no tag, a wild tag, a standard project and a deferred bill do not', () => {
      const t = table();
      t.card.resourceCount = 3;
      expect(t.player.paymentOptionsForCard(spaceCard(8)).arwindFighters).is.true;
      expect(t.player.paymentOptionsForCard(spaceCard(8, [])).arwindFighters).is.false;
      expect(t.player.paymentOptionsForCard(spaceCard(8, [Tag.WILD])).arwindFighters, 'a wild tag is no Space card').is.false;
      expect(t.player.paymentOptionsForCard(new AquiferStandardProject()).arwindFighters).is.false;
      t.player.megaCredits = 3;
      t.player.titanium = 1;
      const model = new SelectPaymentDeferred(t.player, 6, {canUseTitanium: true}).previewPaymentModel();
      expect(model?.paymentOptions.arwindFighters, 'a bill is no card play').is.false;
    });

    it('a Space card for 12 at 0 M€ and 3 fighters here: playable; pay() takes them off THIS card', () => {
      const t = table();
      t.card.resourceCount = 3;
      t.player.megaCredits = 0;
      const probe = spaceCard(12);
      t.player.cardsInHand.push(probe);
      expect(t.player.canPlay(probe)).is.true;
      expect(new SelectProjectCardToPlay(t.player, [probe]).toModel(t.player).arwindFighters).eq(3);
      t.player.checkPaymentAndPlayCard(probe, Payment.of({arwindFighters: 3}));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('overpay is the upstream semantic (ceil): 2 fighters for a 6 M€ card are legal, both leave', () => {
      const t = table();
      t.card.resourceCount = 2;
      t.player.megaCredits = 0;
      const probe = spaceCard(6);
      t.player.cardsInHand.push(probe);
      t.player.checkPaymentAndPlayCard(probe, Payment.of({arwindFighters: 2}));
      expect(t.card.resourceCount).eq(0);
    });

    it('fighters on ANOTHER card are no money; a card with no Space tag is short whatever stands here', () => {
      const t = table();
      const ships = new MarsArmyShips();
      ships.resourceCount = 5;
      t.player.playedCards.push(ships);
      expect(t.player.getSpendable('arwindFighters')).eq(0);
      t.card.resourceCount = 4;
      t.player.megaCredits = 0;
      const plain = spaceCard(8, []);
      t.player.cardsInHand.push(plain);
      expect(t.player.canPlay(plain)).is.false;
    });

    it('without Arwind on the table there is no unit', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      expect(player.getSpendable('arwindFighters')).eq(0);
    });
  });

  describe('rule 6 — save / load', () => {
    it('the fighters survive a reload as the card\'s ordinary count and are spendable again', () => {
      const t = table();
      t.card.resourceCount = 2;
      const game = Game.deserialize(structuredClone(t.game.serialize()));
      const player = game.getPlayerById(t.player.id);
      expect(player.getSpendable('arwindFighters')).eq(2);
    });
  });
});
