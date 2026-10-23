import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {composerReArms, playComposerOutlived} from '../../src/client/console/played/playComposerLifetime';

/**
 * THE PLAY COMPOSER ANSWERS ONE PROMPT (`playComposerLifetime.ts`) — the field report of 2026-10-23: «Корпоративный
 * шпионаж» pushed MarsBot back, the Hydronetwork played the move, and A on its result posted the SAME play again —
 * «Сбой системы · Unknown card name Corporate Espionage».
 *
 * Once every other seat has passed (and in every solo game) each action menu reads «Take your next action», so the
 * prompt KEY could not tell the menu the play answered from the next one: the composer outlived its accepted play,
 * re-armed itself on the response, and — the espionage arming no landing scene — took the next A from under the
 * track. The serial (`promptId`) is the server's own identity of a prompt, kept across a refusal.
 */
describe('playComposerLifetime — the composer answers ONE prompt', () => {
  describe('composerReArms', () => {
    it('re-arms a composer that has answered nothing', () => {
      expect(composerReArms({answeredFor: undefined, live: 7})).to.be.true;
      expect(composerReArms({answeredFor: undefined, live: undefined})).to.be.true;
    });

    it('re-arms while the answered prompt still stands (a view that is not the answer)', () => {
      expect(composerReArms({answeredFor: 7, live: 7})).to.be.true;
    });

    it('NEVER re-arms once the server holds another prompt — the play was taken (the field report)', () => {
      // The next «Take your next action» menu: same key, another serial.
      expect(composerReArms({answeredFor: 7, live: 8})).to.be.false;
      // The turn passed on: no prompt at all.
      expect(composerReArms({answeredFor: 7, live: undefined})).to.be.false;
    });
  });

  describe('playComposerOutlived', () => {
    const base = {composedFor: 7, live: 8, heroOwns: false, outcomeOwns: false};

    it('releases a composer whose prompt the server no longer holds — the espionage case', () => {
      expect(playComposerOutlived(base)).to.be.true;
      expect(playComposerOutlived({...base, live: undefined})).to.be.true;
    });

    it('keeps a composer while its prompt stands', () => {
      expect(playComposerOutlived({...base, live: 7})).to.be.false;
    });

    it('keeps a composer the landing scene owns — its phases end it', () => {
      expect(playComposerOutlived({...base, heroOwns: true})).to.be.false;
    });

    it('keeps a composer while the play\'s own outcome is handed off in its host', () => {
      expect(playComposerOutlived({...base, outcomeOwns: true})).to.be.false;
    });

    it('never releases on an unknown serial (a composer from before the stamp)', () => {
      expect(playComposerOutlived({...base, composedFor: undefined})).to.be.false;
    });
  });

  /*
   * The three places that hold the class shut — read off the source (the repo's guard idiom: no mount of a shell this
   * size). Each line names what it protects; a refactor that drops one fails here, by name.
   */
  describe('the wiring', () => {
    const ROOT = path.resolve(__dirname, '..', '..', 'src', 'client');
    const code = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
    const composer = code(path.join('components', 'console', 'ConsolePlayCardConfirm.vue'));
    const shell = code(path.join('components', 'console', 'ConsoleShell.vue'));
    const transport = code(path.join('console', 'transport', 'gameTransport.ts'));

    it('the composer re-arms on a view only through composerReArms, and records what it answered', () => {
      const watcher = /\n {4}playerView\(\) \{([\s\S]*?)\n {4}\},/.exec(composer)?.[1] ?? '';
      expect(watcher, 'the playerView watcher').to.not.eq('');
      expect(watcher).to.match(/composerReArms\(/);
      expect(composer).to.match(/this\.answeredFor = this\.playerView\.waitingFor\?\.promptId/);
    });

    it('the shell releases an outlived composer and stamps the play with the prompt it was opened on', () => {
      expect(shell).to.match(/playComposerOutlived\(\{/);
      expect(shell).to.match(/promptId: this\.playerView\.waitingFor\?\.promptId\}/);
      const stamped = shell.match(/this\.submitBatch\(batch, pending\.promptId\)/g) ?? [];
      expect(stamped.length, 'both play submits (the espionage and the landing-scene one) carry the stamp').to.eq(2);
      expect(transport).to.match(/promptId: composedFor \?\? currentWaitingFor\(\)\?\.promptId/);
    });

    it('a hydro frame over the hand owns the pad and the bar — never the covered composer', () => {
      expect(shell).to.match(/isBlockadeExecutionActive\(\) \|\| this\.handCoveredByHydro;/);
      expect(shell).to.match(/if \(this\.handCoveredByHydro\) \{\s*return consoleHydroUi\.commands/);
    });

    it('the espionage play refuses a second confirm while its execution stands', () => {
      const branch = /if \(payload\.espionage !== undefined\) \{([\s\S]*?)\n {6}\}/.exec(shell)?.[1] ?? '';
      expect(branch).to.match(/this\.hydroFlow\.commit !== undefined \|\| isHydroMarkerActive\(\)/);
    });
  });
});
