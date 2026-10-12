# Recipe Tabs

A Chrome extension for saving recipes from the tab you are on and comparing them with
Chrome's built-in AI (Gemini Nano). It is an experiment in what on-device AI can do with
recipes, and it is early: this version only opens an empty side panel.

## Requirements

- Chrome 138 or newer (desktop).
- For the built-in AI features (added later), hardware that Chrome supports for Gemini Nano:
  Windows 10/11, macOS 13+, Linux or a Chromebook Plus; at least 22 GB of free disk space;
  and either a GPU with more than 4 GB of VRAM or a CPU with 16 GB of RAM and 4+ cores.
  `chrome://on-device-internals` shows the model status.

## Load it in Chrome

From the repo root:

```bash
pnpm install
pnpm --filter extension build   # or `dev` to rebuild on every change
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick `apps/extension/dist`.
3. Click the Recipe Tabs toolbar icon (pin it from the puzzle-piece menu) to open the side panel.

After a rebuild, press the reload button on the extension's card.

## Privacy

- The extension reads a page only when you click its toolbar icon on that tab (the
  `activeTab` permission). It has no access to any site otherwise.
- Everything it saves stays in your browser's extension storage.
- Nothing is sent anywhere: there is no server, no account and no telemetry. The built-in
  AI runs on your device.

## Common commands

| Task      | Command                             |
| --------- | ----------------------------------- |
| Dev       | `pnpm --filter extension dev`       |
| Build     | `pnpm --filter extension build`     |
| Typecheck | `pnpm --filter extension typecheck` |
| Clean     | `pnpm --filter extension clean`     |

Linting and formatting are repo-wide: run `pnpm lint` / `pnpm format` from the root.
