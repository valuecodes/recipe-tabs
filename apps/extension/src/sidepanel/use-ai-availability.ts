import { useCallback, useEffect, useRef, useState } from "react";

import { AI_APIS, checkAvailability } from "~/ai/availability";
import type { AiStatus } from "~/ai/availability";

// While a model downloads, re-check now and then: it ends in `available`, and
// after an extension reload mid-download this is how the panel catches up.
const POLL_MS = 5000;

const useAiAvailability = (): {
  status: AiStatus | undefined;
  refresh: () => Promise<void>;
} => {
  const [status, setStatus] = useState<AiStatus>();
  // Only the newest check may set the status.
  const requestRef = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;
    const next = await checkAvailability();
    if (request === requestRef.current) {
      setStatus(next);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const downloading =
    status !== undefined &&
    AI_APIS.some((api) => status[api] === "downloading");

  useEffect(() => {
    if (!downloading) {
      return undefined;
    }
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [downloading, refresh]);

  return { status, refresh };
};

export { useAiAvailability };
