export const AUTH_SESSION_CHANGED_EVENT = "auth:session-changed";

export const dispatchAuthSessionChangedEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
};

export const subscribeAuthSessionChanged = (listener: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => listener();
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handler);
  };
};
