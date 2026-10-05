import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A COLONY BUILT BY A CARD — THE WIRING OF THE DOOR (Turmoil Redux TR25
 * Exclusive Colony; docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md). The models are
 * unit-tested (tests/console/colonyBerths.spec.ts, the client specs of the
 * build transaction and of the staged store) and the whole journey is an e2e
 * (tests/e2e/console-exclusive-colony.spec.ts); what neither can pin cheaply
 * is WHERE the pieces are plugged into the shell and the section — the places
 * a later refactor silently unplugs. Source guards, the server runner.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: Array<string>) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
/** Code only: block and line comments dropped (a comment may quote what the guard forbids). */
const code = (raw: string) => raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** The body of a method / computed `name(...) {` — up to the next member at the same indent. */
function memberOf(source: string, name: string): string {
  const start = source.search(new RegExp(`\\n {4}(?:async )?${name}\\(`));
  expect(start, `the source still has «${name}»`).to.be.greaterThan(-1);
  const rest = source.slice(start + 1);
  const end = rest.search(/\n {4}},\n/);
  return rest.slice(0, end === -1 ? undefined : end);
}

describe('a colony built by a card — the wiring of the door', () => {
  const shell = code(read('src', 'client', 'components', 'console', 'ConsoleShell.vue'));
  const section = code(read('src', 'client', 'components', 'console', 'ConsoleColoniesSection.vue'));
  const stage = code(read('src', 'client', 'components', 'console', 'ConsoleColonyFocusStage.vue'));
  const model = code(read('src', 'client', 'console', 'consoleColoniesModel.ts'));

  describe('the act — the marker, never the label', () => {
    it('`colonyPickIntent` reads `buildSites` and no button label at all', () => {
      const start = model.indexOf('export function colonyPickIntent');
      const body = model.slice(start, model.indexOf('\n}\n', start));
      expect(body).to.include('pick.buildSites !== undefined ? \'build\' : \'pick\'');
      expect(body, 'no label in the derivation').to.not.include('buttonLabel');
    });

    it('the resolver hands the server\'s `buildSites` to the grid from the live AND the staged prompt (one model for both doors)', () => {
      const resolver = memberOf(shell, 'colonyPick');
      expect(resolver).to.include('const model = this.colonyModel;');
      expect(resolver).to.include('buildSites: model.buildSites');
      // The grid's projection is a CARD's door only: the prompt names a card as its giver (staged or re-asked).
      expect(resolver).to.include('model.choiceContext?.source.kind === \'card\' ? {buildProjected: true} : {}');
    });
  });

  describe('the commit — ONE body for both doors', () => {
    it('a build of a colony is armed by `armColonyBuildCommit` (both doors) and by the roster\'s own confirm — nowhere else', () => {
      const arms = shell.split('\n').filter((line) => /\barmColonyBuild\(/.test(line));
      expect(arms, 'two call sites').to.have.length(2);
      expect(memberOf(shell, 'armColonyBuildCommit')).to.include('armColonyBuild(');
      expect(memberOf(shell, 'onColonyRosterConfirm')).to.include('armColonyBuild(');
      expect(memberOf(shell, 'onColonyBuildConfirm'), 'the confirm never arms the hero itself').to.not.include('armColonyBuild(');
    });

    it('the confirm calls that body once per door, the staged door first', () => {
      const confirm = memberOf(shell, 'onColonyBuildConfirm');
      const calls = confirm.split('this.armColonyBuildCommit(').length - 1;
      expect(calls).to.eq(2);
      expect(confirm).to.include('this.armColonyBuildCommit(selected, pick, payload, \'staged\')');
      expect(confirm).to.include('this.armColonyBuildCommit(selected, pick, payload, \'live\')');
      expect(confirm.indexOf('pick.staged === true'), 'the staged branch').to.be.greaterThan(-1);
      expect(confirm.indexOf('pick.staged === true')).to.be.lessThan(confirm.indexOf('closeConsoleLayers()'));
    });

    it('the berth is the SERVER\'s — the pick\'s marker, never a clamp — and the stage is pinned before the hero is armed', () => {
      const body = memberOf(shell, 'armColonyBuildCommit');
      expect(body).to.include('nextBuildSlot(selected, buildSiteOf(pick.buildSites, selected.name))');
      expect(body.indexOf('holdFocusStage()')).to.be.greaterThan(-1);
      expect(body.indexOf('holdFocusStage()')).to.be.lessThan(body.indexOf('armColonyBuild('));
      expect(body, 'the answers of the bonus\'s own steps').to.include('stepResponse(step, payload?.captures[i])');
    });

    it('the STAGED door posts ONE batch: the addressed colony, then the bonus\'s answers — and claims the colony\'s follow-up after the play\'s', () => {
      const confirm = memberOf(shell, 'onColonyBuildConfirm');
      const staged = confirm.slice(confirm.indexOf('pick.staged === true'), confirm.indexOf('closeConsoleLayers()'));
      expect(staged).to.include('stagedFor: staged.sourceCard');
      expect(staged).to.include('build.tail');
      expect(staged).to.include('this.claimColonyBuildOutcome(');
      expect(staged, 'nothing is submitted around the staged funnel').to.not.match(/this\.submit(Batch)?\(/);
      const tail = memberOf(shell, 'commitStagedTail');
      expect(tail).to.include('this.submitBatch([...arm.batch, response, ...following])');
      // The step's own claim is made AFTER the play's optimistic one (the nearer host receives the follow-up).
      expect(tail.indexOf('claimPlayOutcome(')).to.be.lessThan(tail.indexOf('claim?.()'));
      expect(tail.indexOf('claim?.()')).to.be.lessThan(tail.lastIndexOf('this.submitBatch('));
    });

    it('the LIVE door keeps its own two sends and its claim', () => {
      const confirm = memberOf(shell, 'onColonyBuildConfirm');
      const live = confirm.slice(confirm.indexOf('closeConsoleLayers()'));
      expect(live).to.include('this.claimColonyBuildOutcome(selected.name as ColonyName, build.slot)');
      expect(live).to.include('this.submitBatch([colonyResponse(selected.name), ...build.tail])');
      expect(live).to.include('this.submit(colonyResponse(selected.name))');
    });
  });

  describe('the ending — HOME, by the roster\'s and the city\'s grammar', () => {
    it('a LANDED staged build goes home; the receipt is read before the step and the play end', () => {
      const settle = memberOf(shell, 'settleStagedColony');
      expect(settle).to.match(/colonyBuildState\.door === 'staged'[\s\S]*void this\.landColonyBuild\(\)/);
      const land = memberOf(shell, 'landColonyBuild');
      expect(land).to.include('this.colonyBuildContinuationOwed');
      expect(land).to.include('section.retargetFocusHome(receipt.colony)');
      expect(land.indexOf('closeColonyFocus()')).to.be.lessThan(land.indexOf('this.endStagedColony()'));
      // Its waits are STATE (the cube's scene, what the bonus still owes) — the one dwell is the receipt's read.
      expect(land.split('await dwell(').length - 1, 'one dwell').to.eq(1);
    });

    it('what a landed build still owes inside its stage is asked by structure — a claim, a scene, a nested step, the prompt\'s own source', () => {
      const owed = memberOf(shell, 'colonyBuildContinuationOwed');
      expect(owed).to.include('workspaceOutcomeState.host === \'colonies\' && workspaceOutcomeClaimed()');
      expect(owed).to.include('colonyResolutionUi.cardSceneLive');
      expect(owed).to.include('workspaceFrameHasNested(\'colonies\')');
      expect(owed).to.include('source?.kind === \'colony\'');
      expect(owed, 'a board placement leaves for the board — it is never waited for here').to.include('wf.type !== \'space\'');
      expect(owed, 'never a title').to.not.include('.title');
    });

    it('the Parliament\'s delegate grant (the Redux Venus) is NOT owed inside the stage — it stands in the section\'s zone AFTER the stage went home', () => {
      // Under a standing stage it was a Parliament drawn over a lit track with the stage's verbs on the bar.
      const owed = memberOf(shell, 'colonyBuildContinuationOwed');
      expect(owed, 'a hosted Parliament does not hold the stage').to.include('workspaceFrameHost(\'parliament\') !== \'colonies\'');
      expect(owed, 'a party prompt does not hold the stage').to.include('wf.type !== \'party\'');
      const grant = memberOf(shell, 'colonyBuildGrantPrompt');
      expect(grant, 'the grant by the server\'s markers').to.include('wf.votePrompt?.source === \'grant\'');
      expect(grant).to.include('source?.kind === \'colony\'');
      expect(grant, 'never a title').to.not.include('.title');
      expect(memberOf(shell, 'colonyBuildSectionStepOwed')).to.include('workspaceFrameHost(\'parliament\') === \'colonies\' || this.colonyBuildGrantPrompt');
      // The grant's door is HELD while a card's build stage stands…
      const door = memberOf(shell, 'openShellTaskSurface');
      expect(door).to.include('if (partyStep && colonyBuildAnswered() && this.colonyFocus.open) {');
      // …and the landing opens it once the stage has left, then waits for the step before the receipt is read.
      const land = memberOf(shell, 'landColonyBuild');
      const fold = land.indexOf('closeColonyFocus()');
      const open = land.indexOf('this.openShellTaskSurface(task)');
      const wait = land.indexOf('this.colonyBuildSectionStepOwed');
      const read = land.indexOf('await dwell(');
      expect(fold, 'the fold').to.be.greaterThan(-1);
      expect(open, 'the door after the fold').to.be.greaterThan(fold);
      expect(wait, 'the step is waited for after its door').to.be.greaterThan(open);
      expect(read, 'the receipt is read after the step').to.be.greaterThan(wait);
    });

    it('the re-asked door and the end of the step both drop the receipt', () => {
      expect(memberOf(shell, 'settleStagedColony')).to.include('clearColonyBuildReceipt()');
      expect(memberOf(shell, 'endStagedColony')).to.include('clearColonyBuildReceipt()');
    });

    it('the section never folds the stage under a staged build, and states the result as the ONE receipt reading', () => {
      const complete = memberOf(section, 'completeFlow');
      expect(complete).to.include('this.buildAnswered');
      expect(memberOf(section, 'receiptOn')).to.include('this.rosterReceiptOn || this.cityReceiptOn || this.buildReceiptOn');
      expect(memberOf(section, 'tileStatus'), 'an answered door offers and refuses nothing').to.include('this.buildAnswered');
    });
  });

  describe('the scene — the door\'s berth, the admission, the confession', () => {
    it('the stage hands the instrument the door\'s berth, the builder\'s colour and the admission beat', () => {
      const raw = read('src', 'client', 'components', 'console', 'ConsoleColonyFocusStage.vue');
      expect(raw).to.include(':buildSlot="buildPreview ? nextBuildSlot : -1"');
      expect(raw).to.include(':admitCell="admitCell"');
      expect(raw).to.include(':projectedColor="buildProjected && viewerColor !== undefined ? viewerColor : \'\'"');
    });

    it('the admission is the build transaction\'s own state — never a timer', () => {
      const admit = memberOf(stage, 'admitCell');
      expect(admit).to.include('b.active && b.colonyName === this.colony.name && berthIsOverLimit(b.slotIndex) ? b.slotIndex : -1');
      expect(admit).to.not.match(/setTimeout|delayedCall/);
    });

    it('the build preview asks whether the aimed berth is empty — it never counts cubes against the limit', () => {
      const preview = memberOf(stage, 'buildPreview');
      expect(preview).to.include('this.colony.colonies[this.nextBuildSlot] === undefined');
      expect(preview).to.not.match(/[<>]=?\s*3\b/);
      expect(memberOf(stage, 'nextBuildSlot')).to.include('nextBuildSlot(this.colony, this.buildSite)');
    });

    it('past the press EVERY colony act speaks ONE status on the bar — «Выполняется…» on the stage, «Выполнено» on the receipt grid', () => {
      const commands = memberOf(shell, 'commands');
      // The stage: ONE check, before every intent's own verbs (a card's build, a roster change, a city, a track).
      const stage = commands.slice(commands.indexOf('const intent = this.colonyFocus.intent;'));
      const stageStatus = stage.indexOf('if (this.colonyActAnswered) {');
      expect(stageStatus, 'the stage asks the act first').to.be.greaterThan(-1);
      expect(stageStatus, '…before the dossier\'s and every act\'s verbs').to.be.lessThan(stage.indexOf('if (intent === \'inspect\') {'));
      expect(stage.slice(stageStatus, stageStatus + 140)).to.include('label: \'Performing…\', enabled: false');
      const answered = memberOf(shell, 'colonyActAnswered');
      expect(answered).to.include('case \'build\': return colonyBuildAnswered();');
      expect(answered).to.include('case \'roster\': return colonyRosterAnswered();');
      expect(answered).to.include('case \'city\': return colonyCityAnswered();');
      expect(answered).to.include('case \'track\': return colonyTrackMoveAnswered();');
      // The city's scene no longer blanks the bar (it speaks the same grammar); its INPUT stays the scene's.
      expect(commands, 'no silent bar for the city').to.not.match(/if \(isColonyCityInputLocked\(\)\) \{\s*return \[\];/);
      // The grid: the section's ONE receipt reading, mirrored for the bar — roster, city and a card's build alike.
      const grid = commands.slice(commands.indexOf('if (this.consoleState.section === \'colonies\') {'));
      const gridStatus = grid.indexOf('if (consoleColoniesUi.receipt) {');
      expect(gridStatus, 'the grid\'s branch asks the receipt first').to.be.greaterThan(-1);
      expect(gridStatus, '…before the pick\'s verbs').to.be.lessThan(grid.indexOf('if (pick !== undefined) {'));
      expect(grid.slice(gridStatus, gridStatus + 140)).to.include('label: \'Completed\', enabled: false');
      expect(section, 'the section publishes its receipt reading').to.include('consoleColoniesUi.receipt = on;');
      // A card's build receipt belongs to the HOSTED instance (a fresh «Колонии» beside a parked flow is ordinary).
      expect(memberOf(section, 'buildReceipt')).to.include('this.embedded ? this.buildState.receipt ?? this.buildReceiptLatch : undefined');
      expect(memberOf(section, 'buildAnswered')).to.include('this.embedded && (colonyBuildAnswered() || this.buildReceipt !== undefined)');
    });

    it('a flight that could not be played is published by the transaction\'s own WITNESS — never by the section\'s render', () => {
      const witness = read('src', 'client', 'components', 'console', 'colonyBuild', 'ConsoleColonyBuildWitness.vue');
      expect(witness).to.include(':data-colony-build-degraded="colonyBuildState.degraded ? \'\' : undefined"');
      expect(witness).to.include(':data-colony-build-phase="colonyBuildState.active ? colonyBuildState.phase : undefined"');
      // The witness rides the cube's shell-mounted layer: it stands whatever surface is open.
      expect(read('src', 'client', 'components', 'console', 'colonyBuild', 'ConsoleColonyBuildLayer.vue')).to.include('<ConsoleColonyBuildWitness />');
      // AN ORDINARY BUILD'S PRESS PATH IS THE ONE IT ALWAYS WAS: the section's template reads nothing of the build
      // transaction (a phase read there re-rendered the whole surface on the press and on every beat — the cube's
      // proxy was born 10–25 ms later), and an ordinary berth admits nothing (the instrument's props stand still).
      const template = section.slice(0, section.indexOf('<script'));
      expect(template.length, 'the section\'s template was found').to.be.greaterThan(1000);
      expect(template).to.not.match(/buildState\.(phase|active|degraded)/);
      expect(memberOf(stage, 'admitCell')).to.include('berthIsOverLimit(b.slotIndex)');
    });
  });
});
