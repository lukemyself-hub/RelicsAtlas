import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationPromptProps {
  onAllow: () => void;
  onDismiss: () => void;
}

export default function LocationPrompt({ onAllow, onDismiss }: LocationPromptProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm mx-4 p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-end -mt-2 -mr-2">
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            开启位置服务
          </h3>
          <p className="text-sm text-muted-foreground mb-1">
            开启位置服务后，我们可以为您：
          </p>
          <ul className="text-sm text-muted-foreground mb-5 space-y-1">
            <li>按距离排序附近的文保单位</li>
            <li>在地图上显示您的当前位置</li>
            <li>提供更精准的导航服务</li>
          </ul>
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onDismiss}
              className="flex-1"
            >
              暂不开启
            </Button>
            <Button
              onClick={onAllow}
              className="flex-1"
            >
              允许定位
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            您的位置信息仅用于本地计算，不会上传到服务器
          </p>
        </div>
      </div>
    </div>
  );
}
