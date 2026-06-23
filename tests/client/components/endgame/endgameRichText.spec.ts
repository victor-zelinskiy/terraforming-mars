import {expect} from 'chai';
import {buildNarrativeTokens} from '@/client/components/endgame/endgameRichText';
import {Color} from '@/common/Color';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';

const detail = (): ChipDetail => ({title: 'x', explanation: 'y', evidence: []});

describe('endgameRichText.buildNarrativeTokens (Iteration 17 §4)', () => {
  it('splits a template into text + term tokens by ${n}', () => {
    const tokens = buildNarrativeTokens('Plans: ${0} vs ${1}.', [
      {text: 'Nastya', kind: 'player', color: 'red' as Color},
      {text: 'Cities & greenery', kind: 'strategy', detail: detail()},
    ]);
    expect(tokens.map((t) => t.type)).to.deep.eq(['text', 'term', 'text', 'term', 'text']);
    expect(tokens[1]).to.include({type: 'term', kind: 'player', text: 'Nastya'});
    expect(tokens[3]).to.include({type: 'term', kind: 'strategy', text: 'Cities & greenery'});
  });

  it('inlines a param without a kind as plain text (no term)', () => {
    const tokens = buildNarrativeTokens('A ${0} B', [{text: 'plain'}]);
    expect(tokens).to.deep.eq([{type: 'text', text: 'A '}, {type: 'text', text: 'plain'}, {type: 'text', text: ' B'}]);
  });

  it('leaves an out-of-range placeholder literal (never throws)', () => {
    const tokens = buildNarrativeTokens('x ${5} y', []);
    expect(tokens.some((t) => t.type === 'text' && t.text === '${5}')).to.be.true;
  });

  it('handles a template with no placeholders', () => {
    expect(buildNarrativeTokens('just text', [])).to.deep.eq([{type: 'text', text: 'just text'}]);
  });
});
