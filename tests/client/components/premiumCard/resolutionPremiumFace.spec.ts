import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {PARLIAMENT_GRAPHIC, resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {buildMechanics} from '@/client/components/premiumCard/mechanicsModel';
import {allResolutions, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {PartyName} from '@/common/turmoil/PartyName';

/**
 * THE FACE OF A RESOLUTION — «THE BILL» (Turmoil Redux,
 * docs/claude/resolution-face-progress.md) on the three technical examples the
 * catalog carries for exactly this purpose (`copies: 0` — never dealt, only
 * inspected): an IMMEDIATE effect, a PASSIVE effect, an ACTION — and on every
 * SHIPPED resolution.
 *
 * A resolution is not a project card: the face is its OWN anatomy (a page
 * with a folded corner, a vellum band, the author's seal, the articles, the
 * quest as a footnote) and wears NOTHING of the project's. The mechanics are
 * still the ONE formula renderer; the chairman quest is a graphic behind a
 * chair — never a sentence, never a caption repeated on every card.
 */
const $t = (k: string) => k;

function face(id: string) {
  const vm = resolutionPremiumVmById(id);
  if (vm === undefined) {
    throw new Error(`no resolution ${id} in the client manifest`);
  }
  return mount(PremiumCard, {props: {name: id as CardName, vmOverride: vm}, global: {mocks: {$t}}});
}

/** Everything the PROJECT face is built from — none of it may stand on a resolution. */
const PROJECT_ANATOMY = ['.pcard__body', '.pcard__rim', '.pcard__frame', '.pcard__content', '.pcard__header', '.pcard-nameplate', '.pcard__cost', '.pcard__tags', '.pcard__reqs', '.pcard__divider', '.pcard__lower', '.pcard__vp', '.pcard-play-rail'];

describe('PremiumCard — the face of a resolution (the bill)', () => {
  for (const [id, label] of [['RDX_DEV_IMMEDIATE', 'immediate'], ['RDX_DEV_PASSIVE', 'passive'], ['RDX_DEV_ACTION', 'action']] as const) {
    it(`a ${label} resolution is the bill: its own anatomy, the mechanics as graphics, the quest as a wordless footnote`, () => {
      const wrapper = face(id);
      expect(wrapper.classes()).to.include('pcard--theme-resolution');
      expect(wrapper.classes(), 'the bill anatomy').to.include('pcard--bill');
      for (const part of PROJECT_ANATOMY) {
        expect(wrapper.find(part).exists(), `nothing of the project's anatomy: ${part}`).to.eq(false);
      }
      for (const part of ['.pcard-bill__sheet', '.pcard-bill__art', '.pcard-bill__band', '.pcard-bill__title', '.pcard-bill__articles', '.pcard-bill__foot', '.pcard-bill__fold', '.pcard-bill__seal']) {
        expect(wrapper.find(part).exists(), `the bill's ${part}`).to.eq(true);
      }
      expect(wrapper.findAll('.pcard-mech-group').length, 'the printed mechanic').to.be.greaterThan(0);
      // THE QUEST: a chair and the condition as a graphic — no sentence, no caption, no reward marks.
      expect(wrapper.find('.pcard-bill__quest .pchair').exists(), 'the chair stands for the words').to.eq(true);
      expect(wrapper.find('.pcard__quest-graphic').exists(), 'the quest condition is a graphic').to.eq(true);
      expect(wrapper.find('.pcard__quest-text').exists(), 'no sentence on the face').to.eq(false);
      expect(wrapper.find('.pcard__quest-kicker').exists(), 'no caption repeated on every card').to.eq(false);
      expect(wrapper.find('.pcard__quest-reward').exists(), 'the reward is the same for every resolution — never repeated on the face').to.eq(false);
      expect(wrapper.find('.pcard-bill__quest').text().replace(/[\s\d+−/:*]/g, ''), 'the footnote prints no words').to.eq('');
      expect(wrapper.find('.pcard-bill__title').text(), 'the title is the only sentence on the page').to.not.eq('');
    });
  }

  it('the PARTY reads without words: the seal is the party\'s own emblem and the page carries its accent', () => {
    const resolution = getResolution('RDX_DEV_PASSIVE');
    if (resolution === undefined) {
      throw new Error('no RDX_DEV_PASSIVE in the client manifest');
    }
    const wrapper = face(resolution.id);
    const emblem = wrapper.find('.pcard-bill__seal .pcard__party-emblem');
    expect(emblem.exists(), 'the author\'s seal').to.eq(true);
    expect(emblem.attributes('src'), 'Mars First\'s emblem').to.contain('mars-first');
    const style = wrapper.attributes('style') ?? '';
    expect(style, 'the accent dyes the band\'s edge and the seal\'s tails').to.contain(`--pcard-party-accent: ${partyAccent(resolution.party)}`);
    expect(style, 'the emblem is the page\'s watermark').to.contain('--pcard-party-emblem: url(');
    expect(wrapper.find('.pcard-bill__band').text(), 'the band names the resolution, never the party').to.not.contain(resolution.party);
  });

  it('an art-less resolution carries the party\'s seal in its window; an illustrated one its own 3:2 art', () => {
    expect(face('RDX_DEV_IMMEDIATE').classes(), 'a never-dealt example has no illustration').to.include('pcard--resolution-seal');
    const illustrated = allResolutions().find((resolution) => resolution.code !== undefined);
    if (illustrated === undefined) {
      throw new Error('the catalog ships no coded resolution');
    }
    const vm = resolutionPremiumVmById(illustrated.id);
    expect(vm?.parliament?.sealArt, `${illustrated.id} resolves its own art only when the pack ships it`).to.be.a('boolean');
    expect(face(illustrated.id).classes()).to.include(vm?.parliament?.sealArt === true ? 'pcard--resolution-seal' : 'pcard--resolution-art');
  });

  it('every SHIPPED resolution prints its own effect as graphics beside its quest — the deck holds no card without one', () => {
    const shipped = allResolutions().filter((resolution) => resolution.copies > 0);
    expect(shipped, 'the deck is not empty').to.not.be.empty;
    for (const resolution of shipped) {
      const wrapper = face(resolution.id);
      expect(wrapper.classes(), `${resolution.id}: the bill`).to.include('pcard--bill');
      expect(wrapper.findAll('.pcard-mech-group').length, `${resolution.id}: its effect`).to.be.greaterThan(0);
      expect(wrapper.find('.pcard__quest-graphic').exists(), `${resolution.id}: its quest`).to.eq(true);
      expect(wrapper.find('.pcard__quest-text').exists(), `${resolution.id}: no sentence`).to.eq(false);
      // THE WINNER'S CLAUSE is set apart by the row's own structure — exactly where the card declares a winner part.
      expect(wrapper.findAll('.pcard-mech-group--winner').length, `${resolution.id}: the winner's clause`).to.eq(resolution.hasWinnerEffect ? 1 : 0);
    }
  });

  it('nothing of the Parliament is ever «played»: no on-play rail over a resolution, a quest or a party formula — the order is untouched', () => {
    for (const resolution of allResolutions()) {
      const canonical = buildMechanics(resolution.renderData);
      const enacted = buildMechanics(resolution.renderData, PARLIAMENT_GRAPHIC);
      expect(enacted.playStart, `${resolution.id}: no on-play zone`).to.eq(enacted.groups.length);
      expect(enacted.groups.map((group) => group.graphicId), `${resolution.id}: the same rows in the same order`).to.deep.eq(canonical.groups.map((group) => group.graphicId));
      const quest = buildMechanics(resolution.questRenderData, PARLIAMENT_GRAPHIC);
      expect(quest.playStart, `${resolution.id}: a quest is a condition, never «при розыгрыше»`).to.eq(quest.groups.length);
    }
  });
});

describe('ConsolePartyFormula — a party\'s printed formula', () => {
  const formula = (party: PartyName) => mount(ConsolePartyFormula, {props: {party}, global: {mocks: {$t}}});

  it('a STANDING modifier (an effect with no cause — the Scientists\' wild tag) prints no lone colon', () => {
    const wrapper = formula(PartyName.SCIENTISTS);
    const standing = wrapper.findAll('.pcard-effect--standing');
    expect(standing.length, 'the passive row is a standing modifier').to.eq(1);
    expect(standing[0].text(), 'no colon before the tag').to.not.contain(':');
    expect(standing[0].find('.pcard-effect__part').exists(), 'the result alone').to.eq(true);
  });

  it('the Mars First effect prints the steel ONCE — the city row adds a card («+»), never a second steel', () => {
    const wrapper = formula(PartyName.MARS);
    const rows = wrapper.findAll('.pcard-mech-group');
    expect(rows.length).to.eq(2);
    const steelIcons = wrapper.findAll('.pcard-ic').filter((ic) => (ic.attributes('style') ?? '').includes('steel'));
    expect(steelIcons.length, 'one steel in the formula').to.eq(1);
    expect(rows[1].text(), 'the city row reads as an addition').to.contain('+');
  });

  it('a party prints the passive AND the action rows as one formula, with no on-play rail', () => {
    const wrapper = formula(PartyName.SCIENTISTS);
    expect(wrapper.findAll('.pcard-mech-group').length, 'the passive row and the action row').to.be.greaterThan(1);
    expect(wrapper.find('.pcard-play-rail').exists(), 'a party\'s effect stands — it is never played').to.eq(false);
  });
});
