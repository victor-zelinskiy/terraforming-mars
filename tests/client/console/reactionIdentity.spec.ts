import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  checkReactionIdentity, noteReactorRising, noteReactorSettled, reactionIdentityVerdicts, resetReactionIdentity,
} from '@/client/console/cardReaction/reactionIdentity';

/**
 * «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА» (P82 Special Permit's polish, the owner's report of 2026-10-31): the
 * identity of a rise is read off the live DOM against the director's DECLARATION — five verdicts, each named with its
 * card: a foreign face, two faces stacked in one box, a lift that moves another card, one card in two places, a warm
 * face painted. A pure read: nothing moves.
 */
describe('reactionIdentity — every face that moves is one the chain declared', () => {
  let root: HTMLElement;
  const box = (el: HTMLElement, rect: {left: number, top: number, width: number, height: number}) => {
    el.getBoundingClientRect = () => ({
      ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}),
    }) as DOMRect;
  };
  const layerFace = (key: string, card: string, rect = {left: 100, top: 100, width: 320, height: 460}, warm = false): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'con-reaction__face';
    el.setAttribute('data-reaction-key', key);
    el.setAttribute(warm ? 'data-reaction-warm' : 'data-reaction-card', card);
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    box(el, rect);
    root.appendChild(el);
    return el;
  };

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });
  afterEach(() => {
    root.remove();
    resetReactionIdentity();
  });

  it('a declared seated face is no verdict; the same face undeclared is a FOREIGN face, named', () => {
    layerFace('7:1', CardName.DECOMPOSERS);
    noteReactorRising({key: '7:1', seq: 7, card: CardName.DECOMPOSERS, via: 'seat'});
    expect(reactionIdentityVerdicts(document)).deep.eq([]);
    noteReactorSettled('7:1');
    expect(reactionIdentityVerdicts(document).map((v) => `${v.kind}:${v.card}`)).deep.eq([`foreign-face:${CardName.DECOMPOSERS}`]);
  });

  it('a face at opacity ≤ .05 or hidden is not painted — no verdict (a rise that has not begun, a receded face)', () => {
    const el = layerFace('1:1', CardName.PETS);
    el.style.opacity = '0.002';
    expect(reactionIdentityVerdicts(document)).deep.eq([]);
    el.style.opacity = '1';
    el.style.visibility = 'hidden';
    expect(reactionIdentityVerdicts(document)).deep.eq([]);
  });

  it('a WARM face painted is named; two declared faces overlapping more than a fifth are STACKED', () => {
    layerFace('warm:3:1', CardName.ARKLIGHT, undefined, true);
    layerFace('4:1', CardName.DECOMPOSERS, {left: 100, top: 100, width: 320, height: 460});
    layerFace('5:1', CardName.MEDIA_GROUP, {left: 200, top: 120, width: 320, height: 460});
    noteReactorRising({key: '4:1', seq: 4, card: CardName.DECOMPOSERS, via: 'seat'});
    noteReactorRising({key: '5:1', seq: 5, card: CardName.MEDIA_GROUP, via: 'seat'});
    expect(reactionIdentityVerdicts(document).map((v) => v.kind).sort()).deep.eq(['stacked-faces', 'warm-painted']);
  });

  it('a LIFT that moves another card\'s face is named; one card lifted AND painted in the layer is TWO INSTANCES', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-played-key', CardName.PETS);
    wrap.setAttribute('data-reaction-lifted', '1');
    const under = document.createElement('div');
    under.setAttribute('data-played-key', CardName.DECOMPOSERS);
    wrap.appendChild(under);
    root.appendChild(wrap);
    noteReactorRising({key: '9:1', seq: 9, card: CardName.PETS, via: 'place'});
    expect(reactionIdentityVerdicts(document).map((v) => `${v.kind}:${v.card}`)).deep.eq([`lift-carries-another:${CardName.PETS}`]);
    layerFace('9:2', CardName.PETS);
    noteReactorRising({key: '9:2', seq: 9, card: CardName.PETS, via: 'seat'});
    expect(reactionIdentityVerdicts(document).map((v) => v.kind)).to.include('two-instances');
  });

  it('a lifted face no rise declared is FOREIGN; the sentinel says it out loud ONCE per step', () => {
    const lifted = document.createElement('div');
    lifted.setAttribute('data-composer-card', CardName.TARDIGRADES);
    lifted.setAttribute('data-reaction-lifted', '1');
    root.appendChild(lifted);
    const warn = console.warn;
    const said: Array<string> = [];
    console.warn = (...args: Array<unknown>) => said.push(args.join(' '));
    try {
      checkReactionIdentity('rise:x');
      checkReactionIdentity('rise:x');
    } finally {
      console.warn = warn;
    }
    expect(said).to.have.lengthOf(1);
    expect(said[0]).to.include('[reaction] foreign face — foreign-face: Tardigrades at rise:x');
  });
});
