"use client";

import * as React from "react";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeTzPhone } from "@/lib/phone";
import { SMS_MAX_LENGTH, SMS_SEGMENT_LENGTH } from "@/lib/sms/sms-types";

type FieldErrors = Partial<Record<"phone" | "message", string[]>>;

/**
 * Types and sends one SMS through notifier. The number starts as the member's
 * own; it can be changed, but a text to another number won't appear in this
 * member's list — notifier files messages by phone, not by member.
 */
export function SendSmsDialog({
  membershipId,
  defaultPhone,
  onSent,
  className,
}: {
  membershipId: string;
  defaultPhone: string | null;
  onSent: () => void;
  /** For the trigger — the phone toolbar sizes it to sit beside Filters. */
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <SendIcon />
        Send SMS
      </Button>

      {/* Remounted per open so the form re-seeds instead of resetting state
          inside an effect. */}
      <Dialog key={String(open)} open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <SendSmsForm
            membershipId={membershipId}
            defaultPhone={defaultPhone}
            onClose={() => setOpen(false)}
            onSent={onSent}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SendSmsForm({
  membershipId,
  defaultPhone,
  onClose,
  onSent,
}: {
  membershipId: string;
  defaultPhone: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [phone, setPhone] = React.useState(defaultPhone ?? "");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const phoneError = usePhoneError(phone);

  const length = message.trim().length;
  const segments = Math.max(1, Math.ceil(length / SMS_SEGMENT_LENGTH));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(`/api/members/${membershipId}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);

    // A refusal still leaves a Failed row in the list, so refresh either way.
    if (response?.ok || data?.reason === "rejected") onSent();

    if (response?.ok) {
      toast.success(`SMS sent to +${data.recipient}`);
      onClose();
      return;
    }

    setFieldErrors(data?.issues ?? {});
    const error = data?.issues
      ? null
      : [data?.error ?? "Couldn't send the SMS", data?.detail]
          .filter(Boolean)
          .join(": ");
    setFormError(error);
    if (error) toast.error(error);
    setPending(false);
  }

  const phoneErrors = fieldErrors.phone ?? (phoneError ? [phoneError] : []);

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Send SMS</DialogTitle>
        <DialogDescription>
          Sent straight away through the SMS provider. Texts to this
          member&apos;s own number appear in their SMS alerts.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <Field>
          <FieldLabel htmlFor="sms-phone">Phone number</FieldLabel>
          <Input
            id="sms-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0712 345 678"
            required
          />
          <FieldError errors={phoneErrors.map((m) => ({ message: m }))} />
        </Field>

        <Field>
          <FieldLabel htmlFor="sms-message">Message</FieldLabel>
          <Textarea
            id="sms-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={SMS_MAX_LENGTH}
            rows={5}
            placeholder="Habari, …"
            required
          />
          <FieldDescription className="flex justify-between tabular-nums">
            <span>
              {segments} SMS{segments === 1 ? "" : " (billed per 160 characters)"}
            </span>
            <span>
              {length}/{SMS_MAX_LENGTH}
            </span>
          </FieldDescription>
          <FieldError
            errors={(fieldErrors.message ?? []).map((m) => ({ message: m }))}
          />
        </Field>
      </div>

      {formError && <FieldError>{formError}</FieldError>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || length === 0}>
          <SendIcon />
          {pending ? "Sending…" : "Send"}
        </Button>
      </DialogFooter>
    </form>
  );
}
