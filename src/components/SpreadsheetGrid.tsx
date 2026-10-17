import React, { useState, useMemo, useEffect } from "react";
import {
  Search, Download, Plus, Filter, QrCode, Boxes, Building2,
  ExternalLink, ArrowUp, ArrowDown, ArrowUpDown, X
} from "lucide-react";
import { ViewDefinition, SensorAsset } from "../types/schema";

interface SpreadsheetGridProps {
  view: ViewDefinition;
  data: any[];
  onSelectRow: (item: any) => void;
  onNewItem?: () => void;
}

interface ColumnFilterConfig {
  term?: string;
  matchCase?: boolean;
  wholeWord?: boolean;
  selectedValues?: string[];
}

interface SortCriterion {
  key: string;
  direction: "asc" | "desc";
}

function getNestedValue(item: any, path: string): any {
  if (!path.includes(".")) return item[path];
  return path.split(".").reduce((acc, part) => acc?.[part], item);
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  view,
  data,
  onSelectRow,
  onNewItem
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([
    { key: view.config?.defaultSort?.field || "id", direction: (view.config?.defaultSort?.order as "asc" | "desc") || "asc" }
  ]);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterConfig>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  const columns = view.config?.columns || [];

  // Close filter popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".col-filter-popover") || target.closest(".col-filter-btn")) {
        return;
      }
      setActiveFilterCol(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Columns treated as discrete checkbox lists
  const isCheckboxCol = (colField: string) => {
    return ["sensor_type", "status", "hw_version", "fw_version", "kit.kit_code"].includes(colField);
  };

  // Compute available options and counts for checkbox columns
  const getAvailableOptions = (colField: string) => {
    const counts = new Map<string, number>();
    for (const item of data) {
      let val = getNestedValue(item, colField);
      if (val === undefined || val === null || val === "") {
        val = "—";
      }
      counts.set(val, (counts.get(val) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([val, count]) => ({ value: val, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Sorting Handler (Cycle: asc -> desc -> remove)
  const handleSort = (fieldKey: string) => {
    setSortCriteria((prev) => {
      const idx = prev.findIndex((c) => c.key === fieldKey);
      if (idx === -1) {
        return [{ key: fieldKey, direction: "asc" }];
      }
      const current = prev[idx];
      if (current.direction === "asc") {
        return [{ key: fieldKey, direction: "desc" }];
      }
      return [];
    });
  };

  // Filter and sort the dataset
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Global search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((item) => {
        return (
          item.serial_number?.toLowerCase().includes(q) ||
          item.sensor_type?.toLowerCase().includes(q) ||
          item.hw_version?.toLowerCase().includes(q) ||
          item.fw_version?.toLowerCase().includes(q) ||
          item.status?.toLowerCase().includes(q) ||
          (item as any).kit?.kit_code?.toLowerCase().includes(q) ||
          (item as any).customer?.company_name?.toLowerCase().includes(q) ||
          item.notes?.toLowerCase().includes(q)
        );
      });
    }

    // 2. Individual column filters
    const filterEntries = Object.entries(columnFilters) as [string, ColumnFilterConfig][];
    for (const [colField, filterCfg] of filterEntries) {
      if (!filterCfg) continue;

      if (isCheckboxCol(colField)) {
        const selected = filterCfg.selectedValues || [];
        if (selected.length > 0) {
          result = result.filter((item) => {
            let val = getNestedValue(item, colField);
            if (val === undefined || val === null || val === "") val = "—";
            return selected.includes(val);
          });
        }
      } else {
        const term = (filterCfg.term || "").trim();
        if (term) {
          result = result.filter((item) => {
            const rawVal = getNestedValue(item, colField);
            const valStr = (rawVal ?? "").toString();
            if (filterCfg.matchCase) {
              if (filterCfg.wholeWord) {
                return new RegExp(`(^|\\s)${term}($|\\s)`).test(valStr);
              }
              return valStr.includes(term);
            }
            if (filterCfg.wholeWord) {
              return new RegExp(`(^|\\s)${term}($|\\s)`, "i").test(valStr);
            }
            return valStr.toLowerCase().includes(term.toLowerCase());
          });
        }
      }
    }

    // 3. Sorting
    if (sortCriteria.length > 0) {
      result.sort((a, b) => {
        for (const crit of sortCriteria) {
          const valA = getNestedValue(a, crit.key) ?? "";
          const valB = getNestedValue(b, crit.key) ?? "";
          let cmp = 0;
          if (typeof valA === "number" && typeof valB === "number") {
            cmp = valA - valB;
          } else {
            cmp = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true });
          }
          if (cmp !== 0) {
            return crit.direction === "asc" ? cmp : -cmp;
          }
        }
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, columnFilters, sortCriteria]);

  // Export CSV helper
  const handleExportCSV = () => {
    const headers = columns.map((c) => c.label).join(",");
    const rows = processedData.map((item) => {
      return columns
        .map((c) => {
          const val = getNestedValue(item, c.field) ?? "";
          return `"${val.toString().replace(/"/g, '""')}"`;
        })
        .join(",");
    });
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bom_sensors_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Count active column filters
  const activeColFiltersCount = useMemo(() => {
    const entries = Object.entries(columnFilters) as [string, ColumnFilterConfig][];
    return entries.filter(([col, cfg]) => {
      if (isCheckboxCol(col)) {
        return (cfg.selectedValues || []).length > 0;
      }
      return Boolean(cfg.term?.trim());
    }).length;
  }, [columnFilters]);

  // Cell Renderer Helper
  const renderCell = (col: any, item: any) => {
    const val = getNestedValue(item, col.field);

    if (!val && col.fallback) {
      return <span className="text-slate-400 italic text-[11px] whitespace-nowrap">{col.fallback}</span>;
    }

    switch (col.renderer) {
      case "mono-badge":
        return (
          <span className="font-mono text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded inline-flex items-center space-x-1.5 whitespace-nowrap shrink-0">
            <QrCode className="w-3 h-3 text-rose-600" />
            <span>{val}</span>
          </span>
        );

      case "type-pill": {
        const typeColors: Record<string, string> = {
          Z: "bg-purple-50 text-purple-700 border-purple-200",
          TP: "bg-emerald-50 text-emerald-700 border-emerald-200",
          Sigma: "bg-amber-50 text-amber-700 border-amber-200",
          Omega: "bg-cyan-50 text-cyan-700 border-cyan-200",
        };
        const color = typeColors[val] || "bg-slate-100 text-slate-700 border-slate-200";
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider inline-block whitespace-nowrap ${color}`}>
            {val}
          </span>
        );
      }

      case "status-badge": {
        const statusConfig: Record<string, { label: string; style: string }> = {
          in_stock: { label: "In Warehouse", style: "bg-blue-50 text-blue-700 border-blue-200" },
          in_kit: { label: "In Kit", style: "bg-amber-50 text-amber-700 border-amber-200" },
          installed: { label: "At Client", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          faulty: { label: "Faulty / RMA", style: "bg-rose-50 text-rose-700 border-rose-200" },
          magazzino: { label: "In Warehouse", style: "bg-blue-50 text-blue-700 border-blue-200" },
          installato_cliente: { label: "At Client", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        };
        const cfg = statusConfig[val] || { label: val || "—", style: "bg-slate-100 text-slate-700 border-slate-200" };
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border inline-flex items-center space-x-1.5 whitespace-nowrap ${cfg.style}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0"></span>
            <span>{cfg.label}</span>
          </span>
        );
      }

      case "code-pill":
        return (
          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
            {val}
          </span>
        );

      case "relation-link":
        return (
          <span className="text-[11px] text-slate-700 inline-flex items-center space-x-1 hover:text-rose-600 transition-colors whitespace-nowrap">
            {col.field.startsWith("kit") ? <Boxes className="w-3 h-3 text-slate-400 shrink-0" /> : <Building2 className="w-3 h-3 text-slate-400 shrink-0" />}
            <span className="font-medium truncate max-w-[200px]">{val}</span>
          </span>
        );

      default:
        return <span className="text-[11px] text-slate-700 whitespace-nowrap">{val ?? "—"}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {/* Global Search Bar */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Global search across all fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded pl-8 pr-3 py-1 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-600 transition-colors"
            />
          </div>

          {/* Active Column Filters Badge / Clear All */}
          {activeColFiltersCount > 0 && (
            <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-2 py-1 rounded text-[10.5px] font-medium whitespace-nowrap">
              <span>{activeColFiltersCount} column filter(s) active</span>
              <button
                onClick={() => setColumnFilters({})}
                className="text-rose-700 hover:text-rose-900 font-bold ml-1 hover:underline cursor-pointer flex items-center space-x-0.5"
                title="Clear all column filters"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>
          {onNewItem && (
            <button
              onClick={onNewItem}
              className="flex items-center space-x-1 text-[11px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Import Scans</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Table with per-column filtering & sorting */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-20 border-b border-slate-300 text-slate-600">
            <tr>
              {columns.map((col, colIdx) => {
                const sortIdx = sortCriteria.findIndex((c) => c.key === col.field);
                const isSorted = sortIdx !== -1;
                const direction = isSorted ? sortCriteria[sortIdx].direction : null;

                const isCheckbox = isCheckboxCol(col.field);
                const colFilter = columnFilters[col.field];
                const selectedValues = colFilter?.selectedValues || [];
                const colTerm = colFilter?.term || "";
                const hasColFilter = isCheckbox
                  ? selectedValues.length > 0
                  : Boolean(colTerm.trim());

                const isFilterOpen = activeFilterCol === col.field;
                const isLastCols = colIdx >= columns.length - 2;

                return (
                  <th
                    key={col.field}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.field)}
                    title={isSorted ? "Click to toggle sort direction or clear" : "Click to sort by this column"}
                    className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap border-b border-r border-slate-300 cursor-pointer select-none hover:bg-slate-200 transition-colors relative"
                  >
                    <div className="flex items-center justify-between space-x-1">
                      <span className={isSorted || hasColFilter ? "text-rose-600 font-extrabold" : "text-slate-700"}>
                        {col.label}
                      </span>

                      <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Per-Column Filter Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterCol(isFilterOpen ? null : col.field);
                          }}
                          title={
                            hasColFilter
                              ? isCheckbox
                                ? `Active filter: ${selectedValues.length} selected`
                                : `Active filter: "${colTerm}"`
                              : `Filter by ${col.label}`
                          }
                          className={`col-filter-btn p-0.5 rounded transition-colors cursor-pointer ${
                            hasColFilter
                              ? "text-rose-600 bg-rose-100 ring-1 ring-rose-300 hover:bg-rose-200"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>

                        {/* Sort Indicator */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSort(col.field);
                          }}
                          className="cursor-pointer p-0.5 hover:bg-slate-200 rounded"
                        >
                          {isSorted ? (
                            direction === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-rose-600" strokeWidth={2.5} />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-rose-600" strokeWidth={2.5} />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Popover for Column Filter */}
                    {isFilterOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`col-filter-popover absolute ${
                          isLastCols ? "right-0" : "left-0"
                        } top-full mt-1 z-50 bg-white border border-slate-300 rounded shadow-xl ${
                          isCheckbox ? "w-64" : "w-60"
                        } p-2.5 text-left font-normal normal-case select-text cursor-default`}
                      >
                        {isCheckbox ? (
                          <div>
                            {/* Checkbox Popover Header */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Filter {col.label}
                              </span>
                              {hasColFilter && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColumnFilters((prev) => {
                                      const next = { ...prev };
                                      delete next[col.field];
                                      return next;
                                    });
                                  }}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            {/* Select All / None */}
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[10px]">
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allVals = getAvailableOptions(col.field).map((o) => o.value);
                                    setColumnFilters((prev) => ({
                                      ...prev,
                                      [col.field]: { ...prev[col.field], selectedValues: allVals }
                                    }));
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColumnFilters((prev) => {
                                      const next = { ...prev };
                                      delete next[col.field];
                                      return next;
                                    });
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                >
                                  None
                                </button>
                              </div>
                              <span className="text-slate-400 text-[10px]">
                                {getAvailableOptions(col.field).length} options
                              </span>
                            </div>

                            {/* Options List */}
                            <div className="max-h-44 overflow-y-auto space-y-1">
                              {getAvailableOptions(col.field).map((opt) => {
                                const isChecked = selectedValues.includes(opt.value);
                                return (
                                  <label
                                    key={opt.value}
                                    className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs"
                                  >
                                    <div className="flex items-center space-x-1.5 overflow-hidden">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setColumnFilters((prev) => {
                                            const current = prev[col.field]?.selectedValues || [];
                                            const nextVals = isChecked
                                              ? current.filter((v) => v !== opt.value)
                                              : [...current, opt.value];
                                            if (nextVals.length === 0) {
                                              const next = { ...prev };
                                              delete next[col.field];
                                              return next;
                                            }
                                            return {
                                              ...prev,
                                              [col.field]: { ...prev[col.field], selectedValues: nextVals }
                                            };
                                          });
                                        }}
                                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                      />
                                      <span className="truncate text-slate-800 font-medium text-[11px]">{opt.value}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-mono ml-1">
                                      {opt.count}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {/* Text Search Popover */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Filter {col.label}
                              </span>
                              {hasColFilter && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColumnFilters((prev) => {
                                      const next = { ...prev };
                                      delete next[col.field];
                                      return next;
                                    });
                                  }}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            <div className="relative flex items-center">
                              <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                              <input
                                type="text"
                                autoFocus
                                value={colTerm}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setColumnFilters((prev) => {
                                    if (!val && !prev[col.field]?.matchCase && !prev[col.field]?.wholeWord) {
                                      const next = { ...prev };
                                      delete next[col.field];
                                      return next;
                                    }
                                    return {
                                      ...prev,
                                      [col.field]: { ...prev[col.field], term: val }
                                    };
                                  });
                                }}
                                placeholder={`Search in ${col.label}...`}
                                className="w-full bg-slate-50 border border-slate-300 rounded pl-6 pr-16 py-1 text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:border-rose-600 font-medium"
                                onKeyDown={(e) => {
                                  if (e.key === "Escape" || e.key === "Enter") {
                                    setActiveFilterCol(null);
                                  }
                                }}
                              />

                              {/* Match Case & Whole Word Controls */}
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColumnFilters((prev) => ({
                                      ...prev,
                                      [col.field]: {
                                        term: prev[col.field]?.term || "",
                                        wholeWord: prev[col.field]?.wholeWord,
                                        matchCase: !prev[col.field]?.matchCase
                                      }
                                    }));
                                  }}
                                  title="Match Case (Aa)"
                                  className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono transition-all border cursor-pointer ${
                                    colFilter?.matchCase
                                      ? "bg-rose-600 text-white border-rose-700 shadow-2xs"
                                      : "bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  Aa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColumnFilters((prev) => ({
                                      ...prev,
                                      [col.field]: {
                                        term: prev[col.field]?.term || "",
                                        matchCase: prev[col.field]?.matchCase,
                                        wholeWord: !prev[col.field]?.wholeWord
                                      }
                                    }));
                                  }}
                                  title="Whole Word"
                                  className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono transition-all border cursor-pointer ${
                                    colFilter?.wholeWord
                                      ? "bg-rose-600 text-white border-rose-700 shadow-2xs"
                                      : "bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  "w"
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap w-12 border-b border-slate-300">
                Open
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {processedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400 text-xs">
                  No sensors match current criteria.
                </td>
              </tr>
            ) : (
              processedData.map((item) => (
                <tr
                  key={item.serial_number}
                  onClick={() => onSelectRow(item)}
                  className="hover:bg-rose-50/40 transition-colors cursor-pointer group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.field}
                      className="px-2.5 py-1.5 align-middle whitespace-nowrap border-r border-slate-100/80 last:border-0"
                    >
                      {renderCell(col, item)}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRow(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 transition-opacity"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10.5px] text-slate-500 flex items-center justify-between shrink-0 whitespace-nowrap">
        <span>Showing {processedData.length} of {data.length} sensors</span>
        <span className="font-mono text-[9.5px] text-slate-400">
          Sorted by: {sortCriteria.map((c) => `${c.key} (${c.direction})`).join(", ") || "None"}
        </span>
      </div>
    </div>
  );
};
