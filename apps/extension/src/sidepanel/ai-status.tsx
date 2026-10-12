import { useState } from "react";

import {
  AI_APIS,
  FI_EN,
  hasApi,
  RECIPE_SESSION_OPTIONS,
} from "~/ai/availability";
import type { AiApi, AiAvailability, AiStatus } from "~/ai/availability";

type Download = { progress?: number; error?: string };

const LABELS: Record<AiApi, string> = {
  languageModel: "Language model (Gemini Nano)",
  languageDetector: "Language detector",
  translator: "Translator fi → en",
};

const STATUS_TEXT: Record<AiAvailability, string> = {
  available: "ready",
  downloadable: "needs download",
  downloading: "downloading",
  unavailable: "not available on this device",
  unsupported: "not supported in this browser",
};

const NEEDS_DOWNLOAD: readonly AiAvailability[] = [
  "downloadable",
  "downloading",
];

const CREATE: Record<
  AiApi,
  (monitor: CreateMonitorCallback) => Promise<{ destroy: () => void }>
> = {
  languageModel: (monitor) =>
    LanguageModel.create({ ...RECIPE_SESSION_OPTIONS, monitor }),
  languageDetector: (monitor) => LanguageDetector.create({ monitor }),
  translator: (monitor) => Translator.create({ ...FI_EN, monitor }),
};

const percent = (progress: number): string =>
  `${String(Math.round(progress * 100))}%`;

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

const AiStatusPanel = ({
  status,
  refresh,
}: {
  status: AiStatus | undefined;
  refresh: () => Promise<void>;
}) => {
  const [downloads, setDownloads] = useState<Partial<Record<AiApi, Download>>>(
    {}
  );

  const setDownload = (api: AiApi, download: Download | undefined): void => {
    setDownloads((current) => ({ ...current, [api]: download }));
  };

  // Must run synchronously inside a click: `create()` needs the user gesture
  // when a download is required, and the gesture is gone after any `await`.
  const start = (api: AiApi): void => {
    setDownload(api, { progress: 0 });
    CREATE[api]((monitor) => {
      monitor.addEventListener("downloadprogress", (event) => {
        setDownload(api, { progress: event.loaded });
      });
    })
      .then((instance) => {
        instance.destroy();
        setDownload(api, undefined);
      })
      .catch((error: unknown) => {
        console.error(`Failed to enable ${api}`, error);
        setDownload(api, {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        void refresh();
      });
  };

  const pending = AI_APIS.filter(
    (api) =>
      status !== undefined &&
      hasApi(api) &&
      NEEDS_DOWNLOAD.includes(status[api]) &&
      downloads[api] === undefined
  );

  return (
    <section className="mt-3 rounded border border-zinc-200 p-3 dark:border-zinc-700">
      <h2 className="font-semibold">On-device AI</h2>
      {status === undefined ? (
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Checking…</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {AI_APIS.map((api) => {
            const download = downloads[api];
            return (
              <li key={api}>
                {LABELS[api]}: {STATUS_TEXT[status[api]]}
                {download?.progress === undefined
                  ? null
                  : ` (${percent(download.progress)})`}
                {download?.error === undefined ? null : (
                  <span className="block text-red-700 dark:text-red-400">
                    {download.error}{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        start(api);
                      }}
                    >
                      Retry
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pending.length === 0 ? null : (
        <button
          type="button"
          className={`${buttonClass} mt-2`}
          onClick={() => {
            for (const api of pending) {
              start(api);
            }
          }}
        >
          Enable on-device AI
        </button>
      )}
      {status?.languageModel === "unavailable" ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Gemini Nano needs Windows 10/11, macOS 13+, Linux or a Chromebook
          Plus, 22 GB of free disk space, and a GPU with more than 4 GB of VRAM
          or 16 GB of RAM with 4+ CPU cores. See chrome://on-device-internals.
        </p>
      ) : null}
      {status?.languageModel === "unsupported" ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Needs Chrome 138 or newer.
        </p>
      ) : null}
    </section>
  );
};

export { AiStatusPanel };
