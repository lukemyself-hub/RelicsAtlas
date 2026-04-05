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
import { cn } from "@/lib/utils";
import type { SearchFilters, FilterOptions } from "@/types";
import { BATCH_ORDER, DEFAULT_BATCHES } from "@/lib/site-data";

interface SearchBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  filterOptions: FilterOptions | undefined;
  isLoading?: boolean;
}

export default function SearchBar({
  filters,
  onFiltersChange,
  filterOptions,
  isLoading,
}: SearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localKeyword, setLocalKeyword] = useState(filters.keyword);
  const [eraKeyword, setEraKeyword] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const filterRef = useRef<HTMLDivElement>(null);

  // Debounce keyword search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localKeyword !== filters.keyword) {
        onFiltersChange({ ...filters, keyword: localKeyword });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, localKeyword, onFiltersChange]);

  useEffect(() => {
    setLocalKeyword(filters.keyword);
  }, [filters.keyword]);

  // Close filter panel on outside click
  useEffect(() => {
    if (!showFilters) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    setLocalKeyword("");
    onFiltersChange({ keyword: "", batches: [...DEFAULT_BATCHES], types: [], era: "" });
  };

  return (
    <div className="relative" ref={filterRef}>
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索文保单位名称..."
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            className="pl-9 pr-8 h-10 bg-white shadow-sm border-border/60"
          />
          {localKeyword && (
            <button
              onClick={() => {
                setLocalKeyword("");
                onFiltersChange({ ...filters, keyword: "" });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <Button
          variant={activeFilterCount > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-10 px-3 gap-1.5 shrink-0 shadow-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">筛选</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full ml-0.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-border/60 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
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

          {/* Batch filter - multi-select */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
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
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.batches.includes(b)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-secondary-foreground border-transparent hover:bg-secondary"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter - multi-select */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
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
                        // All selected → deselect this one
                        onFiltersChange({ ...filters, types: allTypes.filter((x) => x !== t) });
                      } else if (filters.types.includes(t)) {
                        const next = filters.types.filter((x) => x !== t);
                        // If deselecting the last one, reset to all
                        onFiltersChange({ ...filters, types: next.length === 0 ? [] : next });
                      } else {
                        const next = [...filters.types, t];
                        // If all are now selected, reset to empty (= all)
                        onFiltersChange({ ...filters, types: next.length === allTypes.length ? [] : next });
                      }
                    }}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 text-secondary-foreground border-transparent hover:bg-secondary"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Era filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">时代</label>
            <div className="rounded-md border border-border overflow-hidden">
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
