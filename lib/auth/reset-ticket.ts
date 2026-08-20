import { cookies } from "next/headers";

import { RESET_TICKET_COOKIE } from "@/lib/auth/constants";
import {
  RESET_TICKET_DURATION_SECONDS,
  signResetTicket,
  verifyResetTicket,
  type ResetTicketPayload,
} from "@/lib/auth/jwt";

/** Cookie handling for the reset ticket, mirroring `lib/auth/session.ts`. */

export async function setResetTicket(payload: ResetTicketPayload) {
  const store = await cookies();
  store.set(RESET_TICKET_COOKIE, await signResetTicket(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: RESET_TICKET_DURATION_SECONDS,
    path: "/",
  });
}

export async function getResetTicket(): Promise<ResetTicketPayload | null> {
  const token = (await cookies()).get(RESET_TICKET_COOKIE)?.value;
  if (!token) return null;
  return verifyResetTicket(token);
}

export async function clearResetTicket() {
  (await cookies()).delete(RESET_TICKET_COOKIE);
}
