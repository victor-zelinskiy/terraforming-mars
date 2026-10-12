import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Payment} from '../../src/common/inputs/Payment';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {isActionMenuTitle} from '../../src/common/inputs/actionMenuTitles';
import {AddressableInput, PreselectAddress, answerAddressOf, reaskedBy} from '../../src/common/inputs/preselectAddress';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {OrOptionsModel, PlayerInputModel, SelectAmountModel, SelectCardModel, SelectPaymentModel, SelectPlayerModel} from '../../src/common/models/PlayerInputModel';
import {PlayerInput} from '../../src/server/PlayerInput';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {IGame} from '../../src/server/IGame';
import {playPreviewWithTableQuestions} from '../../src/server/models/tableQuestions';
import {drainBatchTail, expireSupersededStagedTail, parkedBatchTailLength, replayBatch} from '../../src/server/inputs/deferredInputBatch';
import {buildPlayCardBatch} from '../../src/client/console/consolePlayCardComposer';
import {orderedPreResponses, orderedStepResponses} from '../../src/client/console/consoleActionComposer';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {setRulingParty} from '../TestingUtils';
import {Pets} from '../../src/server/cards/base/Pets';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {PhysicsComplex} from '../../src/server/cards/base/PhysicsComplex';
import {BribedCommittee} from '../../src/server/cards/base/BribedCommittee';
import {Mine} from '../../src/server/cards/base/Mine';
import {Algae} from '../../src/server/cards/base/Algae';
import {Lichen} from '../../src/server/cards/base/Lichen';
import {KelpFarming} from '../../src/server/cards/base/KelpFarming';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {MarsUniversity} from '../../src/server/cards/base/MarsUniversity';
import {ViralEnhancers} from '../../src/server/cards/base/ViralEnhancers';
import {Recyclon} from '../../src/server/cards/promo/Recyclon';
import {Splice} from '../../src/server/cards/promo/Splice';

/*
 * THE PLAY'S PRE-SELECTS LAND — EVERY ONE, BY CONSTRUCTION.
 *
 * The console's play composer collects the card's choices BEFORE the one
 * submit and posts them as one batch built from the card's preview
 * (`buildPlayCardBatch` + `orderedStepResponses` — the composer's own pure
 * builders, imported here, addresses and all). The preview is therefore a
 * PROMISE: every answer the batch carries meets its own prompt, and nothing
 * the player already chose is asked again. The owner's report of 2026-10-11 —
 * «Sponsored Academies: the discard picked in the composer comes back as a
 * separate prompt» — broke that promise for a WHOLE family (every
 * pre-collected discard), and no guard saw it: the play-preview guards check
 * the STEPS' SHAPE, `actionPromptCoverage` replays ACTIONS only, and the e2e
 * stranded-prompt witness cannot see a re-asked prompt (somebody served it).
 *
 * This spec is the twin of `actionPromptCoverage`'s check 5 for PLAYS: every
 * in-scope project card whose preview pre-collects anything, in three game
 * states, has its preview built READ-ONLY, its batch assembled exactly as the
 * composer would (the first available branch, the cheapest valid answer of
 * each step — the first candidate, the minimum, M€), and REPLAYED on a fresh
 * game through the real `replayBatch`. The play's preview is the one the
 * composer receives (`playPreviewWithTableQuestions`): the TABLE's questions
 * (the profile `interlopers`: Olympus Conference with a stored resource,
 * Pharmacy Union with no disease — both ask on a science tag) are STEPS of it
 * since TR51 («strictly pre-select», the owner's decision 2026-10-12), so the
 * batch answers them too and the replay lands each on its own prompt wherever
 * the queue raises it. A question that is not a pre-select (the Reds' tax under
 * Helion's heat — a rule's, not a card's) is answered the way the player would
 * — the route's own `expireSupersededStagedTail` → `process` → `drainBatchTail`.
 * Then:
 *  · NOTHING may stay parked — an answer that never found its prompt is a
 *    promise the preview could not keep;
 *  · the prompt left standing may not be the card's OWN question again
 *    (`addressVerdict === 'own'` for an answer the batch carried) — that is
 *    exactly «the player was asked twice»;
 *  · no prompt answered «as the player» after the press may be a question of
 *    the player's own TABLE that the forecast did not name an honest follow-up
 *    (`asks` without `preselect`) — that is «a choice after the commit whose
 *    answer was known before it».
 *
 * `LEFTOVER_PRESELECT_WORKLIST` is EMPTY ON PURPOSE and fails BOTH ways: a new
 * leak is a regression, a fixed entry must be removed.
 */

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);

const LEFTOVER_PRESELECT_WORKLIST = new Set<string>([]);

type Profile = {
  label: string,
  options: Record<string, unknown>,
  apply: (game: IGame, player: TestPlayer) => void,
};

const REDUX = {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true};

const PROFILES: ReadonlyArray<Profile> = [
  {label: 'clean', options: REDUX, apply: () => {}},
  {
    label: 'interlopers',
    options: REDUX,
    apply: (_game, player) => {
      // A stored science resource turns Olympus' trigger into a QUESTION ahead of the card's own input; Pharmacy
      // Union with no disease asks on a science tag too (at SUPERPOWER, earlier still).
      const olympus = new OlympusConference();
      olympus.resourceCount = 1;
      player.playedCards.push(olympus, new PharmacyUnion());
    },
  },
  {
    // TR51 — the rest of the table's askers: Mars University (science → discard to draw, AFTER the card's choice),
    // Viral Enhancers (plant / microbe / animal → a resource on the played card or a plant), Recyclon with two microbes
    // (building → two microbes for a plant production, or one more), and Splice on the OPPONENT (a microbe card that
    // holds microbes → its PLAYER chooses a microbe or the M€).
    label: 'reactors',
    options: REDUX,
    apply: (game, player) => {
      const recyclon = new Recyclon();
      recyclon.resourceCount = 2;
      player.playedCards.push(new MarsUniversity(), new ViralEnhancers(), recyclon);
      game.players.find((p) => p !== player)?.playedCards.push(new Splice());
    },
  },
  {
    label: 'reds',
    options: {turmoilExtension: true, venusNextExtension: true, coloniesExtension: true},
    apply: (game, player) => {
      setRulingParty(game, PartyName.REDS);
      // Heat-as-M€ (Helion) makes the tax a QUESTION rather than a silent deduction.
      player.canUseHeatAsMegaCredits = true;
    },
  },
];

function forEachInScopeProjectCard(cb: (Factory: new () => ICard, name: string, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const name of Object.keys(manifest.projectCards)) {
      const Factory = (manifest.projectCards as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
      if (Factory !== undefined) {
        cb(Factory, name, manifest.module);
      }
    }
  }
}

type Table = {game: IGame, player: TestPlayer, card: IProjectCard};

/** A rich table: holders of every common resource, a played event, a building with production, a hand of four, plenty to pay with. */
function table(Factory: new () => ICard, profile: Profile): Table | undefined {
  const [game, player, opponent] = testGame(2, profile.options);
  game.phase = Phase.ACTION;
  let card: IProjectCard;
  try {
    card = new Factory() as IProjectCard;
  } catch {
    return undefined;
  }
  player.playedCards.push(new Pets(), new Tardigrades(), new Dirigibles(), new PhysicsComplex(), new BribedCommittee(), new Mine());
  player.cardsInHand = [card, new Algae(), new Lichen(), new KelpFarming()];
  player.megaCredits = 200;
  player.steel = 10;
  player.titanium = 10;
  player.plants = 10;
  player.energy = 10;
  player.heat = 20;
  opponent.plants = 10;
  opponent.megaCredits = 20;
  opponent.playedCards.push(new Pets());
  profile.apply(game, player);
  return {game, player, card};
}

/** The cheapest VALID answer of a step's input model, as the composer would capture it; `undefined` = cannot synthesize. */
function answerOf(model: PlayerInputModel, exclude: ReadonlySet<string> = new Set()): unknown | undefined {
  switch (model.type) {
  case 'option':
    return {type: 'option'};
  case 'card': {
    const m = model as SelectCardModel;
    const selectable = m.cards.filter((c) => c.isDisabled !== true && !exclude.has(c.name));
    const n = Math.min(Math.max(m.min, 1), m.max, selectable.length);
    if (n < m.min || (n === 0 && m.min > 0)) {
      return undefined;
    }
    return {type: 'card', cards: selectable.slice(0, n).map((c) => c.name)};
  }
  case 'or': {
    const m = model as OrOptionsModel;
    for (let i = 0; i < m.options.length; i++) {
      const inner = answerOf(m.options[i]);
      if (inner !== undefined) {
        return {type: 'or', index: i, response: inner};
      }
    }
    return undefined;
  }
  case 'amount':
    return {type: 'amount', amount: (model as SelectAmountModel).min};
  case 'player': {
    const players = (model as SelectPlayerModel).players;
    return players.length === 0 ? undefined : {type: 'player', player: players[0]};
  }
  case 'payment':
    return {type: 'payment', payment: Payment.of({megacredits: (model as SelectPaymentModel).amount})};
  default:
    return undefined;
  }
}

/** The pre-collect the composer would make for one branch: captured answers by step index, the option answer, the pre answers. */
function capture(preview: ActionPreview, branch: ActionPreviewBranch): {pre: Record<number, unknown>, steps: Record<number, unknown>, option: unknown} | undefined {
  const pre: Record<number, unknown> = {};
  for (const [i, step] of (preview.preSteps ?? []).entries()) {
    if (step.kind === 'input') {
      const a = answerOf(step.input);
      if (a === undefined) {
        return undefined;
      }
      pre[i] = a;
    }
  }
  const steps: Record<number, unknown> = {};
  const chosen = new Map<number, Array<string>>();
  // A merged up-to-N pick (Astra Mechanica): ONE response on the first card step, the later slots collapse into it.
  const mergeHost = branch.mergeCardSteps !== undefined ?
    branch.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'card') : -1;
  for (const [i, step] of branch.steps.entries()) {
    if (step.kind !== 'input') {
      continue;
    }
    if (step.repeatAction === true || step.input.type === 'deltaEspionage') {
      return undefined;
    }
    if (mergeHost >= 0 && i !== mergeHost && step.input.type === 'card') {
      continue;
    }
    const exclude = new Set<string>((step.dedupeFromSteps ?? []).flatMap((j) => chosen.get(j) ?? []));
    const a = answerOf(step.input, exclude);
    if (a === undefined) {
      return undefined;
    }
    if (step.input.type === 'card') {
      chosen.set(i, (a as {cards: Array<string>}).cards);
    }
    steps[i] = a;
  }
  let option: unknown;
  if (branch.optionInput !== undefined) {
    option = answerOf(branch.optionInput);
    if (option === undefined) {
      return undefined;
    }
  }
  return {pre, steps, option};
}

/** canPlay, or false when the card cannot even be ASKED on this table (a board-bound card on another map). */
function playable(t: Table): boolean {
  try {
    return t.player.canPlay(t.card);
  } catch {
    return false;
  }
}

/** Does the preview pre-collect anything at all for this branch? */
function preCollects(preview: ActionPreview, branch: ActionPreviewBranch): boolean {
  return branch.index >= 0 || branch.optionInput !== undefined ||
    branch.steps.some((s) => s.kind === 'input') ||
    (preview.preSteps ?? []).some((s) => s.kind === 'input');
}

/** A follow-up the branch DECLARES (not collected — the composer hands it on): a placement door, a show step, a note, a draw. */
function declaredFollowUp(branch: ActionPreviewBranch, live: PlayerInput): boolean {
  const kinds = new Set(branch.steps.map((s: ActionPreviewStep) => s.kind));
  switch (live.type) {
  case 'space': return kinds.has('boardPlacement') || kinds.has('note');
  case 'party': return kinds.has('delegateGrant') || kinds.has('supportDiscard') || kinds.has('note');
  case 'colony': return kinds.has('colonyPick') || kinds.has('note');
  case 'card': return live.deckPickPrompt !== undefined || branch.reveal !== undefined ||
    branch.effects.some((e) => e.direction === 'gain' && e.icon === 'cards');
  default: return kinds.has('note');
  }
}

function isActionMenu(input: PlayerInput | undefined): boolean {
  return input instanceof OrOptions && typeof input.title === 'string' && isActionMenuTitle(input.title);
}

function shapeOf(input: PlayerInput | undefined): string {
  if (input === undefined) {
    return 'nothing';
  }
  const src = input.choiceContext?.source.card ?? input.discardPrompt?.source?.card;
  return `${input.type}${input.discardPrompt !== undefined ? '(discard)' : ''}${src !== undefined ? ` of ${src}` : ''}`;
}

/** Answer a prompt the way the player would through the single-input route — the interloper in front. */
function answerAsThePlayer(player: TestPlayer, input: PlayerInput): boolean {
  const model = input.toModel(player);
  // A placement the play declares (its tile on the board) is answered on the board — the first legal cell; a table
  // answer parked behind it lands once it is (the route's drain).
  const spaces = (model as {spaces?: ReadonlyArray<string>}).spaces;
  const response = (model.type === 'space' && spaces !== undefined && spaces.length > 0 ?
    {type: 'space', spaceId: spaces[0]} : answerOf(model)) as InputResponse | undefined;
  if (response === undefined) {
    return false;
  }
  expireSupersededStagedTail(player);
  try {
    player.process(response);
  } catch {
    return false;
  }
  drainBatchTail(player);
  return true;
}

type Outcome = {failure?: string, info?: string};

function replayOne(Factory: new () => ICard, name: string, module: GameModule, profile: Profile, unaddressed: boolean): Outcome | undefined {
  const a = table(Factory, profile);
  if (a === undefined || !playable(a)) {
    return undefined;
  }
  let preview: ActionPreview;
  try {
    preview = playPreviewWithTableQuestions(a.player, a.card);
  } catch (e) {
    return {info: `${module}/${name} [${profile.label}] :: the preview threw ${(e as Error).message}`};
  }
  if (preview.kind === 'dynamic') {
    return undefined;
  }
  const branch = preview.branches.find((b) => b.available);
  if (branch === undefined || !preCollects(preview, branch)) {
    return undefined;
  }
  const captured = capture(preview, branch);
  if (captured === undefined) {
    return {info: `${module}/${name} [${profile.label}] :: an answer the guard cannot synthesize (repeat / espionage / an unknown input)`};
  }

  const b = table(Factory, profile)!;
  b.player.takeAction();
  const menu = b.player.getWaitingFor() as OrOptions;
  const menuIndex = menu.options.findIndex((o) => o.title === 'Play project card');
  if (menuIndex < 0) {
    return undefined;
  }
  let batch = buildPlayCardBatch({
    playPath: [menuIndex],
    cardName: b.card.name,
    payment: Payment.of({megacredits: b.player.getCardCost(b.card)}),
    branchIndex: branch.index,
    branchFor: branch.for,
    preResponses: orderedPreResponses(preview, captured.pre),
    optionResponse: captured.option,
    stepResponses: orderedStepResponses(branch, captured.steps),
  }) as Array<InputResponse>;
  if (unaddressed) {
    // The client before the address — the measurement of «who re-asked BEFORE the law».
    batch = batch.map((r) => {
      const copy = {...r} as InputResponse & {for?: PreselectAddress};
      delete copy.for;
      return copy;
    });
  }
  const where = `${module}/${name} [${profile.label}]`;
  try {
    replayBatch(b.player, batch);
  } catch (e) {
    return {info: `${where} :: the play itself was refused (${(e as Error).message})`};
  }
  // The interlopers in front: answered as the player would, the parked answers draining behind them. A TABLE question
  // among them is a pre-select the composer should have collected — unless the forecast named it an honest follow-up.
  const honest = new Set((preview.forecast?.facts ?? []).filter((f) => f.certainty === 'asks' && f.preselect === undefined).map((f) => f.source.name));
  const askedAfter: Array<string> = [];
  for (let guard = 0; guard < 8 && parkedBatchTailLength(b.player) > 0; guard++) {
    const live = b.player.getWaitingFor();
    if (live === undefined || isActionMenu(live)) {
      break;
    }
    const asker = live.choiceContext?.source.card;
    if (asker !== undefined && asker !== b.card.name && !honest.has(asker)) {
      askedAfter.push(shapeOf(live));
    }
    if (!answerAsThePlayer(b.player, live)) {
      break;
    }
  }
  const live = b.player.getWaitingFor();
  const parked = parkedBatchTailLength(b.player);
  const liveAsker = live?.choiceContext?.source.card;
  if (live !== undefined && !isActionMenu(live) && liveAsker !== undefined && liveAsker !== b.card.name && !honest.has(liveAsker)) {
    askedAfter.push(shapeOf(live));
  }
  if (askedAfter.length > 0) {
    return {failure: `${where} :: ASKED AFTER THE PRESS — ${askedAfter.join(', ')} (a table question the composer did not collect)`};
  }
  if (parked > 0) {
    return {failure: `${where} :: ${parked} pre-selected answer(s) never landed (waiting: ${shapeOf(live)})`};
  }
  if (live === undefined || isActionMenu(live)) {
    return {};
  }
  // RE-ASKED: the prompt standing is the card's OWN question an answer of the batch was collected for.
  const reasked = batch.slice(1).some((r) => {
    const address = answerAddressOf(r as InputResponse & {for?: PreselectAddress});
    return address !== undefined && reaskedBy(address, live as unknown as AddressableInput);
  });
  if (reasked) {
    return {failure: `${where} :: RE-ASKED — ${shapeOf(live)} stands after the batch answered it`};
  }
  if (unaddressed && live.discardPrompt?.source?.card === b.card.name && branch.steps.some((s) => s.kind === 'input' && s.input.type === 'card')) {
    // The unaddressed measurement cannot use the verdict (no addresses): a discard of the card's own after a batch that
    // carried a card answer for it is the re-ask the owner reported.
    return {failure: `${where} :: RE-ASKED — ${shapeOf(live)} stands after the batch answered it`};
  }
  if (!declaredFollowUp(branch, live)) {
    return {info: `${where} :: leftover ${shapeOf(live)} (not a pre-select — a follow-up the play raises)`};
  }
  // `{}` = replayed and clean; `undefined` (above) = nothing to replay.
  return {};
}

function sweep(unaddressed: boolean): {failures: Array<string>, infos: Array<string>, verified: number} {
  const failures: Array<string> = [];
  const infos: Array<string> = [];
  let verified = 0;
  forEachInScopeProjectCard((Factory, name, module) => {
    for (const profile of PROFILES) {
      const outcome = replayOne(Factory, name, module, profile, unaddressed);
      if (outcome === undefined) {
        continue;
      }
      verified++;
      if (outcome.failure !== undefined) {
        failures.push(outcome.failure);
      }
      if (outcome.info !== undefined) {
        infos.push(outcome.info);
      }
    }
  });
  return {failures, infos, verified};
}

describe('card-play replay coverage (the pre-select contract for PLAYS)', () => {
  it('every pre-collected answer of every in-scope play lands on its own prompt — nothing parked, nothing asked twice', () => {
    const {failures, infos, verified} = sweep(false);
    if (process.env.TM_REPLAY_COVERAGE_VERBOSE !== undefined) {
      console.log(`\n[replay coverage] replayed ${verified} play(s); informational:\n  ${infos.join('\n  ')}`);
    }
    // The sweep must actually REPLAY plays — a table that stopped dealing pre-selects would pass vacuously.
    expect(verified, 'plays replayed').is.greaterThan(60);
    const cards = (line: string) => line.slice(0, line.indexOf(' ['));
    const leaking = new Set(failures.map((f) => cards(f).split('/')[1]));
    const unexpected = failures.filter((f) => !LEFTOVER_PRESELECT_WORKLIST.has(cards(f).split('/')[1]));
    const fixed = [...LEFTOVER_PRESELECT_WORKLIST].filter((name) => !leaking.has(name));
    expect(unexpected, `\n${unexpected.join('\n')}\n`).is.empty;
    expect(fixed, `fixed — remove from LEFTOVER_PRESELECT_WORKLIST:\n${fixed.join('\n')}`).is.empty;
  }).timeout(600_000);

  it('every input step and every branch pick of an in-scope play preview is ADDRESSED (the composer stamps what the preview carries)', () => {
    const missing: Array<string> = [];
    forEachInScopeProjectCard((Factory, name, module) => {
      const a = table(Factory, PROFILES[0]);
      if (a === undefined || !playable(a)) {
        return;
      }
      let preview: ActionPreview;
      try {
        preview = playPreviewWithTableQuestions(a.player, a.card);
      } catch {
        return;
      }
      for (const branch of preview.branches) {
        if (branch.available && branch.index >= 0 && branch.for === undefined) {
          missing.push(`${module}/${name} :: branch ${branch.index} has no address`);
        }
        for (const step of branch.steps) {
          if (step.kind === 'input' && step.for === undefined && !['space', 'party', 'colony'].includes(step.input.type)) {
            missing.push(`${module}/${name} :: a ${step.input.type} step has no address`);
          }
        }
      }
    });
    expect(missing, `\n${missing.join('\n')}\n`).is.empty;
  }).timeout(300_000);
});

/** The measurement behind the iteration's «who re-asked BEFORE the law» table — `TM_REPLAY_BEFORE=1`. */
if (process.env.TM_REPLAY_BEFORE !== undefined) {
  describe('card-play replay coverage — the UNADDRESSED measurement', () => {
    it('prints who re-asks with the client before the address', () => {
      const {failures, verified} = sweep(true);
      console.log(`\n[replay before] verified ${verified} play(s); re-asked / never landed:\n  ${failures.join('\n  ')}`);
    }).timeout(600_000);
  });
}

// Keep the CardName import honest for readers grepping the guard's subjects.
void CardName.SPONSORED_ACADEMIES;
