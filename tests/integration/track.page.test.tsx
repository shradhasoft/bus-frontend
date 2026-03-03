import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/tracking/track-bus-view", () => ({
  default: () => <div data-testid="track-bus-view">Track view</div>,
}));

import TrackPage from "@/app/track/page";

describe("/track page", () => {
  test("renders track view within suspense boundary", () => {
    render(<TrackPage />);
    expect(screen.getByTestId("track-bus-view")).toBeInTheDocument();
  });
});

