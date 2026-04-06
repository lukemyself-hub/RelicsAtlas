import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, SlidersHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useComposition } from "@/hooks/useComposition";
import { cn } from "@/lib/utils";
import type { SearchFilters, FilterOptions } from "@/types";
import { BATCH_ORDER, DEFAULT_BATCHES } from "@/lib/site-data";

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
  const filterRef = useRef<HTMLDivElement>(null);
  const composition = useComposition<HTMLInputElement>({
    onKeyDown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSearchSubmit();
      }
    },
  });

  useEffect(() => {
    if (!showFilters) return;
    const handler = (event: PointerEvent) => {
      const target = event.target;
      if (
        filterRef.current &&
        target instanceof Node &&
        !filterRef.current.contains(target)
      ) {
        setShowFilters(false);
      }
    };

    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [showFilters]);

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
    if (!keyword) {
      return eras;
    }

    return eras.filter((era) => era.toLowerCase().includes(keyword));
  }, [eraKeyword, filterOptions?.eras]);

  const clearAllFilters = () => {
    onDraftKeywordChange("");
    onFiltersChange({ keyword: "", batches: [...DEFAULT_BATCHES], types: [], era: "" });
  };

  return (
    <div className="relative" ref={filterRef}>
      <div className="flex items-center gap-2">
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              enterKeyHint="search"
              placeholder="搜索文保单位名称..."
              value={draftKeyword}
              onChange={(e) => onDraftKeywordChange(e.target.value)}
              onKeyDown={composition.onKeyDown}
              onCompositionStart={composition.onCompositionStart}
              onCompositionEnd={composition.onCompositionEnd}
              className="h-10 bg-white pl-9 pr-8 shadow-sm border-border/60"
            />
            {draftKeyword && (
              <button
                type="button"
                onClick={() => {
                  onDraftKeywordChange("");
                  onFiltersChange({ ...filters, keyword: "" });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清空搜索词"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button type="submit" size="sm" className="h-10 shrink-0 px-3 shadow-sm">
            搜索
          </Button>
        </form>

        <Button
          variant={activeFilterCount > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-10 shrink-0 gap-1.5 px-3 shadow-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">筛选</span>
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 animate-in slide-in-from-top-2 fade-in rounded-lg border border-border/60 bg-white p-4 shadow-lg duration-200">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">筛选条件</span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-primary hover:underline"
              >
                恢复默认
              </button>
            )}
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">批次</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onFiltersChange({ ...filters, batches: [...DEFAULT_BATCHES] })}
                  className="text-xs text-primary hover:underline"
                >
                  前三批
                </button>
                <button
                  onClick={() => onFiltersChange({ ...filters, batches: [...BATCH_ORDER] })}
                  className="text-xs text-primary hover:underline"
                >
                  全选
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BATCH_ORDER.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    const isSelected = filters.batches.includes(b);
                    const next = isSelected
                      ? filters.batches.filter((batch) => batch !== b)
                      : [...filters.batches, b];

                    onFiltersChange({
                      ...filters,
                      batches: next,
                    });
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    filters.batches.includes(b)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">文物类型</label>
              {filters.types.length > 0 && (
                <button
                  onClick={() => onFiltersChange({ ...filters, types: [] })}
                  className="text-xs text-primary hover:underline"
                >
                  全选
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(filterOptions?.types || []).map((t) => {
                const allTypes = filterOptions?.types || [];
                const isSelected = filters.types.length === 0 || filters.types.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      if (filters.types.length === 0) {
                        onFiltersChange({ ...filters, types: allTypes.filter((x) => x !== t) });
                      } else if (filters.types.includes(t)) {
                        const next = filters.types.filter((x) => x !== t);
                        onFiltersChange({ ...filters, types: next.length === 0 ? [] : next });
                      } else {
                        const next = [...filters.types, t];
                        onFiltersChange({
                          ...filters,
                          types: next.length === allTypes.length ? [] : next,
                        });
                      }
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">时代</label>
            <div className="overflow-hidden rounded-md border border-border">
              <Command shouldFilter={false}>
                <CommandInput
                  value={eraKeyword}
                  onValueChange={setEraKeyword}
                  placeholder="搜索时代..."
                />
                <CommandList className="max-h-48">
                  <CommandEmpty>未找到匹配时代</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => onFiltersChange({ ...filters, era: "" })}>
                      <Check className={cn("h-4 w-4", !filters.era ? "opacity-100" : "opacity-0")} />
                      <span>全部时代</span>
                    </CommandItem>
                    {filteredEras.map((era) => (
                      <CommandItem
                        key={era}
                        value={era}
                        onSelect={() => onFiltersChange({ ...filters, era })}
                      >
                        <Check
                          className={cn("h-4 w-4", filters.era === era ? "opacity-100" : "opacity-0")}
                        />
                        <span className="truncate">{era}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
