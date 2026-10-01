import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {GameEvent} from '../../src/common/events/GameEvent';
import {SkippedEffectFact} from '../../src/common/events/EventImpact';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {SKIP_REASON, SKIPPED_LABEL} from '../../src/server/cards/actionPreviews';
import {AddResourcesToCards} from '../../src/server/deferredActions/AddResourcesToCards';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {RemoveResourcesFromCard} from '../../src/server/deferredActions/RemoveResourcesFromCard';
import {fakeCard, runAllActions} from '../TestingUtils';
import {SupremeExpertise} from '../../src/server/cards/turmoilRedux/SupremeExpertise';
import {PoliticalScience} from '../../src/server/cards/turmoilRedux/PoliticalScience';
import {ImportedNitrogen} from '../../src/server/cards/base/ImportedNitrogen';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {HeatTrappers} from '../../src/server/cards/base/HeatTrappers';
import {HiredRaiders} from '../../src/server/cards/base/HiredRaiders';
import {Sabotage} from '../../src/server/cards/base/Sabotage';
import {Virus} from '../../src/server/cards/base/Virus';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {EcologyResearch} from '../../src/server/cards/colonies/EcologyResearch';
import {CometForVenus} from '../../src/server/cards/venusNext/CometForVenus';
import {VenusianPlants} from '../../src/server/cards/venusNext/VenusianPlants';
import {FreyjaBiodomes} from '../../src/server/cards/venusNext/FreyjaBiodomes';
import {AirScrappingExpedition} from '../../src/server/cards/venusNext/AirScrappingExpedition';
import {PlaceDelegatesOnResolution} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {NEUTRAL_DELEGATE_ICON, POPULAR_SUPPORT_LABEL, SUPPORT_LIMIT_REASON} from '../../src/common/parliament/ParliamentTypes';
import {SelectPartyModel} from '../../src/common/models/PlayerInputModel';
import {Server} from '../../src/server/models/ServerModel';
import {SkyDocks} from '../../src/server/cards/colonies/SkyDocks';
import {FLEET_LIMIT_REASON, GAIN_TRADE_FLEET_LABEL, TRADE_FLEET_ICON} from '../../src/server/colonies/tradeFleetGain';
import {MAX_FLEET_SIZE} from '../../src/common/constants';
import {Phase} from '../../src/common/Phase';
import {ColonySponsors} from '../../src/server/cards/turmoilRedux/ColonySponsors';
import {COLONY_TRACK_LABEL, EVERY_COLONY_TRACK_AT_TOP_REASON} from '../../src/server/deferredActions/MaximizeColonyTrack';
import {trackTop} from '../../src/common/colonies/ColonyMetadata';

/**
 * NO SILENT LOSS — THE LIVE HALF, as a CLASS.
 *
 * The play preview warns BEFORE the commit that an effect will be skipped
 * (`skipped: {label, effect}`). Every step that finds no holder / no target at
 * EXECUTION must now say so AFTER the fact too: exactly one `effect-skipped`
 * event per lost effect (the journal row, the notification line) plus one log
 * line — and in the SAME words the preview used, so the promise and the record
 * cannot read apart. The table below is the class: every shared step and every
 * bespoke card that owned a silent return. Solo (the neutral-opponent rule), a
 * composer borrowing a step's prompt, a removal from one's OWN card (a cost)
 * and a present holder all record nothing; building a preview records nothing
 * (read-only).
 */

function skipsOf(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-skipped');
}

function factsOf(game: IGame): Array<SkippedEffectFact> {
  return skipsOf(game).map((e) => e.impact.skipped!);
}

/** The preview's own warnings — what the record must repeat. */
function previewSkips(player: TestPlayer, card: IProjectCard): Array<{label: string, effect?: {direction: string, icon: string, amount: number, note?: string}}> {
  const steps: Array<ActionPreviewStep> = cardPlayPreview(player, card).branches.flatMap((b) => b.steps);
  return steps
    .filter((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning')
    .map((s) => (s as {skipped?: {label: string, effect?: {direction: string, icon: string, amount: number, note?: string}}}).skipped!)
    .filter((s) => s !== undefined);
}

/** Play `card` for real (the live scope), then drain what it deferred. */
function play(game: IGame, player: TestPlayer, card: IProjectCard): void {
  player.playCard(card);
  runAllActions(game);
}

type Scenario = {
  name: string,
  card: () => IProjectCard,
  arrange?: (game: IGame, player: TestPlayer, opponent: TestPlayer) => void,
  /** The facts the play must record, in order. */
  expected: Array<SkippedEffectFact>,
};

const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: 'Supreme Expertise (declarative add-to-any-card) — no data holder',
    card: () => new SupremeExpertise(),
    expected: [{label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'data', amount: 4, note: 'to a card'}}],
  },
  {
    name: 'Imported Nitrogen — BOTH additions lost, each named, in execution order',
    card: () => new ImportedNitrogen(),
    expected: [
      {label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'microbe', amount: 3, note: 'to a card'}},
      {label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'animal', amount: 2, note: 'to a card'}},
    ],
  },
  {
    name: 'Ecology Research (bespoke → the shared step) — the animal and the microbes',
    card: () => new EcologyResearch(),
    expected: [
      {label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'animal', amount: 1, note: 'to a card'}},
      {label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'microbe', amount: 2, note: 'to a card'}},
    ],
  },
  {
    name: 'Air-Scrapping Expedition (bespoke) — no Venus floater card',
    card: () => new AirScrappingExpedition(),
    expected: [{label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'floater', amount: 3, note: 'to a card'}}],
  },
  {
    name: 'Venusian Plants (bespoke) — microbe OR animal, so the label alone',
    card: () => new VenusianPlants(),
    expected: [{label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder}],
  },
  {
    name: 'Freyja Biodomes (bespoke) — microbes OR animals, so the label alone',
    card: () => new FreyjaBiodomes(),
    expected: [{label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder}],
  },
  {
    name: 'Asteroid (declarative plant removal) — nobody has plants',
    card: () => new Asteroid(),
    expected: [{label: SKIPPED_LABEL.removePlants, reason: SKIP_REASON.noTarget, effect: {direction: 'cost', icon: Resource.PLANTS, amount: 3}}],
  },
  {
    name: 'Heat Trappers (declarative production attack) — nobody has heat production',
    card: () => new HeatTrappers(),
    expected: [{label: SKIPPED_LABEL.reduceProduction, reason: SKIP_REASON.noTarget, effect: {direction: 'cost', icon: Resource.HEAT, amount: 2, note: 'production'}}],
  },
  {
    name: 'Hired Raiders (bespoke steal) — nobody has steel or M€',
    card: () => new HiredRaiders(),
    arrange: (_game, _player, opponent) => {
      opponent.megaCredits = 0;
    },
    expected: [{label: SKIPPED_LABEL.stealResources, reason: SKIP_REASON.noTarget}],
  },
  {
    name: 'Sabotage (bespoke removal) — nobody has titanium, steel or M€',
    card: () => new Sabotage(),
    arrange: (_game, _player, opponent) => {
      opponent.megaCredits = 0;
    },
    expected: [{label: SKIPPED_LABEL.removeResources, reason: SKIP_REASON.noTarget}],
  },
  {
    name: 'Comet for Venus (bespoke removal) — no opponent with a Venus tag',
    card: () => new CometForVenus(),
    expected: [{label: SKIPPED_LABEL.removeResources, reason: SKIP_REASON.noTarget, effect: {direction: 'cost', icon: Resource.MEGACREDITS, amount: 4}}],
  },
  {
    name: 'Virus (bespoke either/or removal) — no animals, no plants',
    card: () => new Virus(),
    expected: [{label: SKIPPED_LABEL.removeAnimalsOrPlants, reason: SKIP_REASON.noTarget}],
  },
  {
    // The engine's `increaseFleetSize` caps at four WITHOUT a word; the class (`behavior.colonies.addTradeFleet`)
    // names the fleet the cap cut — the chip reads «4 → 4 · limit» before the play, the record after it.
    name: 'Sky Docks (declarative «gain a trade fleet») — the fleet is already at its maximum of four',
    card: () => new SkyDocks(),
    arrange: (_game, player) => {
      player.colonies.setFleetSize(MAX_FLEET_SIZE);
    },
    expected: [{label: GAIN_TRADE_FLEET_LABEL, reason: FLEET_LIMIT_REASON, effect: {direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1}}],
  },
  {
    // A target-dependent loss with no magnitude: the steps are the chosen tile's, and there is no tile.
    name: 'Colony Sponsors (the shared «set the chosen colony track to its top») — every active track at its top',
    card: () => new ColonySponsors(),
    arrange: (game) => {
      for (const colony of game.colonies) {
        colony.trackPosition = trackTop(colony.metadata);
      }
    },
    expected: [{label: COLONY_TRACK_LABEL, reason: EVERY_COLONY_TRACK_AT_TOP_REASON}],
  },
  {
    name: 'Virus — the only plants are PROTECTED: the cause says so',
    card: () => new Virus(),
    arrange: (_game, _player, opponent) => {
      opponent.plants = 5;
      opponent.playedCards.push(new ProtectedHabitats());
    },
    expected: [{label: SKIPPED_LABEL.removeAnimalsOrPlants, reason: SKIP_REASON.plantsProtected}],
  },
];

describe('skipped effects — the live record (no silent loss, after the fact)', () => {
  for (const scenario of SCENARIOS) {
    describe(scenario.name, () => {
      let game: IGame;
      let player: TestPlayer;
      let opponent: TestPlayer;

      beforeEach(() => {
        [game, player, opponent] = testGame(2, {venusNextExtension: true, coloniesExtension: true});
        scenario.arrange?.(game, player, opponent);
      });

      it('the preview promised it — and building the preview recorded nothing', () => {
        const before = game.events.events.length;
        const promised = previewSkips(player, scenario.card());
        expect(game.events.events.length, 'a preview is read-only').eq(before);
        expect(promised.map((s) => s.label)).deep.eq(scenario.expected.map((f) => f.label));
      });

      it('the play records one named fact per lost effect, in the preview\'s own words', () => {
        const card = scenario.card();
        const promised = previewSkips(player, card);
        play(game, player, card);
        const facts = factsOf(game);
        expect(facts).deep.eq(scenario.expected);
        // The record repeats the promise: the same label, the same magnitude.
        facts.forEach((fact, i) => {
          expect(fact.label).eq(promised[i].label);
          if (promised[i].effect !== undefined) {
            expect(fact.effect).deep.include({direction: promised[i].effect!.direction, icon: promised[i].effect!.icon, amount: promised[i].effect!.amount});
          } else {
            expect(fact.effect, 'no chip promised, none recorded').is.undefined;
          }
        });
        // Owned by the actor, journal-visible, inside the play's own chain.
        for (const e of skipsOf(game)) {
          expect(e.player).eq(player.color);
          expect(e.visibility).eq('journal');
          const root = game.events.events.find((r) => r.id === e.correlationId);
          expect(root?.source, 'the skip joins the play\'s chain').deep.include({card: card.name});
        }
        // …and every reader of the text log gets the same statement.
        const lines = game.gameLog.filter((m) => m.message === '${0} — effect skipped: ${1} (${2})');
        expect(lines).has.lengthOf(scenario.expected.length);
      });
    });
  }

  describe('what records NOTHING', () => {
    it('a fleet gain with ROOM under the cap — the fleet arrives, the chip says so, nothing is skipped', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      const card = new SkyDocks();
      expect(previewSkips(player, card)).deep.eq([]);
      const chip = cardPlayPreview(player, card).branches[0].effects.find((e) => e.icon === TRADE_FLEET_ICON);
      expect(chip).deep.eq({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 1, resulting: 2});
      player.playCard(card);
      runAllActions(game);
      expect(player.colonies.getFleetSize()).eq(2);
      expect(factsOf(game)).deep.eq([]);
    });

    it('…and AT the cap the chip is honest: «4 → 4 · limit»', () => {
      const [, player] = testGame(2, {coloniesExtension: true});
      player.colonies.setFleetSize(MAX_FLEET_SIZE);
      const chip = cardPlayPreview(player, new SkyDocks()).branches[0].effects.find((e) => e.icon === TRADE_FLEET_ICON);
      expect(chip).deep.eq({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 4, resulting: 4, note: 'limit'});
    });

    it('a holder present — the resource lands, nothing is skipped', () => {
      const [game, player] = testGame(2);
      player.playedCards.push(new PoliticalScience());
      player.playCard(new SupremeExpertise());
      runAllActions(game);
      expect(factsOf(game)).deep.eq([]);
    });

    it('solo — an attack on the neutral opponent is the rule, not a loss (the preview is silent there too)', () => {
      for (const card of [new Asteroid(), new Sabotage(), new Virus(), new CometForVenus(), new HeatTrappers()]) {
        const [game, player] = testGame(1, {venusNextExtension: true});
        expect(previewSkips(player, card), `${card.name}: no warning in solo`).deep.eq([]);
        play(game, player, card);
        expect(factsOf(game), `${card.name}: no record in solo`).deep.eq([]);
      }
    });

    it('a COMPOSER borrowing a removal\'s prompt: Virus with no animal card but an opponent\'s plants — the choice stands, nothing is skipped', () => {
      const [game, player, opponent] = testGame(2);
      opponent.plants = 5;
      player.playCard(new Virus());
      runAllActions(game);
      expect(player.popWaitingFor(), 'the plant removal is asked').is.not.undefined;
      expect(factsOf(game)).deep.eq([]);
    });

    it('a removal from the player\'s OWN card is a cost, gated before it is asked — never a skip', () => {
      const [game, player] = testGame(2);
      new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}).execute();
      expect(factsOf(game)).deep.eq([]);
    });
  });

  describe('the shared steps, driven directly', () => {
    it('AddResourcesToCards (the distribution) — the whole N is named', () => {
      const [game, player] = testGame(2);
      new AddResourcesToCards(player, CardResource.FLOATER, 3).execute();
      expect(factsOf(game)).deep.eq([{label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'floater', amount: 3, note: 'to a card'}}]);
    });

    it('StealResources — nobody to steal from', () => {
      const [game, player] = testGame(2);
      new StealResources(player, Resource.STEEL, 2).execute();
      expect(factsOf(game)).deep.eq([{label: SKIPPED_LABEL.stealResources, reason: SKIP_REASON.noTarget, effect: {direction: 'cost', icon: Resource.STEEL, amount: 2}}]);
    });

    it('RemoveResourcesFromCard from the opponents — no card to take from', () => {
      const [game, player] = testGame(2);
      new RemoveResourcesFromCard(player, CardResource.ANIMAL, 2, {source: 'opponents'}).execute();
      expect(factsOf(game)).deep.eq([{label: SKIPPED_LABEL.removeResources, reason: SKIP_REASON.noTarget, effect: {direction: 'cost', icon: 'animal', amount: 2}}]);
    });

    it('…and its composer door (composedPrompt) records nothing', () => {
      const [game, player] = testGame(2);
      new RemoveResourcesFromCard(player, CardResource.ANIMAL, 2, {source: 'opponents'}).composedPrompt();
      expect(factsOf(game)).deep.eq([]);
    });

    it('an untyped removal («any resource») names the effect without a chip', () => {
      const [game, player] = testGame(2);
      new RemoveResourcesFromCard(player, undefined, 1, {source: 'opponents'}).execute();
      expect(factsOf(game)).deep.eq([{label: SKIPPED_LABEL.removeResources, reason: SKIP_REASON.noTarget}]);
    });

    it('PlaceDelegatesOnResolution with «then N neutral delegates to the party» — a full support area is named at the ANSWER, in the words of the prompt', () => {
      // The loss depends on the TARGET, so the promise is the prompt's per-party row (`votePrompt.support`,
      // `gained: 0` + what cut it) rather than a preview warning — and the record repeats it.
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      const party = parliament.partiesInVotingArea()[0];
      parliament.popularSupport.set(party, 3);
      game.defer(new PlaceDelegatesOnResolution(player, 1, {kind: 'card', card: 'A card that adds a delegate' as CardName}, {support: 3}));
      runAllActions(game);
      const prompt = Server.getPlayerModel(player).waitingFor as SelectPartyModel;
      const promised = prompt.votePrompt!.support!.find((row) => row.party === party)!;
      expect(promised).deep.include({gained: 0, printed: 3, limit: 'area'});
      expect(factsOf(game), 'asking records nothing').deep.eq([]);
      player.process({type: 'party', partyName: party});
      expect(factsOf(game)).deep.eq([{label: POPULAR_SUPPORT_LABEL, reason: SUPPORT_LIMIT_REASON.area, effect: {direction: 'gain', icon: NEUTRAL_DELEGATE_ICON, amount: promised.printed}}]);
    });

    it('a card with a Venus tag in the way does not change the rule (a restricted pick with no candidate is still a named loss)', () => {
      const [game, player] = testGame(2);
      player.playedCards.push(fakeCard({name: 'A plain floater holder' as CardName, resourceType: CardResource.FLOATER, tags: [Tag.SPACE]}));
      player.playCard(new AirScrappingExpedition());
      runAllActions(game);
      expect(factsOf(game).map((f) => f.effect?.icon)).deep.eq(['floater']);
    });
  });
});
