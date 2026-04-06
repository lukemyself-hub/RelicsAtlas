import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="page-shell min-h-screen w-full px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
        <Card className="w-full max-w-2xl border-border/70 bg-white/90">
          <CardContent className="px-8 py-10 text-center md:px-12 md:py-12">
            <div className="mb-7 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary shadow-[0_18px_36px_rgba(5,122,93,0.12)]">
                <Compass className="h-10 w-10" />
              </div>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              404
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold text-foreground md:text-6xl">
              这页走丢了
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
              你访问的页面不存在，或者它已经回到了主地图。回到首页，我们继续从文保地图开始。
            </p>

            <div
              id="not-found-button-group"
              className="mt-8 flex justify-center"
            >
              <Button onClick={handleGoHome} size="lg" className="px-7">
                <Home className="w-4 h-4" />
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
