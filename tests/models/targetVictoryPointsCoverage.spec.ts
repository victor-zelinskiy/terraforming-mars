import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {stepsForBehavior} from '../../src/server/models/actionPreview';
import {Birds} from '../../src/server/cards/base/Birds';
import {Mine} from '../../src/server/cards/base/Mine';
import {Ants} from '../../src/server/cards/base/Ants';
import {Predators} from '../../src/server/cards/base/Predators';
import {SmallAnimals} from '../../src/server/cards/base/SmallAnimals';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';

const CARDS_DIR = path.join(__dirname, '..', '..', 'src', 'server', 'cards');

/** Every `.ts` under `src/server/cards/**`, recursively. */
function cardFiles(dir: string): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...cardFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The brace-balanced object literal ENCLOSING `index` — the `BranchSpec` a
 * `cardInput(` call sits in. Walks back to the opening brace at relative depth
 * 0, then forward to its match, so a nested `{…}` in an argument cannot fool it.
 */
function enclosingLiteral(text: string, index: number): string {
  let depth = 0;
  let open = -1;
  for (let i = index; i >= 0; i--) {
    if (text[i] === '}') {
      depth++;
    } else if (text[i] === '{') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }
  if (open < 0) {
    return '';
  }
  depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(open, i + 1);
      }
    }
  }
  return text.slice(open);
}

/**
 * A RESOURCE ON A CARD IS OFTEN VICTORY POINTS, AND THAT IS THE WHOLE DECISION.
 *
 * «Добавьте ресурс на любую карту» reads as a resource move, but on a scoring
 * card it moves VP — and that is usually the only reason one target beats
 * another. The rule lives in each card's own `victoryPoints` descriptor, so the
 * client cannot derive it; the server answers per candidate via `vpBox`.
 *
 * There are two routes a card target can arrive by, and this pins BOTH:
 *   • the DECLARATIVE walker (`stepsForBehavior`) — every card whose `behavior`
 *     has `addResourcesToAnyCard`, on play, on a blue action and on a corp
 *     first action alike. Automatic, so it cannot be forgotten.
 *   • a BESPOKE branch (`cardInput` as a `BranchSpec.optionInput`) — the one
 *     shape with no backstop, so it is guarded as a WORKLIST below.
 */
describe('target victory points — coverage', () => {
  /** The declarative route answers, and names the scoring candidate. */
  it('the declarative walker ships a VP reading for a scoring candidate', () => {
    const [/* game */, player] = testGame(2);
    const birds = new Birds();
    player.playedCards.push(birds);
    birds.resourceCount = 2;

    // `Mine` holds no resource, so it is the card being PLAYED, never a candidate.
    const steps = stepsForBehavior(player, new Mine(), {
      addResourcesToAnyCard: {type: CardResource.ANIMAL, count: 2},
    });

    const input = steps.find((s) => s.kind === 'input');
    expect(input, 'the target picker is pre-collected').to.not.eq(undefined);
    expect(input?.kind === 'input' ? input.amount : undefined, 'the delta rides the step').to.eq(2);
    // Birds score 1 VP per animal: 2 → 4 animals is 2 → 4 VP.
    const vpBox = input?.kind === 'input' ? input.vpBox : undefined;
    expect(vpBox, 'the VP reading is present').to.not.eq(undefined);
    expect(vpBox?.[CardName.BIRDS]).to.deep.eq({from: 2, to: 4});
  });

  /**
   * …and stays ABSENT when nothing in the set scores per resource. An empty map
   * on every card pick in the game would be noise, and a VP line on a card whose
   * points the resource does not touch would be a claim the player could act on.
   */
  it('ships no VP reading when no candidate scores per resource', () => {
    const [/* game */, player] = testGame(2);
    // A resource holder with no `victoryPoints` at all.
    player.playedCards.push(fakeCard({resourceType: CardResource.ANIMAL}));

    const steps = stepsForBehavior(player, new Mine(), {
      addResourcesToAnyCard: {type: CardResource.ANIMAL, count: 1},
    });
    const input = steps.find((s) => s.kind === 'input');
    expect(input, 'the picker is still shown — the resource still moves').to.not.eq(undefined);
    expect(input?.kind === 'input' ? input.vpBox : undefined).to.eq(undefined);
  });

  /**
   * THE CROSS-OWNER READING — the whole reason Predators is a decision.
   *
   * Taking an animal costs the OWNER points, and which card to take it from is
   * the move: a card scoring 1 VP per animal loses a point, one scoring 1 VP per
   * TWO animals may lose nothing at all, and neither is legible from the faces.
   * The rule must be read against the OWNER's tableau, and the answer must name
   * whose points they are.
   */
  it('reads an opponent card against ITS OWNER, and names them', () => {
    const [/* game */, player, opponent] = testGame(2);
    const predators = new Predators();
    player.playedCards.push(predators);
    const birds = new Birds();
    const small = new SmallAnimals();
    opponent.playedCards.push(birds, small);
    birds.resourceCount = 3;
    small.resourceCount = 3;

    const preview = predators.actionPreview(player);
    const step = preview.branches[0].steps.find((s) => s.kind === 'input');
    const vpBox = step?.kind === 'input' ? step.vpBox : undefined;
    expect(vpBox, 'the removal states what it costs').to.not.eq(undefined);

    // Birds score per animal: −1 animal is −1 VP, and it is the OPPONENT's.
    expect(vpBox?.[CardName.BIRDS]).to.deep.eq({
      from: 3, to: 2, owner: {color: opponent.color, name: opponent.name},
    });
    // Small Animals score per TWO: at 3 animals the same removal costs NOTHING…
    expect(vpBox?.[CardName.SMALL_ANIMALS]?.from).to.eq(1);
    expect(vpBox?.[CardName.SMALL_ANIMALS]?.to).to.eq(1);
    // …and that is STATED, never omitted — silence would make it look like Birds.
    expect(vpBox?.[CardName.SMALL_ANIMALS]?.owner?.color).to.eq(opponent.color);
  });

  /**
   * THE CONSTANT HALF, stated with the EFFECTS.
   *
   * What the taken resource is worth on the acting card does not vary with the
   * candidate, so it belongs beside the other effects and not in the rail — a
   * value restated on every focus move is what stops a status line being
   * glanceable. Without it the trade was told from one side only: the opponent's
   * loss was spelled out and the player's own gain was left as «+1 животное».
   */
  it('states what the taken resource is worth on the ACTING card', () => {
    const [/* game */, player, opponent] = testGame(2);
    const predators = new Predators();
    player.playedCards.push(predators);
    predators.resourceCount = 4;
    const birds = new Birds();
    opponent.playedCards.push(birds);
    birds.resourceCount = 3;

    const vp = predators.actionPreview(player).branches[0].effects.find((e) => e.icon === 'vp');
    expect(vp, 'the action says what the animal is worth here').to.not.eq(undefined);
    // Predators score 1 VP per animal: 4 → 5.
    expect(vp).to.include({direction: 'gain', current: 4, resulting: 5});
  });

  /**
   * …and stated even when THIS one does not pay. Ants score 1 VP per TWO
   * microbes, so at an even count the same action gains nothing — precisely the
   * arithmetic that is invisible on the card face, and the chip's own «no
   * effect» treatment says it without inventing a second vocabulary.
   */
  it('states it even when the acting card gains no point this time', () => {
    const [/* game */, player, opponent] = testGame(2);
    const ants = new Ants();
    player.playedCards.push(ants);
    ants.resourceCount = 2; // 1 VP; +1 microbe → 3 microbes → still 1 VP
    opponent.playedCards.push(fakeCard({resourceType: CardResource.MICROBE, resourceCount: 2}));

    const vp = ants.actionPreview(player).branches[0].effects.find((e) => e.icon === 'vp');
    expect(vp, 'silence would read as «this card does not score»').to.not.eq(undefined);
    expect(vp).to.include({current: 1, resulting: 1});
  });

  /** The actor's OWN card carries no owner label — there is nobody to name. */
  it('leaves the acting player\'s own cards unlabelled', () => {
    const [/* game */, player] = testGame(2);
    const predators = new Predators();
    const birds = new Birds();
    player.playedCards.push(predators, birds);
    birds.resourceCount = 2;

    const preview = predators.actionPreview(player);
    const step = preview.branches[0].steps.find((s) => s.kind === 'input');
    const vpBox = step?.kind === 'input' ? step.vpBox : undefined;
    expect(vpBox?.[CardName.BIRDS], 'own card still reads').to.deep.eq({from: 2, to: 1});
  });

  /**
   * READ-ONLY, STILL. The walker evaluates each candidate's VP rule through the
   * real `Counter`, and computing a rule is one keystroke away from applying it.
   * The whole preview layer is only safe because it never touches state.
   */
  it('computing the VP reading mutates nothing', () => {
    const [game, player] = testGame(2);
    const birds = new Birds();
    player.playedCards.push(birds);
    birds.resourceCount = 3;

    const before = JSON.stringify(game.serialize());
    stepsForBehavior(player, new Mine(), {
      addResourcesToAnyCard: {type: CardResource.ANIMAL, count: 2},
    });
    expect(JSON.stringify(game.serialize()), 'the preview left the game untouched').to.eq(before);
    expect(birds.resourceCount, 'and the candidate still holds what it held').to.eq(3);
  });

  /**
   * THE WORKLIST.
   *
   * A bespoke branch puts the target on the BRANCH (`optionInput`), where there
   * is no step to derive the delta from — so unlike the declarative route it can
   * be forgotten, and it was: five of the six sites shipped without it while the
   * sixth had it, which is exactly the kind of silent per-card drift a fork
   * cannot see in review.
   *
   * The rule is deliberately NOT scoped to an expansion list: it only fires on a
   * branch that ALREADY declares both a card target and a card-resource delta —
   * i.e. one that already has a premium preview. If the preview was written, it
   * must be complete. So this widens by itself when expansion scope widens.
   */
  it('every bespoke branch with a card-resource delta declares its VP reading', () => {
    const offenders: Array<string> = [];
    for (const file of cardFiles(CARDS_DIR)) {
      const text = fs.readFileSync(file, 'utf8');
      let at = text.indexOf('cardInput(');
      while (at >= 0) {
        const branch = enclosingLiteral(text, at);
        // A branch that moves a resource ONTO/OFF the chosen card states it with
        // `cardResourceGain` / `cardResourceLoss`. Anything else (Self-Replicating
        // Robots hosts an unplayed card; its resources are a cost discount and
        // score nothing) is correctly silent about VP.
        const movesCardResource = /cardResource(Gain|Loss)\(/.test(branch);
        if (movesCardResource && !branch.includes('vpBox')) {
          const line = text.slice(0, at).split('\n').length;
          offenders.push(`${path.relative(CARDS_DIR, file).replace(/\\/g, '/')}:${line}`);
        }
        at = text.indexOf('cardInput(', at + 1);
      }
    }
    expect(offenders,
      'these branches move a card resource but never say what it does to VP:\n' +
      offenders.join('\n') +
      '\nAdd `vpBox: actionPreviews.targetVictoryPoints(player, <candidates>, <delta>),` beside the effect.',
    ).to.be.empty;
  });

  /**
   * The same worklist for the REMOVAL shape.
   *
   * `inputStep` serves two unrelated targets: a PLAYER (production attacks —
   * `previewSelectPlayer`, no card VP to read) and a CARD (`previewSelectCard` —
   * "spend a floater from which card?"). Only the second has a VP reading, and
   * it needs the candidate list, which `previewTargetCards()` is what supplies.
   * So: a card-target `inputStep` that never asks for its candidates is one that
   * cannot be showing the points it moves.
   */
  it('every card-target inputStep asks for the candidates its VP reading needs', () => {
    const offenders: Array<string> = [];
    for (const file of cardFiles(CARDS_DIR)) {
      const text = fs.readFileSync(file, 'utf8');
      const feedsACardPicker = text.includes('inputStep(') && text.includes('previewSelectCard(');
      // Any of the sanctioned ways to answer counts — the candidate accessor at a
      // call site, or the computation itself inside a shared builder.
      const readsVictoryPoints = text.includes('previewTargetCards(') ||
        text.includes('targetVictoryPoints(') || text.includes('vpBox');
      if (feedsACardPicker && !readsVictoryPoints) {
        offenders.push(path.relative(CARDS_DIR, file).replace(/\\/g, '/'));
      }
    }
    expect(offenders,
      'these host a CARD-target picker but never read what the move does to VP:\n' +
      offenders.join('\n') +
      '\nPass `{player, cards: <removal>.previewTargetCards()}` as `inputStep`\'s third argument.',
    ).to.be.empty;
  });
});
