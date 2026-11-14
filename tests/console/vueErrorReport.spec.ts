import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {componentChainOf, VUE_ERROR_TAG, vueErrorLine} from '@/client/console/vueErrorReport';
import type {ComponentPublicInstance} from 'vue';

/*
 * A VUE ERROR NAMES ITS COMPONENT, and every e2e spec is red on it (the field
 * export of game-pdb19bfa, 2026-11-07, carried fourteen minified patch errors
 * and no surface's name).
 */
describe('vueErrorReport — a Vue error is a tagged line naming its component', () => {
  it('the line leads with the tag, then the chain, the phase and the message', () => {
    const line = vueErrorLine(new TypeError('Cannot read properties of null (reading \'emitsOptions\')'),
      'ConsoleColonyFleetBar < ConsoleColoniesSection', 'scheduler flush');
    expect(line).to.eq('[vue-error] ConsoleColonyFleetBar < ConsoleColoniesSection · scheduler flush: TypeError: Cannot read properties of null (reading \'emitsOptions\')');
    expect(line.startsWith(VUE_ERROR_TAG)).to.eq(true);
  });

  it('the chain names the component and its nearest ancestors', () => {
    const shell = {type: {name: 'ConsoleShell'}, parent: null};
    const section = {type: {__name: 'ConsoleColoniesSection'}, parent: shell};
    const bar = {type: {name: 'ConsoleColonyFleetBar'}, parent: section};
    expect(componentChainOf({$: bar} as unknown as ComponentPublicInstance))
      .to.eq('ConsoleColonyFleetBar < ConsoleColoniesSection < ConsoleShell');
    expect(componentChainOf(null)).to.eq('app');
  });

  it('a VAPOR component hands the handler its internal instance itself — no `$` — and the chain is read from it', () => {
    // (Since `createVaporApp` every component is one: reading `instance.$.type` threw inside the handler, and the
    // `[vue-error]` line of the product was never printed.)
    const shell = {type: {__name: 'ConsoleShell'}, parent: null};
    const hand = {type: {__name: 'ConsoleHandSection'}, parent: shell};
    const dock = {type: {__name: 'ConsoleHandDock'}, parent: hand};
    expect(componentChainOf(dock as unknown as ComponentPublicInstance)).to.eq('ConsoleHandDock < ConsoleHandSection < ConsoleShell');
    // …and nothing an instance can look like makes the handler throw: it would take the error it reports with it.
    for (const odd of [undefined, {}, {type: undefined, parent: undefined}, {$: undefined}, {parent: {parent: {}}}, 7, 'x']) {
      expect(() => componentChainOf(odd as unknown as ComponentPublicInstance), JSON.stringify(odd)).to.not.throw();
    }
    expect(componentChainOf({} as unknown as ComponentPublicInstance)).to.eq('Anonymous');
    expect(componentChainOf(undefined)).to.eq('app');
  });

  it('the app installs it, and the e2e harness turns the same tag red', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '../../src/client/main.ts'), 'utf8');
    expect(main).to.match(/installVueErrorReport\(app\);/);
    const harness = fs.readFileSync(path.resolve(__dirname, '../e2e/consoleTest.ts'), 'utf8');
    expect(harness).to.include(`const VUE_ERROR_TAG = '${VUE_ERROR_TAG}';`);
    expect(harness).to.match(/vueErrorGuard: \[async/);
  });
});
