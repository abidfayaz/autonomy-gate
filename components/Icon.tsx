type IconProps = {
  name: string;
  className?: string;
};

/** Material Symbols ligature icon, matching the approved reference screens. */
export function Icon({ name, className }: IconProps) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className ?? ""}`}>
      {name}
    </span>
  );
}
