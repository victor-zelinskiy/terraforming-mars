import {expect} from 'chai';
import {
  dossierEmptyKey,
  dossierSections,
  endgameVpTotal,
  placementIdentity,
  placementTitleTier,
  progressTrack,
  rowSourceLabel,
  rowTimingKey,
} from '@/client/console/placementDossier';
import {BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';

import ruConsole from '@/locales/ru/console.json';
import ruUi from '@/locales/ru/ui.json';
import ruUiCards from '@/locales/ru/UI_cards.json';
import ruColonies from '@/locales/ru/colonies.json';
import ruBoardInfo from '@/locales/ru/board_info.json';
import ruCards from '@/locales/ru/cards.json';

/**
 * The console placement panel's IDENTITY: the big title names the OBJECT that
 * lands (from the tile, never from the card — the consolePlacementNextStep
 * law), and the server sentence survives only when it carries information the
 * identity block doesn't. Pure model, translator injected — driven with EN
 * (identity) and the REAL ru dictionaries, which also proves the keys exist.
 */
describe('placementDossier', () => {
  function interpolate(text: string, params?: ReadonlyArray<string>): string {
    return (params ?? []).reduce<string>((acc, p, i) => acc.split('${' + i + '}').join(p), text);
  }
  const en = (key: string, params?: ReadonlyArray<string>) => interpolate(key, params);
  const RU: Record<string, string> = {
    ...(ruCards as Record<string, string>),
    ...(ruUi as Record<string, string>),
    ...(ruUiCards as Record<string, string>),
    ...(ruColonies as Record<string, string>),
    ...(ruBoardInfo as Record<string, string>),
    ...(ruConsole as Record<string, string>),
  };
  const ru = (key: string, params?: ReadonlyArray<string>) => interpolate(RU[key] ?? key, params);

  function identity(over: Partial<Parameters<typeof placementIdentity>[0]> = {}, translate = en) {
    return placementIdentity({
      translatedTitle: '',
      tileType: undefined,
      placementType: undefined,
      placementEffect: undefined,
      sourceCard: undefined,
      hasConversion: false,
      translate,
      ...over,
    });
  }

  it('an ordinary tile titles as its type noun, with the tile as the swatch', () => {
    const d = identity({tileType: TileType.GREENERY, placementType: 'greenery'});
    expect(d.title).to.equal('Greenery');
    expect(d.tileType).to.equal(TileType.GREENERY);
    expect(d.special).to.be.false;
    expect(identity({tileType: TileType.GREENERY}, ru).title).to.equal('Озеленение');
    expect(identity({tileType: TileType.CITY}, ru).title).to.equal('Город');
    expect(identity({tileType: TileType.OCEAN}, ru).title).to.equal('Океан');
  });

  it('a kind-only prompt (no tileType) still resolves the ordinary identity', () => {
    const d = identity({placementType: 'ocean'});
    expect(d.title).to.equal('Ocean');
    expect(d.tileType).to.equal(TileType.OCEAN);
    // The generic land pick has no swatch and the honest generic name.
    const generic = identity({placementType: 'land'});
    expect(generic.title).to.equal('Tile');
    expect(generic.tileType).to.be.undefined;
    expect(RU['Tile'], 'missing RU translation for "Tile"').to.be.a('string');
  });

  it('a named special tile titles as its own name', () => {
    const d = identity({tileType: TileType.LAVA_FLOWS, placementType: 'volcanic'});
    expect(d.title).to.equal(CardName.LAVA_FLOWS);
    expect(d.special).to.be.true;
    expect(d.tileType).to.equal(TileType.LAVA_FLOWS);
    const dRu = identity({tileType: TileType.LAVA_FLOWS}, ru);
    expect(dRu.title).to.equal(RU[CardName.LAVA_FLOWS]);
  });

  /**
   * The thresholds are MEASURED, not guessed: `console-placement-title-measure`
   * renders the whole tile-name corpus in the real font at the real 4K column
   * and asserts every name stays on ONE line. These rows pin the boundaries
   * that table produced (base ≤ 15 · long ≤ 22 · dense beyond).
   */
  it('the title tier steps down by LENGTH (the corpus-calibrated ladder)', () => {
    expect(placementTitleTier('Озеленение')).to.equal('base');
    expect(placementTitleTier('Падение Деймоса'), '15 chars still fit the loud tier').to.equal('base');
    expect(placementTitleTier('Коммерческий район')).to.equal('long');
    expect(placementTitleTier('Металлический астероид'), '22 chars still fit the long tier').to.equal('long');
    // The name that took three lines of hero type before the third step.
    expect(placementTitleTier('Генераторы магнитного поля')).to.equal('dense');
    expect(identity({tileType: TileType.GREENERY}, ru).tier).to.equal('base');
    expect(identity({tileType: TileType.MAGNETIC_FIELD_GENERATORS}, ru).tier).to.equal('dense');
  });

  it('a marker placement titles as a marker and draws no tile swatch', () => {
    const d = identity({placementEffect: 'marker'});
    expect(d.title).to.equal('Marker');
    expect(d.tileType).to.be.undefined;
    expect(identity({placementEffect: 'marker'}, ru).title).to.equal('Маркер');
  });

  describe('the action line', () => {
    it('suppresses the generic «select space for X tile» sentence', () => {
      const d = identity({
        tileType: TileType.GREENERY,
        translatedTitle: ru('Select space for greenery tile'),
      }, ru);
      expect(d.actionLine).to.equal('');
    });

    it('suppresses the card-parameterized generic sentence the chip already names', () => {
      const d = identity({
        tileType: TileType.SOLAR_FARM,
        sourceCard: CardName.SOLAR_FARM,
        translatedTitle: en('Select space for ${0} tile', [CardName.SOLAR_FARM]),
      });
      expect(d.actionLine).to.equal('');
    });

    it('keeps a REAL constraint sentence', () => {
      const title = 'Select a space with a steel or titanium bonus adjacent to one of your tiles';
      const d = identity({tileType: TileType.MINING_AREA, translatedTitle: title});
      expect(d.actionLine).to.equal(title);
    });

    it('yields to the conversion formula (its sentence twin)', () => {
      const d = identity({
        tileType: TileType.GREENERY,
        hasConversion: true,
        translatedTitle: ru('Convert ${0} plants into greenery', ['8']),
      }, ru);
      expect(d.actionLine).to.equal('');
    });
  });

  describe('sections', () => {
    const fact = (over: Partial<BoardFact>): BoardFact => ({
      id: 'f',
      category: 'placement-effect',
      timing: 'immediate',
      severity: 'positive',
      recipient: {kind: 'current-player'},
      title: 'f',
      ...over,
    });
    const preview = (over: Partial<BoardPlacementPreview>): BoardPlacementPreview => ({
      space: '05',
      kind: 'greenery',
      legal: true,
      costFacts: [],
      immediateFacts: [],
      recipientFacts: [],
      warningFacts: [],
      futureScoringFacts: [],
      ruleFacts: [],
      ...over,
    });

    it('groups the cell toll first: costs and risks share the CELL EFFECT block', () => {
      const p = preview({
        costFacts: [fact({id: 'c', timing: 'cost', severity: 'danger'})],
        warningFacts: [fact({id: 'w', timing: 'warning', severity: 'warning'})],
        immediateFacts: [fact({id: 'g'})],
      });
      const sections = dossierSections(p);
      expect(sections.map((s) => s.key)).to.deep.equal(['effect', 'gain']);
      expect(sections[0].facts.map((f) => f.id)).to.deep.equal(['c', 'w']);
      expect(RU['Cell effect'], 'missing RU translation for "Cell effect"').to.be.a('string');
    });

    it('keeps progress OUT of the endgame block and orders the read', () => {
      const p = preview({
        immediateFacts: [fact({id: 'g'})],
        progressFacts: [fact({id: 'p', timing: 'future', progress: {from: 1, to: 2, target: 3}})],
        futureScoringFacts: [fact({id: 'e', timing: 'endgame', vp: {from: 0, to: 1}})],
        ruleFacts: [fact({id: 'r', timing: 'rule'})],
      });
      expect(dossierSections(p).map((s) => s.key)).to.deep.equal(['gain', 'progress', 'endgame', 'rules']);
    });

    it('the endgame block totals the CELL’s own forecast, never a single row', () => {
      const vp = (id: string, to: number): BoardFact =>
        fact({id, timing: 'endgame', category: 'future-scoring', vp: {from: 0, to}});
      // One scoring row: the total would only repeat it.
      expect(dossierSections(preview({futureScoringFacts: [vp('a', 1)]}))
        .find((s) => s.key === 'endgame')?.total).to.be.undefined;
      // Two or more: the sum is what the player is after.
      expect(dossierSections(preview({futureScoringFacts: [vp('a', 1), vp('b', 2)]}))
        .find((s) => s.key === 'endgame')?.total).to.equal(3);
      // A block of prose (no `vp`) never invents a number.
      expect(dossierSections(preview({futureScoringFacts: [fact({id: 'n', timing: 'endgame'}), vp('a', 1)]}))
        .find((s) => s.key === 'endgame')?.total).to.be.undefined;
      expect(endgameVpTotal([vp('a', 1), vp('b', -1)]), 'a net zero says nothing').to.be.undefined;
    });

    it('an empty preview names the honest empty line — tile vs marker', () => {
      expect(dossierEmptyKey(preview({}))).to.equal('Nothing happens beyond placing the tile.');
      expect(dossierEmptyKey(preview({placesTile: false}))).to.equal('Nothing happens beyond placing the marker.');
      expect(dossierEmptyKey(preview({immediateFacts: [fact({})]}))).to.be.undefined;
    });
  });

  describe('rows', () => {
    it('progressTrack renders a micro track only for a readable threshold', () => {
      expect(progressTrack({from: 1, to: 2, target: 3})).to.deep.equal(['filled', 'gained', 'empty']);
      expect(progressTrack({from: 4, to: 5})).to.be.undefined; // an award — no threshold
      expect(progressTrack({from: 0, to: 9, target: 12})).to.be.undefined; // unreadable
      expect(progressTrack(undefined)).to.be.undefined;
    });

    it('rowTimingKey states only what the section head does not', () => {
      const endgame: BoardFact = {
        id: 'e', category: 'future-scoring', timing: 'endgame', severity: 'premium',
        recipient: {kind: 'current-player'}, title: 't',
      };
      expect(rowTimingKey(endgame, ['endgame'])).to.be.undefined;
      expect(rowTimingKey(endgame, [])).to.equal('At game end');
      expect(rowTimingKey({...endgame, timing: 'future'}, ['endgame'])).to.equal('Later');
    });

    it('rowSourceLabel names a card source and stays silent for the cell itself', () => {
      const base: BoardFact = {
        id: 's', category: 'card-trigger', timing: 'immediate', severity: 'info',
        recipient: {kind: 'current-player'}, title: 't',
      };
      expect(rowSourceLabel({...base, source: {type: 'card', label: 'Solar Farm'}})).to.equal('Solar Farm');
      expect(rowSourceLabel({...base, source: {type: 'board-cell', label: 'x'}})).to.be.undefined;
      expect(rowSourceLabel(base)).to.be.undefined;
    });
  });
});
