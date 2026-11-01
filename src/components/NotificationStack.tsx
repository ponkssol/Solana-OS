import { useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';

export function NotificationStack() {
  const notifications = useOSStore((state) => state.notifications);
  const dismiss = useOSStore((state) => state.dismissNotification);

  useEffect(() => {
    if (notifications.length === 0) return;
    const oldest = notifications[notifications.length - 1];
    const timer = window.setTimeout(() => dismiss(oldest.id), Math.max(0, oldest.at + 6000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [notifications, dismiss]);

  return (
    <div className="pointer-events-none absolute right-4 top-12 z-30 flex w-[min(344px,calc(100%-2rem))] flex-col gap-3">
      {notifications.map((note) => (
        <article
          key={note.id}
          onClick={() => dismiss(note.id)}
          className="pointer-events-auto relative overflow-hidden rounded-[16px] border border-white/[0.07] px-3.5 py-2.5"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.75), 0px 12px 32px rgba(0,0,0,0.45)' }}
        >
          <div className="absolute inset-0 rounded-[16px] bg-[rgba(38,38,38,0.75)] backdrop-blur-[40px] [mix-blend-mode:luminosity]" />
          <div className="relative flex items-start justify-between gap-3">
            <h3 className="text-[13px] font-[700] leading-[16px] text-[#f5f5f5]">{note.title}</h3>
            <span className="shrink-0 text-[11px] leading-[14px] text-[#8a8a8a]">
              {new Date(note.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="relative mt-1 line-clamp-3 text-[11px] leading-[14px] text-white/80">{note.body}</p>
        </article>
      ))}
    </div>
  );
}
