import { ArrowLeft, MapPin, Clock, Landmark, Tag, Navigation, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

interface SiteDetailProps {
  siteId: number;
  onBack: () => void;
  onLocateOnMap: (lat: number, lng: number) => void;
}

function getNavigationUrl(name: string, lat: number, lng: number) {
  // Try to detect mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    // Try native map apps first
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      return `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}`;
    }
    // Android - try Amap intent, fallback to web
    return `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name)}&coordinate=wgs84&callnative=1`;
  }

  // Desktop - use Amap web
  return `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name)}&coordinate=wgs84`;
}

export default function SiteDetail({ siteId, onBack, onLocateOnMap }: SiteDetailProps) {
  const { data: site, isLoading: siteLoading } = trpc.heritage.detail.useQuery({ id: siteId });
  const { data: intro, isLoading: introLoading } = trpc.heritage.introduction.useQuery(
    { siteId },
    { enabled: !!site }
  );

  if (siteLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>未找到该文保单位</p>
        <Button variant="ghost" onClick={onBack} className="mt-2">
          返回
        </Button>
      </div>
    );
  }

  const navUrl = getNavigationUrl(site.name, site.latitude, site.longitude);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/40 bg-white sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-base truncate">{site.name}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Info cards */}
        <div className="space-y-2.5">
          {/* Address with navigation */}
          {site.address && (
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">地址</span>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground">{site.address}</p>
                  <a
                    href={navUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Navigation className="h-3 w-3" />
                    导航
                  </a>
                </div>
              </div>
            </div>
          )}

          {site.era && (
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">时代</span>
                <p className="text-sm text-foreground">{site.era}</p>
              </div>
            </div>
          )}

          {site.type && (
            <div className="flex items-start gap-2.5">
              <Landmark className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">文物类型</span>
                <p className="text-sm text-foreground">{site.type}</p>
              </div>
            </div>
          )}

          {site.batch && (
            <div className="flex items-start gap-2.5">
              <Tag className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">批次</span>
                <p className="text-sm text-foreground">{site.batch}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => onLocateOnMap(site.latitude, site.longitude)}
          >
            <MapPin className="h-3.5 w-3.5" />
            在地图上查看
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            asChild
          >
            <a href={navUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-3.5 w-3.5" />
              导航前往
            </a>
          </Button>
        </div>

        {/* Introduction */}
        <div className="border-t border-border/40 pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">简介</h3>
          {introLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在生成介绍内容...</span>
            </div>
          ) : intro?.content ? (
            <div className="text-sm text-foreground/80 leading-relaxed prose prose-sm max-w-none">
              <Streamdown>{intro.content}</Streamdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无介绍信息</p>
          )}
        </div>
      </div>
    </div>
  );
}
