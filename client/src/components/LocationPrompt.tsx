import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationPromptProps {
  onAllow: () => void;
  onDismiss: () => void;
}

export default function LocationPrompt({
  onAllow,
  onDismiss,
}: LocationPromptProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(18,24,22,0.52)] px-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="editorial-card w-full max-w-md rounded-[32px] p-6 animate-in zoom-in-95 duration-200 md:p-7">
        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/10">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            位置服务
          </p>
          <h3 className="mt-2 font-display text-3xl font-semibold text-foreground">
            开启定位权限
          </h3>
          <p className="mt-3 text-base leading-8 text-muted-foreground">
            开启位置服务后，地图会优先呈现你身边更值得先去的文保单位。
          </p>
          <ul className="mt-5 space-y-2 text-sm leading-7 text-muted-foreground">
            <li>按距离排序附近的文保单位</li>
            <li>在地图中标出你的当前位置</li>
            <li>生成更顺手的导航起点</li>
          </ul>
          <div className="mt-6 flex w-full gap-3">
            <Button variant="outline" onClick={onDismiss} className="flex-1">
              暂不开启
            </Button>
            <Button onClick={onAllow} className="flex-1">
              允许定位
            </Button>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            您的位置信息仅用于本地计算，不会上传到服务器
          </p>
        </div>
      </div>
    </div>
  );
}
