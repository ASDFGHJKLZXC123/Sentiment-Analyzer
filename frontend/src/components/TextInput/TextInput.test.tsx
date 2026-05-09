import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "./TextInput";
import { MAX_TEXT_LENGTH } from "@/api/types";

interface Renderer {
  value?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  onChange?: (s: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
}

function renderInput({
  value = "",
  disabled = false,
  submitDisabled = false,
  onChange = vi.fn(),
  onSubmit = vi.fn(),
  onClear = vi.fn(),
}: Renderer = {}) {
  const result = render(
    <TextInput
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onClear={onClear}
      disabled={disabled}
      submitDisabled={submitDisabled}
    />,
  );
  return { ...result, onChange, onSubmit, onClear };
}

describe("TextInput: counter color thresholds", () => {
  it("default class until 90%", () => {
    renderInput({ value: "x".repeat(Math.floor(MAX_TEXT_LENGTH * 0.5)) });
    const counter = document.getElementById("counter-hint")!;
    expect(counter.className).toBe("counter");
  });

  it("warn class at 90%", () => {
    renderInput({ value: "x".repeat(Math.floor(MAX_TEXT_LENGTH * 0.9)) });
    const counter = document.getElementById("counter-hint")!;
    expect(counter.className).toBe("counter warn");
  });

  it("error class at 100%", () => {
    renderInput({ value: "x".repeat(MAX_TEXT_LENGTH) });
    const counter = document.getElementById("counter-hint")!;
    expect(counter.className).toBe("counter error");
  });

  it("counter shows formatted current/max numbers", () => {
    renderInput({ value: "hello" });
    expect(
      screen.getByText(`5 / ${MAX_TEXT_LENGTH.toLocaleString()}`),
    ).toBeInTheDocument();
  });
});

describe("TextInput: submit button state", () => {
  it("Analyze button is disabled when submitDisabled is true", () => {
    renderInput({ submitDisabled: true });
    expect(screen.getByRole("button", { name: /^Analyze$/i })).toBeDisabled();
  });

  it("Analyze button is enabled when submitDisabled is false", () => {
    renderInput({ submitDisabled: false, value: "hello" });
    expect(screen.getByRole("button", { name: /^Analyze$/i })).toBeEnabled();
  });

  it("button text becomes 'Analyzing…' while disabled (loading)", () => {
    renderInput({ disabled: true, submitDisabled: true });
    expect(screen.getByRole("button", { name: /Analyzing…/i })).toBeInTheDocument();
  });

  it("Clear button disabled when value is empty", () => {
    renderInput({ value: "" });
    expect(screen.getByRole("button", { name: /^Clear$/i })).toBeDisabled();
  });

  it("Clear button enabled when value present and not loading", () => {
    renderInput({ value: "hi" });
    expect(screen.getByRole("button", { name: /^Clear$/i })).toBeEnabled();
  });
});

describe("TextInput: sample chips", () => {
  it("appear only when value is empty", () => {
    const { rerender } = render(
      <TextInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onClear={vi.fn()}
        disabled={false}
        submitDisabled={false}
      />,
    );
    expect(screen.getByRole("group", { name: /Sample inputs/i })).toBeInTheDocument();

    rerender(
      <TextInput
        value="anything"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onClear={vi.fn()}
        disabled={false}
        submitDisabled={false}
      />,
    );
    expect(screen.queryByRole("group", { name: /Sample inputs/i })).not.toBeInTheDocument();
  });

  it("clicking a chip calls onChange with the chip's text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TextInput
        value=""
        onChange={onChange}
        onSubmit={vi.fn()}
        onClear={vi.fn()}
        disabled={false}
        submitDisabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Try a tweet/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toMatch(/headphones/);
  });
});

describe("TextInput: keyboard shortcuts", () => {
  it("Cmd+Enter (or Ctrl+Enter) submits when enabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TextInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onClear={vi.fn()}
        disabled={false}
        submitDisabled={false}
      />,
    );
    const textarea = screen.getByLabelText("Text to analyze");
    textarea.focus();
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Cmd+Enter does not submit when submitDisabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TextInput
        value=""
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onClear={vi.fn()}
        disabled={false}
        submitDisabled
      />,
    );
    const textarea = screen.getByLabelText("Text to analyze");
    textarea.focus();
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Escape clears when value is non-empty and not disabled", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <TextInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onClear={onClear}
        disabled={false}
        submitDisabled={false}
      />,
    );
    const textarea = screen.getByLabelText("Text to analyze");
    textarea.focus();
    await user.keyboard("{Escape}");
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("Escape is a no-op while loading", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <TextInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onClear={onClear}
        disabled
        submitDisabled
      />,
    );
    const textarea = screen.getByLabelText("Text to analyze");
    textarea.focus();
    await user.keyboard("{Escape}");
    expect(onClear).not.toHaveBeenCalled();
  });
});

describe("TextInput: typing", () => {
  it("calls onChange with each typed character", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TextInput
        value=""
        onChange={onChange}
        onSubmit={vi.fn()}
        onClear={vi.fn()}
        disabled={false}
        submitDisabled
      />,
    );
    const textarea = screen.getByLabelText("Text to analyze");
    await user.type(textarea, "hi");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
