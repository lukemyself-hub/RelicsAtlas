import { MapPin, Clock, Landmark, Tag } from "lucide-react";
import type { SiteListItem as SiteListItemType } from "@/types";

interface SiteListItemProps {
  site: SiteListItemType;
  onClick: (id: number) => void;
}

export default function SiteListItem({ site, onClick }: SiteListItemProps) {
  return (
    <button
      onClick={() => onClick(site.id)}
      className="w-full text-left p-3.5 border-b border-border/40 hover:bg-accent/50 transition-colors active:bg-accent/80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground truncate">
            {site.name}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {site.era && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[100px]">{site.era}</span>
              </span>
            )}
            {site.type && (
              <span className="flex items-center gap-1">
                <Landmark className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[80px]">{site.type}</span>
              </span>
            )}
          </div>
          {site.address && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{site.address}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {site.batch && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {site.batch}
            </span>
          )}
          {site.distance !== undefined && (
            <span className="text-xs text-muted-foreground">
              {site.distance < 1
                ? `${(site.distance * 1000).toFixed(0)}m`
                : site.distance < 100
                ? `${site.distance.toFixed(1)}km`
                : `${site.distance.toFixed(0)}km`}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
