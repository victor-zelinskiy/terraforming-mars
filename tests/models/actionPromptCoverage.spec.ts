import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {IGame} from '../../src/server/IGame';
import {PlayerInput} from '../../src/server/PlayerInput';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {SelectPaymentDeferred} from '../../src/server/deferredActions/SelectPaymentDeferred';
import {Payment} from '../../src/common/inputs/Payment';
import {ActionPreviewBranch, ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
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

/**
 * Cards whose CHOSEN BRANCH still produces a prompt the preview declares
 * NOTHING about — so the composer's batch ends, the server is left holding a
 * live `waitingFor`, and it surfaces as a bare generic band right after the
 * player confirmed. `Astrodrill`'s «получите любой стандартный ресурс» shipped
 * that way for the whole life of the console composer.
 *
 * A follow-up that CANNOT be pre-collected is not a leak — it is a DECLARATION
 * (`boardPlacement` / `colonyTrade` / `deltaAdvance` / `note`): the confirm then
 * says what is coming and the commit beat routes to the right result category.
 * The only failure this list records is saying nothing at all.
 *
 * EMPTY ON PURPOSE — the in-scope class is closed. An entry here would mean
 * someone decided a branch may keep leaking a prompt and had to say so.
 */
const LEFTOVER_FOLLOWUP_WORKLIST = new Set<CardName>([]);

/**
 * Cards whose chosen branch's follow-up CHAIN outruns its declared steps: the
 * batch answers everything the preview promised, and the server is STILL
 * holding a prompt. The two follow-up checks above each see one slice — the
 * FIRST leftover of a STEP-LESS `SelectOption` branch, and a queued payment
 * behind a `SelectOption` branch. Neither walks past a declared step, so a
 * branch that declares its payment and then ALSO asks for a card target leaks
 * invisibly.
 *
 * That is byte-for-byte how «Обстрел астероидами» (DirectedImpactors) shipped:
 * the add-asteroid branch declared its `paymentStep`, the follow-up check
 * skipped the branch (`steps.length > 0`), and the asteroid-target `SelectCard`
 * arrived as a standalone «ЦЕЛЬ НА КАРТЕ» band right after the workspace had
 * taken the confirmation — a screen the flow promises the player never sees.
 *
 * EMPTY ON PURPOSE — an entry here means someone decided a branch may keep
 * asking past its declared steps and had to say so.
 */
const LEFTOVER_CHAIN_WORKLIST = new Set<CardName>([]);

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

/** A live prompt's shape for a failure message. */
function shapeOf(input: PlayerInput): string {
  return input instanceof OrOptions ? `or(${input.options.length})` : input.type;
}

/**
 * Answer a live input the way the composer's captured response would — the
 * cheapest VALID answer of the input's own kind (the first candidate card, the
 * minimum amount, a plain-M€-first payment) — then drain the deferred queue and
 * return the NEXT prompt. Throws when the input can't be synthesized (the
 * caller stops the walk without judging what it could not see).
 */
function answerLive(input: PlayerInput, player: TestPlayer): PlayerInput | undefined {
  if (input instanceof SelectOption) {
    return churn(() => input.cb(undefined), player);
  }
  if (input instanceof OrOptions) {
    // Continuing down the FIRST option is enough to keep the chain's shape
    // honest — every option of a hosted `or` step is a captured response.
    const first = input.options[0];
    if (first === undefined) {
      throw new Error('empty OrOptions');
    }
    return answerLive(first, player);
  }
  if (input instanceof SelectCard) {
    const cards = (input as SelectCard<ICard>).cards;
    if (cards.length === 0) {
      throw new Error('no candidate cards');
    }
    return churn(() => (input as SelectCard<ICard>).cb([cards[0]]), player);
  }
  if (input instanceof SelectAmount) {
    return churn(() => input.cb(input.min), player);
  }
  if (input instanceof SelectPlayer) {
    return churn(() => input.cb(input.players[0]), player);
  }
  if (input instanceof SelectPayment) {
    // The setup player is a Helion (heat counts toward affordability), so a
    // dial-derived bill can exceed the raw M€ stock — top up with heat.
    const mc = Math.min(input.amount, player.megaCredits);
    return churn(() => input.cb(Payment.of({megacredits: mc, heat: input.amount - mc})), player);
  }
  throw new Error(`unanswerable ${input.type}`);
}

/**
 * The console action workspace CLAIMS a draw / deck-check / buy follow-up and
 * hosts it as its own EMBEDDED stage («ДОБОР КАРТ» / «ПОКУПКА» — Inventors'
 * Guild is the reference flow). The claim derives from the preview through
 * `branchOutcomeClaimPlan` (actionPreviewStore.ts), which reads exactly two
 * signals: a `+N cards` GAIN chip (→ 'draw'/'pick') and the branch's `reveal`
 * descriptor (→ 'deck-check'). A `card` prompt arriving under that claim is the
 * embedded flow, not a standalone band — mirror the SAME reading here.
 */
function workspaceClaims(branch: ActionPreviewBranch, live: PlayerInput): boolean {
  if (live.type !== 'card') {
    return false;
  }
  if (branch.reveal !== undefined) {
    return true;
  }
  return branch.effects.some((e) => e.direction === 'gain' && e.icon === 'cards');
}

/** Does a NAMED (display-only) step honestly announce this live leftover? A
 *  non-warning note is an explicit any-shape hand-off; a WARNING announces a
 *  SKIP, so it covers nothing. */
function namedCovers(step: ActionPreviewStep, live: PlayerInput): boolean {
  switch (step.kind) {
  case 'note': return step.noteKind !== 'warning';
  case 'boardPlacement': return live.type === 'space';
  case 'colonyTrade': return live.type === 'colony';
  // The delta door consumes the branch itself — anything after belongs to the
  // Hydronetwork workspace the player was handed to.
  case 'deltaAdvance': return true;
  default: return false;
  }
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

  /**
   * THE BRANCH'S OWN FOLLOW-UP.
   *
   * The two checks above measure the SHAPE of the branch list (does the preview
   * promise a pick that isn't there, do the indices line up) and one specific
   * leftover (a payment). Neither asks the question the player actually feels:
   * «I picked this branch and confirmed — is the server done asking?»
   *
   * That is a third, independent way to leak, and it is the one that shipped:
   * `Astrodrill`'s third branch answers with a nested `OrOptions` (which of the
   * six standard resources), and the preview said nothing, so a screen the flow
   * promises the player will never see arrived right after the confirm.
   *
   * SCOPE, stated honestly: only branches whose runtime option is a
   * `SelectOption` — the family the composer answers with a bare
   * `{type:'option'}` and therefore the family that can silently end the batch.
   * An `optionInput` branch (the composer submits a real input response) would
   * need a synthesized answer to walk past, and its shape is already covered by
   * the index check above. Only the FIRST leftover prompt is inspected: one is
   * enough to fail, and answering further ones would mean re-implementing the
   * batch replay inside a guard.
   */
  it('a branch\'s own follow-up is DECLARED — hosted, or named (worklist)', () => {
    const leaking = new Map<CardName, string>();
    const scanned = new Set<CardName>();

    forEachActionCard((Factory, module) => {
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

        preview.branches.forEach((branch) => {
          if (!branch.available || branch.optionInput !== undefined || leaking.has(a.card.name)) {
            return;
          }
          // A branch that declares ANYTHING about what follows is honest: a
          // hosted step is pre-collected, a named one is an announced hand-off.
          if (branch.steps.length > 0) {
            return;
          }

          // Walk THIS branch on its own fresh game and see what the server is
          // still holding once the deferred queue has drained.
          const b = setup(Factory, profile);
          let live: PlayerInput | undefined;
          try {
            live = b.card.action(b.player);
          } catch {
            return;
          }
          const option = branch.index >= 0 ?
            (live instanceof OrOptions ? live.options[branch.index] : undefined) :
            live;
          if (!(option instanceof SelectOption)) {
            return;
          }
          let leftover: PlayerInput | undefined;
          try {
            leftover = churn(() => option.cb(undefined), b.player);
          } catch {
            return; // a throw is the OTHER checks' business, not this one
          }
          if (leftover !== undefined) {
            const shape = leftover instanceof OrOptions ? `or(${leftover.options.length})` : leftover.type;
            leaking.set(a.card.name, `${module}/${a.card.name} [${profile.label}] "${String(branch.title)}" → ${shape}`);
          }
        });
      }
    });

    const regressions = [...leaking.entries()].filter(([name]) => !LEFTOVER_FOLLOWUP_WORKLIST.has(name));
    expect(
      regressions.map(([, where]) => where),
      '\nBranches leaking an UNDECLARED follow-up (pre-collect it as a step, or declare it with boardPlacementStep / noteStep / colonyTradeStep / deltaAdvanceStep):\n' +
        `${regressions.map(([, where]) => where).join('\n')}\n`,
    ).is.empty;

    const stale = [...LEFTOVER_FOLLOWUP_WORKLIST].filter((n) => scanned.has(n) && !leaking.has(n));
    expect(stale, `\nFIXED — remove from LEFTOVER_FOLLOWUP_WORKLIST:\n${stale.join('\n')}\n`).is.empty;
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

  /**
   * THE WHOLE CHAIN, not the first leftover.
   *
   * Walks EVERY available branch of every in-scope action card: picks the
   * branch, answers each live prompt with the response the composer's captured
   * step would replay (`answerLive`), and consumes the branch's declared hosted
   * steps in order. Three ways to fail, all of them the player's «повторный
   * промт» bug:
   *
   *  1. a prompt arrives with the step queue EMPTY and no NAMED hand-off
   *     covering it — the batch has ended, the band opens standalone;
   *  2. a prompt's KIND differs from the declared step's — the positional
   *     replay meets a question it has no answer for (order/shape drift);
   *  3. the chain never settles (a runaway loop of prompts).
   *
   * A named hand-off (`boardPlacement` / `colonyTrade` / `deltaAdvance` / a
   * non-warning `note`) legitimately ENDS the walk: the confirm announced what
   * comes next and the commit routes to that surface. A step the walk cannot
   * synthesize an answer for stops the walk WITHOUT judging what it could not
   * see. `dynamic` previews are the documented escape hatch and stay exempt.
   */
  it('a branch\'s WHOLE follow-up chain is covered by its declared steps (worklist)', () => {
    const leaking = new Map<CardName, string>();
    const scanned = new Set<CardName>();

    forEachActionCard((Factory, module) => {
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
        // `preSteps` are spend-heat only, and no profile here owns a heat-source
        // CHOICE (no Stormcraft floaters) — a preStep prompt cannot arrive.
        const available = preview.branches.filter((b) => b.available);

        for (const branch of available) {
          if (leaking.has(a.card.name)) {
            break;
          }
          const where = `${module}/${a.card.name} [${profile.label}] "${String(branch.title) || '<lone branch>'}"`;
          const b = setup(Factory, profile);
          let current: PlayerInput | undefined;
          try {
            current = churn(b.card.action(b.player), b.player);
          } catch {
            continue; // a throwing action() is the other checks' business
          }

          // ── Resolve the branch's own option ──
          try {
            if (branch.index >= 0) {
              if (!(current instanceof OrOptions) || current.options.length <= branch.index) {
                continue; // index divergence — the index check's business
              }
              current = answerLive(current.options[branch.index], b.player);
            } else if (available.length === 1) {
              if (current instanceof SelectOption) {
                // A leftover bare confirm is the auto-resolve check's finding;
                // walk past it to see what ELSE the chain holds.
                current = answerLive(current, b.player);
              } else if (branch.optionInput !== undefined && current !== undefined && current.type === branch.optionInput.type) {
                current = answerLive(current, b.player);
              }
              // else: the action deferred straight into its follow-ups —
              // `current` already is the chain's first prompt.
            } else {
              continue; // several available branches, none picked — index check's business
            }
          } catch {
            continue;
          }

          // ── Walk the rest of the chain against the declared steps ──
          const queue = branch.steps.filter((s) => s.kind === 'input' || s.kind === 'spendHeat' || s.kind === 'tabbedTargets');
          const named = branch.steps.filter((s) =>
            s.kind === 'boardPlacement' || s.kind === 'colonyTrade' || s.kind === 'deltaAdvance' || s.kind === 'note');
          let hops = 0;
          while (current !== undefined) {
            if (++hops > 8) {
              leaking.set(a.card.name, `${where} :: the chain did not settle after 8 prompts`);
              break;
            }
            const step = queue.shift();
            if (step === undefined) {
              if (named.some((s) => namedCovers(s, current!)) || workspaceClaims(branch, current)) {
                break; // an announced hand-off / a workspace-claimed embedded stage
              }
              leaking.set(a.card.name, `${where} :: ${shapeOf(current)} arrives past the declared steps — nothing announced it`);
              break;
            }
            const expected = step.kind === 'tabbedTargets' ? 'or' : step.input.type;
            if (current.type !== expected) {
              leaking.set(a.card.name, `${where} :: declared a '${expected}' step but the server asks ${shapeOf(current)} — order/shape drift`);
              break;
            }
            try {
              current = answerLive(current, b.player);
            } catch {
              break; // unanswerable from here — unverifiable, not a leak
            }
          }
        }
      }
    });

    const regressions = [...leaking.entries()].filter(([name]) => !LEFTOVER_CHAIN_WORKLIST.has(name));
    expect(
      regressions.map(([, where]) => where),
      '\nBranches still asking PAST their declared steps (pre-collect the follow-up as a step, or announce it with boardPlacementStep / noteStep / colonyTradeStep / deltaAdvanceStep):\n' +
        `${regressions.map(([, where]) => where).join('\n')}\n`,
    ).is.empty;

    const stale = [...LEFTOVER_CHAIN_WORKLIST].filter((n) => scanned.has(n) && !leaking.has(n));
    expect(stale, `\nFIXED — remove from LEFTOVER_CHAIN_WORKLIST:\n${stale.join('\n')}\n`).is.empty;
  }).timeout(240_000);
});
