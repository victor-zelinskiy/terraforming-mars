import {expect} from 'chai';
import * as clientCards from '../../src/genfiles/cards.json';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {CardManifest} from '../../src/server/cards/ModuleManifest';
import {FleetDockCard, isFleetDockCard} from '../../src/server/colonies/FleetDock';
import {dockFleet} from '../../src/server/colonies/FleetDockDestination';
import {buildFleetDockPreview} from '../../src/server/colonies/colonyTradePreview';
import {rewardReactionFacts} from '../../src/server/models/effectForecast';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Luna} from '../../src/server/colonies/Luna';
import {Triton} from '../../src/server/colonies/Triton';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {fleetDockEffectNode} from '../../src/client/console/colonyTrade/fleetDockModel';
import {quietResolutionOf, seatEnacted} from '../parliament/parliamentArrange';

/**
 * THE FLEET DOCK CLASS, HELD FOR EVERY DOCK OF THE MANIFESTS — the worklist of
 * the next dock card.
 *
 * `FleetDock.spec.ts` proves the class on a stand-in dock, and each real dock
 * proves its own rules in its own spec; nothing so far stopped a NEW dock from
 * forgetting half of what the class assumes about a card (the state a save
 * keeps, a pure preview, the manifest gate, the client export the «ПРИЧАЛЫ»
 * column stands on, the printed «▲ : [reward]» row the fleet lands on and the
 * card answers with). This spec ENUMERATES the docks — a card is one by
 * declaring `fleetDock`, never by a list here — and asserts those invariants on
 * each, failing with the card's name and the condition. Three docks stand in it
 * since TR27 Aurora Station — the first whose reward ASKS (a card target).
 */
type DockEntry = {name: CardName, module: string, compatibility: unknown, make: () => FleetDockCard};

function manifestDocks(): Array<DockEntry> {
  const docks: Array<DockEntry> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    for (const [name, spec] of CardManifest.entries<IProjectCard>(manifest.projectCards)) {
      const card = new spec.Factory();
      if (isFleetDockCard(card)) {
        docks.push({name, module: manifest.module, compatibility: spec.compatibility, make: () => new spec.Factory() as FleetDockCard});
      }
    }
  }
  return docks;
}

type Table = {game: IGame, player: TestPlayer, card: FleetDockCard};

/** A two-seat Redux table under a QUIET government, the dock in the tableau, one free fleet. */
function table(entry: DockEntry): Table {
  const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  seatEnacted(game.parliament!, quietResolutionOf(PartyName.INDUSTRIALISTS));
  game.colonies = [new Luna(), new Triton()];
  const card = entry.make();
  player.playedCards.push(card);
  return {game, player, card};
}

const DOCKS = manifestDocks();

describe('FleetDock — the class contract, for every dock of the manifests', () => {
  it('the worklist is not empty: Water Hauling, UNMI Liner and Aurora Station stand in it', () => {
    expect(DOCKS.length, 'a guard that iterates nothing proves nothing').greaterThanOrEqual(3);
    expect(DOCKS.map((dock) => dock.name)).to.include.members([CardName.WATER_HAULING, CardName.UNMI_LINER, CardName.AURORA_STATION]);
  });

  it('the client export marks exactly these cards (`ClientCard.fleetDock` — what the «ПРИЧАЛЫ» column reads)', () => {
    const exported = (Object.values(clientCards) as Array<{name?: string, fleetDock?: boolean}>)
      .filter((card) => card !== null && typeof card === 'object' && card.fleetDock === true)
      .map((card) => card.name)
      .sort();
    expect(exported, 'run `npm run make:cards` after adding a dock').deep.eq(DOCKS.map((dock) => dock.name).sort());
  });

  for (const entry of DOCKS) {
    describe(entry.name, () => {
      it('declares the state a save keeps — an OWN `data = {dockedGeneration: -1}`', () => {
        const card = entry.make();
        expect(Object.prototype.hasOwnProperty.call(card, 'data'), `${entry.name}: the deserializer restores only a declared field`).is.true;
        expect(card.data, `${entry.name}: a fresh dock is free`).deep.eq({dockedGeneration: -1});
      });

      it('stands behind the Colonies gate of its manifest', () => {
        const gates = Array.isArray(entry.compatibility) ? entry.compatibility : [entry.compatibility];
        expect(gates, `${entry.name}: a trade destination with no trade in the game`).to.include('colonies');
        expect(gates, `${entry.name}: \`turmoil\` is the classic engine's marker`).not.to.include('turmoil');
      });

      it('its preview is READ-ONLY: the reward, its blocker and its follow-ups change nothing', () => {
        const t = table(entry);
        const before = JSON.stringify(t.game.serialize());
        const events = t.game.events.events.length;
        const queued = t.game.deferredActions.length;
        const log = t.game.gameLog.length;
        t.card.fleetDock.previewEffects(t.player);
        t.card.fleetDock.previewFollowUps?.(t.player);
        t.card.fleetDock.rewardBlockedReason?.(t.player);
        buildFleetDockPreview(t.player, t.card);
        expect(JSON.stringify(t.game.serialize()), `${entry.name}: the preview mutated the game`).eq(before);
        expect(t.game.events.events.length, `${entry.name}: the preview recorded an event`).eq(events);
        expect(t.game.deferredActions.length, `${entry.name}: the preview queued a deferred action`).eq(queued);
        expect(t.game.gameLog.length, `${entry.name}: the preview wrote a log line`).eq(log);
      });

      it('its preview states a reward, and the table\'s answer to it is the forecast engine\'s own', () => {
        const t = table(entry);
        const preview = buildFleetDockPreview(t.player, t.card);
        expect(preview.effects.filter((effect) => effect.direction === 'gain'), `${entry.name}: a dock that pays nothing`).is.not.empty;
        const facts = rewardReactionFacts(t.player, t.card, t.card.fleetDock.previewEffects(t.player));
        expect(preview.forecast?.facts ?? [], `${entry.name}: the forecast's facts are the class's pass over the card's own chips`).deep.eq(facts);
        // The whole forecast is what the stage's R3 «Эффекты» layer opens (PL-060): present exactly when something
        // reacts, no discount and no payment value (a trade's fee is not a card's price), the engine's own coverage.
        expect(preview.forecast !== undefined, `${entry.name}: a forecast exactly when something reacts`).eq(facts.length > 0);
        if (preview.forecast !== undefined) {
          expect(preview.forecast.discounts.final, `${entry.name}: no discount on a trade`).eq(preview.forecast.discounts.base);
          expect(preview.forecast.paymentValues, `${entry.name}: no payment value on a trade`).deep.eq([]);
          expect(preview.forecast.coverage).eq(facts.some((f) => f.certainty === 'unknown') ? 'partial' : 'complete');
        }
      });

      it('under the ruling Greens a TR chip is ANSWERED before the press, and the landing pays exactly that', () => {
        const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
        game.phase = Phase.ACTION;
        expect(game.parliament!.rulingParty(), 'a fresh Redux table: the Greens').eq(PartyName.GREENS);
        game.colonies = [new Luna(), new Triton()];
        const card = entry.make();
        player.playedCards.push(card);
        player.megaCredits = 0;
        const preview = buildFleetDockPreview(player, card);
        const steps = preview.effects.filter((effect) => effect.direction === 'gain' && effect.icon === 'tr').reduce((sum, effect) => sum + effect.amount, 0);
        const promised = (preview.forecast?.facts ?? [])
          .filter((fact) => fact.source.kind === 'party' && fact.recipient.kind === 'you')
          .flatMap((fact) => fact.effects)
          .filter((effect) => effect.icon === 'megacredits' && effect.direction === 'gain')
          .reduce((sum, effect) => sum + effect.amount, 0);
        expect(promised, `${entry.name}: ${steps} TR step(s) under the Greens`).eq(2 * steps);
        dockFleet(player, card);
        runAllActions(game);
        const asked = player.getWaitingFor();
        if (asked instanceof SelectSpace) {
          // A cell with no bonus of its own, so the M€ below is the party's alone.
          player.process({type: 'space', spaceId: (asked.spaces.find((space) => space.bonus.length === 0) ?? asked.spaces[0]).id});
          runAllActions(game);
        }
        expect(player.megaCredits, `${entry.name}: the promise is the payout`).eq(promised);
      });

      it('the landing writes under the card: `fleet-docked`, then whatever the reward records — all sourced by this card', () => {
        const t = table(entry);
        const from = t.game.events.events.length;
        dockFleet(t.player, t.card);
        runAllActions(t.game);
        // A reward with a surface (a placement) is answered on its first legal cell; nothing else is expected to ask here.
        const asked = t.player.getWaitingFor();
        if (asked instanceof SelectSpace) {
          t.player.process({type: 'space', spaceId: asked.spaces[0].id});
          runAllActions(t.game);
        }
        const recorded = t.game.events.events.slice(from);
        expect(recorded[0]?.type, `${entry.name}: the fleet lands BEFORE the reward`).eq('fleet-docked');
        const byCards = recorded.filter((event) => event.source?.kind === 'card');
        expect(byCards.length, `${entry.name}: the reward recorded nothing under a card`).greaterThan(1);
        expect(byCards.filter((event) => event.source?.kind === 'card' && event.source.card !== entry.name).map((event) => event.type),
          `${entry.name}: an event of the landing is attributed to another card`).deep.eq([]);
        expect(t.card.data, `${entry.name}: the stamp`).deep.eq({dockedGeneration: t.game.generation});
        expect(t.player.colonies.usedTradeFleets, `${entry.name}: the fleet is spent`).eq(1);
      });

      it('a reward that ASKS leads the preview with its target, and the landing asks exactly when the preview said it would', () => {
        const t = table(entry);
        if (t.card.fleetDock.rewardTarget === undefined) {
          expect(buildFleetDockPreview(t.player, t.card).followUps.filter((f) => f.kind === 'cardTarget'),
            `${entry.name}: a card target no step stands behind`).deep.eq([]);
          return;
        }
        const target = buildFleetDockPreview(t.player, t.card).followUps[0];
        expect(target?.kind, `${entry.name}: the target is the first follow-up — the landing queues it first`).eq('cardTarget');
        const asks = target?.kind === 'cardTarget' && target.pick !== undefined;
        dockFleet(t.player, t.card);
        runAllActions(t.game);
        expect(t.player.getWaitingFor()?.type === 'card', `${entry.name}: the preview said ${asks ? 'pick' : 'no question'}`).eq(asks);
      });

      it('prints the «▲ : [reward]» row the fleet lands on, with a reward icon on its result side', () => {
        const card = entry.make();
        const node = fleetDockEffectNode(card.metadata.renderData);
        expect(node, `${entry.name}: no effect row whose cause holds the TRADE glyph — the fleet has no ▲ to land on`).is.not.undefined;
        // rows: [cause, delimiter, result] — the result holds at least one printed item (the icon the impulse lands on).
        const result = node!.rows[node!.rows.length - 1] ?? [];
        expect(result.filter((item) => isICardRenderItem(item)), `${entry.name}: the effect's result side prints no icon`).is.not.empty;
      });
    });
  }
});
