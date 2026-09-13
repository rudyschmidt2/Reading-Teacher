import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function base({ size = 24, className, ...rest }: IconProps, filled = false): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: filled ? "none" : "currentColor",
    strokeWidth: 2.25,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    className,
    ...rest,
  };
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props, true)}>
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95L12 2.6z" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="10.5" width="16" height="10.5" rx="3" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5v5a1 1 0 0 0 1 1h2.6l4.2 3.4a.6.6 0 0 0 1-.5V5.6a.6.6 0 0 0-1-.5L7.6 8.5H5a1 1 0 0 0-1 1z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props, true)}>
      <path d="M8 5.4v13.2a1 1 0 0 0 1.5.86l10.6-6.6a1 1 0 0 0 0-1.72L9.5 4.54A1 1 0 0 0 8 5.4z" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v5.5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5.5a1 1 0 0 0-1 1.2A4 4 0 0 0 8 10.5" />
      <path d="M16 6h2.5a1 1 0 0 1 1 1.2A4 4 0 0 1 16 10.5" />
      <path d="M12 13.5V17" />
      <path d="M8.5 20.5h7" />
      <path d="M10 17h4l.6 3.5H9.4L10 17z" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base(props, true)}>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5z" />
      <path d="M5.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
      <path d="M18.5 3l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6z" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5v15" />
      <path d="M6 13.5l6 6 6-6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.5 12h-15" />
      <path d="M10.5 6l-6 6 6 6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12h15" />
      <path d="M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12.5l4.8 4.8L19.5 7" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 11.5L12 4l8.5 7.5" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

export function HandIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 13.5V6.5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 12V6a1.5 1.5 0 0 1 3 0v8.5" />
      <path d="M17 14.5l1.4-2.1a1.4 1.4 0 0 1 2.4 1.4l-2.6 5.2A6 6 0 0 1 12.8 22h-1.3a6 6 0 0 1-5.1-2.9L4 14.9a1.5 1.5 0 0 1 2.5-1.6L8 15.5" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function GamepadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 8h11a4.5 4.5 0 0 1 4.4 5.4l-.6 3a2.6 2.6 0 0 1-4.7.9L15.5 15h-7l-1.1 2.3a2.6 2.6 0 0 1-4.7-.9l-.6-3A4.5 4.5 0 0 1 6.5 8z" />
      <path d="M8 11v3" />
      <path d="M6.5 12.5h3" />
      <circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="13.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base(props, true)}>
      <path d="M13.2 2.5L5 13.5h6l-1.2 8 8.2-11h-6l1.2-8z" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12a8 8 0 0 1-14.3 4.9" />
      <path d="M4 12a8 8 0 0 1 14.3-4.9" />
      <path d="M18.5 3.5v4h-4" />
      <path d="M5.5 20.5v-4h4" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function TelescopeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 12.5l13.4-6.2a1 1 0 0 1 1.3.5l1.3 2.8a1 1 0 0 1-.5 1.3L5.6 17.1a1 1 0 0 1-1.3-.5L3 13.8a1 1 0 0 1 .5-1.3z" />
      <path d="M11 14.5l-1 6.5" />
      <path d="M14 13l2.5 8" />
      <path d="M17.5 5.5l2-1" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </svg>
  );
}
