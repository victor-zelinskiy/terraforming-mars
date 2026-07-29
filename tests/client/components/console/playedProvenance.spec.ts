import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {playedProvenanceByName, zoomProvenanceOver} from '@/client/components/console/played/playedProvenance';

function cards(...names: Array<CardName>): Array<CardModel> {
  return names.map((name) => ({name} as CardModel));
}

function seat(overrides: Partial<PublicPlayerModel> = {}): PublicPlayerModel {
  return {color: 'red' as Color, name: 'Вы', tableau: [], ...overrides} as unknown as PublicPlayerModel;
}

const TABLEAU = cards(
  CardName.THARSIS_REPUBLIC, // corporation
  CardName.PREDATORS, // active
  CardName.TREES, // automated
  CardName.ASTEROID, // event
  CardName.BIG_ASTEROID, // event
);

describe('playedProvenance — the fullscreen provenance plate', () => {
  it('names the seat, the printed zone and the position inside it', () => {
    const at = playedProvenanceByName(seat(), TABLEAU);
    const asteroid = at(CardName.ASTEROID);
    expect(asteroid?.seatName).to.eq('Вы');
    expect(asteroid?.seatColor).to.eq('red');
    expect(asteroid?.isBot).to.be.false;
    expect(asteroid?.category).to.eq('Events');
    // Play order inside the zone (oldest → newest), 1-based.
    expect(asteroid?.ordinal).to.deep.eq({n: 1, total: 2});
    expect(at(CardName.BIG_ASTEROID)?.ordinal).to.deep.eq({n: 2, total: 2});
  });

  it('a lone card in its zone shows NO ordinal («1 / 1» is noise)', () => {
    const at = playedProvenanceByName(seat(), TABLEAU);
    expect(at(CardName.THARSIS_REPUBLIC)?.category).to.eq('Corporation');
    expect(at(CardName.THARSIS_REPUBLIC)?.ordinal).to.be.undefined;
    expect(at(CardName.TREES)?.category).to.eq('Automated');
    expect(at(CardName.TREES)?.ordinal).to.be.undefined;
  });

  it('the Automa seat is marked as FLIPPED and localized', () => {
    const at = playedProvenanceByName(seat({name: 'MarsBot', isMarsBot: true, color: 'green' as Color}), TABLEAU);
    const plate = at(CardName.PREDATORS);
    expect(plate?.isBot).to.be.true;
    expect(plate?.seatColor).to.eq('green');
    // participantDisplayName resolves the localized label (never raw 'MarsBot').
    expect(plate?.seatName).to.not.eq('');
  });

  it('a card not on this table yields NO plate (never a wrong claim)', () => {
    const at = playedProvenanceByName(seat(), TABLEAU);
    expect(at(CardName.ACQUIRED_COMPANY)).to.be.undefined;
    expect(at(undefined)).to.be.undefined;
  });

  it('zoomProvenanceOver maps the viewer index space onto the browsed list', () => {
    const at = playedProvenanceByName(seat(), TABLEAU);
    const list = cards(CardName.ASTEROID, CardName.BIG_ASTEROID);
    const byIndex = zoomProvenanceOver(at, list);
    expect(byIndex(0)?.ordinal).to.deep.eq({n: 1, total: 2});
    expect(byIndex(1)?.ordinal).to.deep.eq({n: 2, total: 2});
    expect(byIndex(9)).to.be.undefined; // out of range degrades silently
  });
});
