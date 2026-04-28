import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { type ChangeEvent } from "react";
import { useNumericInput } from "../useNumericInput";

function changeEvent(value: string) {
  return {
    target: { value },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

describe("useNumericInput", () => {
  it("starts empty when no initialValue is provided", () => {
    const { result } = renderHook(() => useNumericInput());
    expect(result.current.text).toBe("");
    expect(result.current.value).toBeUndefined();
  });

  it("renders the initial numeric value as a string", () => {
    const { result } = renderHook(() =>
      useNumericInput({ initialValue: 6.5 })
    );
    expect(result.current.text).toBe("6.5");
    expect(result.current.value).toBe(6.5);
  });

  it("lets the user clear the field without snapping back", () => {
    const { result } = renderHook(() =>
      useNumericInput({ initialValue: 6, fallback: 6 })
    );

    act(() => result.current.onChange(changeEvent("")));
    expect(result.current.text).toBe("");
    expect(result.current.value).toBeUndefined();

    act(() => result.current.onChange(changeEvent("1")));
    expect(result.current.text).toBe("1");
    expect(result.current.value).toBe(1);

    act(() => result.current.onChange(changeEvent("12")));
    expect(result.current.text).toBe("12");
    expect(result.current.value).toBe(12);
  });

  it("restores the fallback on blur when the field is empty", () => {
    const { result } = renderHook(() =>
      useNumericInput({ initialValue: 6, fallback: 6 })
    );
    act(() => result.current.onChange(changeEvent("")));
    act(() => result.current.onBlur());
    expect(result.current.text).toBe("6");
    expect(result.current.value).toBe(6);
  });

  it("leaves the field empty on blur when no fallback is set", () => {
    const { result } = renderHook(() =>
      useNumericInput({ initialValue: 4, integer: true })
    );
    act(() => result.current.onChange(changeEvent("")));
    act(() => result.current.onBlur());
    expect(result.current.text).toBe("");
    expect(result.current.value).toBeUndefined();
  });

  it("clamps to bounds and rounds to integer on blur", () => {
    const { result } = renderHook(() =>
      useNumericInput({
        initialValue: 90,
        fallback: 90,
        bounds: { min: 30, max: 365 },
        integer: true,
      })
    );

    act(() => result.current.onChange(changeEvent("12.7")));
    expect(result.current.text).toBe("12.7");
    expect(result.current.value).toBe(30);

    act(() => result.current.onBlur());
    expect(result.current.text).toBe("30");
    expect(result.current.value).toBe(30);

    act(() => result.current.onChange(changeEvent("999")));
    expect(result.current.text).toBe("999");
    act(() => result.current.onBlur());
    expect(result.current.text).toBe("365");
    expect(result.current.value).toBe(365);
  });

  it("normalizes trailing-decimal input to a canonical string on blur", () => {
    const { result } = renderHook(() =>
      useNumericInput({ initialValue: 6, fallback: 6 })
    );
    act(() => result.current.onChange(changeEvent("7.")));
    expect(result.current.text).toBe("7.");
    act(() => result.current.onBlur());
    expect(result.current.text).toBe("7");
    expect(result.current.value).toBe(7);
  });

  it("falls back when the user types something unparseable", () => {
    const { result } = renderHook(() =>
      useNumericInput({ initialValue: 6, fallback: 6 })
    );
    act(() => result.current.onChange(changeEvent("abc")));
    expect(result.current.value).toBeUndefined();
    act(() => result.current.onBlur());
    expect(result.current.text).toBe("6");
    expect(result.current.value).toBe(6);
  });
});
