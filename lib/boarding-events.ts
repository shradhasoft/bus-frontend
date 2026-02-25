const BOARDING_BLUEPRINT_CHANGED_EVENT = "boarding-blueprint-changed";

export const dispatchBoardingBlueprintChangedEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BOARDING_BLUEPRINT_CHANGED_EVENT));
};

export const subscribeBoardingBlueprintChanged = (listener: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => {
    listener();
  };

  window.addEventListener(BOARDING_BLUEPRINT_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(BOARDING_BLUEPRINT_CHANGED_EVENT, handler);
  };
};
