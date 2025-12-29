import { describe, it, expect } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { DurationPicker } from "../DurationPicker";

function Harness({
  initial = null,
  stepMinutes,
  minMinutes,
  maxMinutes,
}: {
  initial?: number | null;
  stepMinutes?: number;
  minMinutes?: number;
  maxMinutes?: number;
}) {
  const [value, setValue] = React.useState<number | null>(initial);
  const resetTo = () => setValue(90);
  return (
    <div>
      <button type="button" onClick={resetTo}>Reset</button>
      <div data-testid="value">{value === null ? "null" : String(value)}</div>
      <DurationPicker
        aria-label="Duration"
        valueMinutes={value}
        onChange={setValue}
        stepMinutes={stepMinutes}
        minMinutes={minMinutes}
        maxMinutes={maxMinutes}
      />
    </div>
  );
}

describe("DurationPicker", () => {
  it("renders HH:MM for a minute value and passes basic a11y checks", async () => {
    const { container, getByLabelText } = render(<Harness initial={65} />);
    const hours = getByLabelText("Duration hours") as HTMLInputElement;
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;

    expect(hours.value).toBe("01");
    expect(minutes.value).toBe("05");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("ArrowUp on minutes increments by stepMinutes (default 5); Shift+ArrowUp increments by 5x step", () => {
    const { getByLabelText } = render(<Harness initial={65} stepMinutes={5} />);
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;
    const hours = getByLabelText("Duration hours") as HTMLInputElement;

    minutes.focus();
    fireEvent.keyDown(minutes, { key: "ArrowUp" });
    // 65 + 5 = 70 => 01:10
    expect(hours.value).toBe("01");
    expect(minutes.value).toBe("10");

    fireEvent.keyDown(minutes, { key: "ArrowUp", shiftKey: true });
    // 70 + 25 = 95 => 01:35
    expect(hours.value).toBe("01");
    expect(minutes.value).toBe("35");
  });

  it("clamps to maxMinutes when incrementing", () => {
    const { getByLabelText } = render(<Harness initial={1438} stepMinutes={5} maxMinutes={1440} />);
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;
    const hours = getByLabelText("Duration hours") as HTMLInputElement;

    minutes.focus();
    fireEvent.keyDown(minutes, { key: "ArrowUp" });
    // 1438 + 5 clamped to 1440 => 24:00
    expect(hours.value).toBe("24");
    expect(minutes.value).toBe("00");
  });

  it("normalizes minute overflow on blur (e.g., 01:75 -> 02:15)", () => {
    const { getByLabelText } = render(<Harness initial={null} />);
    const hours = getByLabelText("Duration hours") as HTMLInputElement;
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;

    fireEvent.change(hours, { target: { value: "1" } });
    fireEvent.change(minutes, { target: { value: "75" } });
    fireEvent.blur(minutes);

    expect(hours.value).toBe("02");
    expect(minutes.value).toBe("15");
  });

  it("allows typing two digits without getting stuck (e.g., 45)", () => {
    const { getByLabelText } = render(<Harness initial={0} />);
    const hours = getByLabelText("Duration hours") as HTMLInputElement;
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;

    minutes.focus();
    // With select-all on focus + last-2-digits handling, this should set minutes cleanly.
    fireEvent.change(minutes, { target: { value: "45" } });
    fireEvent.blur(minutes);

    expect(hours.value).toBe("00");
    expect(minutes.value).toBe("45");
  });

  it("re-syncs display when parent changes value while focused but not typing", () => {
    const { getByLabelText, getByText } = render(<Harness initial={65} />);
    const hours = getByLabelText("Duration hours") as HTMLInputElement;
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;

    // Focus without typing.
    minutes.focus();
    // Parent updates controlled value (e.g., reset button)
    fireEvent.click(getByText("Reset"));

    // Should reflect reset value immediately even while focused.
    expect(hours.value).toBe("01");
    expect(minutes.value).toBe("30");
  });

  it("allows clearing both segments to null via the UI (empty HH and MM)", () => {
    const { getByLabelText, getByTestId } = render(<Harness initial={65} />);
    const hours = getByLabelText("Duration hours") as HTMLInputElement;
    const minutes = getByLabelText("Duration minutes") as HTMLInputElement;

    fireEvent.change(hours, { target: { value: "" } });
    fireEvent.change(minutes, { target: { value: "" } });
    fireEvent.blur(minutes);

    expect(getByTestId("value").textContent).toBe("null");
    expect(hours.value).toBe("");
    expect(minutes.value).toBe("");
  });
});


