import { useEffect, useRef } from "react";
import { Landmark, Map, MapPin, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationPromptProps {
  onAllow: () => void;
  onDismiss: () => void;
  focusPermissionActions?: boolean;
}

export default function LocationPrompt({
  onAllow,
  onDismiss,
  focusPermissionActions = false,
}: LocationPromptProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const permissionSectionRef = useRef<HTMLElement>(null);
  const featureItems = [
    {
      id: "01",
      icon: Map,
      title: "看全国文保分布",
      description: "在地图上浏览各地文保单位，快速建立整体认识。",
    },
    {
      id: "02",
      icon: SlidersHorizontal,
      title: "按兴趣细致筛选",
      description: "围绕批次、类别与时代层层查看，让线索更清楚。",
    },
    {
      id: "03",
      icon: MapPin,
      title: "发现你身边的文保单位",
      description: "开启定位后，可优先查看附近地点，并按距离排序。",
    },
  ];

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (!focusPermissionActions) {
      scrollContainer.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const permissionSection = permissionSectionRef.current;
    if (!permissionSection) return;

    const maxScrollTop =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const targetScrollTop = Math.min(
      Math.max(
        permissionSection.offsetTop +
          permissionSection.offsetHeight -
          scrollContainer.clientHeight +
          20,
        0,
      ),
      maxScrollTop,
    );

    scrollContainer.scrollTo({
      top: targetScrollTop,
      behavior: "auto",
    });
  }, [focusPermissionActions]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(18,24,22,0.52)] px-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="editorial-card relative max-h-[min(88dvh,48rem)] w-full max-w-md overflow-hidden rounded-[34px] animate-in zoom-in-95 duration-200">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(11,118,94,0.18),transparent_72%)]" />
        <div className="pointer-events-none absolute left-[-4rem] top-14 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-8 right-[-2rem] h-24 w-24 rounded-full bg-[rgba(201,173,111,0.12)] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(5,122,93,0.22),transparent)]" />

        <div
          ref={scrollContainerRef}
          className="relative max-h-[min(88dvh,48rem)] overflow-y-auto px-6 pb-8 pt-5 md:px-7 md:pb-10 md:pt-6"
        >
          <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-white/58 text-muted-foreground shadow-[0_8px_18px_rgba(19,34,29,0.06)] transition-colors hover:bg-white hover:text-foreground"
            aria-label="关闭欢迎弹窗"
          >
            <X className="h-4 w-4" />
          </button>
          </div>
          <div className="mt-1 flex flex-col gap-6">
            <section className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full border border-primary/10 bg-white/62 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-primary/80 shadow-[0_10px_24px_rgba(19,34,29,0.05)]">
                初识文保地图
              </div>
              <div className="mb-5 flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-[26px] border border-white/45 bg-[linear-gradient(180deg,rgba(11,118,94,0.16)_0%,rgba(4,87,68,0.24)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_18px_36px_rgba(5,122,93,0.12)]">
                <img
                  src="/favicon.svg"
                  alt="文保地图"
                  className="h-11 w-11 rounded-[14px]"
                />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Relics Atlas
              </p>
              <h3 className="mt-2 font-display text-[2rem] font-semibold leading-tight text-foreground md:text-[2.2rem]">
                欢迎使用文保地图
              </h3>
              <p className="mt-3 max-w-[28rem] text-[15px] leading-7 text-muted-foreground md:text-base md:leading-8">
                从全国重点文物保护单位名录出发，在地图上浏览古迹遗存，按批次、类别与时代，找到你真正想了解的地方。
              </p>
            </section>

            <section className="space-y-3">
              {featureItems.map(({ id, icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-[24px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76)_0%,rgba(255,255,255,0.62)_100%)] px-4 py-3.5 shadow-[0_14px_30px_rgba(19,34,29,0.06)]"
                >
                  <div className="flex w-11 shrink-0 flex-col items-center gap-2 pt-0.5">
                    <span className="text-[10px] font-semibold tracking-[0.18em] text-primary/55">
                      {id}
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
                      <Icon className="h-[1.125rem] w-[1.125rem]" />
                    </div>
                  </div>
                  <div className="min-w-0 border-l border-border/60 pl-3 text-left">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            <section
              ref={permissionSectionRef}
              className="rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,rgba(11,118,94,0.08)_0%,rgba(11,118,94,0.025)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] md:px-5"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-primary/12 text-primary">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    如需附近探索，可开启定位
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    定位仅用于当前位置展示与距离计算，帮助你更快找到身边值得一去的文保单位。
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/55 bg-white/62 p-3 shadow-[0_10px_24px_rgba(19,34,29,0.05)]">
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={onDismiss}
                    className="h-11 flex-1 border-white/70 bg-white/88"
                  >
                    先逛一逛
                  </Button>
                  <Button
                    onClick={onAllow}
                    className="h-11 flex-1 bg-[linear-gradient(180deg,#0b765e_0%,#045744_100%)] shadow-[0_14px_28px_rgba(5,122,93,0.22)]"
                  >
                    开启附近探索
                  </Button>
                </div>
                <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                  位置信息仅在本地使用，不会上传到服务器。
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
