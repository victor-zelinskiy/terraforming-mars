import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {supportSceneOf, supportStatusKey, SupportSlot} from '@/client/console/parliament/supportScene';

/*
 * НАРОДНАЯ ПОДДЕРЖКА AS DATA («Заседание v3», В3): the roll call names every party from the object that
 * speaks for it, and every cube knows the PLACE it comes from — the supply, an unenacted card, or that
 * card's delegate ribbon. Pure over the server's own record; no scene, no DOM.
 */
const A = 'RDX_GREENS_AQUIFER_CONTEST#0';
const B = 'RDX_MARS_ARCHITECTURE_AWARD#0';
const C = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID#0';

const slot = (instance: string, party: ReduxParty): SupportSlot => ({instance, party});

function summary(over: Partial<ParliamentPhaseSummaryModel> = {}): Pick<ParliamentPhaseSummaryModel, 'winner' | 'support'> {
  return {
    winner: {instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes: 1, player: 'blue' as Color, slot: 0},
    support: [],
    ...over,
  } as Pick<ParliamentPhaseSummaryModel, 'winner' | 'support'>;
}

describe('supportScene — the support step as objects on screen', () => {
  const table: ReadonlyArray<SupportSlot> = [slot(A, PartyName.GREENS), slot(B, PartyName.MARS), slot(C, PartyName.INDUSTRIALISTS)];

  it('THE ROLL CALL speaks for every party once, from the object that speaks for it: the table left to right, then the government, then the parties nobody named', () => {
    const scene = supportSceneOf(summary({
      support: [
        {party: PartyName.MARS, gained: 1, total: 1, reason: 'lost'},
        {party: PartyName.INDUSTRIALISTS, gained: 2, total: 2, reason: 'lost-with-player-vote'},
        {party: PartyName.REDS, gained: 1, total: 1, reason: 'absent'},
        {party: PartyName.UNITY, gained: 1, total: 1, reason: 'absent'},
      ],
    }), table, PartyName.SCIENTISTS);
    expect(scene.roll.map((e) => `${e.party}:${e.status}:${e.mark.kind}`)).deep.eq([
      `${PartyName.GREENS}:enacted:slot`,
      `${PartyName.MARS}:lost:slot`,
      `${PartyName.INDUSTRIALISTS}:lost:slot`,
      `${PartyName.SCIENTISTS}:ruling:government`,
      `${PartyName.REDS}:absent:none`,
      `${PartyName.UNITY}:absent:none`,
    ]);
    expect(scene.roll.length, 'six parties, one entry each').eq(6);
  });

  it('THE WAVES: the absent parties first (the supply answers), then each unenacted card — its own cube, and the RIBBON\'s second one when a player voted there', () => {
    const scene = supportSceneOf(summary({
      support: [
        {party: PartyName.MARS, gained: 1, total: 1, reason: 'lost'},
        {party: PartyName.INDUSTRIALISTS, gained: 2, total: 3, reason: 'lost-with-player-vote'},
        {party: PartyName.REDS, gained: 1, total: 1, reason: 'absent'},
        {party: PartyName.UNITY, gained: 1, total: 2, reason: 'absent'},
      ],
    }), table, PartyName.SCIENTISTS);
    expect(scene.waves.map((w) => `${w.party}:${w.cubes.map((c) => c.from + ('instance' in c ? `(${c.instance})` : '')).join('+')}`)).deep.eq([
      `${PartyName.REDS}:supply`,
      `${PartyName.UNITY}:supply`,
      `${PartyName.MARS}:card(${B})`,
      `${PartyName.INDUSTRIALISTS}:card(${C})+ribbon(${C})`,
    ]);
    // «The rule of the wave now playing» is what the reading band names («Заседание v5» §2), so each wave
    // carries its own: the two waves obey two different rules and the band may never state both at once.
    expect(scene.waves.map((w) => w.status)).deep.eq(['absent', 'absent', 'lost', 'lost']);
  });

  it('the WINNING card gives nothing, and a party with no record gains nothing — the scene never invents a cube', () => {
    const scene = supportSceneOf(summary({support: [{party: PartyName.MARS, gained: 1, total: 1, reason: 'lost'}]}), table, PartyName.GREENS);
    expect(scene.waves.map((w) => w.party), 'only the party the server paid').deep.eq([PartyName.MARS]);
    expect(scene.roll.find((e) => e.party === PartyName.GREENS)?.status, 'the enacted card outranks its party\'s ruling role').eq('enacted');
  });

  it('a party that both RULES and holds an unenacted card is named ONCE and still gains — the card outranks the office', () => {
    const scene = supportSceneOf(summary({support: [{party: PartyName.MARS, gained: 1, total: 1, reason: 'lost'}]}), table, PartyName.MARS);
    const entries = scene.roll.filter((e) => e.party === PartyName.MARS);
    expect(entries.length, 'one entry').eq(1);
    expect(entries[0].status).eq('lost');
    expect(entries[0].mark).deep.eq({kind: 'slot', instance: B});
    expect(scene.waves.map((w) => w.party)).deep.eq([PartyName.MARS]);
  });

  it('every status has its own word (the glossary\'s), and the four are distinct', () => {
    const keys = (['enacted', 'lost', 'absent', 'ruling'] as const).map(supportStatusKey);
    expect(new Set(keys).size, `four wordings, got ${keys.join(', ')}`).eq(4);
    expect(supportStatusKey('enacted')).eq('Winning');
    expect(supportStatusKey('ruling')).eq('Ruling');
  });

  it('an empty table (no voting cards) still names the government and the absent parties', () => {
    const scene = supportSceneOf(summary({support: [{party: PartyName.REDS, gained: 1, total: 1, reason: 'absent'}]}), [], PartyName.GREENS);
    expect(scene.roll.map((e) => e.status)).deep.eq(['ruling', 'absent']);
    expect(scene.waves.map((w) => w.cubes.length)).deep.eq([1]);
  });

  it('THE STARTING-RULE RULER HOLDS NO CARD: with no ruling party handed in, a ruler the server paid as absent is ABSENT — named by nobody, paid from the supply', () => {
    // Generation 1 of a game with a fourth party on the table: the area is Unity / Mars / Industrialists, the
    // Greens rule by the printed slot (no card) and the support step pays them as «not present on any card».
    const D = 'RDX_UNITY_CLOUD_DEVELOPMENT#0';
    const fourParties: ReadonlyArray<SupportSlot> = [slot(D, PartyName.UNITY), slot(B, PartyName.MARS), slot(C, PartyName.INDUSTRIALISTS)];
    const scene = supportSceneOf(summary({
      winner: {instance: B, resolution: 'RDX_MARS_ARCHITECTURE_AWARD', party: PartyName.MARS, votes: 1, player: 'neutral', slot: 1},
      support: [
        {party: PartyName.GREENS, gained: 1, total: 1, reason: 'absent'},
        {party: PartyName.SCIENTISTS, gained: 1, total: 1, reason: 'absent'},
        {party: PartyName.REDS, gained: 1, total: 1, reason: 'absent'},
        {party: PartyName.UNITY, gained: 1, total: 1, reason: 'lost'},
        {party: PartyName.INDUSTRIALISTS, gained: 1, total: 1, reason: 'lost'},
      ],
    }), fourParties, undefined);
    const greens = scene.roll.find((e) => e.party === PartyName.GREENS);
    expect(greens?.status, 'the office is not a card: the starting ruler is absent from the table').eq('absent');
    expect(greens?.mark.kind, 'nothing on the table speaks for it — no government card to press').eq('none');
    expect(scene.roll.filter((e) => e.status === 'ruling'), 'nobody rules by a card').deep.eq([]);
    const wave = scene.waves.find((w) => w.party === PartyName.GREENS);
    expect(wave?.status).eq('absent');
    expect(wave?.cubes, 'one cube from the supply, like every absent party').deep.eq([{from: 'supply'}]);
    // …and once a card rules (any later generation), the office IS named and never gains.
    const later = supportSceneOf(summary({support: [{party: PartyName.GREENS, gained: 1, total: 1, reason: 'absent'}]}), fourParties, PartyName.GREENS);
    expect(later.roll.find((e) => e.party === PartyName.GREENS)?.status, 'the card outranks the record').eq('ruling');
    expect(later.waves.find((w) => w.party === PartyName.GREENS)).is.undefined;
  });

  it('OVERFLOW is honest: a party the server could not pay (its places are full) still gets a cube — and it goes back', () => {
    const scene = supportSceneOf(summary({support: [
      {party: PartyName.MARS, gained: 0, total: 3, reason: 'lost'},
      {party: PartyName.REDS, gained: 0, total: 3, reason: 'absent'},
    ]}), table, PartyName.SCIENTISTS);
    expect(scene.waves.map((w) => `${w.party}:${w.cubes.length}:${w.overflow === true}`)).deep.eq([
      `${PartyName.REDS}:1:true`,
      `${PartyName.MARS}:1:true`,
    ]);
  });
});
