/**
 * THE CALIBRATION LAWS — how a human criterion becomes a bot target, read off the six official reference cards and
 * the Awards & Milestones module (docs/AUTOMA_DATA_AUDIT.md §22.3 — the same table with its examples). Every HOME rule
 * of the registry (`provenance.source === 'home'`) names its official analog, and a track / pile rule names the law
 * it follows; the guard spec asserts both.
 *
 * Data, not code: the generator (stage 3) reads the laws to decide which track a criterion may ride — a tag law on
 * the track that carries those tags, a production law on the track with that badge.
 */
export type CalibrationLawId =
  | 'tags-single' // N tags of one kind ↔ space N on a track carrying that tag alone (Researcher 4, Spacefarer 4, Terran 5)
  | 'tags-paired' // N tags of a PAIRED track's minor tag ↔ space 2N (Rim Settler: 3 Jovian ↔ space 6 on Jovian/Science)
  | 'production-badge' // N production of a resource ↔ the track with that printed badge (Energizer 6 ↔ power 6)
  | 'production-sum' // a sum of two productions ↔ the sum of the two badge tracks, no offset (Banker, Manufacturer)
  | 'resources-mc' // resources at hand ↔ M€ ÷ 5 (Excentric) · cards with requirements ↔ M€ ÷ 7 (Forecaster, Tactician 35 = 5 × 7)
  | 'pile' // cards in play ↔ the PLAYED PILE, events counted (Celebrity / Incorporator / Sponsor — the official asymmetry)
  | 'tiles' // tiles on the board ↔ the bot's REAL tiles («As usual»)
  | 'award-offset'; // +5 for «resource» awards (Thermalist, Miner, Industrialist, Zoologist), a handicap where the track is wider (Botanist −2, Benefactor −15)

export type CalibrationLaw = {
  readonly id: CalibrationLawId;
  readonly statement: string;
  /** The official cards / pages the law is read from. */
  readonly sources: ReadonlyArray<string>;
};

export const CALIBRATION_LAWS: ReadonlyArray<CalibrationLaw> = [
  {id: 'tags-single', statement: 'N tags of one kind ↔ space N on the track carrying that tag (alone)',
    sources: ['B11 Researcher 4 ↔ 4', 'RB-C p.14 Spacefarer 4 ↔ 4', 'RB-C p.14 Terran 5 ↔ 5', 'B13 Agronomist 4 ↔ 4']},
  {id: 'tags-paired', statement: 'N tags of a paired track\'s minor tag ↔ space 2N (the track also moves for the other tag)',
    sources: ['B09 Rim Settler 3 Jovian ↔ Jovian/Science 6', 'B12 Architect 3 City ↔ City/Science 6']},
  {id: 'production-badge', statement: 'production of a resource ↔ the track with that printed badge (steel → building, titanium → space, M€ → event, energy → power, heat → earth, plants → bio); heat may ride power through Thermalist\'s association',
    sources: ['B09 Energizer 6 ↔ 6', 'RB-C p.13 Forester 4 ↔ bio 6', 'B12 Fundraiser 12 ↔ event 10', 'RB-A Thermalist heat ↔ power']},
  {id: 'production-sum', statement: 'a sum of two productions ↔ the sum of the two badge tracks, no offset',
    sources: ['RB-A Banker building + event', 'RB-C p.15 Manufacturer building + power', 'B11 Smith building + space ≥ 7']},
  {id: 'resources-mc', statement: 'resources at hand ↔ M€ ÷ 5; cards with requirements ↔ M€ ÷ 7',
    sources: ['B09 Excentric ÷ 5', 'B12 Forecaster ÷ 7', 'B09 Tactician 35 = 5 cards × 7']},
  {id: 'pile', statement: 'cards in play ↔ the bot\'s played pile; events are counted where the human\'s criterion excludes them',
    sources: ['B10 Celebrity', 'B11 Incorporator', 'RB-C p.14 Sponsor', 'B10 Tycoon / Legend «As usual (… in played pile)»']},
  {id: 'tiles', statement: 'tiles on the board ↔ the bot\'s real tiles, read by the human\'s own evaluator',
    sources: ['RB-A Mayor / Gardener / Landlord', 'B10 Desert Settler / Estate Dealer', 'RB-C p.13 Coastguard']},
  {id: 'award-offset', statement: '+5 for awards counting RESOURCES (a track measures production, not stock); a handicap where the track is wider than the criterion',
    sources: ['RB-A Thermalist / Miner +5', 'B10 Industrialist +5', 'B12 A. Zoologist +5', 'B11 Botanist −2', 'B10 Benefactor −15']},
];
