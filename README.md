<div align="center">
  <img src="https://raw.githubusercontent.com/victor-zelinskiy/terraforming-mars/main/assets/steamdeck/steam-deck-logo-2048-682.png" width="520" alt="Terraforming Mars">
</div>

# Terraforming Mars — Console Edition

An **unofficial, open-source** desktop build of the board game *Terraforming Mars*, made
for the living room: **Steam Deck, Steam Machine, and Windows**. It ships a controller-first
console UI you can play end-to-end with a gamepad on a TV, alongside the classic mouse UI, a
built-in solo AI opponent (**MarsBot**), and every major expansion. It installs per-user and
**updates itself on launch** — nothing to maintain.

It is a fork of the open-source
[terraforming-mars](https://github.com/terraforming-mars/terraforming-mars) engine, with a
rebuilt client for handhelds and TVs.

> Not affiliated with FryxGames, Asmodee Digital, Valve, or Steam. The board game is
> excellent — [buy it](https://www.amazon.com/Stronghold-Games-6005SG-Terraforming-Board/dp/B01GSYA4K2).

---

## Install

### 🎮 Steam Deck / Steam Machine

One command, about 5 minutes — it downloads the game, sets up the launcher, and adds
**Terraforming Mars** to your Steam library with artwork. Full step-by-step walkthrough:
**[scripts/steamdeck/GUIDE.md](scripts/steamdeck/GUIDE.md)**.

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

GPLv3 — same as the upstream project it is based on.

- Russian Prototype font: https://fonts-online.ru/fonts/prototype-rus-daymarius (copyright 2001, free for personal use)
- Polish Prototype font: https://www.gry-planszowe.pl/viewtopic.php?p=1489006#p1489006 (copyright 2001, free for personal use)
- Board game icons: http://www.kenney.nl/ (Creative Commons Zero, CC0)
