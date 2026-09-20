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
