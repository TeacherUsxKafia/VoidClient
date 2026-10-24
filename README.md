# Void Client

A lightweight, **performance-only** Krunker client by TeacherUs.

**Void Client is a fork of, and based on, [Kute](https://github.com/NullDev/Kute) by NullDev and contributors (GPL-3.0). All credit for the engine work, the Chromium patches and the original ideas goes to them.** Void Client is licensed GPL-3.0 as well (see `LICENSE` and `NOTICE.md`).

It is **not an Electron client**. It is a Rust program that embeds Chromium through CEF, so Krunker does not show an "unsupported client" message.

It keeps: uncapped FPS, the patched Chromium, an exact FPS limiter, raw mouse input and the laptop/GPU tweaks.
It removes everything cosmetic or social, so nothing extra runs.
It adds: your own CSS and userscripts folders, a splash screen, and a drop-in folder for your own ES module features.

---

## Why it should not lag

The speed comes from a patched `libcef.dll` (the Chromium engine). The patches are in [`patches/`](patches/README.md). In plain words:

| Problem | Cause | Fix (Settings > Engine, all on by default) |
|---|---|---|
| Ping spikes when shooting, players hang in the air, then catch-up | Constant mouse input at uncapped FPS can starve Chromium's WebSocket (the "aim freeze") | **Input at Normal Priority**, **Raw Input Keeps Movement** |
| Lag spikes, FPS going up and down | The renderer floods the main thread when the GPU is the limit | **Frame Pacing**, **WebGL Buffer Cache** |
| A cap that wastes CPU or adds delay | Capping in the graphics driver sleeps and spins | **Chromium FPS Limiter** |
| Audio stutter at high FPS | The game re-pans every sound every frame | **Fix Audio Stutters**, **Coalesce Audio Automation** |

Tips for a weak laptop with no GPU: set **FPS Limit** to a steady 60 to 120 instead of fully uncapped, try the **Graphics Backend** setting (D3D11 or OpenGL) if you still see spikes, and use **CPU Throttling** only as a last resort.

---

## Get your .exe without a fast PC: build it on GitHub

1. Make a free account on github.com and create a new repository.
2. Put this project's files in it (easiest: install **GitHub Desktop**, add this folder, commit, push).
3. On GitHub open **Actions** > **Build client** > **Run workflow**.
4. Wait 20 to 60 minutes. When it is green, open the run and download **client-portable** at the bottom.
5. Unzip it and run `void.exe`.

If the run turns red, copy the red error text and send it to whoever helps you with the code.

## Name, developer and icon

- `branding.json` holds three values: `name` (shown to players), `exeName` (the file name, lowercase, no spaces) and `developer` (shown in the exe's properties). After a change run `node scripts/rebrand.mjs`. The cloud build does this for you.
- **Icon:** replace `resources/void.ico` (make one from a PNG at convertico.com) and `resources/void-256.png` (256x256). Keep the file names.
- Everything is stored in `Documents\VoidClient`. It never reads another client's data, and you log in to Krunker again the first time.

## Splash screen

Replace `resources/splash.png` with any PNG and build again. It shows **once, when the client opens**, not on every match or quick match, and only the picture itself is drawn (no dark screen around it). **A small image stays small**: it is never enlarged, and a big one is shrunk to fit. In Settings > Interface players can switch it off, set how long it stays (1 to 10 seconds, default 3) and set the most of the window it may use (**Splash Size**, default 40%). Click it to close it early.

## CSS and userscripts

**Built in, for everyone:** `resources/defaults/default.css` loads on every start (it hides ads and promos). A script you put in `resources/userscripts/` and add to the `SHIPPED` list in `src/modules/userscripts.rs` is copied to the player's folder on first start and runs right away.

**One player, no rebuild:**
- `Documents\VoidClient\css`: every `.css` file loads, in name order, after the built-in one.
- `Documents\VoidClient\userscripts`: every `.js` file runs. Crankshaft and idkr scripts work. Switch single scripts on or off in Settings > Manage Userscripts.
- `Documents\VoidClient\swapper`: swaps game files (Settings > Manage Swapper).
- Press F5 in game, or restart, to apply changes.

## Hotkeys

Settings > Hotkeys changes the client's own keys. The same menu also lists the keys your userscripts react to: exact ones from a script's key settings, and a dashed guess read from the script's code (for example `e.key === "g"`). Features you add can list their keys too (see below).

## Included extra features (each one a single file)

Better Chat, Selectable Chat (select and copy text from the chat), Chat Logs (F1), Menu Timer, Ranked Match Alert, Ranked Queue (own window with a match found sound) and Battle Pass Claim All are in `src/frontend/modules/features/`. Turn them on or off in Settings (Interface and Game), or delete the file to remove one for good.

## Add your own features (ES modules)

Drop a `.js` file into `src/frontend/modules/features/` and build. That is all: it is picked up automatically, runs after the game loads, and cannot crash the client if it fails. The `README.md` and `_example.js` in that folder show the shape, how to read client settings, and how to add a setting of your own. Ranked alerts, ranked queue sounds, account helpers and similar page-only features fit here. Features that need the exe to do something also need Rust code in `src/handlers.rs`.

## Build it yourself on Windows (optional)

You need Windows 10/11 x64, Visual Studio 2022 Build Tools (C++ workload), [Rust](https://rustup.rs), [Bun](https://bun.sh), CMake and the patched `libcef.dll`.

1. Copy `libcef.dll` from Kute's **1.3.0** portable release (github.com/NullDev/Kute/releases) to `resources/cef/libcef.dll`. It must match this source. Without it the client starts but without the fixes above.
2. `bun install`, `bun run build`, `bun run portable`. The zip is `target/void-x86_64-portable.zip`.

## Good to know

- Do not run Void Client and Kute at the same time: both use a shared-memory name that is built into the patched DLL.
- The .exe is not code-signed, so Windows may show "Unknown publisher" in its prompts, whatever `developer` says. Only a paid signing certificate changes that.
- Internal names such as `KuteFrameLimiter` stay as they are, because they are compiled into the patched DLL.
- Some benchmark code from Kute is still in the Rust host. Nothing starts it, and removing it safely needs a compiler.
- The client never connects to Kute's servers.

## License

GPL-3.0. If you share the exe you must also share the source (a public GitHub repo does that). Based on Kute by NullDev and contributors. The Chromium patches are Kute's, with credit in `patches/README.md` to bigjakk and thegu5.
