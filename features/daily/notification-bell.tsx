"use client";

import { useEffect, useRef, useState } from "react";
import { useDailyActivity } from "./daily-activity-provider";
import type { InAppNotification } from "./daily-backend";

export function NotificationBell() {
  const { notifications, markRead } = useDailyActivity();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function markAllRead() {
    await Promise.all(notifications.map((notification) => markRead(notification.id)));
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label={notifications.length ? `${notifications.length} unread notifications` : "Notifications"}
        className="relative grid h-9 w-9 place-items-center border border-navy-700 bg-navy-900 text-muted transition hover:border-signal hover:text-signal"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M10 21h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </svg>
        {notifications.length ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-signal px-1 font-mono text-[9px] font-bold text-navy-950">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(24rem,calc(100vw-2rem))] border border-navy-700 bg-navy-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-navy-700 px-4 py-3">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-wider text-signal uppercase">Notifications</p>
              <p className="mt-1 text-xs text-muted">{notifications.length} belum dibaca</p>
            </div>
            {notifications.length ? (
              <button className="font-mono text-[10px] text-signal hover:underline" onClick={() => void markAllRead()} type="button">
                MARK ALL READ
              </button>
            ) : null}
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onRead={() => void markRead(notification.id)} />
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="font-mono text-xs text-muted">NO UNREAD SIGNALS</p>
                <p className="mt-2 text-xs text-muted">Notifikasi modul dan achievement akan muncul di sini.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationItem({ notification, onRead }: { notification: InAppNotification; onRead: () => void }) {
  return (
    <button className="flex w-full gap-3 border-b border-navy-700/70 px-4 py-3 text-left transition hover:bg-navy-900" onClick={onRead} type="button">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.type === "achievement" ? "bg-warning" : "bg-signal"}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-bold text-ice">{notification.title}</span>
          <span className="shrink-0 font-mono text-[9px] text-muted">{formatTime(notification.createdAt)}</span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted">{notification.body}</span>
        <span className="mt-1.5 block font-mono text-[9px] uppercase text-signal">{notification.type.replaceAll("_", " ")}</span>
      </span>
    </button>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}
