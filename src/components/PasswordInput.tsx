import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes, type Ref } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement>;
  /** Names the toggle: "Show password" or "Show passphrase". */
  revealLabel?: 'password' | 'passphrase';
  /** Classes for the wrapper, such as margins that used to sit on the input. */
  wrapperClassName?: string;
}

/**
 * A password or passphrase field with a show/hide toggle.
 *
 * The field starts hidden, and goes back to hidden when its form submits or the field
 * unmounts. The toggle is a real button with a fixed name and `aria-pressed`. Every
 * other attribute (`autoComplete`, `data-sensitive`, `id`) passes through to the input.
 */
export function PasswordInput({
  ref,
  revealLabel = 'password',
  wrapperClassName = '',
  style,
  disabled,
  ...inputProps
}: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  // Hide again on submit. A native listener sees every submit, whichever handler the
  // form uses.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setRevealed(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...inputProps}
        ref={setRefs}
        type={revealed ? 'text' : 'password'}
        disabled={disabled}
        style={{ ...style, paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        disabled={disabled}
        aria-label={`Show ${revealLabel}`}
        aria-pressed={revealed}
        aria-controls={inputProps.id}
        title={revealed ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
        className="absolute right-1 top-1/2 -translate-y-1/2 size-9 rounded-full flex items-center justify-center focus-ring disabled:opacity-50"
        style={{ color: 'var(--color-text-tertiary)', background: 'transparent' }}
      >
        {revealed ? (
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 8.5 4.5 9.5 7a13 13 0 01-2.4 3.6M6.2 6.2A13 13 0 002.5 12c1 2.5 4.5 7 9.5 7a9.7 9.7 0 004.2-.9" />
          </svg>
        ) : (
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7z" />
            <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
          </svg>
        )}
      </button>
    </div>
  );
}
