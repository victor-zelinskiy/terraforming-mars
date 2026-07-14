/*
 * CEREMONY FX — the shared GSAP burst for the console prestige beats
 * (milestone coronation / award seal in ConsoleMaCeremony, the
 * terraforming-complete cinematic in ConsoleTerraformingCeremony).
 *
 * One shot, layered over a positioned STAGE element:
 *   RINGS  — expanding shockwave rings from the stage centre;
 *   SPARKS — a radial burst of small glowing particles;
 *   FLASH  — a brief centre light pulse (full intensity only);
 *   SWEEP  — one travelling light bar across the stage (full only).
 *
 * Contracts (mirror the console directors — hydroMarker / tradeFleet):
 * transform/opacity only; durations through motionMs(); strictly one-shot
 * (never looping); `stop()` idempotent and always tears the layer down;
 * reduced motion spawns NOTHING (the hosts' entrances already collapse to
 * calm fades there). The layer is transient: created here, removed on
 * complete/stop — the host template never knows about it.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';

export type CeremonyAccent = 'gold' | 'medal' | 'terra';

export type CeremonyBurstOptions = {
  /** The positioned stage the burst plays over (rings/sparks radiate from
   *  its centre; the layer covers it, overflow free). */
  host: HTMLElement,
  accent: CeremonyAccent,
  reduced: boolean,
  /** 'full' — the coronation-grade burst (rings + sparks + flash + sweep);
   *  'ping' — the unobtrusive remote beat (one ring, a few sparks). */
  intensity?: 'full' | 'ping',
  /** Base start delay in ms (pre-motionMs) — lets a CSS entrance land first. */
  delayMs?: number,
};

export type CeremonyBurstHandle = {
  /** Tear down instantly (hide / unmount) — kills tweens, removes the layer. */
  stop: () => void,
};

type Palette = {
  sparks: ReadonlyArray<string>,
  ring: string,
  ringGlow: string,
  flash: string,
};

const PALETTES: Readonly<Record<CeremonyAccent, Palette>> = {
  gold: {
    sparks: ['#fff3d1', '#f6d27a', '#f2c14e'],
    ring: 'rgba(242, 193, 78, 0.65)',
    ringGlow: 'rgba(242, 193, 78, 0.35)',
    flash: 'rgba(255, 243, 209, 0.55)',
  },
  medal: {
    sparks: ['#eef3ff', '#cdd9f4', '#9fb4e8'],
    ring: 'rgba(159, 180, 232, 0.6)',
    ringGlow: 'rgba(159, 180, 232, 0.32)',
    flash: 'rgba(238, 243, 255, 0.5)',
  },
  terra: {
    sparks: ['#d6ffee', '#a8f0d4', '#58d6a6', '#f2c14e'],
    ring: 'rgba(88, 214, 166, 0.65)',
    ringGlow: 'rgba(88, 214, 166, 0.35)',
    flash: 'rgba(214, 255, 238, 0.55)',
  },
};

const NOOP_HANDLE: CeremonyBurstHandle = {stop: () => {}};

export function playCeremonyBurst(opts: CeremonyBurstOptions): CeremonyBurstHandle {
  const {host, reduced} = opts;
  // Reduced motion: no burst at all — the hosts' own entrances are already
  // collapsed to calm fades; spawning particles would defeat the preference.
  if (reduced) {
    return NOOP_HANDLE;
  }
  const palette = PALETTES[opts.accent];
  const full = (opts.intensity ?? 'full') === 'full';
  const s = (baseMs: number) => motionMs(baseMs) / 1000;
  const at0 = s(opts.delayMs ?? 0);

  // Radius from the MEASURED stage box (already profile-scaled by rem/zoom,
  // so no conUiScale multiplication needed); floor for a not-yet-laid-out host.
  const radius = Math.max(host.offsetWidth, host.offsetHeight, 80) / 2;

  const layer = document.createElement('div');
  layer.className = 'con-ceremony-fx';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);

  let done = false;
  const cleanup = () => {
    if (done) {
      return;
    }
    done = true;
    tl.kill();
    layer.remove();
  };
  const tl = gsap.timeline({onComplete: cleanup});

  // RINGS — expanding shockwaves (scale + fade only; the size is set once).
  const ringCount = full ? 3 : 1;
  for (let i = 0; i < ringCount; i++) {
    const ring = document.createElement('div');
    ring.className = 'con-ceremony-fx__ring';
    const size = radius * 1.3;
    ring.style.width = `${size}px`;
    ring.style.height = `${size}px`;
    ring.style.left = '50%';
    ring.style.top = '50%';
    ring.style.marginLeft = `${-size / 2}px`;
    ring.style.marginTop = `${-size / 2}px`;
    ring.style.boxShadow = `0 0 0 2px ${palette.ring}, 0 0 22px ${palette.ringGlow}`;
    layer.appendChild(ring);
    tl.fromTo(ring,
      {scale: 0.32, autoAlpha: 0.95},
      {scale: (full ? 1.55 : 1.25) + i * 0.3, autoAlpha: 0, duration: s(880 + i * 200), ease: 'power2.out'},
      at0 + s(i * 130));
  }

  // SPARKS — a radial burst of glowing particles, each on its own vector.
  const sparkCount = full ? 16 : 6;
  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement('div');
    spark.className = 'con-ceremony-fx__spark';
    const color = palette.sparks[i % palette.sparks.length];
    spark.style.background = color;
    spark.style.boxShadow = `0 0 8px ${color}`;
    spark.style.left = '50%';
    spark.style.top = '50%';
    layer.appendChild(spark);
    const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = radius * (full ? 1.15 : 0.85) * (0.85 + Math.random() * 0.55);
    tl.fromTo(spark,
      {x: 0, y: 0, xPercent: -50, yPercent: -50, autoAlpha: 1, scale: 0.7 + Math.random() * 0.6},
      {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        autoAlpha: 0,
        scale: 0.3,
        duration: s(660 + Math.random() * 420),
        ease: 'power3.out',
      },
      at0 + s(Math.random() * 110));
  }

  if (full) {
    // FLASH — one brief centre light pulse over the stage.
    const flash = document.createElement('div');
    flash.className = 'con-ceremony-fx__flash';
    flash.style.background = `radial-gradient(circle, ${palette.flash} 0%, transparent 66%)`;
    layer.appendChild(flash);
    tl.fromTo(flash, {autoAlpha: 0}, {autoAlpha: 0.85, duration: s(150), ease: 'power1.out'}, at0);
    tl.to(flash, {autoAlpha: 0, duration: s(520), ease: 'power2.out'}, at0 + s(160));

    // SWEEP — a single travelling light bar across the stage.
    const sweep = document.createElement('div');
    sweep.className = 'con-ceremony-fx__sweep';
    sweep.style.background = `linear-gradient(100deg, transparent 0%, ${palette.flash} 50%, transparent 100%)`;
    layer.appendChild(sweep);
    tl.fromTo(sweep,
      {x: -radius * 2.4, autoAlpha: 0},
      {x: radius * 2.4, autoAlpha: 0.6, duration: s(760), ease: 'power1.inOut'},
      at0 + s(260));
    tl.to(sweep, {autoAlpha: 0, duration: s(180)}, at0 + s(880));
  }

  return {stop: cleanup};
}
