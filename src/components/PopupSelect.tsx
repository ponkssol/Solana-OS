import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface PopupOption {
  value: string;
  label: string;
}

export function PopupSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: PopupOption[];
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typed = useRef('');
  const typedTimer = useRef<number>(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = options.findIndex((option) => option.value === value);
  const current = options[selected] ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onResize = () => setBox(null);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const width = Math.max(trigger.width, menu.width);
    let left = trigger.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - width);
    }
    let top = trigger.bottom + gap;
    if (top + menu.height > window.innerHeight - margin) {
      const above = trigger.top - gap - menu.height;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - menu.height);
    }
    setBox((prev) => (prev && prev.top === top && prev.left === left && prev.width === width ? prev : { top, left, width }));
  }, [open, box, options.length]);

  const openMenu = (nextActive = selected >= 0 ? selected : 0) => {
    setActive(nextActive);
    setBox(null);
    setOpen(true);
  };

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const move = (delta: number) => {
    if (!options.length) return;
    setActive((index) => (index + delta + options.length) % options.length);
  };

  const typeSelect = (char: string) => {
    window.clearTimeout(typedTimer.current);
    typed.current = `${typed.current}${char.toLowerCase()}`;
    typedTimer.current = window.setTimeout(() => {
      typed.current = '';
    }, 500);
    const query = typed.current;
    const from = query.length === 1 ? active + 1 : active;
    for (let step = 0; step < options.length; step += 1) {
      const index = (from + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(query)) {
        setActive(index);
        return;
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu(event.key === 'ArrowUp' ? options.length - 1 : selected >= 0 ? selected : 0);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      typeSelect(event.key);
    }
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="mt-1 flex h-[26px] w-full items-center justify-between rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-2 text-left text-[13px] text-white/85"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className="shrink-0 text-[#8a8a8a]">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="fixed z-[80] max-h-[240px] overflow-y-auto rounded-[6px] border border-white/[0.06] py-1 text-[13px] shadow-[0_0_0_1px_rgba(0,0,0,0.75)]"
            style={{
              top: box?.top ?? 0,
              left: box?.left ?? 0,
              width: box?.width,
              minWidth: triggerRef.current?.offsetWidth,
              background: 'rgba(32, 32, 34, 0.96)',
              visibility: box ? 'visible' : 'hidden',
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === active;
              return (
                <div
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                  className={`flex h-7 cursor-default items-center justify-between gap-3 px-2 ${
                    isSelected || isActive ? 'bg-[#0A84FF] text-white' : 'text-white/85'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
                      <path d="M2.2 6.2 4.7 8.7 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
