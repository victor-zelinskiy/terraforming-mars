import {expect} from 'chai';
import {
  buildDossierRows,
  compactTitleKey,
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
// The runtime unions EVERY file in the language directory, so the compact
// vocabulary may legitimately reuse a key that lives in another one («TR» →
// «РТ» is `game_end.json`'s). The spec has to union the same way or it
// reports a missing translation that ships perfectly well.
import ruGameEnd from '@/locales/ru/game_end.json';

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
    ...(ruGameEnd as Record<string, string>),
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
      expect(sections[0].rows.map((r) => r.key)).to.deep.equal(['c', 'w']);
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

    /**
     * The Natural Preserve report: the tile's OWN standing mechanic (the Ares
     * adjacency grant) sat inside «ПРАВИЛА ПОЛЯ» beside passive square notes,
     * under one generic head, clamped to two lines. The split is STRUCTURAL —
     * the engine's own `ares-adjacency-bonus` category — never a title match.
     */
    it('the placed tile’s adjacency mechanic is its own TRIGGER section, not a field rule', () => {
      const grant: BoardFact = {
        id: 'place-adj-megacredits', category: 'ares-adjacency-bonus', timing: 'rule',
        severity: 'positive', recipient: {kind: 'neutral'},
        title: 'Your tile will grant an adjacency bonus',
        description: 'Whoever places a tile next to it gains this — and you gain M€.',
        delta: {icon: 'megacredits', amount: 1, direction: 'gain'},
        source: {type: 'card', id: 'Natural Preserve:ares', label: 'Natural Preserve:ares'},
      };
      const squareNote: BoardFact = {
        id: 'cover-no-bonus', category: 'placement-effect', timing: 'rule',
        severity: 'info', recipient: {kind: 'neutral'},
        title: 'No placement bonus',
      };
      const sections = dossierSections(preview({ruleFacts: [grant, squareNote]}));
      expect(sections.map((s) => s.key)).to.deep.equal(['tile', 'rules']);
      const tile = sections.find((s) => s.key === 'tile');
      expect(tile?.titleKey).to.equal('When placed adjacent');
      // The row: compact trigger label + the full outcome sentence, intact.
      expect(tile?.rows[0].label).to.equal('Bonus to the neighbour');
      expect(tile?.rows[0].note?.text)
        .to.equal('Whoever places a tile next to it gains this — and you gain M€.');
      // …and the RU dictionary really carries the whole chain.
      for (const key of ['When placed adjacent', 'Bonus to the neighbour']) {
        expect(RU[key], `missing RU translation for "${key}"`).to.be.a('string');
      }
      expect(RU['Whoever places a tile next to it gains this — and you gain M€.']).to.be.a('string');
      // The imposed-cost twin reuses the engine's own established key.
      expect(compactTitleKey({...grant, title: 'Your tile will impose an adjacency cost'}))
        .to.equal('Adjacency cost');
      expect(RU['Adjacency cost']).to.be.a('string');
    });

    it('an empty preview names the honest empty line — tile vs marker', () => {
      expect(dossierEmptyKey(preview({}))).to.equal('Nothing happens beyond placing the tile.');
      expect(dossierEmptyKey(preview({placesTile: false}))).to.equal('Nothing happens beyond placing the marker.');
      expect(dossierEmptyKey(preview({immediateFacts: [fact({})]}))).to.be.undefined;
    });
  });

  /**
   * THE COMPACTION — the panel states consequences, not rules. Two failures
   * this replaces, both from a real 4K game: «Производство M€ за стандартный
   * проект „Город"» and «Город размещён где угодно» printed FOUR lines and
   * TWO `47 → 48` vectors for one parameter — and both readings were wrong,
   * because the commit lands on 49.
   */
  describe('rows: compaction and aggregation', () => {
    const prodFact = (id: string, source: string, amount = 1): BoardFact => ({
      id, category: 'card-trigger', timing: 'immediate', severity: 'positive',
      recipient: {kind: 'current-player'}, title: `${id} long server sentence`,
      source: {type: 'card', label: source},
      delta: {icon: 'megacredits', amount, direction: 'gain', current: 47, resulting: 47 + amount, production: true},
    });

    it('one parameter is ONE change-vector plus the reasons behind it', () => {
      const rows = buildDossierRows([prodFact('a', 'Standard project'), prodFact('b', 'Immigrant City')]);
      expect(rows).to.have.lengthOf(1);
      const row = rows[0];
      expect(row.label, 'the pool names itself; the icon says which').to.equal('M€');
      expect(row.delta).to.include({current: 47, resulting: 49, amount: 2, direction: 'gain', production: true});
      expect(row.reasons.map((r) => `${String(r.label)} ${r.amount}`))
        .to.deep.equal(['Standard project +1', 'Immigrant City +1']);
    });

    it('never sums what does not share a starting value', () => {
      const other = {...prodFact('c', 'Other'), delta: {icon: 'megacredits' as const, amount: 1, direction: 'gain' as const, current: 12, resulting: 13, production: true}};
      const rows = buildDossierRows([prodFact('a', 'Standard project'), other]);
      expect(rows, 'two different starting values are two statements').to.have.lengthOf(2);
      // …and a pool-less gain (no `current`) never merges either.
      const poolless = (id: string): BoardFact => ({
        id, category: 'placement-effect', timing: 'immediate', severity: 'positive',
        recipient: {kind: 'current-player'}, title: 'Add to a card',
        delta: {icon: 'microbe', amount: 1, direction: 'gain'},
      });
      expect(buildDossierRows([poolless('m1'), poolless('m2')])).to.have.lengthOf(2);
    });

    it('repeated endgame statements collapse into one counted row', () => {
      const city = (id: string): BoardFact => ({
        id, category: 'city-greenery-scoring', timing: 'endgame', severity: 'premium',
        recipient: {kind: 'current-player'}, title: 'Adjacent city scores at game end',
        vp: {from: 0, to: 1},
      });
      const rows = buildDossierRows([
        {id: 'self', category: 'city-greenery-scoring', timing: 'endgame', severity: 'premium',
          recipient: {kind: 'current-player'}, title: 'Greenery scores at game end', vp: {from: 0, to: 1}},
        city('c1'), city('c2'),
      ], ['endgame']);
      expect(rows.map((r) => [r.label, r.count, r.vp]))
        .to.deep.equal([['The tile itself', 1, 1], ['Adjacent cities', 2, 2]]);
      for (const key of ['The tile itself', 'Adjacent cities']) {
        expect(RU[key], `missing RU translation for "${key}"`).to.be.a('string');
      }
    });

    it('names a fact by its compact label, else by its POOL, else by the server text', () => {
      const tr: BoardFact = {
        id: 'tr', category: 'placement-effect', timing: 'immediate', severity: 'positive',
        recipient: {kind: 'current-player'}, title: 'Terraform rating',
        delta: {icon: 'tr', amount: 1, direction: 'gain', current: 25, resulting: 26},
      };
      expect(compactTitleKey(tr), 'a title the table knows').to.equal('TR');
      expect(ru('TR')).to.equal('РТ');

      // An unknown sentence about a KNOWN POOL is named by the pool — this is
      // «Производство M€ за стандартный проект „Город"», which the panel used
      // to print over four lines and then cut off mid-word.
      const projectProduction: BoardFact = {
        id: 'p', category: 'card-trigger', timing: 'immediate', severity: 'positive',
        recipient: {kind: 'current-player'}, title: 'M€ production from the city project',
        delta: {icon: 'megacredits', amount: 1, direction: 'gain', current: 47, resulting: 48, production: true},
      };
      expect(compactTitleKey(projectProduction)).to.equal('M€');

      // …but a POOL-LESS effect keeps its own words: there the title is the
      // only thing that says what happens.
      const bespoke: BoardFact = {
        id: 'x', category: 'card-trigger', timing: 'immediate', severity: 'positive',
        recipient: {kind: 'current-player'}, title: 'Some card-specific sentence the table has never met',
        delta: {icon: 'animal', amount: 1, direction: 'gain'},
      };
      expect(compactTitleKey(bespoke)).to.equal('Some card-specific sentence the table has never met');
    });

    it('a skipped card trigger keeps its statement and drops the rule restatement', () => {
      // `noEffectHere` — Mining Guild off ore. «No silent loss» keeps the
      // TITLE (it names exactly what does not happen) and the SOURCE chip;
      // the description is the card's general rule, which the panel does not
      // owe («This corporation raises steel production only for…»).
      const skipped: BoardFact = {
        id: 'MiningGuild-noop', category: 'corporation-trigger', timing: 'rule',
        severity: 'info', recipient: {kind: 'current-player'},
        title: 'No steel or titanium bonus here — no steel production',
        description: 'This corporation raises steel production only for a tile placed on an area with a steel or titanium placement bonus.',
        source: {type: 'corporation', id: 'Mining Guild', label: 'Mining Guild'},
      };
      const [row] = buildDossierRows([skipped], ['rule']);
      expect(row.label).to.equal('No steel or titanium bonus here — no steel production');
      expect(row.note, 'the rule restatement is dropped').to.be.undefined;
      expect(row.source).to.equal('Mining Guild');
      // …while a note that CARRIES a value keeps explaining itself (the Ares
      // adjacency grant’s trigger sentence is the outcome, not a restatement).
      const withValue: BoardFact = {
        ...skipped, id: 'v', category: 'ares-adjacency-bonus',
        description: 'Whoever places a tile next to it gains this — and you gain M€.',
        delta: {icon: 'megacredits', amount: 1, direction: 'gain'},
      };
      expect(buildDossierRows([withValue], ['rule'])[0].note?.text)
        .to.equal('Whoever places a tile next to it gains this — and you gain M€.');
    });

    it('a single fact keeps its own note, its source chip and its timing tag', () => {
      const hazard: BoardFact = {
        id: 'cost-production', category: 'placement-penalty', timing: 'cost', severity: 'danger',
        recipient: {kind: 'current-player'}, title: 'Reduce production',
        description: 'Your choice · hazards nearby: ${0}', params: ['2'],
        delta: {icon: 'megacredits', amount: 2, direction: 'cost'},
      };
      const [row] = buildDossierRows([hazard], ['cost']);
      expect(row.note?.text).to.equal('Your choice · hazards nearby: ${0}');
      expect(row.note?.params).to.deep.equal(['2']);
      expect(row.reasons, 'a lone fact has nothing to break down').to.be.empty;
      expect(row.timingKey, 'the section head already states «cost»').to.be.undefined;
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

  /**
   * A MOVE (Turmoil Redux TR14 Re-settlement): the same panel reads a pick of
   * TWO cells. The destination reading gains a section for the cell the city
   * LEAVES, and the city's VP is one pool — never a gain beside a loss; the
   * source reading (the «which city» level) is a section of its own.
   */
  describe('a move', () => {
    const fact = (over: Partial<BoardFact>): BoardFact => ({
      id: 'f', category: 'placement-effect', timing: 'immediate', severity: 'positive',
      recipient: {kind: 'current-player'}, title: 'f', ...over,
    });
    const preview = (over: Partial<BoardPlacementPreview>): BoardPlacementPreview => ({
      space: '05', kind: 'city-move', legal: true,
      costFacts: [], immediateFacts: [], recipientFacts: [], warningFacts: [], futureScoringFacts: [], ruleFacts: [],
      placesTile: true, ...over,
    });
    const freed = fact({
      id: 'move-vacated', category: 'tile-move', timing: 'rule', severity: 'info', recipient: {kind: 'nobody'},
      title: 'The space is freed', description: 'Its placement bonus goes again to whoever places a tile there next.',
      delta: {icon: 'plants', amount: 2, direction: 'gain'}, spaces: ['04'],
    });
    const gain = fact({
      id: 'move-city-vp-gain', category: 'city-greenery-scoring', timing: 'endgame', severity: 'positive',
      title: 'City VP', reason: 'At the new space', vp: {from: 2, to: 4}, spaces: ['06', '07'],
    });
    const loss = fact({
      id: 'move-city-vp-loss', category: 'tile-departure', timing: 'endgame', severity: 'warning',
      title: 'City VP', reason: 'At the former space', vp: {from: 2, to: 1}, spaces: ['03'],
    });

    it('the object is the city that travels — the kind titles «City», a Capital names itself by its tile', () => {
      expect(identity({placementType: 'city-move', placementEffect: 'move', tileType: TileType.CITY}, ru).title).to.equal(RU['City']);
      const capital = identity({placementType: 'city-move', placementEffect: 'move', tileType: TileType.CAPITAL});
      expect(capital.title).to.equal('Capital');
      expect(capital.tileType).to.equal(TileType.CAPITAL);
      expect(identity({placementType: 'city-move', placementEffect: 'move'}).tileType, 'the kind alone still draws a city').to.equal(TileType.CITY);
    });

    it('AN OCEAN\'S move (TR39): the object is the ocean that travels — the kind titles «Ocean», draws the ocean, and the SOURCE reading is «This ocean»', () => {
      const ocean = identity({placementType: 'ocean-move', placementEffect: 'move', tileType: TileType.OCEAN}, ru);
      expect(ocean.title).to.equal(RU['Ocean']);
      expect(ocean.tileType).to.equal(TileType.OCEAN);
      expect(identity({placementType: 'ocean-move', placementEffect: 'move'}).tileType, 'the kind alone still draws an ocean').to.equal(TileType.OCEAN);
      const p = preview({
        kind: 'ocean-move', placesTile: false,
        ruleFacts: [fact({id: 'move-reach', category: 'tile-move', timing: 'rule', severity: 'info', recipient: {kind: 'neutral'}, title: 'Spaces to move to: ${0}', params: ['4'], spaces: ['06']})],
      });
      const sections = dossierSections(p);
      expect(sections.map((s) => s.key)).to.deep.equal(['source']);
      expect(sections[0].titleKey).to.equal('This ocean');
      expect(RU['This ocean'], 'missing RU translation').to.equal('Этот океан');
      expect(dossierSections(preview({kind: 'ocean-move', placesTile: true, ruleFacts: [freed]}))[0].titleKey, 'the destination reading keeps «Former space»').to.equal('Former space');
    });

    it('the DESTINATION reading: the former cell is a section of its own, between «others» and the progress', () => {
      const p = preview({
        immediateFacts: [fact({id: 'g'})],
        recipientFacts: [fact({id: 'o', recipient: {kind: 'player', color: 'red'}})],
        progressFacts: [fact({id: 'p', category: 'milestone-progress', timing: 'future', progress: {from: 1, to: 0}})],
        futureScoringFacts: [gain, loss],
        ruleFacts: [freed, fact({id: 'r', category: 'map-special-zone', timing: 'rule'})],
      });
      const sections = dossierSections(p);
      expect(sections.map((s) => s.key)).to.deep.equal(['gain', 'others', 'departure', 'progress', 'endgame', 'rules']);
      const departure = sections.find((s) => s.key === 'departure')!;
      expect(departure.titleKey).to.equal('Former space');
      expect(RU['Former space'], 'missing RU translation').to.equal('Прежняя клетка');
      expect(sections.find((s) => s.key === 'rules')!.rows.map((r) => r.key), 'never dumped into the field rules').to.deep.equal(['r']);
    });

    it('the freed cell\'s bonus is a NEUTRAL chip — what the cell holds, never a gain of the mover\'s', () => {
      const [row] = buildDossierRows([freed], ['rule']);
      expect(row.label).to.equal('The space is freed');
      expect(row.neutralDelta).to.be.true;
      expect(row.delta).to.deep.include({icon: 'plants', amount: 2});
      expect(row.note?.text).to.equal('Its placement bonus goes again to whoever places a tile there next.');
      // An ordinary gain keeps its sign.
      expect(buildDossierRows([fact({id: 'g', delta: {icon: 'plants', amount: 2, direction: 'gain'}})])[0].neutralDelta).to.be.undefined;
    });

    it('the city\'s VP is ONE vector with its two members under it — «2 → 3», «+2 · −1»', () => {
      const rows = buildDossierRows([gain, loss], ['endgame']);
      expect(rows, 'never two rows for one parameter').to.have.length(1);
      const row = rows[0];
      expect(row.label).to.equal('City VP');
      expect(row.vpVector).to.deep.equal({from: 2, to: 3});
      expect(row.vp, 'the signed difference').to.equal(1);
      expect(row.reasons.map((r) => [r.label, r.amount])).to.deep.equal([['At the new space', '+2'], ['At the former space', '−1']]);
      expect(row.severity, 'a pool that ends higher is good news').to.equal('positive');
      expect(row.count).to.equal(1);
      for (const key of ['City VP', 'At the new space', 'At the former space']) {
        expect(RU[key], `missing RU translation for "${key}"`).to.be.a('string');
      }
    });

    it('a pool of ONE member is still a vector with its cause; a pool that ends lower takes the warning tone', () => {
      const [up] = buildDossierRows([gain], ['endgame']);
      expect(up.vpVector).to.deep.equal({from: 2, to: 4});
      expect(up.reasons.map((r) => r.amount)).to.deep.equal(['+2']);
      const [down] = buildDossierRows([loss], ['endgame']);
      expect(down.vpVector).to.deep.equal({from: 2, to: 1});
      expect(down.vp).to.equal(-1);
      expect(down.severity).to.equal('warning');
    });

    it('the section head totals the DELTA of the pool, and an ordinary VP statement beside it is not merged in', () => {
      const other = fact({id: 'place-x', category: 'future-scoring', timing: 'endgame', title: 'Adjacent city scores at game end', vp: {from: 0, to: 1}});
      const p = preview({futureScoringFacts: [gain, loss, other]});
      const endgame = dossierSections(p).find((s) => s.key === 'endgame')!;
      expect(endgame.rows.map((r) => r.key)).to.deep.equal(['agg:p|City VP|2', 'place-x']);
      expect(endgame.total, '(+2 − 1) + 1').to.equal(2);
      expect(endgameVpTotal([gain, loss]), 'two members of one pool: the net').to.equal(1);
    });

    it('«unchanged» is one calm line — a label and a note, no vector, no badge', () => {
      const [row] = buildDossierRows([fact({
        id: 'move-city-vp', category: 'city-greenery-scoring', timing: 'endgame', severity: 'info',
        title: 'City VP', description: 'Unchanged: ${0} VP', params: ['2'],
      })], ['endgame']);
      expect(row.vpVector).to.be.undefined;
      expect(row.vp).to.be.undefined;
      expect(row.note).to.deep.equal({text: 'Unchanged: ${0} VP', params: ['2']});
    });

    it('the SOURCE reading (nothing is put down yet) is «This city», never «Former space»', () => {
      const p = preview({
        placesTile: false,
        ruleFacts: [
          fact({id: 'move-reach', category: 'tile-move', timing: 'rule', severity: 'info', recipient: {kind: 'neutral'}, title: 'Spaces to move to: ${0}', params: ['3'], spaces: ['06', '07', '08']}),
          fact({id: 'move-scores-now', category: 'tile-move', timing: 'rule', severity: 'info', recipient: {kind: 'neutral'}, title: 'Scores now: ${0} VP', params: ['2']}),
        ],
      });
      const sections = dossierSections(p);
      expect(sections.map((s) => s.key)).to.deep.equal(['source']);
      expect(sections[0].titleKey).to.equal('This city');
      expect(sections[0].rows.map((r) => [r.label, r.params])).to.deep.equal([['Spaces to move to: ${0}', ['3']], ['Scores now: ${0} VP', ['2']]]);
      expect(dossierEmptyKey(p), 'a city with facts is never «nothing happens»').to.be.undefined;
      for (const key of ['This city', 'Spaces to move to: ${0}', 'Scores now: ${0} VP']) {
        expect(RU[key], `missing RU translation for "${key}"`).to.be.a('string');
      }
    });

    it('a standing fall of an award reads «1 → 0» in the warning tone, with no micro track', () => {
      const [row] = buildDossierRows([fact({
        id: 'award-Estate Dealer', category: 'milestone-progress', timing: 'future', severity: 'warning',
        title: 'Estate Dealer', progress: {from: 1, to: 0},
      })]);
      expect(row.progress).to.deep.equal({from: 1, to: 0});
      expect(row.severity).to.equal('warning');
      expect(progressTrack(row.progress)).to.be.undefined;
    });
  });
});
