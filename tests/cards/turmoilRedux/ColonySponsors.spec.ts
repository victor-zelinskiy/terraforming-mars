import {expect} from 'chai';
import {ColonySponsors} from '../../../src/server/cards/turmoilRedux/ColonySponsors';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Luna} from '../../../src/server/colonies/Luna';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Titan} from '../../../src/server/colonies/Titan';
import {PlutoRedux, PLUTO_REDUX_NO_DATA_HOLDER_REASON} from '../../../src/server/colonies/PlutoRedux';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {ColonyBenefit} from '../../../src/common/colonies/ColonyBenefit';
import {trackTop, tradeBenefitAt} from '../../../src/common/colonies/ColonyMetadata';
import {
  COLONY_NOT_ACTIVE_REASON, COLONY_TRACK_AT_TOP_REASON, COLONY_TRACK_LABEL, EVERY_COLONY_TRACK_AT_TOP_REASON,
} from '../../../src/server/deferredActions/MaximizeColonyTrack';
import {ActionPreviewStep, StagedColonyModel} from '../../../src/common/models/ActionPreviewModel';
import {SelectColonyModel} from '../../../src/common/models/PlayerInputModel';
import {Server} from '../../../src/server/models/ServerModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';

/**
 * TR07 — COLONY SPONSORS: «Requires that you have a colony in play. Choose 1
 * colony track. Move its marker to the highest (right-most) position.» Every
 * rule reading of the card file's header is pinned here; the shared step is
 * pinned by tests/deferredActions/MaximizeColonyTrack.spec.ts and the staged
 * tail by tests/inputs/deferredInputBatch.spec.ts § addressed staged colony.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: ColonySponsors, luna: Luna, ceres: Ceres, titan: Titan, pluto: PlutoRedux};

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  const luna = new Luna();
  const ceres = new Ceres();
  const titan = new Titan();
  const pluto = new PlutoRedux();
  game.colonies = [luna, ceres, titan, pluto];
  titan.isActive = false;
  luna.trackPosition = 2;
  ceres.trackPosition = trackTop(ceres.metadata);
  pluto.trackPosition = 1;
  // p1 owns a colony on Luna — the requirement.
  luna.colonies.push(p1.id);
  const card = new ColonySponsors();
  p1.cardsInHand.push(card);
  p1.megaCredits = 10;
  return {game, p1, p2, card, luna, ceres, titan, pluto};
}

/** The play through the REAL door — the action menu — so the chain has its root (the journal's scope). */
function play(t: Table): SelectColony {
  t.p1.takeAction();
  const menu = cast(t.p1.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  t.p1.process({type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 5})}});
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectColony);
}

/** Answer the card's own colony question by the wire, as the client does. */
function answer(t: Table, colony: ColonyName): void {
  t.p1.process({type: 'colony', colonyName: colony});
  runAllActions(t.game);
}

function doorOf(t: Table): StagedColonyModel {
  const steps: ReadonlyArray<ActionPreviewStep> = cardPlayPreview(t.p1, t.card).branches[0].steps;
  const door = steps.find((s) => s.kind === 'colonyPick');
  expect(door, 'the play carries the colony door').is.not.undefined;
  return (door as Extract<ActionPreviewStep, {kind: 'colonyPick'}>).staged;
}

describe('ColonySponsors', () => {
  describe('the card as printed', () => {
    it('is AUTOMATED for 5 with a Jovian tag, «a colony in play», no VP, TR07 — «SET [colony tile] TO MAX»', () => {
      const card = new ColonySponsors();
      expect(card.name).eq(CardName.COLONY_SPONSORS);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(5);
      expect(card.tags).deep.eq([Tag.JOVIAN]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([{colonies: 1, count: 1}]);
      expect(card.metadata.cardNumber).eq('TR07');
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => item.type)).deep.eq([CardRenderItemType.TEXT, CardRenderItemType.COLONY_TILE, CardRenderItemType.TEXT]);
      expect(items.filter((item) => item.type === CardRenderItemType.TEXT).map((item) => item.text)).deep.eq(['SET', 'TO MAX']);
    });

    it('needs Colonies (the grey ▲) and declares no Turmoil compatibility (the module is the gate)', () => {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.COLONY_SPONSORS];
      expect(entry.compatibility).eq('colonies');
    });
  });

  describe('rule 1 — a colony of one\'s OWN in play', () => {
    it('playable with a colony of the player\'s', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('unplayable without one — the reason says how many there are now; a RIVAL\'s colony does not count', () => {
      const t = table();
      t.luna.colonies = [t.p2.id];
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({message: 'Requires ${0} colony(ies)', current: 0, requirement: true});
    });
  });

  describe('rules 2–4 — any ACTIVE tile below its top, anybody\'s; the marker is SET to the top', () => {
    it('the play asks the card\'s own colony question: candidates, disabled tiles with ONE reason each, the projection', () => {
      const t = table();
      const prompt = play(t);
      expect(prompt.choiceContext?.source).deep.eq({kind: 'card', card: CardName.COLONY_SPONSORS});
      expect(prompt.colonies.map((c) => c.name)).deep.eq([ColonyName.LUNA, ColonyName.PLUTO_REDUX]);
      expect(prompt.disabledColonies.map((d) => [d.colony.name, d.reason])).deep.eq([
        [ColonyName.CERES, COLONY_TRACK_AT_TOP_REASON],
        [ColonyName.TITAN, COLONY_NOT_ACTIVE_REASON],
      ]);
      expect(prompt.trackMoves).deep.eq([
        {colony: ColonyName.LUNA, before: 2, after: 6},
        {colony: ColonyName.PLUTO_REDUX, before: 1, after: 6},
      ]);
    });

    it('a tile with nobody\'s cube — and one with a docked fleet — is a candidate (the track is the tile\'s)', () => {
      const t = table();
      t.pluto.visitor = t.p2.color;
      const prompt = play(t);
      expect(prompt.colonies.map((c) => c.name)).includes(ColonyName.PLUTO_REDUX);
      expect(t.pluto.colonies).deep.eq([]);
    });

    it('the answer moves the marker to the top: the log names the steps, the event names the move, the card is played', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.LUNA);
      expect(t.luna.trackPosition).eq(6);
      expect(t.p1.tableau.has(CardName.COLONY_SPONSORS)).is.true;
      expect(t.p1.megaCredits).eq(5);
      const line = t.game.gameLog.find((m) => m.message === '${0} increased ${1} colony track ${2} step(s)');
      expect(line?.data.map((d) => d.value)).deep.eq([t.p1.color, ColonyName.LUNA, '4']);
      const moved = t.game.events.events.filter((e) => e.type === 'colony-track-moved');
      expect(moved).has.lengthOf(1);
      expect(moved[0].impact.colonyTrackMove).deep.eq({colony: ColonyName.LUNA, before: 2, after: 6});
      const root = t.game.events.events.find((e) => e.id === moved[0].correlationId);
      expect(root?.source, 'the move joins the play\'s chain, sourced by the card').deep.include({card: CardName.COLONY_SPONSORS});
    });

    it('rule 6 — it is not a trade: no fleet leaves, no visitor, no trade income', () => {
      const t = table();
      const used = t.p1.colonies.usedTradeFleets;
      play(t);
      const hand = t.p1.cardsInHand.length;
      answer(t, ColonyName.LUNA);
      expect(t.luna.visitor).is.undefined;
      expect(t.p1.colonies.usedTradeFleets).eq(used);
      expect(t.p1.cardsInHand.length).eq(hand);
    });
  });

  describe('rule 5 — every active track at its top', () => {
    it('the card stays playable; the play records a NAMED skip and asks nothing', () => {
      const t = table();
      t.luna.trackPosition = 6;
      t.pluto.trackPosition = 6;
      expect(t.p1.canPlay(t.card)).is.true;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor() instanceof SelectColony).is.false;
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped))
        .deep.eq([{label: COLONY_TRACK_LABEL, reason: EVERY_COLONY_TRACK_AT_TOP_REASON}]);
    });

    it('…and the preview says so BEFORE the play: no door, the warning in the record\'s own words', () => {
      const t = table();
      t.luna.trackPosition = 6;
      t.pluto.trackPosition = 6;
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.map((s) => s.kind)).deep.eq(['note']);
      expect(steps[0]).deep.include({noteKind: 'warning', text: EVERY_COLONY_TRACK_AT_TOP_REASON, skipped: {label: COLONY_TRACK_LABEL}});
    });
  });

  describe('rule 6 — the Redux Pluto at its top pays CARDS, with no data card needed', () => {
    it('from position 2 (data, refused without a holder) to the top: the next trade pays 3 cards', () => {
      const t = table();
      expect(t.pluto.tradeIncomeBlockedReason(t.p1, t.pluto.trackPosition)).eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      play(t);
      answer(t, ColonyName.PLUTO_REDUX);
      expect(t.pluto.trackPosition).eq(6);
      expect(t.pluto.tradeIncomeBlockedReason(t.p1, t.pluto.trackPosition)).is.undefined;
      expect(tradeBenefitAt(t.pluto.metadata, 6)).deep.include({type: ColonyBenefit.DRAW_CARDS, quantity: 3});
      const hand = t.p1.cardsInHand.length;
      t.pluto.trade(t.p1);
      runAllActions(t.game);
      expect(t.p1.cardsInHand.length - hand).eq(3);
    });
  });

  describe('the preview — the staged door', () => {
    it('one branch, no chips (the result depends on the tile), and the door with the very prompt the play asks', () => {
      const t = table();
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches).has.lengthOf(1);
      expect(preview.branches[0].effects).deep.eq([]);
      const door = doorOf(t);
      expect(door.sourceCard).eq(CardName.COLONY_SPONSORS);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const live = Server.getPlayerModel(t.p1).waitingFor as SelectColonyModel;
      expect(door.prompt.title).deep.eq(live.title);
      expect(door.prompt.coloniesModel.map((c) => c.name)).deep.eq(live.coloniesModel.map((c) => c.name));
      expect(door.prompt.disabledColonies).deep.eq(live.disabledColonies);
      expect(door.prompt.trackMoves).deep.eq(live.trackMoves);
      expect(door.prompt.choiceContext).deep.eq(live.choiceContext);
    });

    it('is read-only: the game serializes identically before and after', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('the staged play — ONE batch with the addressed colony tail', () => {
    it('the play and the tile land in one POST; the tile is never asked again', () => {
      const t = table();
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const index = menu.options.findIndex((o) => o.title === 'Play project card');
      replayBatch(t.p1, [
        {type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 5})}},
        {type: 'colony', colonyName: ColonyName.LUNA, stagedFor: CardName.COLONY_SPONSORS},
      ]);
      expect(t.luna.trackPosition).eq(6);
      expect(t.p1.getWaitingFor() instanceof SelectColony).is.false;
    });
  });

  describe('what the TABLE is told — the journal row and a rival\'s notification', () => {
    it('one row under the card: «+4» on the colony-tile chip, the position fact as the label', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.LUNA);
      const moved = t.game.events.events.find((e) => e.type === 'colony-track-moved')!;
      const chain = t.game.events.events.filter((e) => e.correlationId === moved.correlationId);
      const rows = buildEventChildren(chain, moved.correlationId!, t.p1.color);
      const row = rows.find((r) => r.political?.kind === 'colonyTrack');
      expect(row?.political).deep.eq({kind: 'colonyTrack', colony: ColonyName.LUNA, before: 2, after: 6});
      expect(row?.chips).deep.eq([{icon: 'colony-tile', text: '+4'}]);
    });
  });
});
