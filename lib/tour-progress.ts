import { prisma } from "@/lib/prisma";
import { isTourId, TOURS_VERSION } from "@/lib/tours";

/**
 * Which tours a user has finished or dismissed, held on the `User` row.
 *
 * This replaced a localStorage key. Per-device memory was the wrong shape for
 * the thing being remembered: the same person was greeted again by every tour
 * on each new browser, while a tour dismissed by accident on one device was
 * gone there for good. Signing in is what identifies somebody, so that is what
 * the memory now follows.
 *
 * Reads happen in the app layout, which already runs on every signed-in page,
 * so the list reaches the client as a prop rather than as a fetch after paint —
 * there is no window in which a tour could flash before its "seen" state is
 * known.
 */

/**
 * The stored list, or nothing if it was recorded against an older
 * `TOURS_VERSION`.
 *
 * A stale list is ignored rather than deleted: the read path is on every page
 * render and should not write, and the row corrects itself the next time this
 * user finishes or resets a tour.
 */
export async function getToursSeen(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { toursSeen: true, toursSeenVersion: true },
  });

  if (!user || user.toursSeenVersion !== TOURS_VERSION) return [];
  return user.toursSeen;
}

/**
 * Records one tour as seen and returns the resulting list.
 *
 * Read-modify-write rather than an atomic `push`, because a stale version has
 * to be replaced wholesale rather than appended to. The only writer is the one
 * person clicking through their own tour, so there is no contention to lose.
 *
 * An id that names no tour is ignored — this is reached from an HTTP route, and
 * the column should never accumulate strings that no longer mean anything.
 */
export async function markTourSeen(
  userId: string,
  tourId: string
): Promise<string[]> {
  if (!isTourId(tourId)) return getToursSeen(userId);

  const seen = await getToursSeen(userId);
  if (seen.includes(tourId)) return seen;

  const next = [...seen, tourId];
  await prisma.user.update({
    where: { id: userId },
    data: { toursSeen: next, toursSeenVersion: TOURS_VERSION },
  });
  return next;
}

/** Forgets every tour, so each greets this user again on its own page. */
export async function resetToursSeen(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { toursSeen: [], toursSeenVersion: TOURS_VERSION },
  });
}
