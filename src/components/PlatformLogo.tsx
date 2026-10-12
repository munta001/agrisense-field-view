import { Leaf } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";

export function PlatformLogo({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const { logo_url, platform_name, resolved } = useBranding();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        className,
        logo_url && "platform-logo-image",
      )}
    >
      {!resolved ? (
        <span aria-hidden className="h-full w-full animate-pulse bg-muted/40" />
      ) : logo_url ? (
        <img src={logo_url} alt={`${platform_name} logo`} className="h-full w-full object-contain" />
      ) : (
        <Leaf className={cn("h-5 w-5", iconClassName)} />
      )}
    </div>
  );
}
