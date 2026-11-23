/**
 * Wraps a form's server action so that a broken reply (server restarting or asleep, network drop,
 * "An unexpected response was received from the server") shows a message in the form instead of
 * crashing the page. What the user typed stays in the form.
 */
export function safeAction<S, F>(
  fn: (prev: S, form: F) => Promise<S>,
  message = "The server didn't answer. Nothing was lost — please try again.",
): (prev: S, form: F) => Promise<S> {
  return async (prev, form) => {
    try {
      return await fn(prev, form);
    } catch (e) {
      // Redirects and "not found" from the server must still work.
      const digest = (e as { digest?: unknown })?.digest;
      if (typeof digest === "string" && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(digest)) throw e;
      return { error: message } as S;
    }
  };
}
