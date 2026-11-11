import { cn } from "@/lib/utils";

/** Single key cap. */
export const Kbd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <kbd
    className={cn(
      "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-card px-1 font-mono text-[11px] leading-none text-muted-foreground",
      className
    )}
  >
    {children}
  </kbd>
);

/** A key sequence such as g then h. */
export const Keys = ({ keys, className }: { keys: string[]; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1", className)}>
    {keys.map((k, i) => (
      <Kbd key={i}>{k}</Kbd>
    ))}
  </span>
);
