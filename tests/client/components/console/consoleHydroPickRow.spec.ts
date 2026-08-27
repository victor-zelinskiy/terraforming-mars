import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroPickRow from '@/client/components/console/hydroFlow/ConsoleHydroPickRow.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';

/**
 * THE LANDED STAGE'S PRE-SELECT ROW — one component, both roads onto the track.
 *
 * Its job is to state ONE branch the way the Actions workspace states it: the
 * branch's own printed graphic and nothing else. «Права на астероиды» is the
 * case that broke it — its first `action()` literally ends `.nbsp.or()`, the
 * connector joining it to the box below on the card face, which is meaningless
 * (and visibly orphaned) once the branch stands alone: the row read
 * «1 M€ → <asteroid>* ИЛИ» with nothing after the ИЛИ.
 */
function nodeOf(card: CardName, index: number) {
  const group = playerActionGroups([{name: card, isDisabled: false} as CardModel])[0];
  const node = group?.nodes[index];
  return node === undefined ? undefined : stripNodeOr(node);
}

function mountRow(props: Record<string, unknown>) {
  return mount(ConsoleHydroPickRow, {
    props: {kind: 'reuse-action', ...props},
    global: {stubs: {GamepadGlyph: true}},
  });
}

describe('the Hydronetwork pre-select row', () => {
  describe('a chosen action renders its OWN branch', () => {
    it('drops the connector that joined it to the box below', () => {
      const w = mountRow({card: CardName.ASTEROID_RIGHTS, node: nodeOf(CardName.ASTEROID_RIGHTS, 0)});
      expect(w.find('.con-composer__repeatpick-graphic').exists(), 'the branch graphic is drawn').is.true;
      expect(w.findAll('.card-or'), 'an orphaned «ИЛИ» with nothing after it').to.have.length(0);
      w.unmount();
    });

    /** …but an OR that is INSIDE the branch is the branch's OWN choice
     *  («производство M€ ИЛИ 2 титана») and must survive. */
    it('keeps an OR that belongs to the branch itself', () => {
      const w = mountRow({card: CardName.ASTEROID_RIGHTS, node: nodeOf(CardName.ASTEROID_RIGHTS, 1)});
      expect(w.findAll('.card-or'), 'the branch\'s own two outcomes').to.have.length(1);
      w.unmount();
    });

    it('names the card beside the graphic, with a tick', () => {
      const w = mountRow({card: CardName.ASTEROID_RIGHTS, node: nodeOf(CardName.ASTEROID_RIGHTS, 0)});
      expect(w.find('.con-composer__repeatpick-name').exists()).is.true;
      expect(w.find('.con-hydro__bonus-tick').exists()).is.true;
      w.unmount();
    });
  });

  describe('the three states', () => {
    it('UNCHOSEN wears the owed register and names the verb', () => {
      const w = mountRow({});
      expect(w.classes()).to.contain('con-hydro__pickrow--missing');
      expect(w.find('.con-hydro__summary-body--empty').exists()).is.true;
      expect(w.attributes('role'), 'it is a press').to.eq('button');
      w.unmount();
    });

    it('CHOSEN is not owed', () => {
      const w = mountRow({card: CardName.ASTEROID_RIGHTS, node: nodeOf(CardName.ASTEROID_RIGHTS, 0)});
      expect(w.classes()).to.not.contain('con-hydro__pickrow--missing');
      w.unmount();
    });

    /**
     * FIZZLED — the server offered no candidate. Telling the player to «выберите
     * действие» is an instruction they cannot follow, so the row states the dead
     * end and offers no press at all.
     */
    it('FIZZLED states the skip and is not a press', () => {
      const w = mountRow({fizzled: true});
      expect(w.classes()).to.contain('con-hydro__pickrow--fizzled');
      expect(w.classes(), 'nothing is owed').to.not.contain('con-hydro__pickrow--missing');
      expect(w.attributes('role')).to.eq(undefined);
      expect(w.find('.con-hydro__summary-body--empty').exists(), 'no «choose» affordance').is.false;
      w.unmount();
    });

    it('a click opens the picker — but never from a dead end', async () => {
      const live = mountRow({});
      await live.trigger('click');
      expect(live.emitted('open')).to.have.length(1);
      live.unmount();

      const dead = mountRow({fizzled: true});
      await dead.trigger('click');
      expect(dead.emitted('open')).is.undefined;
      dead.unmount();
    });
  });

  describe('the animal target', () => {
    it('states the honest «сейчас → станет» beside the card', () => {
      const w = mount(ConsoleHydroPickRow, {
        props: {kind: 'animal-target', card: CardName.BIRDS, animalCurrent: 3},
        global: {stubs: {GamepadGlyph: true}},
      });
      const text = w.find('.con-hydro__pick-cur').text().replace(/\s+/g, ' ');
      expect(text).to.contain('3');
      expect(text).to.contain('5');
      w.unmount();
    });
  });
});
