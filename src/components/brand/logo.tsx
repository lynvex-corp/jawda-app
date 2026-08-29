import { cn } from "@/lib/utils";

export function JawdaLogo({
  className,
  showWordmark = true,
  size = 28,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path
          d="M11 8h11v11.5a5.5 5.5 0 0 1-5.5 5.5H15a4 4 0 0 1-4-4v-1.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="22" cy="10" r="1.6" fill="white" />
      </svg>
      {showWordmark && (
        <span
          className="text-[15px] font-semibold tracking-tight text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          Jáwda
        </span>
      )}
    </div>
  );
}
