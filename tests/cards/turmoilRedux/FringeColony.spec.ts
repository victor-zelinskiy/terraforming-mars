import {expect} from 'chai';
import {FringeColony} from '../../../src/server/cards/turmoilRedux/FringeColony';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {Game} from '../../../src/server/Game';
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
import {Europa} from '../../../src/server/colonies/Europa';
import {Io} from '../../../src/server/colonies/Io';
import {Enceladus} from '../../../src/server/colonies/Enceladus';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {
  COLONY_ON_NEW_TILE_LABEL, COLONY_TILE_LABEL, NO_VACANT_COLONY_TILE_REASON, REPLACE_COLONY_TILE_TITLE,
} from '../../../src/server/deferredActions/ReplaceColonyTile';
import {COLONY_TILE_HAS_COLONIES_REASON, COLONY_TILE_HAS_FLEET_REASON} from '../../../src/server/colonies/ColoniesHandler';
import {ActionPreviewStep, StagedColonyModel} from '../../../src/common/models/ActionPreviewModel';
import {SelectColonyModel} from '../../../src/common/models/PlayerInputModel';
import {Server} from '../../../src/server/models/ServerModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';

/**
 * TR10 — FRINGE COLONY: «This can only be played during generation 4 or
 * later. Remove from play a colony tile that has NO COLONIES, TILES, OR TRADE
 * FLEETS ON IT. Replace it with a new colony tile of your choice, and place a
 * colony on it, if possible.» Every rule reading of the card file's header is
 * pinned here; the shared step is pinned by
 * tests/deferredActions/ReplaceColonyTile.spec.ts, the roster's writers by
 * tests/colonies/ColonyRoster.spec.ts and the staged tail by
 * tests/inputs/deferredInputBatch.spec.ts § the replacement.
 */
type Table = {
  game: IGame, p1: TestPlayer, p2: TestPlayer, card: FringeColony,
  ceres: Ceres, europa: Europa, luna: Luna, titan: Titan, enceladus: Enceladus, io: Io,
};

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  const ceres = new Ceres();
  const europa = new Europa();
  const luna = new Luna();
  const titan = new Titan();
  const enceladus = new Enceladus();
  const io = new Io();
  // In play: an empty tile, a tile with the RIVAL's colony, a tile with a fleet, an inactive empty tile.
  game.colonies = [ceres, europa, luna, titan];
  europa.colonies.push(p2.id);
  luna.visitor = p2.id;
  // The reserve: a tile that needs a microbe card nobody has, and one active by its class.
  game.discardedColonies = [enceladus, io];
  game.generation = 4;
  const card = new FringeColony();
  p1.cardsInHand.push(card);
  p1.megaCredits = 30;
  return {game, p1, p2, card, ceres, europa, luna, titan, enceladus, io};
}

function names(t: Table): Array<ColonyName> {
  return t.game.colonies.map((c) => c.name);
}

/** The play through the REAL door — the action menu — so the chain has its root (the journal's scope). */
function play(t: Table): SelectColony {
  t.p1.takeAction();
  const menu = cast(t.p1.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  t.p1.process({type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 24})}});
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectColony);
}

/** Answer the card's own question by the wire, as the client does — ONE answer naming both tiles. */
function answer(t: Table, incoming: ColonyName, replaces: ColonyName): void {
  t.p1.process({type: 'colony', colonyName: incoming, replaces});
  runAllActions(t.game);
}

function doorOf(t: Table): StagedColonyModel {
  const steps: ReadonlyArray<ActionPreviewStep> = cardPlayPreview(t.p1, t.card).branches[0].steps;
  const door = steps.find((s) => s.kind === 'colonyPick');
  expect(door, 'the play carries the colony door').is.not.undefined;
  return (door as Extract<ActionPreviewStep, {kind: 'colonyPick'}>).staged;
}

function skips(t: Table) {
  return t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
}

describe('FringeColony', () => {
  describe('the card as printed', () => {
    it('is AUTOMATED for 24 with Jovian + Space, «GEN 4+», 1 VP, TR10 — «− [tile]* + [tile] [colony]*»', () => {
      const card = new FringeColony();
      expect(card.name).eq(CardName.FRINGE_COLONY);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(24);
      expect(card.tags).deep.eq([Tag.JOVIAN, Tag.SPACE]);
      expect(card.victoryPoints).eq(1);
      expect(card.requirements).deep.eq([{generation: 4, count: 4}]);
      expect(card.metadata.cardNumber).eq('TR10');
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows, 'ONE row, as printed').has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => item.type).filter((type) => type !== CardRenderItemType.NBSP))
        .deep.eq([CardRenderItemType.COLONY_TILE, CardRenderItemType.COLONY_TILE, CardRenderItemType.COLONIES]);
    });

    it('needs Colonies (the grey ▲) and declares no Turmoil compatibility (the module is the gate)', () => {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.FRINGE_COLONY];
      expect(entry.compatibility).eq('colonies');
    });
  });

  describe('rule 1 — the game\'s clock', () => {
    it('unplayable before the 4th generation, and the reason names the «now»', () => {
      const t = table();
      t.game.generation = 3;
      expect(t.p1.canPlay(t.card)).is.false;
      const reasons = unplayableReasons(t.p1, t.card);
      expect(reasons).has.lengthOf(1);
      expect(reasons[0]).deep.include({type: 'count', message: 'Requires generation ${0} or later', params: ['4'], current: 3, requirement: true});
      expect(reasons[0].requirementKey).eq(`req:${RequirementType.GENERATION}`);
    });

    it('playable from the 4th', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
      t.game.generation = 9;
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rules 2–4 — who may leave, who may not, what enters', () => {
    it('the play asks the card\'s own question: every tile in play with its ONE reason, the reserve with its projection', () => {
      const t = table();
      const prompt = play(t);
      expect(prompt.title).eq(REPLACE_COLONY_TILE_TITLE);
      expect(prompt.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FRINGE_COLONY});
      expect(prompt.colonies.map((c) => c.name), 'the selectable tiles are the RESERVE').deep.eq([ColonyName.ENCELADUS, ColonyName.IO]);
      expect(prompt.rosterChange).deep.eq({
        kind: 'replace',
        outgoing: [
          {colony: ColonyName.CERES},
          {colony: ColonyName.EUROPA, reason: COLONY_TILE_HAS_COLONIES_REASON},
          {colony: ColonyName.LUNA, reason: COLONY_TILE_HAS_FLEET_REASON},
          // Inactive and empty — a lawful candidate.
          {colony: ColonyName.TITAN},
        ],
        incoming: [
          {colony: ColonyName.ENCELADUS, entersActive: false, build: {skipped: 'Colony is inactive'}},
          {colony: ColonyName.IO, entersActive: true, build: {slot: 0}},
        ],
      });
    });

    it('nothing happens before the answer — a single candidate is still CHOSEN, never auto-picked', () => {
      const t = table();
      t.titan.colonies.push(t.p2.id);
      const prompt = play(t);
      expect(prompt.rosterChange?.outgoing?.filter((tile) => tile.reason === undefined)).deep.eq([{colony: ColonyName.CERES}]);
      expect(names(t)).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(t.game.events.events.filter((e) => e.type === 'colony-roster-changed')).deep.eq([]);
    });

    it('a tile that cannot leave is refused with ITS reason; the question stands', () => {
      const t = table();
      play(t);
      expect(() => t.p1.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.EUROPA})).to.throw(COLONY_TILE_HAS_COLONIES_REASON);
      expect(() => t.p1.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.LUNA})).to.throw(COLONY_TILE_HAS_FLEET_REASON);
      expect(() => t.p1.process({type: 'colony', colonyName: ColonyName.IO})).to.throw('No colony tile to replace selected');
      cast(t.p1.getWaitingFor(), SelectColony);
    });
  });

  describe('rules 5–6 — the swap in place, then the colony', () => {
    it('the new tile takes the removed tile\'s SLOT; the player\'s colony stands on it with its build bonus; the card is played and paid', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.IO, ColonyName.CERES);
      expect(names(t)).deep.eq([ColonyName.IO, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(t.game.discardedColonies.map((c) => c.name)).deep.eq([ColonyName.CERES, ColonyName.ENCELADUS]);
      expect(t.io.colonies).deep.eq([t.p1.id]);
      expect(t.io.isActive).is.true;
      expect(t.p1.production.heat, 'Io\'s build bonus').eq(1);
      expect(t.p1.tableau.has(CardName.FRINGE_COLONY)).is.true;
      expect(t.p1.megaCredits).eq(6);
      expect(skips(t)).deep.eq([]);
      expect(t.p1.getWaitingFor() instanceof SelectColony, 'ONE question, ONE answer').is.false;
    });

    it('rule 9 — the journal: ONE line and ONE roster event in the play\'s chain, sourced by the card; then the build\'s own line', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.IO, ColonyName.CERES);
      const lines = t.game.gameLog.filter((m) => m.message === '${0} replaced the ${1} colony tile with ${2}');
      expect(lines).has.lengthOf(1);
      expect(lines[0].data.map((d) => d.value)).deep.eq([t.p1.color, ColonyName.CERES, ColonyName.IO]);
      const changed = t.game.events.events.filter((e) => e.type === 'colony-roster-changed');
      expect(changed).has.lengthOf(1);
      expect(changed[0].impact.colonyRoster).deep.eq({kind: 'replace', removed: ColonyName.CERES, added: ColonyName.IO, slot: 0});
      expect(changed[0].player).eq(t.p1.color);
      const root = t.game.events.events.find((e) => e.id === changed[0].correlationId);
      expect(root?.source, 'the change joins the play\'s chain, sourced by the card').deep.include({card: CardName.FRINGE_COLONY});
      const order = t.game.gameLog.map((m) => m.message);
      expect(order.indexOf('${0} built a colony on ${1}')).greaterThan(order.indexOf('${0} replaced the ${1} colony tile with ${2}'));
    });

    it('the removed tile lies in the reserve as in the box — the same after a save/load', () => {
      const t = table();
      t.ceres.trackPosition = 5;
      play(t);
      answer(t, ColonyName.IO, ColonyName.CERES);
      const boxed = t.game.discardedColonies.find((c) => c.name === ColonyName.CERES)!;
      expect(boxed.trackPosition).eq(1);
      expect(boxed.colonies).deep.eq([]);
    });

    it('«if possible» — a tile that enters inactive takes the slot and the colony is a NAMED skip', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.ENCELADUS, ColonyName.TITAN);
      expect(names(t)).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.ENCELADUS]);
      expect(t.enceladus.isActive).is.false;
      expect(t.enceladus.colonies).deep.eq([]);
      expect(skips(t)).deep.eq([{label: COLONY_ON_NEW_TILE_LABEL, reason: 'Colony is inactive'}]);
      expect(t.p1.tableau.has(CardName.FRINGE_COLONY)).is.true;
    });
  });

  describe('rule 7 — nothing to replace', () => {
    function occupyAll(t: Table) {
      t.ceres.colonies.push(t.p1.id);
      t.titan.visitor = t.p2.id;
    }

    it('the card stays playable; the play records a NAMED skip and asks nothing', () => {
      const t = table();
      occupyAll(t);
      expect(t.p1.canPlay(t.card)).is.true;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor() instanceof SelectColony).is.false;
      expect(skips(t)).deep.eq([{label: COLONY_TILE_LABEL, reason: NO_VACANT_COLONY_TILE_REASON}]);
      expect(t.p1.tableau.has(CardName.FRINGE_COLONY)).is.true;
    });

    it('…and the preview says so BEFORE the play: no door, the warning in the record\'s own words', () => {
      const t = table();
      occupyAll(t);
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.map((s) => s.kind)).deep.eq(['note']);
      expect(steps[0]).deep.include({noteKind: 'warning', text: NO_VACANT_COLONY_TILE_REASON, skipped: {label: COLONY_TILE_LABEL}});
    });
  });

  describe('rule 8 — not a trade, not an extra tile', () => {
    it('the number of tiles, the fleets and the other tracks are untouched', () => {
      const t = table();
      t.europa.trackPosition = 4;
      const used = t.p1.colonies.usedTradeFleets;
      play(t);
      answer(t, ColonyName.IO, ColonyName.CERES);
      expect(t.game.colonies).has.lengthOf(4);
      expect(t.europa.trackPosition).eq(4);
      expect(t.luna.visitor).eq(t.p2.id);
      expect(t.p1.colonies.usedTradeFleets).eq(used);
    });
  });

  describe('the preview — the staged door', () => {
    it('one branch, no chips (the result depends on the tiles), and the door with the very prompt the play asks', () => {
      const t = table();
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches).has.lengthOf(1);
      expect(preview.branches[0].effects).deep.eq([]);
      const door = doorOf(t);
      expect(door.sourceCard).eq(CardName.FRINGE_COLONY);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const live = Server.getPlayerModel(t.p1).waitingFor as SelectColonyModel;
      expect(door.prompt.title).deep.eq(live.title);
      expect(door.prompt.purpose).eq(live.purpose);
      expect(door.prompt.coloniesModel).deep.eq(live.coloniesModel);
      expect(door.prompt.rosterChange).deep.eq(live.rosterChange);
      expect(door.prompt.choiceContext).deep.eq(live.choiceContext);
    });

    it('is read-only: the game serializes identically before and after', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('the staged play — ONE batch with the addressed replacement tail', () => {
    it('the play and both tiles land in one POST; nothing is asked again', () => {
      const t = table();
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const index = menu.options.findIndex((o) => o.title === 'Play project card');
      replayBatch(t.p1, [
        {type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 24})}},
        {type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.CERES, stagedFor: CardName.FRINGE_COLONY},
      ]);
      runAllActions(t.game);
      expect(names(t)).deep.eq([ColonyName.IO, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(t.io.colonies).deep.eq([t.p1.id]);
      expect(t.p1.getWaitingFor() instanceof SelectColony).is.false;
    });
  });

  describe('what the TABLE is told — the journal row', () => {
    it('one row under the card names both tiles; a replacement moves no count, so it carries no chip', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.IO, ColonyName.CERES);
      const changed = t.game.events.events.find((e) => e.type === 'colony-roster-changed')!;
      const chain = t.game.events.events.filter((e) => e.correlationId === changed.correlationId);
      const rows = buildEventChildren(chain, changed.correlationId!, t.p1.color);
      const row = rows.find((r) => r.political?.kind === 'colonyRoster');
      expect(row?.political).deep.eq({kind: 'colonyRoster', change: {kind: 'replace', removed: ColonyName.CERES, added: ColonyName.IO, slot: 0}});
      expect(row?.chips).deep.eq([]);
    });
  });

  describe('save / load', () => {
    it('the swapped table survives a round trip: the slot, the colony, the reserve', () => {
      const t = table();
      play(t);
      answer(t, ColonyName.IO, ColonyName.CERES);
      const restored = Game.deserialize(structuredClone(t.game.serialize()));
      expect(restored.colonies.map((c) => c.name)).deep.eq([ColonyName.IO, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(restored.colonies[0].colonies).deep.eq([t.p1.id]);
      expect(restored.discardedColonies.map((c) => c.name)).includes(ColonyName.CERES);
      expect(restored.discardedColonies.map((c) => c.name)).does.not.include(ColonyName.IO);
      expect(restored.players[0].tableau.has(CardName.FRINGE_COLONY)).is.true;
    });
  });
});
