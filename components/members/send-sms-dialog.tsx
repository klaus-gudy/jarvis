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

/**
 * Types and sends one SMS to this member, through notifier.
 *
 * The number is the member's own and can't be edited here — the API ignores
 * any number a caller sends and uses the one on file, so the field is shown
 * read-only for the record rather than as an input. A member with no usable
 * number gets a disabled button instead of a dialog that can't send.
 */
export function SendSmsDialog({
  membershipId,
  phone,
  onSent,
  className,
}: {
  membershipId: string;
  /** The member's phone as stored. */
  phone: string | null;
  onSent: () => void;
  /** For the trigger — the phone toolbar sizes it to sit beside Filters. */
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const number = phone ? normalizeTzPhone(phone) : null;

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpen(true)}
        disabled={!number}
        title={number ? undefined : "This member has no valid phone number on file"}
      >
        <SendIcon />
        Send SMS
      </Button>

      {/* Remounted per open so the form re-seeds instead of resetting state
          inside an effect. */}
      <Dialog key={String(open)} open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <SendSmsForm
            membershipId={membershipId}
            phone={number ?? ""}
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
  phone,
  onClose,
  onSent,
}: {
  membershipId: string;
  phone: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [messageErrors, setMessageErrors] = React.useState<string[]>([]);

  const length = message.trim().length;
  const segments = Math.max(1, Math.ceil(length / SMS_SEGMENT_LENGTH));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setMessageErrors([]);

    const response = await fetch(`/api/members/${membershipId}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);

    // A refusal still leaves a Failed row in the list, so refresh either way.
    if (response?.ok || data?.reason === "rejected") onSent();

    if (response?.ok) {
      toast.success(`SMS sent to +${data.recipient}`);
      onClose();
      return;
    }

    setMessageErrors(data?.issues?.message ?? []);
    const error = data?.issues
      ? null
      : [data?.error ?? "Couldn't send the SMS", data?.detail]
          .filter(Boolean)
          .join(": ");
    setFormError(error);
    if (error) toast.error(error);
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Send SMS</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <Field>
          <FieldLabel htmlFor="sms-phone">Phone number</FieldLabel>
          <Input
            id="sms-phone"
            type="tel"
            value={phone}
            readOnly
            // Not `disabled`: a disabled field drops out of the accessibility
            // tree's focus order and can't be selected to copy.
            className="bg-muted text-muted-foreground focus-visible:ring-0"
          />
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
            errors={messageErrors.map((m) => ({ message: m }))}
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
