import { Card } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

/** One settings block: Card + consistent h2 header, anchored for the section nav. */
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  danger,
  className,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <Card className={cn("space-y-4 p-4 sm:p-6", danger && "border-destructive/50", className)}>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Icon className={cn("h-5 w-5", danger ? "text-destructive" : "text-primary")} />
            <h2 id={headingId} className={cn("text-lg font-semibold", danger ? "text-destructive" : "text-foreground")}>
              {title}
            </h2>
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </Card>
    </section>
  );
}
