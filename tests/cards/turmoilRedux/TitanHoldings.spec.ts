import {expect} from 'chai';
import {
  TITAN_EFFECT_TEXT, TITAN_EFFECT_TEXT_NO_MOON, TITAN_EFFECT_TEXT_NO_MOON_NO_VENUS, TITAN_EFFECT_TEXT_NO_VENUS, TITAN_ONE_DELEGATE_TITLE, TITAN_TAGS, TITAN_TWO_DELEGATES_TITLE,
  TitanHoldings, titanTags,
} from '../../../src/server/cards/turmoilRedux/TitanHoldings';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {ICard} from '../../../src/server/cards/ICard';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {tagReason} from '../../../src/server/cards/effectForecastPreviews';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {resolveCardText} from '../../../src/common/cards/CardTextVariant';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR84 — TITAN HOLDINGS: 50 M€ + 2 M€ production, Earth + Jovian; «after you play a Mars, Earth, Venus, Jovian, or Moon
 * tag (including these), add 1 leverage resource to this card» — ONE predicate (`titanTags`) for the live hook and its
 * forecast twin; «spend 2 leverage from here to add 1 delegate to a resolution, OR spend 4 leverage to add 2
 * delegates». Every rule reading of the card file's header is pinned here.
 */
const S = PartyName.SCIENTISTS;
const M = PartyName.MARS;
const R = PartyName.REDS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: TitanHoldings};

/** A two-seat Redux table, three QUIET resolutions (Scientists · Mars First · Reds), Titan PLAYED by p1 — the action phase. */
function owned(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  const parliament = game.parliament!;
  ([S, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new TitanHoldings();
  p1.playCorporationCard(card);
  runAllActions(game);
  game.phase = Phase.ACTION;
  p1.megaCredits = 60;
  p2.megaCredits = 60;
  return {game, p1, p2, parliament, card};
}

function tagged(tags: Array<Tag>, type: CardType = CardType.AUTOMATED): ICard {
  return fakeCard({tags, type, cost: 0});
}

function play(t: Table, card: ICard, player: TestPlayer = t.p1): void {
  player.playCard(card as never);
  runAllActions(t.game);
}

/** The action taken, answered down to its vote prompt — `branch` among the LIVE options when there are two. */
function toVote(t: Table, branch?: number): SelectParty {
  t.card.action(t.p1);
  runAllActions(t.game);
  if (branch !== undefined) {
    const or = cast(t.p1.getWaitingFor(), OrOptions);
    t.p1.process({type: 'or', index: branch, response: {type: 'option'}});
    runAllActions(t.game);
    expect(or).is.not.undefined;
  }
  return cast(t.p1.getWaitingFor(), SelectParty);
}

describe('TitanHoldings', () => {
  describe('rule 0 — the card as printed', () => {
    it('a corporation for 50 M€ + 2 M€ production, Earth + Jovian, a leverage holder, no VP, no first action — TR84', () => {
      const card = new TitanHoldings();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(50);
      expect(card.tags).deep.eq([Tag.EARTH, Tag.JOVIAN]);
      expect(card.resourceType).eq(CardResource.LEVERAGE);
      expect(card.behavior?.production).deep.eq({megacredits: 2});
      expect(card.victoryPoints).is.undefined;
      expect(card.firstAction).is.undefined;
      expect(card.metadata.cardNumber).eq('TR84');
      expect(card.resourceRole).deep.eq({kind: 'delegate', price: 2});
      expect(TURMOIL_REDUX_CARD_MANIFEST.corporationCards[CardName.TITAN_HOLDINGS]?.compatibility, 'the Moon is an option of the text, not a condition').is.undefined;
      const row = TURMOIL_REDUX_NEW_CORPORATIONS.find((c) => c.name === 'Titan Holdings');
      expect(row?.authored).eq(CardName.TITAN_HOLDINGS);
      expect(newCorporationCardNumber(CardName.TITAN_HOLDINGS)).eq('TR84');
    });

    it('the face: the planet-tag disc on the effect row — never a Moon tag; two action rows of 2 and 4 leverage', () => {
      const json = JSON.stringify(new TitanHoldings().metadata.renderData);
      expect(json).to.include(`"type":"${CardRenderItemType.PLANET_TAG}"`);
      expect(json, 'the face never draws the Moon').to.not.include(`"tag":"${Tag.MOON}"`);
      expect(json).to.include(`"type":"${CardRenderItemType.DELEGATES}"`);
    });

    it('the play: 50 M€, 2 M€ production — and 2 leverage of its OWN Earth + Jovian («including these»)', () => {
      const t = owned();
      expect(t.p1.production.megacredits).eq(2);
      expect(t.card.resourceCount).eq(2);
    });
  });

  describe('rule 2 — the planet tags, one leverage each', () => {
    it('the predicate: the PRINTED planet tags, duplicates kept, wild and others ignored', () => {
      expect(TITAN_TAGS).deep.eq([Tag.MARS, Tag.EARTH, Tag.VENUS, Tag.JOVIAN, Tag.MOON]);
      expect(titanTags(tagged([Tag.EARTH, Tag.JOVIAN]))).deep.eq([Tag.EARTH, Tag.JOVIAN]);
      expect(titanTags(tagged([Tag.JOVIAN, Tag.JOVIAN]))).deep.eq([Tag.JOVIAN, Tag.JOVIAN]);
      expect(titanTags(tagged([Tag.SPACE, Tag.SCIENCE]))).deep.eq([]);
      expect(titanTags(tagged([Tag.WILD]))).deep.eq([]);
    });

    for (const tag of [Tag.MARS, Tag.EARTH, Tag.VENUS, Tag.JOVIAN, Tag.MOON]) {
      it(`a ${tag} tag played: +1`, () => {
        const t = owned();
        play(t, tagged([tag]));
        expect(t.card.resourceCount).eq(3);
      });
    }

    it('Earth + Jovian: +2; two Jovians: +2; no planet tag: nothing; wild: nothing', () => {
      const t = owned();
      play(t, tagged([Tag.EARTH, Tag.JOVIAN]));
      expect(t.card.resourceCount).eq(4);
      play(t, tagged([Tag.JOVIAN, Tag.JOVIAN]));
      expect(t.card.resourceCount).eq(6);
      play(t, tagged([Tag.SPACE, Tag.SCIENCE]));
      play(t, tagged([Tag.WILD]));
      expect(t.card.resourceCount).eq(6);
    });

    it('an event with an Earth tag pays (its tags are played); a rival\'s play pays nothing', () => {
      const t = owned();
      play(t, tagged([Tag.EARTH], CardType.EVENT));
      expect(t.card.resourceCount).eq(3);
      play(t, tagged([Tag.EARTH, Tag.JOVIAN]), t.p2);
      expect(t.card.resourceCount).eq(3);
    });

    it('with Tharsis Republic beside it (multicorp) a Mars-tag play pays Titan too', () => {
      const t = owned();
      t.p1.playedCards.push(new TharsisRepublic());
      play(t, tagged([Tag.MARS]));
      expect(t.card.resourceCount).eq(3);
    });

    it('ONE reaction record per play — the corporation\'s own play names itself as the cause', () => {
      const t = owned();
      const own = t.game.cardReactions.filter((r) => r.card === CardName.TITAN_HOLDINGS);
      expect(own).to.have.lengthOf(1);
      expect(own[0].cause).deep.eq({card: CardName.TITAN_HOLDINGS});
      expect(own[0].impacts).deep.eq([{kind: 'card-resource', resource: CardResource.LEVERAGE, amount: 2, target: CardName.TITAN_HOLDINGS, to: t.p1.color}]);
      const trigger = tagged([Tag.EARTH, Tag.JOVIAN]);
      play(t, trigger);
      const records = t.game.cardReactions.filter((r) => r.card === CardName.TITAN_HOLDINGS);
      expect(records).to.have.lengthOf(2);
      expect(records[1].channel).eq('card-played');
      expect(records[1].impacts).deep.eq([{kind: 'card-resource', resource: CardResource.LEVERAGE, amount: 2, target: CardName.TITAN_HOLDINGS, to: t.p1.color}]);
    });
  });

  describe('rule 4 — the forecast twin', () => {
    it('ONE exact fact per planet tag: the tag named, effect row #0, a leverage on this card', () => {
      const t = owned();
      const trigger = tagged([Tag.EARTH, Tag.JOVIAN]);
      t.p1.cardsInHand.push(trigger as never);
      const facts = effectForecastForPlay(t.p1, trigger, cardPlayPreview(t.p1, trigger)).facts
        .filter((f) => f.source.name === CardName.TITAN_HOLDINGS);
      expect(facts.map((f) => f.certainty)).deep.eq(['exact', 'exact']);
      expect(facts.map((f) => f.reasonTag)).deep.eq([Tag.EARTH, Tag.JOVIAN]);
      expect(facts.map((f) => f.reason)).deep.eq([tagReason(Tag.EARTH), tagReason(Tag.JOVIAN)]);
      expect(new Set(facts.map((f) => f.id)).size, 'distinct ids').eq(2);
      for (const fact of facts) {
        expect(fact.source.channel).eq('card-played');
        expect(fact.source.printedEffect).eq(0);
        expect(fact.recipient.kind).eq('you');
        expect(fact.effects[0]).deep.include({direction: 'gain', amount: 1, note: 'on this card'});
      }
    });

    it('no planet tag forecasts NOTHING; a rival\'s play is never addressed', () => {
      const t = owned();
      const plain = tagged([Tag.SCIENCE]);
      t.p1.cardsInHand.push(plain as never);
      expect(effectForecastForPlay(t.p1, plain, cardPlayPreview(t.p1, plain)).facts.filter((f) => f.source.name === CardName.TITAN_HOLDINGS)).deep.eq([]);
      const rival = tagged([Tag.EARTH]);
      t.p2.cardsInHand.push(rival as never);
      expect(effectForecastForPlay(t.p2, rival, cardPlayPreview(t.p2, rival)).facts.filter((f) => f.source.name === CardName.TITAN_HOLDINGS)).deep.eq([]);
    });
  });

  describe('rule 5 — the action: 2 leverage → a delegate OR 4 → two', () => {
    it('below 2: unavailable, the count and the need named («N of 2 leverage on this card»)', () => {
      const t = owned();
      t.card.resourceCount = 1;
      expect(t.card.canAct(t.p1)).is.false;
      const reason = actionUnavailableReasons(t.p1, t.card)[0];
      expect(reason.message).eq('${0} of ${1} leverage on this card');
      expect(reason.params).deep.eq(['1', '2']);
    });

    it('two branches SHOWN, the second disabled with its own reason at 3 leverage', () => {
      const t = owned();
      t.card.resourceCount = 3;
      const branches = actionPreview(t.p1, t.card).branches;
      expect(branches.map((b) => b.title)).deep.eq([TITAN_ONE_DELEGATE_TITLE, TITAN_TWO_DELEGATES_TITLE]);
      expect(branches.map((b) => b.available)).deep.eq([true, false]);
      expect(branches[1].unavailableReason).eq('${0} of ${1} leverage on this card');
      expect(branches[1].unavailableReasonParams).deep.eq(['3', '4']);
      expect(branches[0].index, 'the one live branch IS the action').eq(-1);
    });

    it('the preview\'s door asks the very grant the answer charges: a staged vote, the price inside', () => {
      const t = owned();
      t.card.resourceCount = 4;
      const branches = actionPreview(t.p1, t.card).branches;
      for (const [i, count] of [[0, 1], [1, 2]] as const) {
        const door = branches[i].steps.find((s) => s.kind === 'delegateGrant');
        expect(door, `branch ${i} opens the Parliament's vote`).is.not.undefined;
        if (door?.kind === 'delegateGrant') {
          expect(door.staged.prompt.votePrompt).deep.include({source: 'grant', count, printed: count});
          expect(door.staged.sourceCard).eq(CardName.TITAN_HOLDINGS);
        }
        expect(branches[i].effects.find((e) => e.direction === 'cost')).deep.include({amount: 2 * count});
      }
    });

    it('2–3 leverage: no question — the vote prompt directly; the leverage leaves INSIDE the answer, with the cube', () => {
      const t = owned();
      const {p1, parliament, card, game} = t;
      card.resourceCount = 3;
      const reserve = parliament.reserve(p1);
      const select = toVote(t);
      expect(select.votePrompt).deep.include({source: 'grant', cost: 0, count: 1, printed: 1});
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.TITAN_HOLDINGS}, mode: 'reward'});
      expect(card.resourceCount, 'nothing spent before the answer').eq(3);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(1);
      expect(parliament.reserve(p1)).eq(reserve - 1);
      expect(parliament.lobby.has(p1.id), 'the lobby\'s cube is not the card\'s to spend').is.true;
      const lines = game.gameLog.map((l) => l.message);
      expect(lines).to.include('${0} spent ${1} ${2} from ${3} for a delegate');
      parliament.assertLedger(game);
    });

    it('4 leverage: an effect-choice OrOptions (never auto-selected); B places TWO on ONE resolution for 4', () => {
      const t = owned();
      const {p1, parliament, card, game} = t;
      card.resourceCount = 4;
      t.card.action(p1);
      runAllActions(game);
      const or = cast(p1.getWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([TITAN_ONE_DELEGATE_TITLE, TITAN_TWO_DELEGATES_TITLE]);
      expect(or.choiceContext?.source).deep.include({card: CardName.TITAN_HOLDINGS});
      p1.process({type: 'or', index: 1, response: {type: 'option'}});
      runAllActions(game);
      const select = cast(p1.getWaitingFor(), SelectParty);
      expect(select.votePrompt).deep.include({count: 2, printed: 2});
      expect(card.resourceCount).eq(4);
      p1.process({type: 'party', partyName: S});
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(parliament.votesOf(p1, parliament.slots[0])).eq(2);
      parliament.assertLedger(game);
    });

    it('«paid and placed nothing» is impossible: an emptied reserve at the answer charges NOTHING', () => {
      const t = owned();
      const {p1, parliament, card, game} = t;
      card.resourceCount = 2;
      toVote(t);
      while (parliament.reserve(p1) > 0) {
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
      }
      const before = parliament.votesOf(p1, parliament.slots[1]);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(before);
      expect(card.resourceCount, 'the price was never charged').eq(2);
    });

    it('an EMPTY voting area refuses both branches by name — nothing spent, the action closed', () => {
      const t = owned();
      t.card.resourceCount = 4;
      t.parliament.slots = [];
      expect(t.card.canAct(t.p1)).is.false;
      const branches = actionPreview(t.p1, t.card).branches;
      expect(branches.map((b) => b.available)).deep.eq([false, false]);
      expect(branches.map((b) => b.unavailableReason)).deep.eq(['No resolution is up for a vote', 'No resolution is up for a vote']);
      expect(actionUnavailableReasons(t.p1, t.card)[0].message).eq('No resolution is up for a vote');
      expect(t.card.resourceCount).eq(4);
    });

    it('a reserve of ONE refuses the two-delegate branch (a price for two buys two, or nothing)', () => {
      const t = owned();
      const {p1, parliament} = t;
      t.card.resourceCount = 4;
      while (parliament.reserve(p1) > 1) {
        parliament.placeVote(p1, parliament.slots[2], 'reserve');
      }
      const branches = actionPreview(p1, t.card).branches;
      expect(branches.map((b) => b.available)).deep.eq([true, false]);
    });

    it('once per generation, like every card action', () => {
      const t = owned();
      t.card.resourceCount = 2;
      toVote(t);
      t.p1.process({type: 'party', partyName: M});
      runAllActions(t.game);
      t.p1.actionsThisGeneration.add(CardName.TITAN_HOLDINGS);
      t.card.resourceCount = 2;
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).not.includes(CardName.TITAN_HOLDINGS);
    });
  });

  describe('rule 6 — the printed text names only what the game can play', () => {
    it('three variants: the Moon and Venus named only when the game has them', () => {
      const variants = new TitanHoldings().metadata.textVariants;
      const full = 'Effect: ' + TITAN_EFFECT_TEXT;
      expect(variants?.map((v) => v.unless)).deep.eq([['moon'], ['venus'], ['moon', 'venus']]);
      expect(resolveCardText(full, variants, {moon: false, venus: true})).eq('Effect: ' + TITAN_EFFECT_TEXT_NO_MOON);
      expect(resolveCardText(full, variants, {moon: true, venus: false})).eq('Effect: ' + TITAN_EFFECT_TEXT_NO_VENUS);
      expect(resolveCardText(full, variants, {moon: false, venus: false}), 'the most specific variant').eq('Effect: ' + TITAN_EFFECT_TEXT_NO_MOON_NO_VENUS);
      expect(resolveCardText(full, variants, {moon: true, venus: true})).eq(full);
      expect(TITAN_EFFECT_TEXT_NO_VENUS).to.not.include('Venus');
      expect(TITAN_EFFECT_TEXT_NO_MOON_NO_VENUS).to.not.match(/Moon|Venus/);
      expect(resolveCardText(full, variants, undefined), 'no game: the printed card').eq(full);
      expect(TITAN_EFFECT_TEXT_NO_MOON).to.not.include('Moon');
    });

    it('the information block carries the FULL key; the captions never list the planets', () => {
      const info = buildCardInformation(new TitanHoldings(), 'turmoilRedux');
      const blocks = info!.groups.flatMap((g) => g.blocks);
      expect(blocks.map((b) => b.text)).to.include('Effect: ' + TITAN_EFFECT_TEXT);
      const shorts = blocks.map((b) => b.short).filter((s): s is string => s !== undefined);
      expect(shorts, 'the effect and each action row').to.have.lengthOf(3);
      for (const s of shorts) {
        expect(s).to.not.match(/Moon|Mars|Venus|Jovian|Earth/);
      }
    });
  });

  describe('rule 7 — the deal and the save', () => {
    it('dealt with Turmoil Redux, never with classic Turmoil', () => {
      // The POOL, not the shuffled draw pile (a dealt hand would take the card out of it).
      const [redux] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      expect(new GameCards(redux.gameOptions).getCorporationCards().map((c) => c.name)).to.include(CardName.TITAN_HOLDINGS);
      const [classic] = testGame(2, {turmoilExtension: true, coloniesExtension: true});
      expect(new GameCards(classic.gameOptions).getCorporationCards().map((c) => c.name)).to.not.include(CardName.TITAN_HOLDINGS);
    });

    it('the leverage survives a save / load, and the card still acts', () => {
      const t = owned();
      t.card.resourceCount = 5;
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.p1.id);
      const titan = again.tableau.get(CardName.TITAN_HOLDINGS);
      expect(titan?.resourceCount).eq(5);
      expect((titan as TitanHoldings).canAct(again)).is.true;
    });
  });
});
