/**
 * In-memory notification store for Next.js API routes.
 * Uses a module-level singleton so it persists across requests within one process.
 * On Netlify/Vercel serverless each cold start gets a fresh store — acceptable for notifications.
 */

export type Notification = {
  id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const store: Notification[] = [];
let counter = 1;

export function addNotification(
  recipient: string,
  type: string,
  title: string,
  message: string
): Notification {
  const n: Notification = {
    id: String(counter++),
    recipient,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.unshift(n);
  if (store.length > 200) store.splice(200);
  return n;
}

export function getByRecipient(
  recipient: string,
  limit = 50,
  unreadOnly = false
): Notification[] {
  return store
    .filter((n) => n.recipient === recipient && (!unreadOnly || !n.read))
    .slice(0, limit);
}

export function getUnreadCount(recipient: string): number {
  return store.filter((n) => n.recipient === recipient && !n.read).length;
}

export function markAsRead(id: string): boolean {
  const n = store.find((n) => n.id === id);
  if (!n) return false;
  n.read = true;
  return true;
}

export function markAllAsRead(recipient: string): number {
  let count = 0;
  store.forEach((n) => {
    if (n.recipient === recipient && !n.read) {
      n.read = true;
      count++;
    }
  });
  return count;
}

export function deleteNotification(id: string): boolean {
  const idx = store.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  store.splice(idx, 1);
  return true;
}
