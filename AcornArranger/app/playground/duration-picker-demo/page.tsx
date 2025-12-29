"use client";

import * as React from "react";
import DurationPicker from "@/components/filters/DurationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function Page() {
  const [valueMinutes, setValueMinutes] = React.useState<number | null>(90);

  const [stepMinutes, setStepMinutes] = React.useState("5");
  const [minMinutes, setMinMinutes] = React.useState("0");
  const [maxMinutes, setMaxMinutes] = React.useState("1440");
  const [allowNull, setAllowNull] = React.useState(true);

  const parsedStep = Number(stepMinutes);
  const parsedMin = Number(minMinutes);
  const parsedMax = Number(maxMinutes);

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">DurationPicker Demo</h1>
        <p className="text-sm text-muted-foreground">
          HH:MM picker that stores total minutes. Use arrow keys (Shift for 5×) and type digits to edit.
        </p>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="step">Step minutes</Label>
            <Input
              id="step"
              inputMode="numeric"
              value={stepMinutes}
              onChange={(e) => setStepMinutes(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="min">Min minutes</Label>
            <Input
              id="min"
              inputMode="numeric"
              value={minMinutes}
              onChange={(e) => setMinMinutes(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="max">Max minutes</Label>
            <Input
              id="max"
              inputMode="numeric"
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="allow-null"
              checked={allowNull}
              onCheckedChange={(v) => setAllowNull(Boolean(v))}
            />
            <Label htmlFor="allow-null" className="cursor-pointer font-normal">
              Allow null value
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <DurationPicker
          aria-label="Estimated cleaning time"
          valueMinutes={valueMinutes}
          onChange={(v) => setValueMinutes(v)}
          stepMinutes={Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : 5}
          minMinutes={Number.isFinite(parsedMin) ? parsedMin : 0}
          maxMinutes={Number.isFinite(parsedMax) ? parsedMax : 1440}
          placeholder={allowNull ? "—" : undefined}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setValueMinutes(90)}
          >
            Set to 90
          </Button>
          <Button
            variant="secondary"
            onClick={() => setValueMinutes(0)}
          >
            Set to 0
          </Button>
          <Button
            variant="secondary"
            onClick={() => setValueMinutes(1440)}
          >
            Set to 1440
          </Button>
          <Button
            variant="outline"
            onClick={() => setValueMinutes(allowNull ? null : 0)}
          >
            {allowNull ? "Set null" : "Set 0"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Current valueMinutes</div>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify({ valueMinutes }, null, 2)}
        </pre>
      </div>
    </div>
  );
}


