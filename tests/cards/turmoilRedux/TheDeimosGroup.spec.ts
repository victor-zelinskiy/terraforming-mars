import {expect} from 'chai';
import {DEIMOS_INFLUENCE_BONUS, TheDeimosGroup} from '../../../src/server/cards/turmoilRedux/TheDeimosGroup';
import {BackroomDeal} from '../../../src/server/cards/turmoilRedux/BackroomDeal';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {LakeMarineris} from '../../../src/server/cards/base/LakeMarineris';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {corpFirstActionPreview} from '../../../src/server/models/corpFirstActionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requirementEasingOf} from '../../../src/server/models/requirementEasing';
import {armedPlayEffectsOf} from '../../../src/server/cards/armedPlayEffects';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {InfluenceRequirement} from '../../../src/server/cards/requirements/InfluenceRequirement';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions, setTemperature} from '../../TestingUtils';

/**
 * TR83 — THE DEIMOS GROUP: 50 M€, a Mars tag; «as your first action, add a delegate to any resolution»; «you have +2
 * influence; when playing cards, you can ignore all party requirements». Three existing declarations — every rule
 * reading of the card file's header is pinned here on the real card.
 */
const ID = CardName.THE_DEIMOS_GROUP;
const R = PartyName.REDS;
const M = PartyName.MARS;
const S = PartyName.SCIENTISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

/** A two-seat Redux table with three QUIET resolutions (Scientists · Mars First · Reds) — the Greens rule by the starting rule. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  const parliament = game.parliament!;
  ([S, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament};
}

/** The table with Deimos PLAYED by p1 (its +2 influence on the ledger) — the action phase. */
function owned(): Table & {card: TheDeimosGroup} {
  const t = table();
  const card = new TheDeimosGroup();
  t.p1.playCorporationCard(card);
  t.game.phase = Phase.ACTION;
  t.p1.megaCredits = 60;
  return {...t, card};
}

/** TR36 Council Seat — a card with the REDS' plate — in p1's hand (Reds out of power, 0 delegates). */
function councilSeat(t: Table): CouncilSeat {
  const card = new CouncilSeat();
  t.p1.cardsInHand.push(card);
  return card;
}

/** Take the owed first action through the marked prompt, stopping at its question. */
function firstActionToPrompt(t: Table): SelectParty {
  t.p1.takeAction();
  const prompt = cast(t.p1.getWaitingFor(), OrOptions);
  expect(prompt.startGamePrompt?.kind).eq('corporationInitialAction');
  t.p1.process({type: 'or', index: 0, response: {type: 'option'}});
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectParty);
}

function seatOf(t: Table, player: TestPlayer) {
  return getParliamentModel(t.game, player)!.players.find((p) => p.color === player.color)!;
}

function projectionOf(t: Table, player: TestPlayer, party: ReduxParty) {
  const slot = t.parliament.slotOf(party)!;
  return getParliamentModel(t.game, player)!.viewer!.vote.projections.find((p) => p.instance === slot.instance)!;
}

function cubes(t: Table, player: TestPlayer, party: ReduxParty, n: number): void {
  const slot = t.parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

describe('TheDeimosGroup', () => {
  describe('rule 1 — the card as printed', () => {
    it('a corporation for 50 M€, a Mars tag, no VP / action / resources, a first action — TR83, the sixth new corporation', () => {
      const card = new TheDeimosGroup();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(50);
      expect(card.tags).deep.eq([Tag.MARS]);
      expect(card.victoryPoints).is.undefined;
      expect(card.resourceType).is.undefined;
      expect(card.initialActionText).eq('Add a delegate to any resolution');
      expect(card.firstAction).deep.eq({text: 'Add a delegate to any resolution', turmoil: {sendDelegates: {count: 1}}});
      expect(card.behavior).deep.eq({turmoil: {influenceBonus: DEIMOS_INFLUENCE_BONUS}});
      expect(card.partyRequirementWaiver, 'TR70\'s declaration WITHOUT nextCardOnly — standing').deep.eq({});
      expect(card.metadata.cardNumber).eq('TR83');
      expect(card.metadata.reimplements).is.undefined;
      expect(newCorporationCardNumber(ID)).eq('TR83');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS[5]).deep.include({name: 'The Deimos Group', authored: ID});
      const entry = TURMOIL_REDUX_CARD_MANIFEST.corporationCards[ID];
      expect(entry).is.not.undefined;
      expect(entry!.compatibility, 'only the module\'s own diamond on the scan').is.undefined;
    });

    it('the face reads the scan: «50» + one delegate; the effect row «+ 2 [influence] [party plate, struck]»', () => {
      const rows = new TheDeimosGroup().metadata.renderData!;
      const flat = JSON.stringify(rows);
      expect(flat).to.include(`"type":"${CardRenderItemType.DELEGATES}"`);
      expect(flat).to.include(`"type":"${CardRenderItemType.INFLUENCE}"`);
      expect(flat).to.match(new RegExp(`"type":"${CardRenderItemType.PARTY_REQUIREMENT}"[^}]*"cancelled":true`));
    });

    it('the structured text: the effect with ONE short caption, the start and the first action', () => {
      const info = buildCardInformation(new TheDeimosGroup(), 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Effect: You have +2 influence. When playing cards, you can ignore all party requirements.',
        'Start with 50 M€.',
        'As your first action, add a delegate to any resolution.',
      ]);
      expect(blocks[0].short).eq('+2 influence · party requirements ignored');
    });

    it('the play: 50 M€, no production, the first action owed', () => {
      const t = table();
      t.p1.playCorporationCard(new TheDeimosGroup());
      expect(t.p1.megaCredits).eq(50);
      expect(t.p1.production.megacredits).eq(0);
      expect(t.p1.pendingInitialActions.map((c) => c.name)).deep.eq([ID]);
    });
  });

  describe('rule 2 — the first action: a delegate from the RESERVE on any resolution of the voting area', () => {
    it('asks WHICH resolution through the shared grant — the giver is the corporation, three candidates SHOWN', () => {
      const t = owned();
      const select = firstActionToPrompt(t);
      expect(select.parties).to.have.members([S, M, R]);
      expect(select.votePrompt?.source).eq('grant');
      expect(select.votePrompt?.count).eq(1);
      expect(select.choiceContext?.source).deep.include({card: ID});
    });

    it('the answer places ONE delegate of the player on the chosen resolution; the reserve −1, the lobby untouched', () => {
      const t = owned();
      const reserve = t.parliament.reserve(t.p1);
      firstActionToPrompt(t);
      t.p1.process({type: 'party', partyName: M});
      runAllActions(t.game);
      expect(t.parliament.votesOf(t.p1, t.parliament.slotOf(M)!)).eq(1);
      expect(t.parliament.votesOf(t.p1)).eq(1);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 1);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby\'s free cube is not the grant\'s to spend').is.true;
      expect(t.p1.pendingInitialActions).deep.eq([]);
      t.parliament.assertLedger(t.game);
    });

    it('an EMPTY voting area (a Merger corporation mid-game) is the grant\'s NAMED skip, never a crash', () => {
      const t = owned();
      t.parliament.slots = [];
      t.p1.takeAction();
      t.p1.process({type: 'or', index: 0, response: {type: 'option'}});
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.not.instanceOf(SelectParty);
      expect(t.game.gameLog.some((m) => m.message === '${0} cannot add delegates to a resolution: no resolution is up for a vote')).is.true;
    });

    it('the preview of the first action is NOT mute: the reserve chip N → N−1 and the vote as the step after the confirm', () => {
      const t = owned();
      const preview = corpFirstActionPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const reserve = t.parliament.reserve(t.p1);
      const chip = preview.branches[0].effects.find((e) => e.current === reserve);
      expect(chip, 'the reserve chip').is.not.undefined;
      expect(chip!.resulting).eq(reserve - 1);
      expect(preview.branches[0].steps.map((s) => s.kind)).to.include('delegateGrantFollowUp');
    });
  });

  describe('rule 3 — +2 influence, one NAMED entry of the ledger', () => {
    it('right after the play: the Career\'s level + 2, the source named; the rival gains nothing', () => {
      const t = table();
      const before = t.parliament.influence(t.p1);
      const rival = t.parliament.influence(t.p2);
      t.p1.playCorporationCard(new TheDeimosGroup());
      expect(t.parliament.influence(t.p1)).eq(before + 2);
      expect(t.parliament.influenceSourcesOf(t.p1)).deep.eq([{amount: 2, source: ID}]);
      expect(t.parliament.influence(t.p2)).eq(rival);
      const seat = seatOf(t, t.p1);
      expect(seat.influence).eq(before + 2);
      expect(seat.influenceSources).deep.eq([{amount: 2, source: ID}]);
    });

    it('the journal writes the influence beside the corporation (the T05 road)', () => {
      const t = table();
      t.p1.playCorporationCard(new TheDeimosGroup());
      const change = t.game.events.events.find((e) => e.type === 'influence-changed' && e.player === t.p1.color);
      expect(change?.impact.influence).deep.include({amount: 2});
    });

    it('an influence requirement of 2 (TR04 class) is met from the first generation', () => {
      const t = owned();
      expect(new InfluenceRequirement({count: 2}).satisfies(t.p1, fakeCard())).is.true;
      expect(new InfluenceRequirement({count: 2}).satisfies(t.p2, fakeCard())).is.false;
    });

    it('the ledger survives a reload', () => {
      const t = owned();
      const loaded = Game.deserialize(structuredClone(t.game.serialize()));
      const p1 = loaded.getPlayerById(t.p1.id);
      expect(loaded.parliament!.influenceSourcesOf(p1)).deep.eq([{amount: 2, source: ID}]);
      expect(loaded.parliament!.influence(p1)).eq(t.parliament.influence(t.p1));
    });
  });

  describe('rule 4 — every PARTY requirement lifted, standing; nothing else', () => {
    it('Council Seat (the Reds\' plate) with the Reds out of power and 0 delegates: playable, no party reason, decisive, NOT one play', () => {
      const t = table();
      const card = councilSeat(t);
      expect(t.p1.canPlay(card), 'refused without the corporation').is.false;
      expect(unplayableReasons(t.p1, card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, party: R});
      t.p1.playCorporationCard(new TheDeimosGroup());
      t.game.phase = Phase.ACTION;
      t.p1.megaCredits = 60;
      expect(t.p1.canPlay(card)).is.true;
      expect(unplayableReasons(t.p1, card)).deep.eq([]);
      const [easing] = requirementEasingOf(t.p1, card);
      expect(easing).deep.include({type: RequirementType.PARTY, party: R, effective: 'waived', current: 0, met: true, decisive: true});
      expect(easing.sources).deep.eq([{source: {kind: 'corporation', card: ID, owner: t.p1.color}, kind: 'waive', oneShot: false}]);
    });

    it('met ANYWAY (two own delegates on the Reds) is not decisive', () => {
      const t = owned();
      const card = councilSeat(t);
      cubes(t, t.p1, R, 2);
      expect(requirementEasingOf(t.p1, card)[0]).deep.include({effective: 'waived', decisive: false});
    });

    it('nothing ARMED: the public reading is empty — a standing waiver is no charge', () => {
      const t = owned();
      expect(armedPlayEffectsOf(t.p1)).deep.eq([]);
    });

    it('standing: two plays in a row are both let through — the waiver is never spent', () => {
      const t = owned();
      const first = councilSeat(t);
      t.p1.playCard(first, Payment.of({megacredits: first.cost}));
      runAllActions(t.game);
      const second = councilSeat(t);
      expect(t.p1.canPlay(second), 'the next play is let through as well').is.true;
      expect(t.p1.partyRequirementWaiver()).deep.eq({kind: 'corporation', card: ID, owner: t.p1.color});
      const eased = t.game.events.events.filter((e) => e.type === 'requirement-eased' && e.player === t.p1.color);
      expect(eased.length, 'the play wrote who let it through').gte(1);
    });

    it('NOT lifted: a global requirement (Lake Marineris at −30 °C)', () => {
      const t = owned();
      setTemperature(t.game, -30);
      const lake = new LakeMarineris();
      t.p1.cardsInHand.push(lake);
      expect(t.p1.canPlay(lake)).is.false;
      expect(t.p1.globalRequirementWaiver(GlobalParameter.TEMPERATURE)).is.undefined;
    });

    it('the party\'s EFFECT is not granted — a requirement is the card\'s, an effect is the Parliament\'s (FAQ p.19)', () => {
      const t = owned();
      const access = t.parliament.access(t.p1, R);
      expect(access.hasEffect).is.false;
      expect(access.satisfiesRequirement, 'the Parliament\'s roads stay printed').is.false;
    });
  });

  describe('rule 5 — beside an armed Backroom Deal the STANDING waiver is named', () => {
    it('Deimos + TR70 armed → the source is Deimos; Backroom Deal\'s charge is still spent by the next play', () => {
      const t = owned();
      const deal = new BackroomDeal();
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(t.p1.lastCardPlayed).eq(CardName.BACKROOM_DEAL);
      const card = councilSeat(t);
      expect(t.p1.partyRequirementWaiver()).deep.eq({kind: 'corporation', card: ID, owner: t.p1.color});
      expect(requirementEasingOf(t.p1, card)[0].sources).deep.eq([{source: {kind: 'corporation', card: ID, owner: t.p1.color}, kind: 'waive', oneShot: false}]);
      t.p1.playCard(card, Payment.of({megacredits: Math.max(0, card.cost - 10)}));
      runAllActions(t.game);
      expect(t.p1.lastCardPlayed, 'the charge is spent, needed or not').eq(CardName.COUNCIL_SEAT);
    });
  });

  describe('rule 6 — the Parliament reads the waiver through ONE seat field', () => {
    it('the seat carries the standing waiver; the rival has no field', () => {
      const t = owned();
      expect(seatOf(t, t.p1).partyRequirementWaiver).deep.eq({source: {kind: 'corporation', card: ID, owner: t.p1.color}, oneShot: false});
      expect(seatOf(t, t.p2).partyRequirementWaiver).is.undefined;
    });

    it('the vote never promises «unlocks the requirement» to the owner; the effect projection is unchanged; the rival\'s is', () => {
      const t = owned();
      cubes(t, t.p1, M, 1);
      cubes(t, t.p2, M, 1);
      expect(projectionOf(t, t.p1, M)).deep.include({unlocksEffect: true, unlocksRequirement: false});
      expect(projectionOf(t, t.p2, M)).deep.include({unlocksEffect: true, unlocksRequirement: true});
    });

    it('a ONE-PLAY waiver (TR70 alone) keeps the chip — the requirement opens for the cards AFTER the next one', () => {
      const t = table();
      t.game.phase = Phase.ACTION;
      t.p1.megaCredits = 60;
      const deal = new BackroomDeal();
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      cubes(t, t.p1, M, 1);
      expect(seatOf(t, t.p1).partyRequirementWaiver).deep.eq({source: {kind: 'card', card: CardName.BACKROOM_DEAL, owner: t.p1.color}, oneShot: true});
      expect(projectionOf(t, t.p1, M)).deep.include({unlocksRequirement: true});
    });
  });

  describe('rule 8 — save / load', () => {
    it('the waiver is read anew from the table after a reload', () => {
      const t = owned();
      const loaded = Game.deserialize(structuredClone(t.game.serialize()));
      const p1 = loaded.getPlayerById(t.p1.id);
      expect(p1.partyRequirementWaiver()).deep.eq({kind: 'corporation', card: ID, owner: t.p1.color});
    });
  });
});
