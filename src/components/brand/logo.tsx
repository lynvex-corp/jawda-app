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
      <img src="/logo-mark.png" alt="Jáwda" width={size} height={size} className="shrink-0" />
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
