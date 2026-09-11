"use client";

import { useState, useMemo } from "react";
import { Check, Search, X, ChevronDown, ChevronUp } from "lucide-react";

interface ListBoxProps {
  title: string;
  items: string[];
  selectedItems: string[];
  possibleValues: Set<string>;
  frequencies: Record<string, number>;
  onToggle: (val: string) => void;
  onClear: () => void;
  maxHeight?: string;
}

function QlikListBox({
  title,
  items,
  selectedItems,
  possibleValues,
  frequencies,
  onToggle,
  onClear,
  maxHeight = "max-h-36",
}: ListBoxProps) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Normalize and group items to eliminate case duplication (e.g. BLACK vs Black)
  const normalizedItems = useMemo(() => {
    const map = new Map<string, { display: string; originals: string[]; totalFreq: number }>();

    items.forEach((item) => {
      const key = item.trim().toUpperCase();
      const existing = map.get(key);
      const freq = frequencies[item] || 0;

      if (!existing) {
        map.set(key, {
          display: item.trim(),
          originals: [item],
          totalFreq: freq,
        });
      } else {
        existing.originals.push(item);
        existing.totalFreq += freq;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Sort selected to the top first, then alphabetical
      const aSel = a.originals.some((o) => selectedItems.includes(o));
      const bSel = b.originals.some((o) => selectedItems.includes(o));
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.display.localeCompare(b.display);
    });
  }, [items, selectedItems, frequencies]);

  const filtered = normalizedItems.filter((item) =>
    item.display.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = selectedItems.length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all duration-200 hover:border-slate-700/80">
      {/* Panel Header */}
      <div className="bg-slate-950/80 px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[11px] font-bold text-slate-200 tracking-wide truncate">
            {title}
          </span>
          {selectedCount > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
              {selectedCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded transition-colors ${
              showSearch || search ? "text-emerald-400 bg-slate-800" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Search list"
          >
            <Search className="w-3 h-3" />
          </button>

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors font-medium px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Expandable Search Input */}
      {!collapsed && showSearch && (
        <div className="p-1.5 bg-slate-950/40 border-b border-slate-800/70 relative">
          <input
            type="text"
            placeholder={`Filter ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 text-[11px] pl-2 pr-6 py-1 rounded-md text-white placeholder-slate-500 focus:outline-none transition-colors"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Row List Body */}
      {!collapsed && (
        <div
          className={`${maxHeight} overflow-y-auto divide-y divide-slate-800/30 text-[11px] select-none [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/60 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600`}
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-[10px] italic">
              No matching {title.toLowerCase()}
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = item.originals.some((o) => selectedItems.includes(o));
              const isPossible = item.originals.some((o) => possibleValues.has(o));
              const primaryOriginal = item.originals[0];

              return (
                <div
                  key={item.display}
                  onClick={() => onToggle(primaryOriginal)}
                  className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white font-semibold shadow-xs"
                      : isPossible
                      ? "bg-slate-900/60 text-slate-200 hover:bg-slate-800/90 hover:text-white"
                      : "bg-slate-950/70 text-slate-600 opacity-40 hover:opacity-60"
                  }`}
                >
                  <span className="truncate pr-2">{item.display}</span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-emerald-700/60 text-emerald-100 font-bold"
                          : isPossible
                          ? "bg-slate-800/80 text-slate-400 font-medium"
                          : "text-slate-600"
                      }`}
                    >
                      {item.totalFreq}
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-white stroke-[2.5]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}