import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardResource} from '../../src/common/CardResource';
import {REDUX_PARTIES, STARTER_QUEST} from '../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {PARTY_EFFECTS} from '../../src/server/parliament/parties/PartyEffects';
import {questRenderData, starterQuestRenderData} from '../../src/server/parliament/quests/questRender';
import {availablePartyActionCount} from '../../src/server/parliament/ParliamentModel';
import {potentialActions} from '../../src/server/models/potentialActions';
import {TradeWithUnity} from '../../src/server/parliament/TradeWithUnity';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';

/**
 * THE PARTY FAMILY'S PRESENTATION CONTRACT (the Parliament UI rework): the
 * printed action rows live in `actionRenderData` (the action menu's tile draws
 * exactly those), a quest's goal has ONE graphic built from its definition,
 * the Unity payment path carries its structural party marker, and the wheel's
 * potential count includes the party actions the player could take.
 */
describe('party presentation (Turmoil Redux UI)', () => {
  it('every party with an action prints it in actionRenderData; the passive rows stay passive', () => {
    for (const party of REDUX_PARTIES) {
      const definition = PARTY_EFFECTS[party];
      if (definition.actionId !== undefined) {
        expect(definition.actionRenderData?.rows.length ?? 0, `${party} action rows`).to.be.greaterThan(0);
      } else {
        expect(definition.actionRenderData, `${party} has no action`).to.eq(undefined);
        expect(definition.passiveRenderData.rows.length).to.be.greaterThan(0);
      }
    }
    // An action-only party draws NO passive graphic (an empty root, never a duplicate of the action).
    const unityPassive = PARTY_EFFECTS[PartyName.UNITY].passiveRenderData.rows.flat().filter((n) => n !== undefined);
    expect(unityPassive.length).to.eq(0);
  });

  it('a quest goal is drawn from its definition: production box, tags, tiles, resources, delegates, TR', () => {
    const production = questRenderData(STARTER_QUEST);
    expect(JSON.stringify(production)).to.contain('production-box');
    expect(JSON.stringify(production)).to.contain(`"type":"${CardRenderItemType.HEAT}"`);
    expect(JSON.stringify(starterQuestRenderData())).to.eq(JSON.stringify(production));
    const tags = questRenderData({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
    expect(JSON.stringify(tags)).to.contain(`"tag":"${Tag.SCIENCE}"`);
    expect(JSON.stringify(tags)).to.contain('"amount":2');
    const tiles = questRenderData({goal: {kind: 'tile', tile: 'greenery'}, count: 2});
    expect(tiles.rows[0].filter((n) => n !== undefined && typeof n !== 'string').length).to.eq(2);
    expect(JSON.stringify(questRenderData({goal: {kind: 'delegates'}, count: 4}))).to.contain(`"type":"${CardRenderItemType.DELEGATES}"`);
    expect(JSON.stringify(questRenderData({goal: {kind: 'tr'}, count: 3}))).to.contain(`"type":"${CardRenderItemType.TR}"`);
    expect(JSON.stringify(questRenderData({goal: {kind: 'cardResource', resource: CardResource.MICROBE}, count: 1}))).to.contain(CardResource.MICROBE);
    expect(JSON.stringify(questRenderData({goal: {kind: 'colony'}, count: 1}))).to.contain(`"type":"${CardRenderItemType.COLONIES}"`);
    // A card-type quest draws CARD glyphs wearing the type (the premium face's header band), one per card — never a text plate.
    const blue = JSON.stringify(questRenderData({goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2}));
    expect(blue).to.contain(`"type":"${CardRenderItemType.CARDS}"`);
    expect(blue).to.contain('"secondaryTag":"blue"');
    expect(blue).to.contain('"amount":2');
    expect(blue).to.not.contain('blue cards');
    expect(JSON.stringify(questRenderData({goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2}))).to.contain('"secondaryTag":"green"');
  });

  it('the Unity trade path carries its PARTY marker — the structural identity the console locks the trade to', () => {
    const [game, player] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true});
    expect(game.parliament).to.not.eq(undefined);
    const trader = new TradeWithUnity(player);
    expect(trader.optionMetadata().party).to.eq(PartyName.UNITY);
  });

  it('the potential projection counts the party actions the player could take, by the parliament\'s own verdict', () => {
    const [game, player] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true});
    const parliament = game.parliament;
    if (parliament === undefined) {
      throw new Error('no parliament');
    }
    expect(availablePartyActionCount(player)).to.eq(0);
    expect(potentialActions(player).partyActions).to.eq(0);
    parliament.grantPartyEffect(player, PartyName.REDS, 'Spec');
    expect(availablePartyActionCount(player)).to.eq(1);
    expect(potentialActions(player).partyActions).to.eq(1);
    // The Scientists' action needs a receiving card; the Industrialists' a decreasable production.
    parliament.grantPartyEffect(player, PartyName.SCIENTISTS, 'Spec');
    expect(availablePartyActionCount(player)).to.eq(1);
    player.playedCards.push(new Tardigrades());
    expect(availablePartyActionCount(player)).to.eq(2);
    parliament.grantPartyEffect(player, PartyName.INDUSTRIALISTS, 'Spec');
    player.production.add(Resource.ENERGY, 1);
    expect(availablePartyActionCount(player)).to.eq(3);
    // A used action leaves the count.
    parliament.recordPartyActionUse(player, PartyName.REDS);
    expect(availablePartyActionCount(player)).to.eq(2);
    runAllActions(game);
  });
});
