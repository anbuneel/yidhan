interface ModalBackdropButtonProps {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ModalBackdropButton({
  label = 'Dismiss dialog',
  disabled = false,
  onClick,
}: ModalBackdropButtonProps) {
  if (disabled) return null;

  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
      onClick={onClick}
    />
  );
}
