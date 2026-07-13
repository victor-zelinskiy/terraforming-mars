// Generate the premium app icons (Windows exe .ico + a 512² master PNG reused for the Steam
// shortcut icon and the Linux AppImage icon) from the master icon source.
//
// Source: electron/build-resources/icon-source.png — the premium square "TM over Mars" icon.
// Re-run after replacing the source:  node scripts/make-app-icon.cjs
//
// Outputs (committed assets):
//   electron/build-resources/icon.ico       — embedded in Terraforming Mars.exe (electron-builder
//                                              win.icon) + the Velopack Setup.exe (vpk --icon).
//   electron/build-resources/linuxIcon.png  — the Linux AppImage icon (vpk --icon / electron-builder).
//   assets/steamdeck/steam-deck-icon-512.png — materialized at runtime as the Steam Non-Steam
//                                              shortcut icon (electron/steamShortcut.ts).

const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
// png-to-ico v3 is published as an ESM module with a default export; under CJS require() that
// surfaces as { default: fn }. Older versions export the function directly — support both.
const pngToIco = typeof pngToIcoModule === 'function' ? pngToIcoModule : pngToIcoModule.default;
const {writeFileSync} = require('fs');

const SRC = 'electron/build-resources/icon-source.png';

async function main() {
  const master = () => sharp(SRC).resize(512, 512, {fit: 'cover'});

  // 512² master PNG — Steam shortcut icon + Linux AppImage icon (same premium look everywhere).
  await master().png().toFile('assets/steamdeck/steam-deck-icon-512.png');
  await master().png().toFile('electron/build-resources/linuxIcon.png');

  // Multi-resolution .ico for the Windows exe / installer (Steam also extracts this if it ever
  // falls back to the exe icon). 256 is required by electron-builder for the exe.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((s) => sharp(SRC).resize(s, s, {fit: 'cover'}).png().toBuffer()),
  );
  const ico = await pngToIco(pngs);
  writeFileSync('electron/build-resources/icon.ico', ico);

  console.log('icons written: icon.ico, linuxIcon.png, steam-deck-icon-512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
