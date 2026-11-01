/** A trailing throttle: continuous motion cannot postpone a send indefinitely.
 * The callback reads the current camera and dimensions when the timer fires. */
export function createViewportSync(send: () => void, intervalMs = 100) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    schedule() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        send();
      }, intervalMs);
    },
    syncNow() {
      cancel();
      send();
    },
    cancel,
  };
}
