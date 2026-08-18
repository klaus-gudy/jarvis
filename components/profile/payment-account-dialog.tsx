"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_ACCOUNT_NUMBER_LABEL,
  PAYMENT_ACCOUNT_PROVIDERS,
  PAYMENT_ACCOUNT_TYPES,
  PAYMENT_ACCOUNT_TYPE_LABEL,
  type PaymentAccountTypeValue,
} from "@/lib/payment-account-options";
import type { PaymentAccountRow } from "@/lib/payment-accounts";

type Values = {
  type: PaymentAccountTypeValue;
  provider: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
};
type FieldErrors = Partial<Record<keyof Values, string[]>>;

export function PaymentAccountDialog({
  open,
  onOpenChange,
  /** Null when adding. */
  account,
  /** The first account is always the default, so the tick is hidden for it. */
  isFirstAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: PaymentAccountRow | null;
  isFirstAccount: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Values>({
    type: account?.type ?? "MOBILE_MONEY",
    provider: account?.provider ?? "",
    accountNumber: account?.accountNumber ?? "",
    accountName: account?.accountName ?? "",
    isDefault: account?.isDefault ?? false,
  });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(
      account ? `/api/payment-accounts/${account.id}` : "/api/payment-accounts",
      {
        method: account ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }
    );

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success(account ? "Payment account updated" : "Payment account added");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setFieldErrors(data?.issues ?? {});
    const message = data?.issues ? null : (data?.error ?? "Something went wrong");
    setFormError(message);
    if (message) toast.error(message);
    setPending(false);
  }

  const suggestions = PAYMENT_ACCOUNT_PROVIDERS[values.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {account ? "Edit payment account" : "Add payment account"}
            </DialogTitle>
            <DialogDescription>
              Where tenants send rent. You can keep more than one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="account-type" required>
                Type
              </FieldLabel>
              <Select
                value={values.type}
                onValueChange={(value) =>
                  set("type", value as PaymentAccountTypeValue)
                }
              >
                <SelectTrigger id="account-type" className="w-full bg-background">
                  {/* Base UI renders the raw value without a function child. */}
                  <SelectValue>
                    {(value: PaymentAccountTypeValue) =>
                      PAYMENT_ACCOUNT_TYPE_LABEL[value]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PAYMENT_ACCOUNT_TYPE_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="account-provider" required>
                Provider
              </FieldLabel>
              <Input
                id="account-provider"
                list="payment-account-providers"
                value={values.provider}
                onChange={(event) => set("provider", event.target.value)}
                placeholder={suggestions[0]}
                required
              />
              {/* A datalist suggests without closing the list — a bank or wallet
                  that isn't in PAYMENT_ACCOUNT_PROVIDERS can still be typed. */}
              <datalist id="payment-account-providers">
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <FieldError
                errors={fieldErrors.provider?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="account-number" required>
                {PAYMENT_ACCOUNT_NUMBER_LABEL[values.type]}
              </FieldLabel>
              <Input
                id="account-number"
                inputMode="numeric"
                value={values.accountNumber}
                onChange={(event) => set("accountNumber", event.target.value)}
                required
              />
              <FieldError
                errors={fieldErrors.accountNumber?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="account-name">Account name</FieldLabel>
              <Input
                id="account-name"
                value={values.accountName}
                onChange={(event) => set("accountName", event.target.value)}
                placeholder="Name the account is registered under"
              />
              <FieldDescription>
                Shown to tenants so they can check the name before sending.
              </FieldDescription>
              <FieldError
                errors={fieldErrors.accountName?.map((m) => ({ message: m }))}
              />
            </Field>

            {!isFirstAccount && (
              <FieldLabel className="items-center gap-2.5">
                <Checkbox
                  checked={values.isDefault}
                  onCheckedChange={(checked) => set("isDefault", checked === true)}
                  disabled={account?.isDefault}
                />
                <span className="text-sm font-normal">
                  Use as the default account
                </span>
              </FieldLabel>
            )}
            {account?.isDefault && (
              <FieldDescription>
                This is the default. To change it, mark another account instead.
              </FieldDescription>
            )}

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : account ? "Save changes" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
