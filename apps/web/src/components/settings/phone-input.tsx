"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

// Curated list — Mexico first, then LATAM + common ones.
type Country = { code: string; name: string; dial: string; flag: string };

const COUNTRIES: Country[] = [
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "US", name: "Estados Unidos", dial: "+1", flag: "🇺🇸" },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "PE", name: "Perú", dial: "+51", flag: "🇵🇪" },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { code: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦" },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮" },
  { code: "DO", name: "Rep. Dominicana", dial: "+1809", flag: "🇩🇴" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
];

const DEFAULT = COUNTRIES[0];

// Split a stored E.164-ish value into a country + local digits.
function parseValue(value: string): { country: Country; local: string } {
  const v = (value || "").replace(/\s+/g, "");
  if (!v.startsWith("+")) return { country: DEFAULT, local: v.replace(/\D/g, "") };
  // Longest dial code match wins (so +1809 beats +1).
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const match = sorted.find((c) => v.startsWith(c.dial));
  if (match) return { country: match, local: v.slice(match.dial.length).replace(/\D/g, "") };
  return { country: DEFAULT, local: v.replace(/\D/g, "") };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  const initial = useMemo(() => parseValue(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState<Country>(initial.country);
  const [local, setLocal] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-sync when an external value arrives (e.g. after data load).
  useEffect(() => {
    const parsed = parseValue(value);
    setCountry(parsed.country);
    setLocal(parsed.local);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const emit = (c: Country, l: string) => {
    const digits = l.replace(/\D/g, "");
    onChange(digits ? `${c.dial}${digits}` : "");
  };

  const handleSelect = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setQuery("");
    emit(c, local);
  };

  const handleLocal = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 15);
    setLocal(digits);
    emit(country, digits);
  };

  const filtered = query
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dial.includes(query) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      )
    : COUNTRIES;

  return (
    <div ref={containerRef} className="relative flex gap-2">
      {/* Country selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-sm hover:bg-secondary disabled:opacity-50"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="font-mono text-xs text-muted-foreground">{country.dial}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Local number */}
      <input
        type="tel"
        inputMode="numeric"
        value={local}
        disabled={disabled}
        onChange={(e) => handleLocal(e.target.value)}
        placeholder="442 123 4567"
        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
      />

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país o lada..."
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Sin resultados</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelect(c)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${
                  c.code === country.code ? "bg-secondary/60" : ""
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
