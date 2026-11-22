import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {promptFlagsVerdict} from '@/client/console/servingOwnerMeasure';
import {Ownership} from '@/client/console/servingOwner';

/**
 * A PRESENCE FINISHING IS NOT A SECOND ANSWER (FREEZE ZERO, stage 2 — the one-owner law's standing residue).
 *
 * `invariant/broken/serving-owner:second-surface` stood under nine GREEN tests of the whole suite (CI, 2026-11-22):
 * «`deckPick` stands for `colony` beside the function's answer `colonies@hand held admission:played-hero`». The deck
 * pick's surface stays up PAST its own answer by design — the picks fly into the dock, the rest tumble away, the
 * played card rises out of it (`deckPickHolding`) — and the look that followed read that outgoing beat as a surface
 * SERVING the next question. The law judges the surfaces that serve; the flag it is given says so now.
 */
describe('the deck pick\'s outgoing beat is no second surface of the one-owner law', () => {
  const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../src/client/console/shell', file), 'utf8').replace(/\r\n/g, '\n');

  it('the pure verdict: a prompt surface standing under a hold is the law broken — and nothing standing is the hold, kept', () => {
    const held = {asked: true, owner: 'colonies', host: 'hand', hold: {kind: 'admission', block: 'played-hero'}} as unknown as Ownership;
    expect(promptFlagsVerdict(held, ['deckPick'])).to.equal('flag-EXTRA:admission:deckPick');
    expect(promptFlagsVerdict(held, [])).to.equal('flag-held');
  });

  it('the controller names the outgoing beat: on stage by its own hold, and NOT the function\'s owner of what is asked', () => {
    const reveal = read('revealController.ts');
    expect(reveal).to.match(/const deckPickOutgoing = computed\(\(\): boolean => \{\s+return deckPickUnheld\.value && deckPickHolding\(\) && !shell\.ownerServes\('deck-pick'\);/);
    // …while a NEW deck pick asked over the last one's beat is served — the function names it, the flag stands.
    expect(reveal).to.match(/return deckPickUnheld\.value && \(deckPickHolding\(\) \|\| shell\.ownerServes\('deck-pick'\)\);/);
  });

  it('the law is given the surfaces that SERVE — the deck pick without its outgoing beat', () => {
    const wiring = read('wiringController.ts');
    expect(wiring).to.contain('[\'deckPick\', shell.deckPickServing && !shell.deckPickOutgoing]');
    // The pad and the bar keep reading the surface itself: the outgoing beat still owns its own presses.
    expect(read('padRouterController.ts')).to.contain('deckPick: () => shell.deckPickServing,');
  });
});
