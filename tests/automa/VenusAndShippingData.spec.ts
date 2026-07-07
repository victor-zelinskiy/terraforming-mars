import {expect} from 'chai';
import {Tag} from '../../src/common/cards/Tag';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {MarsBotBoard, MarsBotTrack} from '../../src/server/automa/MarsBotBoard';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {VENUS_TRACK, VENUS_TRACK_INDEX, VENUS_CELL9_TARGET_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {SHIPPING_BOARD_AREAS, shippingAreaFor} from '../../src/common/automa/ShippingBoardData';

describe('VenusMarsBot track data', () => {
  it('has 13 positions (0–12)', () => {
    expect(VENUS_TRACK.layout.length).to.eq(13);
    expect(VENUS_TRACK.maxPosition).to.eq(12);
  });

  it('maps only the Venus tag', () => {
    expect(VENUS_TRACK.tags).to.deep.eq([Tag.VENUS]);
    expect(VENUS_TRACK.productions).to.be.empty;
  });

  it('matches the transcribed component layout', () => {
    expect(VENUS_TRACK.layout[0]).to.be.undefined;
    expect(VENUS_TRACK.layout[1]).to.eq('floater');
    expect(VENUS_TRACK.layout[2]).to.eq('floater2');
    expect(VENUS_TRACK.layout[3]).to.eq('venus');
    expect(VENUS_TRACK.layout[4]).to.eq('floater2');
    expect(VENUS_TRACK.layout[5]).to.eq('venus');
    expect(VENUS_TRACK.layout[6]).to.be.undefined;
    expect(VENUS_TRACK.layout[7]).to.eq('floater2');
    expect(VENUS_TRACK.layout[8]).to.eq('venus');
    expect(VENUS_TRACK.layout[9]).to.eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    expect(VENUS_TRACK.layout[10]).to.eq('venus');
    expect(VENUS_TRACK.layout[11]).to.eq('floater2');
    expect(VENUS_TRACK.layout[12]).to.eq('tr5');
  });

  it('yields 9 floaters over the full track — enough for Hoverlord (7)', () => {
    const floaters = VENUS_TRACK.layout
      .map((a) => a === 'floater' ? 1 : a === 'floater2' ? 2 : 0)
      .reduce((a: number, b) => a + b, 0);
    expect(floaters).to.eq(9);
  });

  it('cell 9 advances the Tharsis Bio track', () => {
    const bio = THARSIS_MARSBOT_BOARD[VENUS_CELL9_TARGET_TRACK];
    expect(bio.tags).to.include(Tag.MICROBE);
    expect(bio.tags).to.include(Tag.PLANT);
    expect(bio.tags).to.include(Tag.ANIMAL);
  });

  it('MarsBotTrack honors maxPosition 12: advancing past it is maxed', () => {
    const track = new MarsBotTrack(VENUS_TRACK);
    for (let i = 0; i < 12; i++) {
      expect(track.advance().type).to.not.eq('maxed');
    }
    expect(track.position).to.eq(12);
    expect(track.canAdvance()).to.be.false;
    expect(track.advance().type).to.eq('maxed');
    expect(track.position).to.eq(12);
  });

  it('standard tracks keep the default max position 18', () => {
    const track = new MarsBotTrack(THARSIS_MARSBOT_BOARD[0]);
    expect(track.maxPosition).to.eq(18);
  });

  it('appending the Venus track to the Tharsis board maps the Venus tag at index 7', () => {
    const board = new MarsBotBoard([...THARSIS_MARSBOT_BOARD, VENUS_TRACK]);
    expect(board.tracks.length).to.eq(8);
    expect(board.getTrackIndexForTag(Tag.VENUS)).to.eq(VENUS_TRACK_INDEX);
    // Tharsis mappings are untouched.
    expect(board.getTrackIndexForTag(Tag.BUILDING)).to.eq(0);
    expect(board.getTrackIndexForTag(Tag.PLANT)).to.eq(6);
  });
});

describe('Colonies shipping board data', () => {
  it('has exactly 11 storage areas, one per base-Colonies colony', () => {
    expect(SHIPPING_BOARD_AREAS.length).to.eq(11);
    const names = SHIPPING_BOARD_AREAS.map((a) => a.colony);
    expect(new Set(names).size).to.eq(11);
  });

  it('matches the transcribed 5-resources → tag exchange mapping', () => {
    expect(shippingAreaFor(ColonyName.CERES)?.exchangeTag).to.eq(Tag.BUILDING);
    expect(shippingAreaFor(ColonyName.LUNA)?.exchangeTag).to.eq(Tag.EVENT);
    expect(shippingAreaFor(ColonyName.IO)?.exchangeTag).to.eq(Tag.EARTH);
    expect(shippingAreaFor(ColonyName.ENCELADUS)?.exchangeTag).to.eq(Tag.MICROBE);
    expect(shippingAreaFor(ColonyName.GANYMEDE)?.exchangeTag).to.eq(Tag.PLANT);
    expect(shippingAreaFor(ColonyName.CALLISTO)?.exchangeTag).to.eq(Tag.POWER);
    expect(shippingAreaFor(ColonyName.MIRANDA)?.exchangeTag).to.eq(Tag.ANIMAL);
    expect(shippingAreaFor(ColonyName.TRITON)?.exchangeTag).to.eq(Tag.SPACE);
    expect(shippingAreaFor(ColonyName.PLUTO)?.exchangeTag).to.eq(Tag.SCIENCE);
  });

  it('Titan (floater area) and Europa (never stores) have no track exchange', () => {
    expect(shippingAreaFor(ColonyName.TITAN)?.exchangeTag).to.be.undefined;
    expect(shippingAreaFor(ColonyName.EUROPA)?.exchangeTag).to.be.undefined;
  });

  it('every exchange tag resolves to a Tharsis track', () => {
    const board = new MarsBotBoard([...THARSIS_MARSBOT_BOARD]);
    for (const area of SHIPPING_BOARD_AREAS) {
      if (area.exchangeTag !== undefined) {
        expect(board.getTrackIndexForTag(area.exchangeTag),
          `${area.colony} → ${area.exchangeTag}`).to.not.be.undefined;
      }
    }
  });
});
