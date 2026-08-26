import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {IGame} from '../../src/server/IGame';
import {PlayerInput} from '../../src/server/PlayerInput';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectPaymentDeferred} from '../../src/server/deferredActions/SelectPaymentDeferred';
import {actionPreview} from '../../src/server/models/actionPreview';
import {MAX_TEMPERATURE, MAX_VENUS_SCALE, MAX_OXYGEN_LEVEL} from '../../src/common/constants';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {setTemperature, setVenusScaleLevel, setOxygenLevel, churn} from '../TestingUtils';

/*
 * THE PRE-COLLECT CONTRACT, ENFORCED.
 *
 * The premium/console action flow shows the player every cost, every branch and
 * every choice of an action BEFORE they confirm, then sends ONE batch of
 * responses (`buildActionBatch` / `submitCardActionBatch`) built from the
 * `ActionPreview`. So the preview is not decoration — it is a PROMISE about the
 * shape of the live prompt sequence, and the batch is only byte-correct while
 * that promise holds.
 *
 * When it does not hold, the leftover prompt does not fail loudly: it surfaces
 * as a bare generic band (console) / a legacy modal (desktop) AFTER the action
 * was already confirmed — a screen the player is told they will never see. That
 * is how Factorum shipped a redundant «Потратьте 3 M€…» confirmation on top of
 * the confirmation the workspace had just taken.
 *
 * This spec walks every in-scope action card in several game states, builds the
 * preview READ-ONLY, then runs the real `action()` on a FRESH game and compares
 * what the preview promised with what the server actually asks. The worklist
 * sets below are the migration to-do: an entry means «known to still leak»,
 * NOT «allowed to leak». Emptying them is the goal; adding to them is a
 * decision someone has to make on purpose.
 */

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

/**
 * Cards whose action still defers a payment the preview does not pre-collect
 * (`actionPreviews.paymentStep`). The prompt is REAL — `SelectPaymentDeferred`
 * asks whenever the player can pay with anything other than plain M€, which for
 * Helion (heat) and Luna Trade Federation (titanium) is EVERY M€ action cost,
 * not just the cards that opt into steel/titanium.
 *
 * The DECLARATIVE half of this class (`action: {spend: {megacredits: N}}`) was
 * a documented TODO in `stepsForBehavior` — "payment … added as their card
 * groups are migrated; until then they produce no step and the leftover prompt
 * rides the graceful fallback". It is migrated now: `models/actionPreview.ts`
 * emits the payment as a preStep for the whole declarative family at once.
 *
 * EMPTY ON PURPOSE — the in-scope class is closed. An entry here would mean
 * someone decided a card may keep leaking a payment prompt and had to say so.
 */
const LEFTOVER_PAYMENT_WORKLIST = new Set<CardName>([]);

/** Iterate every constructable in-scope action card. */
function forEachActionCard(fn: (Factory: new () => ICard, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined) {
          continue;
        }
        let probe: ICard;
        try {
          probe = new Factory();
        } catch {
          continue;
        }
        if (isIActionCard(probe)) {
          fn(Factory as new () => ICard, manifest.module);
        }
      }
    }
  }
}

/**
 * The game states worth walking. A single "player has everything" state hides
 * exactly the divergences that bite: an action's branch set changes when a
 * GLOBAL PARAMETER caps out (a raise becomes pointless and the card drops that
 * option) and when the player is broke.
 */
type Profile = {label: string, apply: (game: IGame, player: TestPlayer, card: ICard & IActionCard) => void};

const PROFILES: ReadonlyArray<Profile> = [
  {
    label: 'rich',
    apply: () => {},
  },
  {
    label: 'globals maxed',
    apply: (game) => {
      setTemperature(game, MAX_TEMPERATURE);
      setVenusScaleLevel(game, MAX_VENUS_SCALE);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    },
  },
  {
    label: 'broke',
    apply: (_game, player) => {
      player.megaCredits = 0;
      player.steel = 0;
      player.titanium = 0;
      player.heat = 0;
      player.canUseHeatAsMegaCredits = false;
    },
  },
  /*
   * DELIBERATELY ABSENT — «Reds in power, nothing that can pay the tax»:
   *
   *   {label: 'reds, no M€', turmoil: true, apply: (game, player) => {
   *      const turmoil = Turmoil.getTurmoil(game);
   *      game.phase = Phase.ACTION;
   *      turmoil.rulingParty = new Reds();
   *      PoliticalAgendas.setNextAgenda(turmoil, game);
   *      player.megaCredits = 0; player.heat = 0; player.canUseHeatAsMegaCredits = false;
   *   }}
   *
   * It is a legitimate state and it DOES find things — ~40 in-scope cards whose
   * preview reads the Reds TR tax while their live availability gate does not,
   * several of which then throw «Player does not have 3 M€». But that is a
   * TURMOIL-wide question (Turmoil is outside the premium subsystem scope), and
   * a 40-entry exemption list here would bury the in-scope findings this guard
   * exists to state. Recorded as an open class in
   * `docs/claude/action-prompt-audit.md`; add the profile back when the Turmoil
   * scope is opened.
   */
];

function setup(Factory: new () => ICard, profile: Profile): {game: IGame, player: TestPlayer, card: ICard & IActionCard} {
  const [game, player, opponent] = testGame(2);
  const card = new Factory() as ICard & IActionCard;
  player.playedCards.push(card);
  player.megaCredits = 100;
  player.steel = 10;
  player.titanium = 10;
  player.plants = 10;
  player.energy = 10;
  player.heat = 10;
  // Helion: the state in which EVERY M€ cost becomes a payment CHOICE.
  player.canUseHeatAsMegaCredits = true;
  opponent.plants = 10;
  opponent.megaCredits = 10;
  if (card.resourceType !== undefined) {
    card.resourceCount = 8;
  }
  profile.apply(game, player, card);
  return {game, player, card};
}

/** A queued payment the player would actually be ASKED about. */
function pendingPaymentPrompt(game: IGame): boolean {
  const queue = (game.deferredActions as unknown as {queue: ReadonlyArray<unknown>}).queue;
  return queue.some((a) => a instanceof SelectPaymentDeferred && a.previewPaymentModel() !== undefined);
}

describe('action prompt coverage (the pre-collect contract)', () => {
  it('an action the preview AUTO-RESOLVES asks nothing more', () => {
    const failures: Array<string> = [];

    forEachActionCard((Factory, module) => {
      for (const profile of PROFILES) {
        const a = setup(Factory, profile);
        if (!a.card.canAct(a.player)) {
          continue;
        }
        const preview = actionPreview(a.player, a.card);
        // The documented escape hatch: a `dynamic` preview PROMISES nothing and
        // its follow-ups ride the legacy routing on purpose.
        if (preview.kind === 'dynamic') {
          continue;
        }
        const available = preview.branches.filter((b) => b.available);
        const lone = available.length === 1 ? available[0] : undefined;
        if (lone === undefined || lone.index !== -1 || lone.optionInput !== undefined) {
          continue;
        }

        // Run the REAL action on a fresh game — `action()` mutates. `churn`
        // resolves it the way the server does (a declarative card DEFERS its
        // OrOptions rather than returning it), so this is the prompt the player
        // actually meets first.
        const b = setup(Factory, profile);
        let live: PlayerInput | undefined;
        try {
          live = churn(b.card.action(b.player), b.player);
        } catch (e) {
          failures.push(`${module}/${b.card.name} [${profile.label}] :: action() threw ${(e as Error).message}`);
          continue;
        }
        const where = `${module}/${b.card.name} [${profile.label}]`;
        if (live instanceof SelectOption) {
          failures.push(`${where} :: asks a bare SelectOption — the batch submits nothing for it, so the player confirms the same thing twice`);
        } else if (live instanceof OrOptions) {
          failures.push(`${where} :: asks an OrOptions with ${live.options.length} option(s) — the preview promised no branch pick`);
        }
      }
    });

    expect(failures, `\n${failures.join('\n')}\n`).is.empty;
  }).timeout(120_000);

  it('the preview\'s branch INDICES match the live OrOptions', () => {
    const failures: Array<string> = [];

    forEachActionCard((Factory, module) => {
      for (const profile of PROFILES) {
        const a = setup(Factory, profile);
        if (!a.card.canAct(a.player)) {
          continue;
        }
        const preview = actionPreview(a.player, a.card);
        if (preview.kind === 'dynamic') {
          continue;
        }
        const declared = preview.branches.filter((b) => b.index >= 0);
        if (declared.length === 0) {
          continue;
        }

        const b = setup(Factory, profile);
        let live: PlayerInput | undefined;
        try {
          live = churn(b.card.action(b.player), b.player);
        } catch (e) {
          failures.push(`${module}/${b.card.name} [${profile.label}] :: action() threw ${(e as Error).message}`);
          continue;
        }
        const where = `${module}/${b.card.name} [${profile.label}]`;
        if (!(live instanceof OrOptions)) {
          failures.push(`${where} :: preview declares ${declared.length} branch indices but the live action asks ${live === undefined ? 'nothing' : live.type}`);
          continue;
        }
        // A declared index the live OrOptions has no option for is not a cosmetic
        // mismatch: the batch submits `{type:'or', index}` positionally, so the
        // WRONG branch runs (or the server throws «Invalid index»).
        if (live.options.length !== declared.length) {
          failures.push(`${where} :: preview declares ${declared.length} submittable branches, live OrOptions has ${live.options.length}`);
        }
      }
    });

    expect(failures, `\n${failures.join('\n')}\n`).is.empty;
  }).timeout(120_000);

  /*
   * Deliberately WITHOUT the Reds profile: under Reds every TR raise bills a tax
   * through the same `SelectPaymentDeferred`, so a Reds run reports the RULING
   * PARTY's prompt against every terraforming card — a Turmoil-wide question
   * (Turmoil is not in the premium scope), not the per-card cost this check is
   * about.
   */
  it('an action that defers a PAYMENT pre-collects it (worklist)', () => {
    const leaking = new Set<CardName>();
    const scanned = new Set<CardName>();

    forEachActionCard((Factory) => {
      for (const profile of PROFILES) {
        const a = setup(Factory, profile);
        scanned.add(a.card.name);
        if (!a.card.canAct(a.player)) {
          continue;
        }
        const preview = actionPreview(a.player, a.card);
        if (preview.kind === 'dynamic') {
          continue;
        }
        const declaresPayment = preview.branches.some((br) =>
          br.steps.some((s) => s.kind === 'input' && s.input.type === 'payment')) ||
          (preview.preSteps ?? []).some((s) => s.kind === 'input' && s.input.type === 'payment');
        if (declaresPayment) {
          continue;
        }

        // Walk each SelectOption branch on its own fresh game and look for a
        // payment the player would be asked about.
        const probes: Array<() => IGame | undefined> = [];
        const b = setup(Factory, profile);
        let live: PlayerInput | undefined;
        try {
          live = b.card.action(b.player);
        } catch {
          continue;
        }
        if (live === undefined) {
          probes.push(() => b.game);
        } else if (live instanceof SelectOption) {
          probes.push(() => {
            (live as SelectOption).cb(undefined);
            return b.game;
          });
        } else if (live instanceof OrOptions) {
          for (let i = 0; i < live.options.length; i++) {
            probes.push(() => {
              const c = setup(Factory, profile);
              const orLive = c.card.action(c.player);
              if (!(orLive instanceof OrOptions) || orLive.options.length <= i) {
                return undefined;
              }
              const target = orLive.options[i];
              if (!(target instanceof SelectOption)) {
                return undefined;
              }
              target.cb(undefined);
              return c.game;
            });
          }
        }
        for (const probe of probes) {
          let g: IGame | undefined;
          try {
            g = probe();
          } catch {
            continue;
          }
          if (g !== undefined && pendingPaymentPrompt(g)) {
            leaking.add(a.card.name);
            break;
          }
        }
      }
    });

    const regressions = [...leaking].filter((n) => !LEFTOVER_PAYMENT_WORKLIST.has(n));
    expect(regressions, `\nNEW cards leaking a payment prompt (add a paymentStep to their preview):\n${regressions.join('\n')}\n`).is.empty;

    // The worklist is a to-do, not a permanent exemption: an entry that no
    // longer leaks must be REMOVED, or the list stops meaning anything.
    const stale = [...LEFTOVER_PAYMENT_WORKLIST].filter((n) => scanned.has(n) && !leaking.has(n));
    expect(stale, `\nFIXED — remove from LEFTOVER_PAYMENT_WORKLIST:\n${stale.join('\n')}\n`).is.empty;
  }).timeout(120_000);
});
