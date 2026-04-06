import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useComposition } from "@/hooks/useComposition";
import { useIsMobile } from "@/hooks/useMobile";
import { BATCH_ORDER, DEFAULT_BATCHES } from "@/lib/site-data";
import { cn } from "@/lib/utils";
import type { FilterOptions, SearchFilters } from "@/types";

interface SearchBarProps {
  filters: SearchFilters;
  draftKeyword: string;
  onDraftKeywordChange: (keyword: string) => void;
  onSearchSubmit: () => void;
  onFiltersChange: (filters: SearchFilters) => void;
  filterOptions: FilterOptions | undefined;
}

export default function SearchBar({
  filters,
  draftKeyword,
  onDraftKeywordChange,
  onSearchSubmit,
  onFiltersChange,
  filterOptions,
}: SearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [eraKeyword, setEraKeyword] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const composition = useComposition<HTMLInputElement>({
    onKeyDown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSearchSubmit();
      }
    },
  });

  useEffect(() => {
    if (isMobile || !showFilters) return;
    const handler = (event: PointerEvent) => {
      const target = event.target;
      if (
        rootRef.current &&
        target instanceof Node &&
        !rootRef.current.contains(target)
      ) {
        setShowFilters(false);
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [isMobile, showFilters]);

  useEffect(() => {
    if (!showFilters) {
      setEraKeyword("");
    }
  }, [showFilters]);

  const hasCustomBatchSelection =
    filters.batches.length !== DEFAULT_BATCHES.length ||
    DEFAULT_BATCHES.some((batch) => !filters.batches.includes(batch));

  const activeFilterCount =
    (hasCustomBatchSelection ? 1 : 0) +
    (filters.types.length > 0 ? 1 : 0) +
    (filters.era ? 1 : 0);

  const filteredEras = useMemo(() => {
    const eras = filterOptions?.eras || [];
    const keyword = eraKeyword.trim().toLowerCase();
    if (!keyword) return eras;
    return eras.filter((era) => era.toLowerCase().includes(keyword));
  }, [eraKeyword, filterOptions?.eras]);

  const clearAllFilters = () => {
    onDraftKeywordChange("");
    onFiltersChange({
      keyword: "",
      batches: [...DEFAULT_BATCHES],
      types: [],
      era: "",
    });
  };

  const filterPanel = (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              批次
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              默认展示前三批，可根据需要扩大范围。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-primary">
            <button
              onClick={() =>
                onFiltersChange({ ...filters, batches: [...DEFAULT_BATCHES] })
              }
            >
              前三批
            </button>
            <span className="text-border">/</span>
            <button
              onClick={() =>
                onFiltersChange({ ...filters, batches: [...BATCH_ORDER] })
              }
            >
              全选
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {BATCH_ORDER.map((batch) => {
            const selected = filters.batches.includes(batch);
            return (
              <button
                key={batch}
                onClick={() => {
                  const next = selected
                    ? filters.batches.filter((item) => item !== batch)
                    : [...filters.batches, batch];
                  onFiltersChange({ ...filters, batches: next });
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(5,122,93,0.18)]"
                    : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-accent",
                )}
              >
                {batch}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              文物类别
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              不选择代表全部类别。
            </p>
          </div>
          {filters.types.length > 0 && (
            <button
              onClick={() => onFiltersChange({ ...filters, types: [] })}
              className="shrink-0 text-xs font-medium text-primary"
            >
              恢复全部
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(filterOptions?.types || []).map((type) => {
            const allTypes = filterOptions?.types || [];
            const selected =
              filters.types.length === 0 || filters.types.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  if (filters.types.length === 0) {
                    onFiltersChange({
                      ...filters,
                      types: allTypes.filter((item) => item !== type),
                    });
                    return;
                  }

                  if (filters.types.includes(type)) {
                    const next = filters.types.filter((item) => item !== type);
                    onFiltersChange({
                      ...filters,
                      types: next.length === 0 ? [] : next,
                    });
                    return;
                  }

                  const next = [...filters.types, type];
                  onFiltersChange({
                    ...filters,
                    types: next.length === allTypes.length ? [] : next,
                  });
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  selected
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border bg-white text-foreground hover:border-primary/30 hover:bg-accent",
                )}
              >
                {type}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              时代
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              支持按时代关键词快速检索。
            </p>
          </div>
          {filters.era && (
            <button
              onClick={() => onFiltersChange({ ...filters, era: "" })}
              className="shrink-0 text-xs font-medium text-primary"
            >
              清除
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-[26px] border border-border bg-white">
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              value={eraKeyword}
              onValueChange={setEraKeyword}
              placeholder="搜索时代，如：清、唐、辽金"
              className="h-12"
            />
            <CommandList className="max-h-56 px-2 pb-2">
              <CommandEmpty className="px-3 py-6 text-sm text-muted-foreground">
                未找到匹配时代
              </CommandEmpty>
              <CommandGroup className="space-y-1">
                <CommandItem
                  onSelect={() => onFiltersChange({ ...filters, era: "" })}
                  className="rounded-2xl px-3 py-3 text-sm"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      !filters.era ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>全部时代</span>
                </CommandItem>
                {filteredEras.map((era) => (
                  <CommandItem
                    key={era}
                    value={era}
                    onSelect={() => onFiltersChange({ ...filters, era })}
                    className="rounded-2xl px-3 py-3 text-sm"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        filters.era === era ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{era}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </section>
    </div>
  );

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-3">
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6f756f]" />
            <Input
              type="text"
              enterKeyHint="search"
              placeholder="搜索文化遗产、古建筑、遗址…"
              value={draftKeyword}
              onChange={(event) => onDraftKeywordChange(event.target.value)}
              onKeyDown={composition.onKeyDown}
              onCompositionStart={composition.onCompositionStart}
              onCompositionEnd={composition.onCompositionEnd}
              className="h-12 border-white/20 bg-white pl-12 pr-11 text-[15px] text-[#202422] shadow-[0_14px_28px_rgba(12,32,25,0.18)] placeholder:text-[#7d837e] focus-visible:border-white/50 focus-visible:ring-white/25 md:h-14 md:text-base"
            />
            {draftKeyword && (
              <button
                type="button"
                onClick={() => {
                  onDraftKeywordChange("");
                  onFiltersChange({ ...filters, keyword: "" });
                }}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#6f756f] transition-colors hover:bg-black/5 hover:text-foreground"
                aria-label="清除搜索"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            className="h-12 shrink-0 rounded-full bg-white px-4 text-primary shadow-[0_14px_28px_rgba(12,32,25,0.18)] hover:bg-white/92 md:h-14"
          >
            搜索
          </Button>
        </form>

        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setShowFilters((current) => !current)}
            className="h-12 w-12 rounded-full border border-white/22 bg-white/10 text-white shadow-[0_14px_28px_rgba(12,32,25,0.14)] backdrop-blur-md hover:bg-white/16"
            aria-label="打开筛选"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
          {activeFilterCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-6 min-w-6 border-white/20 bg-[#dcefe8] px-1.5 text-[11px] text-primary shadow-sm">
              {activeFilterCount}
            </Badge>
          )}
        </div>
      </div>

      {!isMobile && showFilters && (
        <div className="editorial-card absolute right-0 top-full z-50 mt-4 w-[min(36rem,calc(100vw-2rem))] rounded-[32px] p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-semibold text-foreground">
                筛选文保单位
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                当前共启用 {activeFilterCount} 项筛选规则。
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                恢复默认
              </Button>
            )}
          </div>
          {filterPanel}
        </div>
      )}

      {isMobile && (
        <Drawer open={showFilters} onOpenChange={setShowFilters}>
          <DrawerContent className="rounded-t-[32px] border-border bg-background">
            <DrawerHeader className="px-5 pb-2 pt-5 text-left">
              <DrawerTitle className="font-display text-2xl font-semibold text-foreground">
                筛选文保单位
              </DrawerTitle>
              <DrawerDescription className="text-sm">
                让结果更贴近你关心的批次、类别与时代。
              </DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[70vh] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  当前共启用 {activeFilterCount} 项筛选规则
                </div>
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    恢复默认
                  </Button>
                )}
              </div>
              {filterPanel}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
