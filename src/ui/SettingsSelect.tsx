import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export interface SettingsSelectOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

interface SettingsSelectProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SettingsSelectOption[];
  readonly onChange: (value: string) => void;
}

export function SettingsSelect({
  label,
  value,
  options,
  onChange,
}: SettingsSelectProps) {
  const labelId = useId();
  const valueId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      const option = optionRefs.current[activeIndex];
      const menu = menuRef.current;
      option?.focus({ preventScroll: true });
      if (option && menu) {
        const optionTop = option.offsetTop;
        const optionBottom = optionTop + option.offsetHeight;
        if (optionTop < menu.scrollTop) {
          menu.scrollTop = optionTop;
        } else if (optionBottom > menu.scrollTop + menu.clientHeight) {
          menu.scrollTop = optionBottom - menu.clientHeight;
        }
      }
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [activeIndex, open]);

  const openList = (index = selectedIndex) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const closeList = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (option.value !== value) onChange(option.value);
    closeList(true);
  };

  const moveTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    setActiveIndex(nextIndex);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openList(Math.min(options.length - 1, selectedIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openList(Math.max(0, selectedIndex - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      openList(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      openList(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openList();
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent,
    index: number,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(index);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeList(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div
      className={`settings-field settings-select${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <span className="settings-field-label" id={labelId}>
        {label}
      </span>
      <button
        className="settings-select-trigger"
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="settings-select-value" id={valueId}>
          <strong>{selectedOption.label}</strong>
          <small>{selectedOption.description}</small>
        </span>
        <svg
          className="settings-select-chevron"
          aria-hidden="true"
          viewBox="0 0 16 16"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          className="settings-select-menu"
          ref={menuRef}
          role="listbox"
          aria-labelledby={labelId}
        >
          {options.map((option, index) => (
            <button
              className="settings-select-option"
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => selectOption(index)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className="settings-select-check" aria-hidden="true">
                {option.value === value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
