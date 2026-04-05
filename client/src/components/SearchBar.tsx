import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { SearchFilters, FilterOptions } from "@/types";

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
  }, [localKeyword]);

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

  const activeFilterCount = [filters.batch, filters.type, filters.era].filter(Boolean).length;

  const clearAllFilters = () => {
    setLocalKeyword("");
    onFiltersChange({ keyword: "", batch: "", type: "", era: "" });
  };

  const batchOrder = ["第一批", "第二批", "第三批", "第四批", "第五批", "第六批", "第七批", "第八批"];

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
                清除全部
              </button>
            )}
          </div>

          {/* Batch filter */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1.5 block">批次</label>
            <div className="flex flex-wrap gap-1.5">
              {batchOrder.map((b) => (
                <button
                  key={b}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      batch: filters.batch === b ? "" : b,
                    })
                  }
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.batch === b
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-secondary-foreground border-transparent hover:bg-secondary"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1.5 block">文物类型</label>
            <div className="flex flex-wrap gap-1.5">
              {(filterOptions?.types || []).map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      type: filters.type === t ? "" : t,
                    })
                  }
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.type === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-secondary-foreground border-transparent hover:bg-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Era filter - use select for many options */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">时代</label>
            <div className="relative">
              <select
                value={filters.era}
                onChange={(e) =>
                  onFiltersChange({ ...filters, era: e.target.value })
                }
                className="w-full h-9 px-3 pr-8 text-sm border border-border rounded-md bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">全部时代</option>
                {(filterOptions?.eras || []).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
