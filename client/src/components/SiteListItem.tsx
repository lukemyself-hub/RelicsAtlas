import { Clock3, MapPin, MoveUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatSiteDistance, resolveSiteTypeIcon } from "@/lib/site-ui";
import type { SiteListItem as SiteListItemType } from "@/types";

interface SiteListItemProps {
  site: SiteListItemType;
  onClick: (id: number) => void;
}

export default function SiteListItem({ site, onClick }: SiteListItemProps) {
  const TypeIcon = resolveSiteTypeIcon(site.type);
  const distanceText = formatSiteDistance(site.distance);

  return (
    <button
      onClick={() => onClick(site.id)}
      className="editorial-card w-full rounded-[28px] p-5 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-display pr-3 text-[1.55rem] font-semibold leading-[1.2] text-foreground md:text-[1.75rem]">
              {site.name}
            </h3>
            {site.batch && (
              <Badge className="shrink-0 bg-primary px-3 py-1.5 text-[11px] tracking-[0.12em] text-primary-foreground">
                {site.batch}
              </Badge>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-muted-foreground">
            {site.era && (
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium text-foreground/82">
                  {site.era}
                </span>
              </span>
            )}
            {site.type && (
              <span className="flex items-center gap-2">
                <TypeIcon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground/82">
                  {site.type}
                </span>
              </span>
            )}
          </div>

          {site.address && (
            <div className="mt-3 flex items-center gap-2 text-[15px] text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{site.address}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-border/70 pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            距离参考
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {distanceText ?? "未定位"}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          查看详情
          <MoveUpRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}
