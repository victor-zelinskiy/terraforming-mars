import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  COPIED_ACTION_STANCES, CopiedActionArtifact,
} from '@/client/console/hydroMarker/hydroStepAdmission';
import {
  WORKSPACE_FRAME_KINDS, workspaceKindSpec,
} from '@/client/console/consoleWorkspaceStack';

/**
 * COPIED-ACTION STAGE GUARD — «the copied action waits for its stage» is a
 * claim about a SET, and this is the set.
 *
 * THE BUG CLASS. A Hydronetwork stage-7 reward repeats a USED BLUE ACTION, and
 * the server resolves the whole traversal inside ONE request (the parked batch
 * tail drains in the response that answers the stage-5 deck pick). So every
 * artifact that action produces is on the wire while the marker is still two
 * cells back — and every director that reacts to one of those artifacts will
 * paint it on the spot unless it asks whose stage it is.
 *
 * It shipped twice, one family at a time:
 *   1. The drawn batch reached the reveal MODAL early. Gated the modal.
 *   2. …and the DEAL CINEMATIC still peeled the cards off the deck on the spot,
 *      because it is the first thing that reacts to a batch existing and had a
 *      gate of its own. Gated that too.
 * Both fixes were correct and neither was a guarantee, because an action is not
 * only a draw: «Поиск жизни» turns a card over and shows a VERDICT, and
 * `lastReveal` reached the screen with nothing in between.
 *
 * WHAT THIS GUARD CHECKS. `COPIED_ACTION_STANCES` is exhaustive over the
 * artifact union (a `Record`, so a new member is a compile error), every member
 * states a stance, and every `gated` member NAMES THE FILE whose ownership
 * question must ask `hydroStepQueuedFor` — which this spec then reads. A family
 * that is declared gated but whose file does not ask the gate fails here; a new
 * family cannot be added without deciding which it is.
 *
 * It deliberately does NOT try to prove the `by-construction` members from
 * source — that is an argument, not a grep, so each carries its reasoning in
 * `why` and is re-read when the surrounding flow changes.
 */

const ROOT = path.join(__dirname, '..', '..');

/** The one primitive every gated family goes through. */
const GATE = 'hydroStepQueuedFor';

const ALL: ReadonlyArray<CopiedActionArtifact> = [
  'drawn-batch', 'deck-check', 'prompt', 'colony-trade', 'tile-landing', 'reward-wave',
];

describe('copied-action stage guard (every artifact declares its stance)', () => {
  it('the declared set is EXHAUSTIVE over the union', () => {
    // `ALL` is written out by hand on purpose: the `Record` type already forces
    // the table to cover the union, and this asserts the union itself has not
    // grown a member nobody thought about here.
    expect(Object.keys(COPIED_ACTION_STANCES).sort()).to.deep.equal([...ALL].sort());
  });

  it('every family states a stance and a REASON', () => {
    for (const key of ALL) {
      const s = COPIED_ACTION_STANCES[key];
      expect(s, key).to.not.be.undefined;
      expect(['gated', 'by-construction'], `${key} stance`).to.include(s.stance);
      expect(s.why.length, `${key} states why`).to.be.greaterThan(40);
    }
  });

  it('every GATED family names a file that really asks the gate', () => {
    const gated = ALL.filter((k) => COPIED_ACTION_STANCES[k].stance === 'gated');
    // Anti-vacuous: if this list ever empties, the guard is guarding nothing.
    expect(gated.length, 'at least the three known gated families').to.be.at.least(3);
    for (const key of gated) {
      const file = COPIED_ACTION_STANCES[key].file;
      expect(file, `${key} names its file`).to.be.a('string');
      const abs = path.join(ROOT, file as string);
      expect(fs.existsSync(abs), `${key}: ${file} exists`).to.equal(true);
      const src = fs.readFileSync(abs, 'utf8');
      // The prompt family goes through the admission POLICY rather than the
      // predicate — the shell feeds it the signal and the policy owns the block.
      const asks = key === 'prompt' ? src.includes('stage-gate') : src.includes(GATE);
      expect(asks, `${key}: ${file} asks the stage gate`).to.equal(true);
    }
  });

  /*
   * ── A COPIED ACTION CAN WALK INTO ANOTHER WORKSPACE ───────────────────────
   *
   * Repeating «Титановая плавучая платформа» spends a floater to trade — so the
   * copied action's follow-up is not a card batch or a target pick, it is the
   * COLONIES SCREEN, opened as a step INSIDE the Hydronetwork. That path is
   * meant to work without anybody having written it: the door asks
   * `workspaceHostForStep()`, the guest teleports into the zone the host below
   * published, and the crumb is derived from the stack. This pins the three
   * registry facts that make it true, because each of them is a thing a NEW
   * workspace could silently not do.
   */
  describe('a copied action that walks into ANOTHER workspace', () => {
    it('every hostable workspace declares how it hosts — never a hand-written door', () => {
      // `hosts` is what `workspaceHostForStep()` reads. A workspace that omits
      // it can never receive a nested step, and the failure is silent: the
      // prompt opens its own standalone screen over the flow that caused it.
      for (const kind of WORKSPACE_FRAME_KINDS) {
        const spec = workspaceKindSpec(kind);
        expect(['always', 'inFlow', undefined], `${kind} declares its hosting`)
          .to.include(spec.hosts);
      }
      // Anti-vacuous: the flows a copied action can run inside must host.
      for (const kind of ['hydro', 'card-actions', 'hand'] as const) {
        expect(workspaceKindSpec(kind).hosts, `${kind} hosts steps`).to.not.equal(undefined);
      }
    });

    it('a host that can carry a step also publishes a ZONE for it', () => {
      // The zone is what a nested frame teleports into; without it the guest
      // renders NOWHERE, permanently (embed rule 4's gap made unbounded). The
      // publication is a `setWorkspaceFrameSlot` call in the host's own file.
      const HOST_FILES: Readonly<Record<string, string>> = {
        'hydro': 'src/client/components/console/ConsoleHydroSection.vue',
        'card-actions': 'src/client/components/console/ConsoleActionComposer.vue',
        'hand': 'src/client/components/console/ConsoleHandSection.vue',
        'colonies': 'src/client/components/console/ConsoleColoniesSection.vue',
        'start': 'src/client/components/console/ConsoleStartScene.vue',
        'standard-projects': 'src/client/components/console/ConsoleStdProjectsScreen.vue',
      };
      for (const [kind, file] of Object.entries(HOST_FILES)) {
        const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
        expect(src.includes(`setWorkspaceFrameSlot('${kind}'`),
          `${kind} publishes its step zone (${file})`).to.equal(true);
      }
    });

    it('a host that carries a CARD publishes it — the guest never guesses', () => {
      // `L3 Источник` inside a nested step asks its HOST which card the step is
      // being done for. It used to be a ternary in the guest that carved out
      // the one host it knew was different, and it was already wrong for a
      // third: the Hydronetwork's crumb subject is a STAGE NAME, so the verb
      // would have opened a zoom on a string that is not a card.
      for (const [kind, file] of [
        ['hydro', 'src/client/components/console/ConsoleHydroSection.vue'],
        ['card-actions', 'src/client/components/console/ConsoleActionComposer.vue'],
      ] as const) {
        const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
        expect(src.includes(`setWorkspaceFrameSourceCard('${kind}'`),
          `${kind} publishes the card its step is for (${file})`).to.equal(true);
      }
    });
  });

  it('the DEAL cinematic asks it as `waiting`, never as `foreign`', () => {
    // `foreign` is REMEMBERED for the batch's life — classified that way, a
    // queued batch would never get its deal at all once the stage opened. The
    // distinction is the whole reason the verdict has two negative answers.
    const src = fs.readFileSync(path.join(ROOT,
      COPIED_ACTION_STANCES['drawn-batch'].file as string), 'utf8');
    const waitingBlock = src.slice(src.indexOf('const waiting ='), src.indexOf('deckDrawVerdict('));
    expect(waitingBlock.includes(GATE), 'the gate is a term of `waiting`').to.equal(true);
    const foreignBlock = src.slice(src.indexOf('const foreign ='), src.indexOf('const waiting ='));
    expect(foreignBlock.includes(GATE), 'the gate is NOT a term of `foreign`').to.equal(false);
  });
});
