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
      expect(admit).to.include('b.active && b.colonyName === this.colony.name ? b.slotIndex : -1');
      expect(admit).to.not.match(/setTimeout|delayedCall/);
    });

    it('the build preview asks whether the aimed berth is empty — it never counts cubes against the limit', () => {
      const preview = memberOf(stage, 'buildPreview');
      expect(preview).to.include('this.colony.colonies[this.nextBuildSlot] === undefined');
      expect(preview).to.not.match(/[<>]=?\s*3\b/);
      expect(memberOf(stage, 'nextBuildSlot')).to.include('nextBuildSlot(this.colony, this.buildSite)');
    });

    it('a flight that could not be played is published on the section\'s root', () => {
      const raw = read('src', 'client', 'components', 'console', 'ConsoleColoniesSection.vue');
      expect(raw).to.include(':data-colony-build-degraded="buildState.degraded ? \'\' : undefined"');
    });
  });
});
