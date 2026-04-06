import {
  ArrowLeft,
  Clock3,
  MapPin,
  Navigation,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import introMapJson from "@/generated/site-introductions.json";
import { buildBaiduSearchUrl, getSiteIntroduction } from "@/lib/site-data";
import { resolveSiteTypeIcon } from "@/lib/site-ui";
import type {
  SiteDetail as SiteDetailType,
  SiteIntroductionMap,
} from "@/types";

interface SiteDetailProps {
  site: SiteDetailType | null;
  onBack: () => void;
  onLocateOnMap: (siteId: number) => void;
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

export default function SiteDetail({
  site,
  onBack,
  onLocateOnMap,
}: SiteDetailProps) {
  if (!site) {
    return (
      <div className="page-shell flex h-full items-center justify-center px-6 text-center">
        <div className="editorial-card max-w-md rounded-[32px] p-8">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            未找到该文保单位
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            当前选择的点位可能已经不在筛选结果中，或数据尚未加载完成。
          </p>
          <Button variant="outline" onClick={onBack} className="mt-6">
            返回结果列表
          </Button>
        </div>
      </div>
    );
  }

  const TypeIcon = resolveSiteTypeIcon(site.type);

  const detailRows = [
    site.address
      ? {
          label: "地址",
          value: site.address,
          icon: MapPin,
          action: (
            <a
              href={getNavigationUrl(
                site.name,
                site.mapLatitude,
                site.mapLongitude,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary"
            >
              导航
            </a>
          ),
        }
      : null,
    site.era ? { label: "时代", value: site.era, icon: Clock3 } : null,
    site.type ? { label: "文物类别", value: site.type, icon: TypeIcon } : null,
    site.batch
      ? { label: "保护批次", value: site.batch, icon: Sparkles }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    action?: React.ReactNode;
  }>;

  const navUrl = getNavigationUrl(
    site.name,
    site.mapLatitude,
    site.mapLongitude,
  );
  const introductions = introMapJson as SiteIntroductionMap;
  const intro = getSiteIntroduction(site, introductions);
  const baiduSearchUrl = buildBaiduSearchUrl(site);

  return (
    <div className="page-shell flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-white/12 bg-[linear-gradient(180deg,#0b6f59_0%,#045744_100%)] text-white shadow-[0_18px_36px_rgba(6,44,34,0.2)]">
        <div className="mx-auto flex max-w-4xl items-start gap-3 px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-6 md:pb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mt-1 h-11 w-11 rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/16"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/68">
              全国重点文物保护单位
            </p>
            <h2 className="font-serif-accent mt-2 text-[2rem] font-semibold leading-tight text-white md:text-[2.35rem]">
              {site.name}
            </h2>
          </div>
          {site.batch && (
            <Badge className="mt-1 hidden shrink-0 border-white/15 bg-white/14 px-3 py-1.5 text-[11px] tracking-[0.12em] text-white md:inline-flex">
              {site.batch}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:px-6 md:py-7">
          {site.batch && (
            <Badge className="inline-flex self-start border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] tracking-[0.14em] text-primary md:hidden">
              {site.batch}
            </Badge>
          )}

          <section className="editorial-card rounded-[32px] p-5 md:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <TypeIcon className="h-5 w-5" />
              </div>
              <h3 className="text-[1.3rem] font-semibold text-foreground md:text-[1.4rem]">
                基本信息
              </h3>
            </div>

            <div className="space-y-4">
              {detailRows.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className="grid grid-cols-[2.75rem_1fr_auto] items-start gap-4 rounded-[24px] border border-border/70 bg-white/70 px-4 py-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <row.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {row.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold leading-8 text-foreground">
                      {row.value}
                    </p>
                  </div>
                  {row.action ? <div className="pt-1">{row.action}</div> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <Button
              variant="outline"
              size="lg"
              className="h-14 justify-center gap-2 text-[15px]"
              onClick={() => onLocateOnMap(site.id)}
            >
              <MapPin className="h-4 w-4" />
              在地图上查看
            </Button>
            <Button
              size="lg"
              className="h-14 justify-center gap-2 text-[15px]"
              asChild
            >
              <a href={navUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                导航前往
              </a>
            </Button>
          </section>

          <section className="editorial-card rounded-[32px] p-5 md:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[1.3rem] font-semibold text-foreground md:text-[1.4rem]">
                  阅读简介
                </h3>
              </div>
            </div>

            {intro ? (
              <p className="text-[1.05rem] leading-9 text-foreground/88 md:text-[1.1rem]">
                {intro}
              </p>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border bg-white/70 p-5">
                <p className="text-base leading-8 text-muted-foreground">
                  当前版本暂未收录该文保单位的站内简介，但你仍可继续检索外部资料，了解其历史背景与文化价值。
                </p>
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-5 gap-2"
                  asChild
                >
                  <a
                    href={baiduSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Search className="h-4 w-4" />
                    百度搜索
                  </a>
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
