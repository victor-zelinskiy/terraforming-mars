import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {DELTA_STAGE_NAMES} from '../../src/common/delta/deltaStages';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {commitDeltaMovement, commitDeltaRetreat, plannedDeltaMovement, resolveDeltaMovementBonuses} from '../../src/server/delta/deltaMovement';
import {SocialHeating} from '../../src/server/cards/delta/SocialHeating';
import {DevelopmentManager} from '../../src/server/cards/delta/DevelopmentManager';
import {IGame} from '../../src/server/IGame';
import {fakeCard} from '../TestingUtils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * THE ONE POSITION WRITE.
 *
 * Whether «any player moved» is answerable at all comes down to a source-level
 * fact: nothing may assign a Hydronetwork position except the movement ledger.
 * Before it existed, MarsBot wrote `progress.position` itself and published
 * nothing — the whole class of «somebody moved» rules was quietly bot-blind.
 *
 * This guard reads the source and fails with the offending file, so a future
 * mover (a second bot, a card that repositions a marker) cannot re-open that
 * hole by accident. Deserialization is the one legitimate exception: it
 * assigns the whole `deltaProjectData` object, which is state RESTORATION and
 * deliberately publishes nothing.
 */
describe('the Delta Project movement ledger', () => {
  describe('is the only writer of a track position', () => {
    /** `<something>.position = …` on a Delta progress object, in server source. */
    const ASSIGNMENT = /(progress|deltaProjectData!?|deltaProjectData\?)\s*\.\s*position\s*=[^=]/;
    const ALLOWED: ReadonlySet<string> = new Set([
      // The ledger itself.
      path.join('src', 'server', 'delta', 'deltaMovement.ts'),
    ]);

    function sourceFiles(dir: string): Array<string> {
      const out: Array<string> = [];
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...sourceFiles(full));
        } else if (entry.name.endsWith('.ts')) {
          out.push(full);
        }
      }
      return out;
    }

    it('no other server file assigns a Hydronetwork position', () => {
      const offenders: Array<string> = [];
      for (const file of sourceFiles(path.join(ROOT, 'src', 'server'))) {
        const relative = path.relative(ROOT, file);
        if (ALLOWED.has(relative)) {
          continue;
        }
        const raw = fs.readFileSync(file, 'utf8');
        // Cheap pre-filter first: the comment strip below is the expensive
        // part, and the whole server tree is walked on every run.
        if (!raw.includes('.position')) {
          continue;
        }
        const source = raw
          // Comments are prose, not code.
          .replace(/[/][*][^]*?[*][/]/g, '')
          .split('\n').map((l) => l.replace(/[/][/].*$/, '')).join('\n');
        if (ASSIGNMENT.test(source)) {
          offenders.push(relative);
        }
      }
      expect(offenders, `These files write a Hydronetwork position directly instead of going ` +
        `through commitDeltaMovement (src/server/delta/deltaMovement.ts):\n${offenders.join('\n')}`).to.deep.eq([]);
      // A full walk of `src/server` can outrun the 2 s default on a cold disk.
    }).timeout(30000);
  });

  describe('the fact itself', () => {
    let game: IGame;
    let player: TestPlayer;
    let opponent: TestPlayer;

    beforeEach(() => {
      [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
    });

    it('reports the COMMITTED distance, its cause and a unique key', () => {
      const movement = commitDeltaMovement(player, 3, {kind: 'card', card: CardName.STORM_SURGE_BARRIER})!;
      expect(movement.from).to.eq(0);
      expect(movement.to).to.eq(3);
      expect(movement.steps).to.eq(3);
      expect(movement.requested).to.eq(3);
      expect(movement.cause).to.deep.eq({kind: 'card', card: CardName.STORM_SURGE_BARRIER});
      expect(movement.generation).to.eq(game.generation);
      expect(movement.key).to.eq(`${player.color}:0->3`);
    });

    it('a key is never repeated for one player (positions only increase)', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 4; i++) {
        keys.add(commitDeltaMovement(player, 1, {kind: 'standard'})!.key);
      }
      expect(keys.size).to.eq(4);
    });

    it('refuses to run off the end of the track', () => {
      player.deltaProjectData!.position = DELTA_STAGE_NAMES.length - 1;
      expect(() => commitDeltaMovement(player, 1, {kind: 'standard'})).to.throw(/end of the track/);
    });

    it('the track tables it reads stay parallel', () => {
      expect(DELTA_TRACK_TAGS).to.have.length(DELTA_STAGE_NAMES.length);
    });

    it('publishes the mover’s own hooks BEFORE the table-wide ones', () => {
      const order: Array<string> = [];
      player.playedCards.push(fakeCard({
        tags: [Tag.BUILDING],
        onDeltaTrackAdvance: () => {
          order.push('mover-hook');
        },
        deltaMovementBonus: () => {
          order.push('bonus');
          return undefined;
        },
      }));
      commitDeltaMovement(player, 2, {kind: 'standard'});
      expect(order).to.deep.eq(['mover-hook', 'bonus']);
    });

    it('asks EVERY player’s tableau, the mover included', () => {
      const asked: Array<string> = [];
      const probe = () => fakeCard({
        deltaMovementBonus: (owner) => {
          asked.push(owner.color);
          return undefined;
        },
      });
      player.playedCards.push(probe());
      opponent.playedCards.push(probe());
      commitDeltaMovement(opponent, 1, {kind: 'standard'});
      expect(asked).to.have.members([player.color, opponent.color]);
    });

    it('an inert hook records nothing at all (the effect scope stays lazy)', () => {
      player.playedCards.push(fakeCard({deltaMovementBonus: () => undefined}));
      const before = game.events.events.length;
      commitDeltaMovement(player, 1, {kind: 'standard'});
      const added = game.events.events.slice(before);
      expect(added.filter((e) => e.type === 'effect-triggered')).to.deep.eq([]);
    });

    it('a non-positive amount is not a grant', () => {
      player.playedCards.push(fakeCard({
        deltaMovementBonus: () => ({card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount: 0}),
      }));
      commitDeltaMovement(player, 1, {kind: 'standard'});
      expect(player.heat).to.eq(0);
    });

    it('the two historical movement rules coexist on one move', () => {
      player.playedCards.push(new DevelopmentManager());
      player.playedCards.push(new SocialHeating());
      commitDeltaMovement(player, 2, {kind: 'standard'});
      expect(player.megaCredits).to.eq(2); // Development Manager: 2+ steps
      expect(player.heat).to.eq(2); // Social Heating: 1 per step
    });
  });

  describe('the retreat twin (Corporate Espionage)', () => {
    let game: IGame;
    let player: TestPlayer;
    let opponent: TestPlayer;

    beforeEach(() => {
      [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
    });

    it('commits a signed backward fact with the attacker in its cause', () => {
      player.deltaProjectData!.position = 4;
      const movement = commitDeltaRetreat(player, 1, {kind: 'card-attack', card: CardName.CORPORATE_ESPIONAGE, by: opponent.color})!;
      expect(movement.from).to.eq(4);
      expect(movement.to).to.eq(3);
      expect(movement.steps).to.eq(-1);
      expect(movement.requested).to.eq(-1);
      expect(movement.direction).to.eq('backward');
      expect(player.deltaProjectData!.position).to.eq(3);
    });

    it('floors at the track start: no write, no publication', () => {
      const before = game.events.events.length;
      expect(commitDeltaRetreat(player, 1, {kind: 'card-attack', card: CardName.CORPORATE_ESPIONAGE, by: opponent.color})).is.undefined;
      expect(player.deltaProjectData!.position).to.eq(0);
      expect(game.events.events.length).to.eq(before);
    });

    it('never fires the advance hooks and never owes movement bonuses', () => {
      player.deltaProjectData!.position = 4;
      player.playedCards.push(new SocialHeating());
      const hook: Array<number> = [];
      player.playedCards.push(fakeCard({onDeltaTrackAdvance: (_p, steps) => {
        hook.push(steps);
      }}));
      commitDeltaRetreat(player, 1, {kind: 'card-attack', card: CardName.CORPORATE_ESPIONAGE, by: opponent.color});
      expect(hook).to.deep.eq([]);
      expect(player.heat).to.eq(0);
    });

    it('two identical retreats carry distinct keys (the re-advance loop)', () => {
      player.deltaProjectData!.position = 4;
      const first = commitDeltaRetreat(player, 1, {kind: 'card-attack', card: CardName.CORPORATE_ESPIONAGE, by: opponent.color})!;
      commitDeltaMovement(player, 1, {kind: 'standard'});
      const second = commitDeltaRetreat(player, 1, {kind: 'card-attack', card: CardName.CORPORATE_ESPIONAGE, by: opponent.color})!;
      expect(first.key).to.not.eq(second.key);
    });

    it('both directions publish the canonical delta-position-changed fact', () => {
      player.deltaProjectData!.position = 4;
      commitDeltaRetreat(player, 1, {kind: 'card-attack', card: CardName.CORPORATE_ESPIONAGE, by: opponent.color});
      commitDeltaMovement(player, 2, {kind: 'standard'});
      const facts = game.events.events.filter((e) => e.type === 'delta-position-changed');
      expect(facts).lengthOf(2);
      expect(facts[0].impact.deltaPosition).to.deep.eq({from: 4, to: 3, steps: -1});
      expect(facts[0].player).to.eq(player.color);
      expect(facts[0].target).to.deep.eq({player: opponent.color});
      expect(facts[0].tags).to.include('attack');
      expect(facts[1].impact.deltaPosition).to.deep.eq({from: 3, to: 5, steps: 2});
      expect(facts[1].source).to.deep.eq({kind: 'card', card: CardName.DELTA_PROJECT, owner: player.color});
    });
  });

  describe('the shared reader', () => {
    it('answers identically for a planned and a committed movement', () => {
      const [, player] = testGame(2, {deltaProjectExpansion: true});
      player.playedCards.push(new SocialHeating());
      const planned = plannedDeltaMovement(player, 3, {kind: 'standard'});
      const projected = resolveDeltaMovementBonuses([player], planned);
      expect(projected.map((b) => b.amount)).to.deep.eq([3]);

      commitDeltaMovement(player, 3, {kind: 'standard'});
      expect(player.heat).to.eq(3);
      // …and the preview route serves exactly that reading.
      player.deltaProjectData!.position = 0;
      player.heat = 0;
      expect(DeltaProjectExpansion.projectedMovementBonuses(player, 3))
        .to.deep.eq([{card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount: 3, before: 0, after: 3}]);
    });
  });
});
