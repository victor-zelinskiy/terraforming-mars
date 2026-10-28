import {expect} from 'chai';
import {MEDICAL_INSTITUTE_KINDS, MedicalInstitute} from '../../../src/server/cards/turmoilRedux/MedicalInstitute';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {PreludeCard} from '../../../src/server/cards/prelude/PreludeCard';
import {Psychrophiles} from '../../../src/server/cards/prelude/Psychrophiles';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Research} from '../../../src/server/cards/base/Research';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {MicroMills} from '../../../src/server/cards/base/MicroMills';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {tagReason} from '../../../src/server/cards/effectForecastPreviews';
import {SKIP_REASON} from '../../../src/server/cards/actionPreviews';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {cast} from '../../../src/common/utils/utils';

/**
 * TRP9 — MEDICAL INSTITUTE: a Prelude, Microbe + Science; «Draw a card. Effect: after you play a Science tag (including
 * this), add 1 microbe or data resource to ANY card» — the set's first PRELUDE-REACTOR. Every rule reading of the card
 * file's header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.ACTION;
  return {game, player, rival};
}

/** Play `card` and run the queue to the next question. */
function play(t: Table, card: ICard): void {
  t.player.playCard(card as IProjectCard);
  runAllActions(t.game);
}

function pick(t: Table): SelectCard<ICard> {
  return cast(t.player.popWaitingFor(), SelectCard);
}

function institute(t: Table): MedicalInstitute {
  const card = new MedicalInstitute();
  t.player.playedCards.push(card);
  return card;
}

function factsOf(t: Table, card: IProjectCard): ReadonlyArray<EffectForecastFact> {
  t.player.cardsInHand.push(card);
  return effectForecastForPlay(t.player, card, cardPlayPreview(t.player, card)).facts
    .filter((f) => f.source.name === CardName.MEDICAL_INSTITUTE);
}

describe('MedicalInstitute', () => {
  describe('rule 1 — the printed card', () => {
    it('a PRELUDE — Microbe + Science, draws 1 card, no cost, no VP, holds nothing — TRP9', () => {
      const card = new MedicalInstitute();
      expect(card).instanceOf(PreludeCard);
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.MICROBE, Tag.SCIENCE]);
      expect(card.behavior).deep.eq({drawCard: 1});
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.resourceType).is.undefined;
      expect(card.metadata.cardNumber).eq('TRP9');
      expect(MEDICAL_INSTITUTE_KINDS).deep.eq([CardResource.MICROBE, CardResource.DATA]);
    });

    it('a prelude of the manifest, dealt only beside the Prelude expansion', () => {
      const entry = TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.MEDICAL_INSTITUTE];
      expect(entry?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.MEDICAL_INSTITUTE]).is.undefined;
    });
  });

  describe('rule 2 — the play: a card, then «where?» for its own Science tag', () => {
    it('draws ONE card first, then asks ONE pick over the holders of microbes AND data (including this)', () => {
      const t = table();
      const psychrophiles = new Psychrophiles();
      const supercomputer = new Supercomputer();
      t.player.playedCards.push(psychrophiles, supercomputer);
      const hand = t.player.cardsInHand.length;
      play(t, new MedicalInstitute());
      expect(t.player.cardsInHand.length, 'the card is taken before the pick').eq(hand + 1);
      const select = pick(t);
      expect(select.cards.map((c) => c.name)).deep.eq([CardName.PSYCHROPHILES, CardName.SUPERCOMPUTER]);
      const model = select.toModel(t.player) as SelectCardModel;
      expect(model.resourceGainPrompt?.cardResources).deep.eq(['microbe', 'data']);
      expect(select.choiceContext?.source).deep.include({card: CardName.MEDICAL_INSTITUTE});
      select.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(t.game);
      expect(supercomputer.resourceCount, 'the unit takes the chosen card\'s kind (data)').eq(1);
      expect(psychrophiles.resourceCount).eq(0);
      expect(t.player.popWaitingFor()).is.undefined;
    });

    it('ONE candidate is still ASKED (autoSelect: false — the «ANY card» law)', () => {
      const t = table();
      const tardigrades = new Tardigrades();
      t.player.playedCards.push(tardigrades);
      play(t, new MedicalInstitute());
      const select = pick(t);
      expect(select.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      select.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(t.game);
      expect(tardigrades.resourceCount).eq(1);
    });

    it('no holder of either kind: a NAMED skip — the prelude still plays and still draws', () => {
      const t = table();
      const hand = t.player.cardsInHand.length;
      play(t, new MedicalInstitute());
      expect(t.player.popWaitingFor()).is.undefined;
      expect(t.player.cardsInHand.length).eq(hand + 1);
      expect(t.player.tableau.has(CardName.MEDICAL_INSTITUTE)).is.true;
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped');
      expect(skipped.length, 'the loss names itself').to.be.greaterThan(0);
    });

    it('is always playable', () => {
      const t = table();
      expect(new MedicalInstitute().canPlay(t.player)).is.true;
    });
  });

  describe('rule 3 — per Science tag, own plays only', () => {
    it('a card with TWO Science tags asks TWO independent picks', () => {
      const t = table();
      institute(t);
      const tardigrades = new Tardigrades();
      const supercomputer = new Supercomputer();
      t.player.playedCards.push(tardigrades, supercomputer);
      play(t, new Research());
      pick(t).process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(t.game);
      pick(t).process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(t.game);
      expect(tardigrades.resourceCount).eq(1);
      expect(supercomputer.resourceCount).eq(1);
      expect(t.player.popWaitingFor()).is.undefined;
    });

    it('the card being played is a candidate when it holds microbes or data (the live set: it is on the table)', () => {
      const t = table();
      institute(t);
      const tardigrades = new Tardigrades();
      t.player.playedCards.push(tardigrades);
      const played = new Supercomputer();
      play(t, played);
      const select = pick(t);
      expect(select.cards.map((c) => c.name)).to.have.members([CardName.TARDIGRADES, CardName.SUPERCOMPUTER]);
    });

    it('a card without a Science tag asks nothing; a rival\'s Science tag asks nothing', () => {
      const t = table();
      institute(t);
      t.player.playedCards.push(new Tardigrades());
      play(t, new MicroMills());
      expect(t.player.popWaitingFor()).is.undefined;
      t.rival.playCard(new SearchForLife());
      runAllActions(t.game);
      expect(t.player.popWaitingFor()).is.undefined;
    });

    it('a bare Science tag (onNonCardTagAdded) answers like a played one', () => {
      const t = table();
      const card = institute(t);
      t.player.playedCards.push(new Tardigrades());
      card.onNonCardTagAdded(t.player, Tag.SCIENCE);
      runAllActions(t.game);
      expect(pick(t).cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      card.onNonCardTagAdded(t.player, Tag.EARTH);
      runAllActions(t.game);
      expect(t.player.popWaitingFor()).is.undefined;
    });
  });

  describe('rule 4 — the forecast twin', () => {
    it('one `asks` fact per Science tag, effect frame #0, the pick PRE-COLLECTED and addressed to TRP9', () => {
      const t = table();
      institute(t);
      t.player.playedCards.push(new Tardigrades());
      const facts = factsOf(t, new Research());
      expect(facts.map((f) => f.certainty)).deep.eq(['asks', 'asks']);
      expect(new Set(facts.map((f) => f.id)).size, 'distinct ids').eq(2);
      for (const fact of facts) {
        expect(fact.reasonTag).eq(Tag.SCIENCE);
        expect(fact.reason).eq(tagReason(Tag.SCIENCE));
        expect(fact.source.channel).eq('card-played');
        expect(fact.source.printedEffect).eq(0);
        expect(fact.effects[0]).deep.include({direction: 'gain', amount: 1, icons: ['microbe', 'data'], note: 'to a card'});
        const step = fact.preselect;
        expect(step?.kind).eq('input');
        if (step?.kind !== 'input') {
          throw new Error('no preselect');
        }
        expect(step.for).deep.eq({role: 'card', source: {kind: 'card', card: CardName.MEDICAL_INSTITUTE}});
        expect((step.input as SelectCardModel).cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      }
    });

    it('the card being played is in the PRE-COLLECTED set (cardBeingPlayed) — preview = live', () => {
      const t = table();
      institute(t);
      t.player.playedCards.push(new Tardigrades());
      const facts = factsOf(t, new Supercomputer());
      expect(facts).to.have.lengthOf(1);
      const step = facts[0].preselect;
      if (step?.kind !== 'input') {
        throw new Error('no preselect');
      }
      expect((step.input as SelectCardModel).cards.map((c) => c.name)).to.have.members([CardName.TARDIGRADES, CardName.SUPERCOMPUTER]);
    });

    it('«including this»: the prelude\'s own play forecasts its own pick', () => {
      const t = table();
      t.player.playedCards.push(new Tardigrades());
      const card = new MedicalInstitute();
      const facts = effectForecastForPlay(t.player, card, cardPlayPreview(t.player, card)).facts
        .filter((f) => f.source.name === CardName.MEDICAL_INSTITUTE);
      expect(facts.map((f) => f.certainty)).deep.eq(['asks']);
    });

    it('no holder: a `skipped` fact with the live step\'s own reason; no Science tag: nothing', () => {
      const t = table();
      institute(t);
      const facts = factsOf(t, new Research());
      expect(facts.map((f) => f.certainty)).deep.eq(['skipped', 'skipped']);
      expect(facts[0].reason).eq(SKIP_REASON.noHolder);
      expect(factsOf(t, new MicroMills())).deep.eq([]);
    });
  });

  describe('rule 5 — the reaction record', () => {
    it('ONE record per answered pick: the card, its channel, the cause, the landing', () => {
      const t = table();
      institute(t);
      const tardigrades = new Tardigrades();
      t.player.playedCards.push(tardigrades);
      const from = t.game.cardReactions.length;
      play(t, new SearchForLife());
      expect(t.player.getWaitingFor()).instanceOf(SelectCard);
      // Through the player's own route — the answer runs under the scope the deferred pick restores.
      t.player.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(t.game);
      const records = t.game.cardReactions.slice(from).filter((r) => r.card === CardName.MEDICAL_INSTITUTE);
      expect(records).to.have.lengthOf(1);
      expect(records[0].channel).eq('card-played');
      expect(records[0].cause).deep.eq({card: CardName.SEARCH_FOR_LIFE});
      expect(records[0].impacts).deep.eq([{kind: 'card-resource', resource: CardResource.MICROBE, amount: 1, target: CardName.TARDIGRADES, to: t.player.color}]);
    });
  });

  describe('rule 6 — the neighbours', () => {
    it('Olympus Conference asks its own question first; TRP9 asks its own after — neither duplicates', () => {
      const t = table();
      institute(t);
      const olympus = new OlympusConference();
      olympus.resourceCount = 1;
      const tardigrades = new Tardigrades();
      t.player.playedCards.push(olympus, tardigrades);
      play(t, new SearchForLife());
      const first = t.player.popWaitingFor();
      expect(first, 'Olympus (OLYMPUS_CONFERENCE priority) first').instanceOf(OrOptions);
      cast(first, OrOptions).options[1].cb(undefined);
      runAllActions(t.game);
      pick(t).process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(t.game);
      expect(olympus.resourceCount).eq(2);
      expect(tardigrades.resourceCount).eq(1);
      expect(t.player.popWaitingFor()).is.undefined;
    });
  });

  describe('rule 7 — the save', () => {
    it('nothing beyond the card on the table survives a round trip', () => {
      const t = table();
      institute(t);
      const restored = Game.deserialize(t.game.serialize());
      const player = restored.getPlayerById(t.player.id);
      expect(player.tableau.has(CardName.MEDICAL_INSTITUTE)).is.true;
    });
  });
});
