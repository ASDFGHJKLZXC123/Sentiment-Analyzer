import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("scaffold smoke", () => {
  it("renders a DOM element and resolves jest-dom matchers", () => {
    render(<button>click me</button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });
});
