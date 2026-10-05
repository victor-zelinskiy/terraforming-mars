import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A CITY ON A COLONY TILE — THE WIRING (Turmoil Redux TR22 Nova City;
 * docs/TURMOIL_REDUX_NOVA_CITY.md). The scene's controller is unit-tested
 * (tests/client/console/colonyCity.spec.ts) and the whole journey is an e2e
 * (tests/e2e/console-nova-city.spec.ts); what neither can pin cheaply is WHERE
 * the pieces are plugged into the shell, the transport and the section — the
 * places a later refactor silently unplugs. Source guards, the server runner.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: Array<string>) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
/** Code only: block and line comments dropped (a comment may quote what the guard forbids). */
const code = (raw: string) => raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** The body of a method / computed `name(...) {` — up to the next member at the same indent. */
function memberOf(source: string, name: string): string {
  const start = source.search(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\)[^\\n]*\\{\\n`));
  expect(start, `the shell still has «${name}»`).to.be.greaterThan(-1);
  const rest = source.slice(start + 1);
  const end = rest.search(/\n {4}},\n/);
  return rest.slice(0, end === -1 ? undefined : end);
}

describe('a city on a colony tile — the wiring', () => {
  const shell = code(read('src', 'client', 'components', 'console', 'ConsoleShell.vue'));
  const transport = code(read('src', 'client', 'console', 'transport', 'gameTransport.ts'));
  const section = code(read('src', 'client', 'components', 'console', 'ConsoleColoniesSection.vue'));
  const app = code(read('src', 'client', 'components', 'App.vue'));

  describe('the door — one model, one confirm', () => {
    it('the resolver hands the server\'s `tileSite` marker to the grid from the live AND the staged prompt (one model for both doors)', () => {
      const resolver = memberOf(shell, 'colonyPick');
      expect(resolver).to.include('model.tileSite !== undefined ? {tileSite: model.tileSite} : {}');
      // …read off `colonyModel`, which is the live prompt or the staged store's — never a second resolver.
      expect(resolver).to.include('const model = this.colonyModel;');
    });

    it('the landing is ARMED in exactly two places — the staged commit and the live confirm — and nowhere before A', () => {
      const arms = shell.split('\n').filter((line) => /\barmColonyCity\(/.test(line));
      expect(arms, 'two call sites').to.have.length(2);
      expect(memberOf(shell, 'commitStagedColony')).to.match(/staged\.prompt\.tileSite[\s\S]*armColonyCity\(/);
      expect(memberOf(shell, 'onColonyPickConfirm')).to.match(/pick\.tileSite !== undefined[\s\S]*armColonyCity\(/);
    });

    it('the staged door outranks the live branch: a staged `city` pick commits the play\'s ONE tail, never a bare colony answer', () => {
      const confirm = memberOf(shell, 'onColonyPickConfirm');
      expect(confirm.indexOf('pick.staged === true'), 'the staged branch').to.be.greaterThan(-1);
      expect(confirm.indexOf('pick.staged === true')).to.be.lessThan(confirm.indexOf('pick.tileSite !== undefined'));
    });

    it('the live confirm pins the stage and crosses the commit boundary before it submits', () => {
      const confirm = memberOf(shell, 'onColonyPickConfirm');
      const branch = confirm.slice(confirm.indexOf('pick.tileSite !== undefined'), confirm.indexOf('pick.trackMoves !== undefined'));
      for (const step of ['holdFocusStage()', 'markColonyFocusCommitting()', 'setWorkspaceFramePhase(\'colonies\', \'committed\')', 'armColonyCity(', 'this.submit(colonyResponse(']) {
        expect(branch, step).to.include(step);
      }
      expect(branch.indexOf('armColonyCity('), 'armed BEFORE the POST').to.be.lessThan(branch.indexOf('this.submit('));
    });
  });

  describe('the verbs — by intent', () => {
    it('the `city` stage: A confirms («Play card» on the staged door, the server\'s verb on a live one) · X inspects · L3 the source · B back', () => {
      const commands = memberOf(shell, 'commands');
      const at = commands.indexOf('intent === \'city\'');
      expect(at, 'the bar knows the act').to.be.greaterThan(-1);
      const branch = commands.slice(at, commands.indexOf('intent !== \'trade\'', at));
      expect(branch).to.include('staged ? \'Play card\' : (this.colonyPick?.labelKey ?? \'Select\')');
      expect(branch).to.match(/control: 'secondary', label: 'Inspect'/);
      expect(branch).to.match(/colonyEmbedSourceCard !== undefined \? \[\{control: 'stickL' as GlyphControl, label: 'Source'\}\]/);
      expect(branch).to.match(/control: 'back', label: 'Back'/);
    });

    it('while the piece is in the air or the stage folds home the bar advertises nothing and A only presses the scene through', () => {
      expect(memberOf(shell, 'commands')).to.match(/if \(isColonyCityInputLocked\(\)\) \{\s*return \[\];\s*\}/);
      expect(shell).to.match(/if \(isColonyCityInputLocked\(\)\) \{\s*if \(intent\.kind === 'press' && action === 'primary'\) \{\s*hurryColonyCity\(\);\s*\}\s*return true;\s*\}/);
    });
  });

  describe('the gate — the commit is held to the contact', () => {
    it('the transport verifies the armed landing and awaits the scene with its own named hold, between the roster\'s gate and the build\'s', () => {
      const roster = transport.indexOf('detectColonyRosterChange(currentView(), newView)');
      const city = transport.indexOf('detectColonyCity(currentView(), newView)');
      const build = transport.indexOf('detectColonyBuild(currentView(), newView)');
      expect(roster).to.be.greaterThan(-1);
      expect(city, 'after the roster').to.be.greaterThan(roster);
      expect(build, 'before the build').to.be.greaterThan(city);
      const gate = transport.slice(city, build);
      expect(gate).to.match(/transportHolds\.colonyCity = true;\s*try \{\s*await runColonyCity\(colonyCityEvent\);\s*\} finally \{\s*transportHolds\.colonyCity = false;/);
      expect(transport, 'the hold is a transport hold like every cinematic gate').to.match(/h\.colonyRoster \|\| h\.colonyCity/);
    });

    it('a refused answer drops the hold and the arm (the abort battery)', () => {
      expect(transport).to.match(/transportHolds\.colonyCity = false;\s*disarmColonyCity\(\);/);
    });

    it('a watcher\'s landing is seeded in BOTH apply blocks — the transport\'s and the poll / WS frame\'s', () => {
      expect(transport).to.include('seedColonyCityHolds(currentView(), newView);');
      expect(app).to.include('seedColonyCityHolds(prevView as PlayerViewModel | undefined, model as PlayerViewModel);');
    });
  });

  describe('the three outcomes of the staged door, and HOME', () => {
    it('RE-ASKED drops the arm; LANDED goes home; PARKED clears with the step', () => {
      const settle = memberOf(shell, 'settleStagedColony');
      expect(settle).to.match(/if \(reAsked\) \{[\s\S]*disarmColonyCity\(\);[\s\S]*return;\s*\}/);
      expect(settle).to.match(/if \(colonyCityState\.receipt !== undefined\) \{\s*void this\.landColonyCity\(\);\s*return;\s*\}/);
      expect(memberOf(shell, 'endStagedColony')).to.include('clearColonyCity();');
    });

    it('HOME waits for the scene, folds the stage into its tile, reads the receipt, then ends the staged play — or hands the screen on', () => {
      const home = memberOf(shell, 'landColonyCity');
      const order = ['setColonyCityHoming(true)', 'await colonyCitySceneDone()', 'section.retargetFocusHome(receipt.colony)', 'closeColonyFocus()',
        'await dwell(COLONY_ROSTER_LANDING_MS + ROSTER_READ_MS)', 'clearColonyCity()', 'this.endStagedColony()', 'this.settleColonyFollowUp()'];
      let from = 0;
      for (const step of order) {
        const at = home.indexOf(step, from);
        expect(at, `«${step}» in order`).to.be.greaterThan(-1);
        from = at;
      }
      expect(home, 'entered once').to.match(/if \(colonyCityState\.homing\) \{\s*return;\s*\}/);
    });

    it('a live door\'s landing goes home from the follow-up\'s end, and the colonies frame lives through the scene and the homing beat', () => {
      expect(memberOf(shell, 'settleColonyFollowUp')).to.match(/if \(colonyCityState\.receipt !== undefined\) \{\s*void this\.landColonyCity\(\);\s*return;\s*\}/);
      expect(memberOf(shell, 'colonyFollowUpLive')).to.include('colonyCityPending() || colonyCityState.homing');
    });
  });

  describe('the grid as a receipt — ONE reading for every flow that folds its stage home', () => {
    it('`receiptOn` is the roster\'s receipt OR the city\'s OR a card-built colony\'s (TR25) — the roster\'s own reading is untouched', () => {
      expect(section).to.match(/receiptOn\(\): boolean \{\s*return this\.rosterReceiptOn \|\| this\.cityReceiptOn \|\| this\.buildReceiptOn;\s*\}/);
      expect(section).to.match(/rosterReceiptOn\(\): boolean \{/);
      expect(section).to.include(':data-colony-roster-receipt="rosterReceiptOn ? \'\' : undefined"');
      expect(section).to.include(':data-colony-city-receipt="cityReceiptOn ? \'\' : undefined"');
    });

    it('nothing folds the stage under the piece: the section\'s own completion yields to an answered city', () => {
      expect(section).to.match(/if \(this\.cityAnswered\) \{\s*return;\s*\}/);
    });
  });

  describe('the layer', () => {
    it('is mounted by the SHELL beside the build layer — never inside a teleported surface', () => {
      expect(shell).to.match(/<ConsoleColonyBuildLayer \/>\s*<ConsoleColonyCityLayer \/>/);
    });
  });
});
