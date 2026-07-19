<div align="center">
  <img src="https://raw.githubusercontent.com/victor-zelinskiy/terraforming-mars/main/assets/steamdeck/steam-deck-logo-2048-682.png" width="520" alt="Terraforming Mars">
</div>

# Terraforming Mars — Console Edition

An **unofficial, open-source** desktop application for the board game *Terraforming Mars*,
built for the living room: a **controller-first console UI** you can play entirely with a
gamepad, optimized for **TVs, Steam Deck, Steam Machine, and Windows**. It is a standalone
[Electron](https://www.electronjs.org/) client, installs per-user (no administrator rights),
and updates itself on launch.

> **Project status — fully playable, but a work in progress.** A complete game can be played
> from start to finish today. The project is under active development: many individual UI
> elements, animations, controller interactions, and visual details are not finished yet and
> still need polish.

It is a fork of the open-source
[terraforming-mars](https://github.com/terraforming-mars/terraforming-mars) engine. It
already supports several major expansions and includes **MarsBot**, a built-in solo opponent
that plays by the official Automa rules. Turmoil support is planned once the core polish is
complete, followed by the gradual addition of unofficial (fan-made) expansions.

> Not affiliated with FryxGames, Asmodee Digital, Valve, or Steam. The board game is
> excellent — [buy it](https://www.amazon.com/Stronghold-Games-6005SG-Terraforming-Board/dp/B01GSYA4K2).

---

## Install

### 🎮 Steam Deck / Steam Machine

A single command downloads the game, sets up the launcher, and adds **Terraforming Mars** to
your Steam library with artwork — it usually takes a few minutes. Full step-by-step
walkthrough: **[scripts/steamdeck/GUIDE.md](scripts/steamdeck/GUIDE.md)**.

In Desktop Mode, open **Konsole** and paste:

```bash
curl -sSL https://raw.githubusercontent.com/victor-zelinskiy/terraforming-mars/main/scripts/steamdeck/install-steamdeck.sh | bash
```

Then switch back to Gaming Mode → **Library** → **Play**. Updates apply automatically on launch.

### 🪟 Windows

Download the latest **Setup.exe** from the
[**Releases**](https://github.com/victor-zelinskiy/terraforming-mars/releases) page and run
it. It installs per-user (no admin), updates itself on launch, and can add itself to Steam
as a **Non-Steam Game** for Big Picture / controller play.

---

## Build from source

The desktop app is a thin [Electron](https://www.electronjs.org/) client over the web client.

```bash
npm install
npm run build          # server (tsc) + client (webpack) + static assets

# run the client in Electron against a local dev server (three terminals):
npm run dev:server     # game server (REST + WebSocket)
npm run dev:client     # client bundle, watch mode
npm run electron:dev   # the desktop window
```

Other tasks: `npm run test` (server + client), `npm run lint`.

---

## License

The source code is licensed under **GPLv3**, the same license as the upstream project it is
based on.
