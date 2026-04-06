import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const APP_DESCRIPTION =
  "全国重点文物保护单位地图是一款面向公众的文保信息浏览工具，帮助用户更轻松地发现全国重点文物保护单位，结合地图定位、条件筛选与详情介绍，快速了解遗产分布、基础信息与出行线索，让历史文化遗产的认知与探索更直观、更便捷。";

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="page-shell flex min-h-dvh w-full flex-col overflow-hidden">
      <header className="relative z-10 shrink-0 border-b border-white/12 bg-[linear-gradient(180deg,#0b765e_0%,#045744_100%)] text-white shadow-[0_20px_40px_rgba(4,39,31,0.18)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.95rem)] md:px-6 md:pb-5 md:pt-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            className="h-10 w-10 shrink-0 rounded-full border border-white/28 bg-white/20 text-white shadow-[0_10px_24px_rgba(6,44,34,0.16)] hover:bg-white/28"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/68">
              About
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-white">
              关于
            </h1>
          </div>
          <div className="h-10 w-10 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <main className="flex flex-1 items-stretch justify-center px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:px-6 md:py-8">
        <div className="flex w-full max-w-xl flex-1">
          <section className="editorial-card flex w-full flex-1 flex-col rounded-[32px] px-5 py-6 md:px-7 md:py-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(180deg,#0b8f71_0%,#056850_100%)] p-3 shadow-[0_18px_36px_rgba(5,122,93,0.22)]">
                <img
                  src="/favicon.svg"
                  alt="全国重点文物保护单位地图 Logo"
                  className="h-full w-full rounded-[20px]"
                />
              </div>
              <h2 className="mt-5 whitespace-nowrap font-display text-[1.12rem] font-bold tracking-[-0.04em] text-foreground sm:text-[1.45rem]">
                全国重点文物保护单位地图
              </h2>
            </div>

            <div className="mt-8 border-t border-border/70 pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                应用介绍
              </p>
              <p className="mt-3 text-[1rem] leading-8 text-foreground/86 md:text-[1.05rem]">
                {APP_DESCRIPTION}
              </p>
            </div>

            <div className="mt-6 rounded-[24px] border border-border/70 bg-white/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                开发者
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                @LukeMyself
              </p>
            </div>

            <div className="mt-auto pt-10 text-center">
              <p className="text-xs text-muted-foreground/85">
                © 2026 全国重点文物保护单位地图
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
