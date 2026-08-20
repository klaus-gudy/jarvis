export const SESSION_COOKIE = "jarvis_session";

/**
 * Set once a reset code has been verified, and read by
 * `POST /api/auth/reset-password`. It exists so the code never has to travel
 * in a URL between the two steps — a query string lands in browser history,
 * referrer headers and server logs, none of which should hold a live
 * credential.
 */
export const RESET_TICKET_COOKIE = "jarvis_reset";
