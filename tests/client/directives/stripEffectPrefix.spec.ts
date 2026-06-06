import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent} from 'vue';
import {stripEffectPrefix} from '@/client/directives/stripEffectPrefix';

// Mounts a bare element carrying the directive with the given inner HTML and
// returns its resulting text (the directive runs on `mounted`).
function strip(innerHtml: string): string {
  const Host = defineComponent({
    directives: {stripEffectPrefix},
    template: `<div v-strip-effect-prefix>${innerHtml}</div>`,
  });
  return mount(Host).text();
}

describe('stripEffectPrefix directive', () => {
  it('strips the English "Effect: " label and uppercases the next letter', () => {
    expect(strip('Effect: when you play a card, gain 1 M€.')).to.eq('When you play a card, gain 1 M€.');
  });

  it('strips the Russian "Эффект: " label and uppercases the next letter', () => {
    expect(strip('Эффект: когда вы играете карту.')).to.eq('Когда вы играете карту.');
  });

  it('strips the label from a nested element (mirrors CardDescription markup)', () => {
    // Real structure: `(<span>Эффект: …</span>)` — the labelled text is in a child.
    expect(strip('(<span>Эффект: когда вы играете.</span>)')).to.eq('(Когда вы играете.)');
  });

  it('strips the label after a leading "(" in a single text node (Neptunian plainText)', () => {
    // `plainText('(Effect: …)')` is ONE text node beginning with "(Effect: ".
    expect(strip('(Effect: when any ocean is placed, gain energy.)')).to.eq('(When any ocean is placed, gain energy.)');
    expect(strip('(Эффект: когда выложен океан, получите энергию.)')).to.eq('(Когда выложен океан, получите энергию.)');
  });

  it('leaves text without the label untouched', () => {
    expect(strip('When you play a card, gain 1 M€.')).to.eq('When you play a card, gain 1 M€.');
  });

  it('is idempotent (an already-stripped node is unchanged)', () => {
    // Already stripped — no leading label, so nothing changes.
    expect(strip('Когда вы играете.')).to.eq('Когда вы играете.');
  });
});
