import {expect} from 'chai';
import {relationsFromPreview, relationToneOf} from '@/client/console/placementRelations';
import {BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {SpaceId} from '@/common/Types';

function fact(partial: Partial<BoardFact> & {id: string, category: BoardFact['category']}): BoardFact {
  return {
    timing: 'immediate',
    severity: 'positive',
    recipient: {kind: 'current-player'},
    title: partial.id,
    ...partial,
  } as BoardFact;
}

function preview(partial: Partial<BoardPlacementPreview>): BoardPlacementPreview {
  return {
    space: '10' as SpaceId,
    kind: 'city',
    legal: true,
    costFacts: [],
    immediateFacts: [],
    recipientFacts: [],
    warningFacts: [],
    futureScoringFacts: [],
    ruleFacts: [],
    ...partial,
  };
}

describe('placementRelations', () => {
  it('collects one relation per named cell, keyed by tone', () => {
    const rels = relationsFromPreview(preview({
      immediateFacts: [fact({id: 'ocean-adjacency', category: 'ocean-adjacency-bonus', spaces: ['11', '12'] as SpaceId[]})],
      futureScoringFacts: [fact({id: 'place-city', category: 'city-greenery-scoring', spaces: ['13'] as SpaceId[]})],
    }));
    expect(rels).to.deep.include.members([
      {spaceId: '11', tone: 'ocean'},
      {spaceId: '12', tone: 'ocean'},
      {spaceId: '13', tone: 'score'},
    ]);
    expect(rels).to.have.length(3);
  });

  it('a fact without spaces contributes nothing', () => {
    const rels = relationsFromPreview(preview({
      immediateFacts: [fact({id: 'effect-oxygen', category: 'placement-effect'})],
    }));
    expect(rels).to.have.length(0);
  });

  it('the placement cell itself is never a relation (the reticle owns it)', () => {
    const rels = relationsFromPreview(preview({
      immediateFacts: [fact({id: 'x', category: 'ocean-adjacency-bonus', spaces: ['10', '11'] as SpaceId[]})],
    }));
    expect(rels).to.deep.equal([{spaceId: '11', tone: 'ocean'}]);
  });

  it('a penalty is never masked by a reward on the same cell', () => {
    const rels = relationsFromPreview(preview({
      costFacts: [fact({id: 'cost-production', category: 'placement-penalty', severity: 'danger', spaces: ['21'] as SpaceId[]})],
      immediateFacts: [fact({id: 'ares-adj-21-steel', category: 'ares-adjacency-bonus', spaces: ['21'] as SpaceId[]})],
    }));
    expect(rels).to.deep.equal([{spaceId: '21', tone: 'penalty'}]);
  });

  it('…in either arrival order', () => {
    const rels = relationsFromPreview(preview({
      immediateFacts: [
        fact({id: 'ares-adj-21-steel', category: 'ares-adjacency-bonus', spaces: ['21'] as SpaceId[]}),
        fact({id: 'cost-production', category: 'placement-penalty', severity: 'danger', spaces: ['21'] as SpaceId[]}),
      ],
    }));
    expect(rels).to.deep.equal([{spaceId: '21', tone: 'penalty'}]);
  });

  it('planetary events are the quiet event tone', () => {
    const rels = relationsFromPreview(preview({
      immediateFacts: [fact({id: 'ares-event-dust-storms-recede', category: 'hazard-cleanup', severity: 'premium', spaces: ['31', '32'] as SpaceId[]})],
      warningFacts: [fact({id: 'effect-ares-erosions-severe', category: 'hazard-penalty', severity: 'warning', spaces: ['33'] as SpaceId[]})],
    }));
    expect(rels).to.deep.include.members([
      {spaceId: '31', tone: 'event'},
      {spaceId: '32', tone: 'event'},
    ]);
    // An intensify event keeps the honest penalty voice (those hazards become
    // MORE taxing); the board quiets far participants geometrically.
    expect(rels).to.deep.include({spaceId: '33', tone: 'penalty'});
  });

  it('tone classification is structural', () => {
    expect(relationToneOf(fact({id: 'a', category: 'ocean-adjacency-bonus'}))).to.eq('ocean');
    expect(relationToneOf(fact({id: 'b', category: 'future-scoring'}))).to.eq('score');
    expect(relationToneOf(fact({id: 'c', category: 'tile-owner-benefit'}))).to.eq('reward');
    expect(relationToneOf(fact({id: 'd', category: 'placement-cost', severity: 'warning'}))).to.eq('penalty');
    // Fallback for a future spatial category: severity decides.
    expect(relationToneOf(fact({id: 'e', category: 'card-trigger', severity: 'danger'}))).to.eq('penalty');
    expect(relationToneOf(fact({id: 'f', category: 'card-trigger'}))).to.eq('reward');
  });

  it('undefined preview → empty', () => {
    expect(relationsFromPreview(undefined)).to.deep.equal([]);
  });
});
