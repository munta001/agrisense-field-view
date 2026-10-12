import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";

/**
 * The platform name, or a quiet placeholder while the real branding is still
 * unknown — so a wrong name is never painted and then swapped.
 */
export function BrandName({ className }: { className?: string }) {
  const { platform_name, resolved } = useBranding();

  if (!resolved || !platform_name) {
    return (
      <span
        aria-hidden
        className={cn("inline-block h-5 w-28 animate-pulse rounded-md bg-muted align-middle", className)}
      />
    );
  }

  return <span className={className}>{platform_name}</span>;
}
