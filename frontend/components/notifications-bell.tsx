import { useEffect, useRef, useState } from "react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "../lib/api";

type Props = {
  stellarAddress: string;
};

export function NotificationsBell({ stellarAddress }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await getNotifications(stellarAddress);
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Backend may not be running — silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!stellarAddress) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [stellarAddress]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead(stellarAddress);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleMarkOne(id: number) {
    try {
      await markNotificationRead(id, stellarAddress);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  function typeIcon(type: string) {
    if (type.includes("claim")) return "assignment_late";
    if (type.includes("signer")) return "manage_accounts";
    if (type.includes("pool")) return "shield";
    if (type.includes("contribution")) return "payments";
    return "notifications";
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifications(); }}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-sm w-[340px] bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-lg py-md border-b border-outline-variant/20">
            <span className="font-headline-sm text-headline-sm text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-label-caps text-label-caps text-secondary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-xl">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-lg py-xl text-center">
                <span className="material-symbols-outlined text-[32px] text-outline block mb-sm">notifications_off</span>
                <p className="text-body-sm text-on-surface-variant">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && handleMarkOne(n.id)}
                  className={`flex items-start gap-md px-lg py-md border-b border-outline-variant/10 last:border-0 transition-colors cursor-pointer ${
                    n.read ? "opacity-60" : "hover:bg-surface-container-low"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    n.read ? "bg-surface-container-high" : "bg-primary-container"
                  }`}>
                    <span className={`material-symbols-outlined text-[16px] ${n.read ? "text-on-surface-variant" : "text-on-primary-container"}`}>
                      {typeIcon(n.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-xs">
                      <p className={`text-body-sm font-bold truncate ${n.read ? "text-on-surface-variant" : "text-on-surface"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-body-sm text-on-surface-variant line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-outline mt-xs">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
