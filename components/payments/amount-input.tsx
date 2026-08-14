"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  caretAfterGrouping,
  evaluateAmount,
  groupAmountDigits,
} from "@/lib/amount-expression";
import { formatMoneyFull } from "@/lib/format";

/**
 * The money field both payment dialogs use.
 *
 * Two behaviours, and they are the reason this is one component rather than a
 * pair of `<Input>`s wired up twice:
 *
 * 1. **Digits group as you type.** "500000*3" reads "500,000*3" immediately,
 *    not only once it has been worked out. Safe on every keystroke because the
 *    parser treats commas as separators, so grouping never changes the value.
 * 2. **The sum folds into its result on leaving the field.** "500,000*3"
 *    becomes "1,500,000" — the figure that will be saved, in the box where it
 *    can still be corrected.
 *
 * `type="text"`: a number input refuses every character that isn't part of a
 * number, so `*` could never be typed into one.
 */
/**
 * `useLayoutEffect` warns when React renders it on the server; the choice is
 * made once at module load, so this stays a stable hook identity.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function AmountInput({
  id,
  value,
  onValueChange,
  placeholder,
  required,
}: {
  id: string;
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);

  /**
   * Puts the caret back after a re-render that changed the text.
   *
   * A layout effect, not `requestAnimationFrame`: the frame callback races
   * React's commit and lost — inserting a digit mid-number regrouped correctly
   * but threw the caret to the end anyway. This runs after the DOM is updated
   * and before paint, so the caret never visibly moves.
   */
  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    inputRef.current?.setSelectionRange(caret, caret);
  });

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const formatted = groupAmountDigits(raw);

    if (formatted !== raw) {
      pendingCaret.current = caretAfterGrouping(raw, caret, formatted);
    }

    onValueChange(formatted);
  }

  function handleBlur() {
    const result = evaluateAmount(value);
    // An unfinished or invalid expression is left exactly as typed; folding it
    // would destroy what the person was in the middle of writing.
    if (result.status !== "ok") return;
    onValueChange(formatMoneyFull(result.value));
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="text"
      autoComplete="off"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      required={required}
    />
  );
}
