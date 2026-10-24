# Your own features (ES modules)

Drop a `.js` file in this folder and it is part of the client on the next build. Nothing else to edit.

- Every `.js` file here is loaded once, after the game has loaded.
- Files that start with `_` are ignored (use that for drafts and for `_example.js`).
- Plain `export default function(voidClient){ ... }` is the normal shape. A file with only top-level code works too.
- A feature that crashes is logged to the console (F12) and skipped. It cannot break the client.

## What a feature gets

`voidClient` is the client object:

| What | Use |
|---|---|
| `voidClient.settings.data.<id>` | read a setting (see "Add a setting" below) |
| `voidClient.showNotification(message, false, 4)` | a small notification (message, needs a click?, seconds) |
| `voidClient.hostFeatures` | what the .exe supports (an array of strings) |
| `voidClient.hotkeyHints` | push `{ source, label, key }` so the key shows up in Hotkeys > "Keys from userscripts and features" |

Krunker's own page is a normal web page, so `document`, `window`, `fetch` and `window.chrome.webview.postMessage(...)` work as usual.

## Add a setting for your feature

1. Open `src/cSettings.json` and copy a small entry such as `rampBoost` (a checkbox). Give it a new key and `"id"`, a `"name"`, a `"description"` and a `"defaultValue"`.
2. In your feature: `if (!voidClient.settings.data.myFeature) return;`

The setting then appears in Client settings and is saved for you.

## Ideas that only need this folder

Ranked alert, ranked queue sound, a nuke counter, a keystroke display, account helpers, a chat log. Anything that runs inside the game page. Features that need the .exe to do something (read files, talk to Windows) also need Rust code in `src/handlers.rs`.

## Features that already ship here

Each one is a single file. Delete the file (and its row in `src/cSettings.json`) to remove it.

| File | What it does | Setting |
|---|---|---|
| `betterChat.js` | Team and all chat in one view, `[T]` / `[M]` tags, Tab switches where you send | Interface > Better Chat |
| `textSelect.js` | Select and copy text from the in-game chat with the mouse and Ctrl+C | Interface > Selectable Chat |
| `chatLogs.js` | Keeps the last 2000 chat lines across lobbies, search and copy. F1 opens it (change `OPEN_KEY` at the top of the file) | Interface > Chat Logs |
| `menuTimer.js` | Match timer in the menu (its CSS is inside the file) | Interface > Menu Timer |
| `rankedAlert.js` | Brings the client to the front when the ranked queue finds a match while you are tabbed out | Game > Ranked Match Alert |
| `rankedQueue.js` + `assets/match-found.ogg` | Ranked queue in its own window with a match found sound and volume | Sound button under Ranked Match Alert |
| `bpClaimAll.js` | "Claim All" button in the battle pass | none |

`assets/` holds files a feature loads (the sound). It is not scanned for features.

## Example

Copy `_example.js` to `myFeature.js` (no underscore) and edit it.
