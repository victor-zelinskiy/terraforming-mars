import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  RD_FUNDING, RD_FUNDING_CODE, RD_FUNDING_ID, RD_FUNDING_NO_ACTION_REASON, RD_FUNDING_TAGS_PER_INFLUENCE,
  RD_FUNDING_USES_PER_GENERATION, rdFundingTagBonus,
} from '../../src/server/parliament/resolutions/scientists/RdFunding';
import {OPEN_IP_TRADE_ID} from '../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {METAL_RESEARCH_ID} from '../../src/server/parliament/resolutions/industrialists/MetalResearch';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {repeatableActionCards} from '../../src/server/cards/repeatableActions';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {PlayerInput} from '../../src/server/PlayerInput';
import {IPlayer} from '../../src/server/IPlayer';
import {ICard, IActionCard} from '../../src/server/cards/ICard';
import {ResolutionActionPromptMeta, SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderEffect, isICardRenderItem, isICardRenderSymbol} from '../../src/common/cards/render/Types';
import {CardRenderSymbolType} from '../../src/common/cards/render/CardRenderSymbolType';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {Research} from '../../src/server/cards/base/Research';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {RegolithEaters} from '../../src/server/cards/base/RegolithEaters';
import {ExtremeColdFungus} from '../../src/server/cards/base/ExtremeColdFungus';
import {AICentral} from '../../src/server/cards/base/AICentral';
import {Playwrights} from '../../src/server/cards/community/Playwrights';
import {Sabotage} from '../../src/server/cards/base/Sabotage';
import {Viron} from '../../src/server/cards/venusNext/Viron';
import {ProjectInspection} from '../../src/server/cards/promo/ProjectInspection';

/**
 * R&D FUNDING (Turmoil Redux, RX26) — the first law with NO enactment: a
 * PASSIVE that raises a TAG COUNT while it stands («when taking actions, you
 * have additional Science tags equal to your Influence») and an ACTION that
 * repeats a card action already used this generation.
 *
 * What these specs pin:
 *  · the bonus is added where the player DECIDES — a card requirement, an
 *    action's gate, a behaviour counter — and NOWHERE else: `'raw'` (the tag
 *    zone's printed truth), `'award'` and `'milestone'` are untouched, the
 *    milestone decision being this card's own (a milestone records an
 *    achievement; it is not an action taken);
 *  · nothing is written into the player: the save carries no tag field, a
 *    reload reads the same numbers, and the bonus leaves with the law;
 *  · a seat outside the parliament (MarsBot) never holds it, and the
 *    Scientists' own wild tag keeps counting exactly as before;
 *  · the ACTION is the ONE shared repeat list (`repeatableActionCards`) —
 *    Viron and Project Inspection ask the same function now, and answer the
 *    same lists;
 *  · the repeat runs inside the copied-action scope of the LAW, records its
 *    use at the ANSWER, is refused with a NAMED reason, and is always a
 *    visible pick even with a single candidate.
 */
const RDF = resolutionInstanceId(RD_FUNDING_ID, 0);

/**
 * THE BASELINE EVERY COUNT BELOW CARRIES: this law is the SCIENTISTS' own, so
 * while it stands the Scientists RULE — and a ruling party's effect is held by
 * every participant. Theirs is an extra WILD tag, which counts towards any tag
 * but wild (`ParliamentHandler.wildTags`). So a seat under this law reads
 * `printed + 1 wild + influence`, and every expectation here names the three.
 * The wild tag is NOT this card's: it stands with any Scientists law, and
 * unlike this card's tags it DOES count for a milestone.
 */
const RULING_WILD = 1;

function reduxGame(players: 2 | 3 = 2): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(players, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat R&D Funding in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, RDF);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
}

/** The card ENACTED by a real sitting, the next generation's action phase open. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = stage();
  endGenerationThroughParliament(game);
  runAllActions(game);
  settleParliamentGates(game);
  game.phase = Phase.ACTION;
  expect(parliament.enacted).eq(RDF);
  return [game, p1, p2, parliament];
}

/** Influence exactly `n` for a seat that takes no Agenda step (the track's own positions). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function setInfluence(parliament: Parliament, player: TestPlayer, influence: number): void {
  parliament.agenda.set(player.id, agendaForInfluence(influence));
  expect(parliament.influence(player), `influence of ${player.color}`).eq(influence);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** The structural marker of an option (the `PlayerInput` interface does not declare the field). */
function markerOf(input: PlayerInput): ResolutionActionPromptMeta | undefined {
  return (input as {resolutionActionPrompt?: ResolutionActionPromptMeta}).resolutionActionPrompt;
}

/** The resolution action's option, by its MARKER (never by its title). */
function actionOption(player: IPlayer): SelectCard<IActionCard & ICard> | undefined {
  const option = ParliamentHandler.resolutionActionOptions(player).find((o: PlayerInput) => markerOf(o) !== undefined);
  return option === undefined ? undefined : cast(option, SelectCard) as unknown as SelectCard<IActionCard & ICard>;
}

/** …and the same option inside the player's live action menu (the whole path: `Player.getActions`). */
function menuOption(player: TestPlayer): {menu: OrOptions, index: number} {
  const menu = player.getActions();
  return {menu, index: menu.options.findIndex((o) => markerOf(o) !== undefined)};
}

/** A card whose action was already used this generation, sitting in `player`'s tableau. */
function usedTardigrades(game: IGame, player: TestPlayer): Tardigrades {
  const card = new Tardigrades();
  player.playedCards.push(card);
  card.action(player);
  runAllActions(game);
  player.actionsThisGeneration.add(card.name);
  return card;
}

describe('RdFunding', () => {
  describe('the catalog entry', () => {
    it('is RX26 of the Scientists — one copy, no expansion needed, the 2-blue-cards quest, and NOTHING at the enactment', () => {
      expect(REDUX_RESOLUTION_CATALOG.all()).includes(RD_FUNDING);
      expect(RD_FUNDING_CODE).eq('RX26');
      expect(RD_FUNDING_CODE).match(RESOLUTION_CODE_PATTERN);
      expect(RD_FUNDING.party).eq(PartyName.SCIENTISTS);
      expect(RD_FUNDING.module).eq('turmoilRedux');
      expect(RD_FUNDING.copies).eq(1);
      expect(RD_FUNDING.compatibility, 'no expansion is needed').is.undefined;
      // A BLUE card is an ACTIVE card — by TYPE, never by a tag or the colour of a face.
      expect(RD_FUNDING.quest).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2});
      // Nothing is paid, moved or granted when the card is enacted.
      expect(RD_FUNDING.scaled, 'no influence-scaled payout').is.undefined;
      expect(RD_FUNDING.immediateSteps, 'no immediate step').is.undefined;
      expect(RD_FUNDING.winnerSteps, 'no winner step').is.undefined;
      expect(RD_FUNDING.winnerReward, 'no winner reward').is.undefined;
      expect(RD_FUNDING.worldMoves, 'the planet is untouched').is.undefined;
      expect(RD_FUNDING.levy, 'nobody pays anything').is.undefined;
      // Everything it gives, it gives WHILE IT STANDS.
      expect(RD_FUNDING.passive?.tagBonus, 'the passive').is.a('function');
      expect(RD_FUNDING.action, 'the action').is.not.undefined;
      expect(RD_FUNDING.action?.usesPerGeneration({} as IPlayer)).eq(RD_FUNDING_USES_PER_GENERATION).eq(1);
    });

    it('the face draws the standing rule and the action — the science tag over the influence, and the replay icon', () => {
      const [rule, action] = RD_FUNDING.renderData.rows.flat().filter(isICardRenderEffect);
      expect(rule, 'the standing rule is the first drawing').is.not.undefined;
      expect(action, 'the action is the second').is.not.undefined;
      // THE RULE: the law is the cause (an empty left side), the result is a
      // science tag per point of influence.
      const ruleItems = rule.rows.flat().filter(isICardRenderItem);
      expect(ruleItems.map((i) => i.type)).deep.eq([CardRenderItemType.TAG, CardRenderItemType.INFLUENCE]);
      expect(ruleItems[0].tag, 'the science tag of the rule').eq(Tag.SCIENCE);
      const ruleSymbols = rule.rows.flat().filter(isICardRenderSymbol).map((sym) => sym.type);
      expect(ruleSymbols, 'an empty-cause effect is drawn as the MODIFIER it is').includes(CardRenderSymbolType.PLUS);
      expect(ruleSymbols, 'and the per-influence slash').includes(CardRenderSymbolType.SLASH);
      // THE ACTION: the replay icon Project Inspection prints.
      expect(action.rows.flat().filter(isICardRenderItem).map((i) => i.type)).deep.eq([CardRenderItemType.ACTION_REPLAY]);
      expect(action.rows.flat().filter(isICardRenderSymbol).map((sym) => sym.type), 'behind the action arrow')
        .includes(CardRenderSymbolType.ARROW);
    });

    it('reads as the plain influence family — its instrument is neither a count nor a tile', () => {
      expect(familyOf(RD_FUNDING)).eq('influence');
    });

    it('the action states NO result chips — what it pays is the copied card own payout, unknown until one is picked', () => {
      expect(RD_FUNDING.action?.preview()).deep.eq([]);
      expect(RD_FUNDING.passive?.forecast({} as never), 'and the passive states no fact — its twin is the tag zone rate').deep.eq([]);
    });
  });

  describe('the passive — the extra tags, as one pure function', () => {
    it('is Science only, one per point of influence, and never negative', () => {
      const player = {} as IPlayer;
      expect(rdFundingTagBonus(player, Tag.SCIENCE, 2)).eq(2 * RD_FUNDING_TAGS_PER_INFLUENCE);
      expect(rdFundingTagBonus(player, Tag.SCIENCE, 0)).eq(0);
      expect(rdFundingTagBonus(player, Tag.SCIENCE, -3), 'a negative influence is not a negative tag').eq(0);
      for (const tag of [Tag.BUILDING, Tag.SPACE, Tag.MICROBE, Tag.WILD, Tag.EVENT]) {
        expect(rdFundingTagBonus(player, tag, 5), `${tag} is untouched`).eq(0);
      }
    });
  });

  describe('the passive — where the bonus is counted', () => {
    it('raises the count when the player ACTS, and leaves the printed truth printed', () => {
      const [, p1, , parliament] = enacted();
      p1.playedCards.push(new Research()); // 2 printed science tags
      setInfluence(parliament, p1, 2);

      expect(p1.tags.count(Tag.SCIENCE), 'taking an action: 2 printed + the ruling wild tag + 2 by influence').eq(2 + RULING_WILD + 2);
      expect(p1.tags.count(Tag.SCIENCE, 'raw'), 'the printed count — what the МЕТКИ zone prints').eq(2);
      expect(p1.tags.countAllTags()[Tag.SCIENCE], 'and what the model carries').eq(2);
      expect(p1.tags.count(Tag.SCIENCE, 'award'), 'an award counts printed tags — neither the law nor a wild tag').eq(2);
      expect(p1.tags.count(Tag.SCIENCE, 'milestone'),
        'a MILESTONE takes the wild tag but NOT the law: it records an achievement, not an action taken').eq(2 + RULING_WILD);
      expect(p1.tags.count(Tag.BUILDING), 'no other tag gains from the LAW (the wild tag is not this card)').eq(RULING_WILD);
    });

    it('makes a card whose requirement it satisfies actually playable', () => {
      const [, p1, , parliament] = enacted();
      const aiCentral = new AICentral(); // requires 3 science tags
      p1.megaCredits = 30;
      p1.production.override({energy: 2});

      setInfluence(parliament, p1, 1);
      expect(p1.tags.count(Tag.SCIENCE), 'the wild tag and one by influence — two').eq(RULING_WILD + 1);
      expect(p1.canPlay(aiCentral), 'two science tags are not three').is.false;

      setInfluence(parliament, p1, 2);
      expect(p1.canPlay(aiCentral), 'the law hands the third one while the player acts').is.true;
    });

    it('influence 0 gives nothing, and the bonus grows with the influence', () => {
      const [, p1, , parliament] = enacted();
      for (const influence of [0, 1, 3, 5]) {
        setInfluence(parliament, p1, influence);
        expect(p1.tags.count(Tag.SCIENCE), `influence ${influence}`).eq(RULING_WILD + influence);
        expect(ParliamentHandler.tagBonus(p1, Tag.SCIENCE), 'the law own share').eq(influence);
      }
    });

    it('is a QUERY: nothing is written into the player, and a reload reads the same numbers', () => {
      const [game, p1, , parliament] = enacted();
      p1.playedCards.push(new Research());
      setInfluence(parliament, p1, 3);
      expect(p1.tags.count(Tag.SCIENCE)).eq(2 + RULING_WILD + 3);

      const saved = game.serialize().players.find((p) => p.id === p1.id)!;
      expect(saved.playedCards.length, 'the tableau is the only place tags live').eq(1);

      const copy = reload(game);
      const p1Copy = copy.getPlayerById(p1.id);
      expect(copy.parliament!.enacted, 'the law survives the save').eq(RDF);
      expect(p1Copy.tags.count(Tag.SCIENCE), 'and the copy derives the bonus again').eq(2 + RULING_WILD + 3);
      expect(p1Copy.tags.count(Tag.SCIENCE, 'raw')).eq(2);
    });

    it('leaves the moment another law takes the ENACTED slot', () => {
      const [, p1, , parliament] = enacted();
      p1.playedCards.push(new Research());
      setInfluence(parliament, p1, 2);
      expect(p1.tags.count(Tag.SCIENCE)).eq(2 + RULING_WILD + 2);

      // The Industrialists' law rules now: neither the science bonus nor the
      // Scientists' wild tag is held by anybody any more.
      parliament.enacted = resolutionInstanceId(METAL_RESEARCH_ID, 0);
      expect(p1.tags.count(Tag.SCIENCE), 'a law with no tag bonus stands now').eq(2);
      expect(ParliamentHandler.tagBonus(p1, Tag.SCIENCE)).eq(0);
      expect(ParliamentHandler.tagBonuses(p1)).is.empty;
    });

    it('is never held by a seat outside the parliament — MarsBot counts its printed tags only', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, RDF);
      parliament.enacted = RDF;
      human.playedCards.push(new Research());
      setInfluence(parliament, human, 2);
      parliament.agenda.set(bot.id, agendaForInfluence(2));

      expect(parliament.participates(bot), 'MarsBot takes no seat').is.false;
      expect(ParliamentHandler.tagBonus(bot, Tag.SCIENCE)).eq(0);
      expect(ParliamentHandler.tagBonuses(bot)).is.empty;
      expect(ParliamentHandler.tagBonus(human, Tag.SCIENCE), 'the human holds the law').eq(2);
      expect(human.tags.count(Tag.SCIENCE)).eq(2 + RULING_WILD + 2);
    });

    it('is stated as a LIST for the surfaces that must name it — one entry, the tag, the amount and the law', () => {
      const [, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 2);
      expect(ParliamentHandler.tagBonuses(p1)).deep.eq([{tag: Tag.SCIENCE, amount: 2, resolution: RD_FUNDING_ID}]);
      setInfluence(parliament, p1, 0);
      expect(ParliamentHandler.tagBonuses(p1), 'influence 0 states nothing').is.empty;
    });
  });

  describe('the passive — the other counting functions read it the same way', () => {
    it('multipleCount takes it in the action mode only', () => {
      const [, p1, , parliament] = enacted();
      p1.playedCards.push(new Research());
      setInfluence(parliament, p1, 2);
      expect(p1.tags.multipleCount([Tag.SCIENCE, Tag.PLANT]), 'a behaviour counter is an action').eq(2 + RULING_WILD + 2);
      expect(p1.tags.multipleCount([Tag.SCIENCE, Tag.PLANT], 'award')).eq(2);
      expect(p1.tags.multipleCount([Tag.SCIENCE, Tag.PLANT], 'milestone'), 'the wild tag, never the law').eq(2 + RULING_WILD);
      expect(p1.tags.multipleCount([Tag.PLANT, Tag.ANIMAL]), 'a list without science gains nothing from the LAW').eq(RULING_WILD);
    });

    it('distinctCount shows the tag while the player acts, and never for a milestone or a global event', () => {
      const [, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 2);
      expect(p1.tags.count(Tag.SCIENCE, 'raw'), 'not a single printed science tag').eq(0);
      expect(p1.tags.distinctCount('default'), 'the science tag the law grants, plus the ruling wild tag').eq(1 + RULING_WILD);
      expect(p1.tags.distinctCount('milestone'), 'a milestone sees the wild tag only').eq(RULING_WILD);
      expect(p1.tags.distinctCount('globalEvent'), 'and a global event neither').eq(0);
    });

    it('playerHas counts the granted tag as showing, like legacy Turmoil own science hook', () => {
      const [, p1, , parliament] = enacted();
      p1.playedCards.push(new Tardigrades()); // a microbe tag, no science
      setInfluence(parliament, p1, 0);
      expect(p1.tags.playerHas([Tag.SCIENCE, Tag.MICROBE])).is.false;
      setInfluence(parliament, p1, 1);
      expect(p1.tags.playerHas([Tag.SCIENCE, Tag.MICROBE])).is.true;
    });

    it('the Scientists own WILD tag keeps counting exactly as before, and the two stack', () => {
      const [, , p2, parliament] = enacted();
      p2.playedCards.push(new Research());
      setInfluence(parliament, p2, 2);
      // The Scientists RULE while their law stands, so every seat holds their
      // wild tag — this card changed nothing about it.
      expect(ParliamentHandler.wildTags(p2), 'the party wild tag is untouched by this card').eq(RULING_WILD);
      expect(p2.tags.count(Tag.SCIENCE), 'printed + wild + law, all three').eq(2 + RULING_WILD + 2);
      expect(p2.tags.count(Tag.WILD), 'and the wild COUNT itself is the printed one').eq(0);
      expect(p2.tags.count(Tag.SCIENCE, 'award'), 'neither reaches an award').eq(2);
    });
  });

  describe('the action — the shared repeat list', () => {
    it('offers only the actions already used this generation that can act again', () => {
      const [game, p1] = enacted();
      const used = usedTardigrades(game, p1);
      const unused = new RegolithEaters();
      p1.playedCards.push(unused);

      expect(repeatableActionCards(p1).map((c) => c.name)).deep.eq([used.name]);
      p1.actionsThisGeneration.add(unused.name);
      expect(repeatableActionCards(p1).map((c) => c.name)).deep.eq([used.name, unused.name]);
    });

    it('excludes the copier itself, and a card already two checks deep in a copy loop', () => {
      const [game, p1] = enacted();
      const viron = new Viron();
      p1.playedCards.push(viron);
      const used = usedTardigrades(game, p1);
      expect(repeatableActionCards(p1, viron).map((c) => c.name), 'a copier never copies itself').deep.eq([used.name]);

      // Playwrights is the card that COUNTS its own copy depth — the loop guard.
      const playwrights = new Playwrights();
      p1.playedCards.push(playwrights);
      p1.actionsThisGeneration.add(playwrights.name);
      p1.playedCards.push(new Sabotage()); // a cheap played EVENT — what Playwrights replays
      p1.megaCredits = 30;
      expect(repeatableActionCards(p1).map((c) => c.name), 'shallow, it is a candidate').includes(playwrights.name);
      (playwrights as unknown as {checkLoops: number}).checkLoops = 2;
      expect(repeatableActionCards(p1).map((c) => c.name), 'two checks deep it is out').deep.eq([used.name]);
    });

    it('is the SAME list Viron and Project Inspection answer — the extraction moved nothing', () => {
      const [game, p1] = enacted();
      const used = usedTardigrades(game, p1);
      const viron = new Viron();
      const inspection = new ProjectInspection();
      p1.playedCards.push(viron);

      expect(viron.canAct(p1), 'Viron still sees a card to copy').is.true;
      const step = viron.actionPreview(p1).branches[0].steps[0];
      expect(step.kind, 'the repeat pick is the preview own step').eq('input');
      expect(step.kind === 'input' ? step.repeatAction : undefined, 'marked as a repeat').is.true;
      expect(step.kind === 'input' ? (step.input as SelectCardModel).cards.map((c) => c.name) : [])
        .deep.eq([used.name]);
      expect(inspection.bespokeCanPlay(p1), 'and so does Project Inspection').is.true;
      expect(inspection.unplayableReason(p1)).is.undefined;
      expect(repeatableActionCards(p1, viron).map((c) => c.name)).deep.eq([used.name]);
    });
  });

  describe('the action — availability, with a reason', () => {
    it('is offered only when there is a used action to repeat', () => {
      const [game, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 1);

      expect(ParliamentHandler.resolutionActionOptions(p1), 'nothing was used yet').is.empty;
      let model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({
        resolution: RD_FUNDING_ID, party: PartyName.SCIENTISTS, hasAccess: true,
        usesLeft: 1, usesPerGeneration: 1, available: false, reason: RD_FUNDING_NO_ACTION_REASON,
      });

      usedTardigrades(game, p1);
      model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({available: true, reason: ''});
      expect(actionOption(p1), 'and the option is in the menu, by its marker').is.not.undefined;
    });

    it('carries the structural marker and stands inside the live action menu', () => {
      const [game, p1] = enacted();
      usedTardigrades(game, p1);
      const option = actionOption(p1)!;
      expect(markerOf(option)).deep.eq({
        resolution: RD_FUNDING_ID, party: PartyName.SCIENTISTS, stage: 'choose', usesLeft: 1, usesPerGeneration: 1,
      });
      expect(option.choiceContext?.source).deep.eq({kind: 'resolution', resolution: RD_FUNDING_ID});
      const {index} = menuOption(p1);
      expect(index, 'the whole path — Player.getActions').is.greaterThan(-1);
    });

    it('shows the pick even when there is exactly one candidate — no hidden target', () => {
      const [game, p1] = enacted();
      const used = usedTardigrades(game, p1);
      const option = actionOption(p1)!;
      expect(option.cards.map((c) => c.name)).deep.eq([used.name]);
      expect(option.config.min).eq(1);
      expect(option.config.max).eq(1);
    });

    it('is gone when another law takes the slot, and never offered to MarsBot', () => {
      const [game, p1, , parliament] = enacted();
      usedTardigrades(game, p1);
      parliament.enacted = resolutionInstanceId(OPEN_IP_TRADE_ID, 0);
      expect(ParliamentHandler.resolutionActionOptions(p1).some((o) => markerOf(o)?.resolution === RD_FUNDING_ID)).is.false;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction!.resolution).eq(OPEN_IP_TRADE_ID);

      const [botGame, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      botGame.phase = Phase.ACTION;
      seatResolution(botGame.parliament!, 0, RDF);
      botGame.parliament!.enacted = RDF;
      usedTardigrades(botGame, human as TestPlayer);
      expect(ParliamentHandler.resolutionActionOptions(bot)).is.empty;
      expect(ParliamentHandler.resolutionActionOptions(human), 'the human holds it').has.length(1);
    });
  });

  describe('the action — the commit', () => {
    it('runs the picked action a SECOND time, under the law own copied-action scope', () => {
      const [game, p1] = enacted();
      const used = usedTardigrades(game, p1);
      expect(used.resourceCount, 'the first use').eq(1);

      const option = actionOption(p1)!;
      expect(option.cards.map((c) => c.name)).deep.eq([used.name]);
      option.process({type: 'card', cards: [used.name]});
      runAllActions(game);
      expect(used.resourceCount, 'and the second one').eq(2);

      const copy = game.events.events.find((e) => e.type === 'copied-action' && e.target?.card === used.name);
      expect(copy, 'the copy is recorded').is.not.undefined;
      expect(copy!.source).deep.eq({kind: 'resolution', id: RD_FUNDING_ID, owner: p1.color});
    });

    it('records the use at the ANSWER — a prompt built and abandoned spends nothing', () => {
      const [game, p1, , parliament] = enacted();
      const used = usedTardigrades(game, p1);

      actionOption(p1);
      expect(parliament.resolutionActionUsesLeft(p1), 'building the prompt changed nothing').eq(1);

      actionOption(p1)!.process({type: 'card', cards: [used.name]});
      runAllActions(game);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
      expect(ParliamentHandler.resolutionActionOptions(p1), 'and the option is gone this generation').is.empty;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction).deep.include({
        usesLeft: 0, available: false, reason: 'This resolution action was already used this generation',
      });
    });

    it('hands back whatever the copied action asks next, stamped as a copy', () => {
      const [game, p1] = enacted();
      usedTardigrades(game, p1); // a microbe holder, so the fungus has a target
      const fungus = new ExtremeColdFungus(); // «add 2 microbes to another card OR gain 1 plant»
      p1.playedCards.push(fungus);
      p1.actionsThisGeneration.add(fungus.name);

      const next = actionOption(p1)!.process({type: 'card', cards: [fungus.name]});
      expect(next, 'the copied action own question comes straight back out of the commit').is.not.undefined;
      expect((next as unknown as {copiedActionSource?: CardName}).copiedActionSource, 'stamped with the copied card').eq(fungus.name);
    });

    it('a new generation gives the use back', () => {
      const [game, p1, , parliament] = enacted();
      const used = usedTardigrades(game, p1);
      actionOption(p1)!.process({type: 'card', cards: [used.name]});
      runAllActions(game);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);

      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      // The next sitting enacts its own law; put THIS one back in the slot to
      // read the counter the generation boundary cleared.
      parliament.enacted = RDF;
      expect(parliament.resolutionActionUsesLeft(p1), 'the generation boundary resets it').eq(RD_FUNDING_USES_PER_GENERATION);
    });
  });

  describe('the sitting', () => {
    it('pays nobody at the enactment — no record, no prompt, and the card simply stands', () => {
      const [game, p1, p2, parliament] = stage();
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);

      expect(parliament.enacted).eq(RDF);
      const outcomes = (parliament.lastPhase?.outcomes ?? []).filter((o) => o.kind !== 'reaction');
      expect(outcomes, 'a law with no step records nothing').is.empty;
      const asked = [p1, p2].map((p) => p.getWaitingFor()).filter((wf) => wf !== undefined);
      expect(asked.every((wf) => wf!.choiceContext?.source?.kind !== 'resolution'), 'and asks nobody anything of its own').is.true;
      // …and from that moment on, every participant holds the rule.
      setInfluence(parliament, p2, 0);
      const base = p2.tags.count(Tag.SCIENCE);
      setInfluence(parliament, p2, 3);
      expect(p2.tags.count(Tag.SCIENCE), 'the loser of the vote holds the law too').eq(base + 3);
    });
  });
});
