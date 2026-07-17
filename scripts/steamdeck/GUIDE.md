# 🚀 Install Terraforming Mars on Steam Deck / Steam Machine

A beginner-friendly guide. Takes ~5 minutes. Nothing to break — one script does it all.

---

## What you need

- A Steam Deck (or a SteamOS / Linux PC hooked up to your TV).
- Internet.
- 5 minutes.

---

## Step 1. Switch to Desktop Mode

On the Steam Deck:

1. Press the **STEAM** button.
2. Choose **Power**.
3. Choose **Switch to Desktop**.

The Deck reboots into a normal desktop, similar to Windows.

> 💡 You don't need a keyboard/mouse — the right trackpad works as a mouse, and **STEAM + X** brings up the on-screen keyboard.

---

## Step 2. Open Konsole (the terminal)

1. Click the menu icon in the bottom-left corner (like the Windows "Start" button).
2. Type **Konsole** in the search box.
3. Open it. A black window appears — that's the terminal.

---

## Step 3. Paste and run the install command

Copy this **single** line in full:

```bash
curl -sSL https://raw.githubusercontent.com/victor-zelinskiy/terraforming-mars/main/scripts/steamdeck/install-steamdeck.sh | bash
```

Paste it into Konsole:

- **Paste into the terminal** is **Ctrl + Shift + V** (plain Ctrl+V does NOT work here!).
- Or right-click → **Paste**.

Press **Enter** and wait. The script automatically:

1. ⬇️ downloads the latest version of the game,
2. ⚙️ sets up the launcher,
3. 🎨 downloads the Steam artwork,
4. ➕ adds **"Terraforming Mars"** to your Steam library.

When you see **`Done.`** — you're finished. You can close Konsole.

---

## Step 4. Go back to Gaming Mode and play

1. On the desktop, double-click the **Return to Gaming Mode** icon.
2. The Deck returns to the familiar Steam interface.
3. Open your **Library** → find **"Terraforming Mars"** → **Play**. 🎉

---

## Updates

Nothing to do. The game **updates itself** on launch through the built-in updater — you'll see a nice loading screen, and a couple of seconds later the new version starts.

---

## ❓ Troubleshooting

| Problem                               | Fix                                                                                 |
|---------------------------------------|-------------------------------------------------------------------------------------|
| "Steam user profile not found"        | Open Steam at least once (sign in), then re-run the command.                        |
| "No .AppImage asset found"            | A build is still publishing. Wait ~5 minutes and run the command again.             |
| Shortcut didn't appear in the library | Fully restart Steam (or switch to Game Mode — it always shows up there).            |
| Game won't start / black screen       | Re-run the install command — it's safe to re-run and reinstalls the latest version. |

> The script is **idempotent** — you can run it as many times as you like; it just refreshes the install and the shortcut without breaking anything. Your Steam settings are backed up before every write.

---

## For advanced users 🤓

- The AppImage lives at `~/Applications/TerraformingMars.AppImage`, launched through the wrapper `~/Applications/run-terraforming-mars.sh` (the `--no-sandbox` flags gamescope needs + a restart-loop for in-session updates).
- The shortcut is written directly to `shortcuts.vdf` with a deterministic appid; artwork is dropped into `userdata/<id>/config/grid/`.
- Launch logs: `~/Applications/terraforming-mars-steam.log`.
- Manual launch without the script: `chmod +x` the AppImage and run `./TerraformingMars-x86_64.AppImage` (or `--appimage-extract-and-run` if FUSE is unavailable).
- If the GPU path misbehaves (black screen), uncomment `export TM_ELECTRON_SOFTWARE=1` in the wrapper to force software rendering.

Have fun! 🔴
