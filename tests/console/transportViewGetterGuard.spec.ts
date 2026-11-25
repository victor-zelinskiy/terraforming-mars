import {expect} from 'chai';
import * as fs from 'fs';

/*
 * A GETTER OF THE VIEW THAT LEAVES THE TRANSPORT ANSWERS «NOTHING» ONCE THE TRANSPORT HAS STOPPED — it never throws.
 *
 * `currentView()` is the transport's own word INSIDE a live commit: it throws when there is no root, which is how a
 * call out of order is found. Handed to another module as a getter (`() => currentView()`) it is read LATER — after
 * that module's own beats — and the game may be over by then: the generation's income flies for seconds, then asks
 * «where does the scene rise?»; after the last production of a game the transport has stopped. The getter threw
 * inside a detached scene: «unhandled rejection: game transport used before startGameTransport», eleven whole games
 * of eighty-four (FREEZE ZERO, the zero bar — the first error line of a whole game's log, 2026-11-25).
 *
 * The law: a view getter that leaves the module is `standingView` (`undefined` once stopped — the contract its
 * readers already type: `() => PlayerViewModel | undefined`). This guard refuses the throwing one as a closure.
 */
describe('the game transport — a view getter that leaves the module never throws', () => {
  const source = fs.readFileSync('src/client/console/transport/gameTransport.ts', 'utf8');

  it('no closure hands `currentView()` / `currentWaitingFor()` out to be read later', () => {
    const handedOut = [...source.matchAll(/\(\)\s*=>\s*current(?:View|WaitingFor)\(\)\s*[,)]/g)].map((match) => {
      const line = source.slice(0, match.index).split('\n').length;
      return `gameTransport.ts:${line}  ${match[0]}`;
    });
    expect(handedOut, 'hand `standingView` out instead — a getter read after the commit must answer «nothing», never throw').to.deep.eq([]);
  });

  it('`standingView` reads the root without asserting it', () => {
    const body = /function standingView\(\)[^{]*\{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
    expect(body, 'the getter exists').to.not.eq('');
    expect(body, 'it must not go through `theRoot()` (which throws)').to.not.match(/theRoot\(\)|currentView\(\)/);
    expect(body).to.match(/root\?\.playerView/);
  });
});
