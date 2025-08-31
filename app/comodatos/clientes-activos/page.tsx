"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ===================== CONFIG ===================== */
const DEFAULT_VENTAS_URL =
  "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=871602912#gid=871602912";
const DEFAULT_COMODATOS_URL =
  "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=551810728#gid=551810728";
const DEFAULT_CATALOG_URL =
  "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=0#gid=0";
const DEFAULT_SN_URL =
  "https://docs.google.com/spreadsheets/d/1kF0INEtwYDXhQCBPTVhU8NQI2URKoi99Hs43DTSO02I/edit?gid=161671364#gid=161671364";

const VIABILITY_THRESHOLD = 0.005; // 0,50%
const SUGGEST_ID = "catalog-suggest";
const DEFAULT_LOGO_URL = "/logo.png"; // si pones el archivo en /public/logo.png


/* ===================== HELPERS ===================== */
function money(n: number) {
  return (n || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}
function pct(n: number) {
  return (n || 0).toLocaleString("es-CL", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function parseDateLike(d: any): Date | null {
  if (!d && d !== 0) return null;
  if (d instanceof Date) return d;
  if (typeof d === "number") {
    const base = new Date(1899, 11, 30).getTime();
    return new Date(base + d * 86400000);
  }
  const s = String(d).trim();
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return new Date(+m1[1], +m1[2] - 1, +m1[3]);
  const m2 = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  if (m2) return new Date(+m2[3], +m2[2] - 1, +m2[1]);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}
function rango6Meses(base = new Date()) {
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const start = new Date(base.getFullYear(), base.getMonth() - 5, 1);
  return { start, end };
}
function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
    const DEFAULT_LOGO_URL = "/logo.png"; // si pones el archivo en /public/logo.png

  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}
function parsePeriodoToDate(val: any): Date | null {
  if (typeof val === "number") return parseDateLike(val);
  const s = String(val ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, 1);
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, 1);
  const d = parseDateLike(s);
  return d ? new Date(d.getFullYear(), d.getMonth(), 1) : null;
}
function diffMonths(from: Date, to: Date): number {
  const a = from.getFullYear() * 12 + from.getMonth();
  const b = to.getFullYear() * 12 + to.getMonth();
  return b - a;
}
/* CSV robusto */
function parseCsv(text: string): Record<string, any>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => (row.push(cell), (cell = ""));
  const pushRow = () => (row.length ? rows.push(row) : 0, (row = []));
  const s = text.replace(/\r/g, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') (cell += '"'), i++;
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") (pushCell(), pushRow());
      else cell += ch;
    }
  }
  if (cell.length || row.length) (pushCell(), pushRow());
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, any>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => c === "")) continue;
    const obj: any = {};
    headers.forEach((h, j) => (obj[h] = r[j] ?? ""));
    out.push(obj);
  }
  return out;
}
/* GViz + CSV smart */
async function fetchCsv(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV vacío");
  return rows;
}
async function fetchGviz(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GViz ${res.status}`);
  const text = await res.text();
  const m = text.match(/setResponse\(([\s\S]*?)\);?$/);
  if (!m) throw new Error("GViz: formato inesperado.");
  let json: any;
  try {
    json = JSON.parse(m[1]);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    json = JSON.parse(text.slice(start, end + 1));
  }
  const table = json.table;
  const headers: string[] = table.cols.map((c: any) => (c.label || c.id || "col").trim());
  const rows: Record<string, any>[] = [];
  for (const r of table.rows) {
    const obj: any = {};
    headers.forEach((h, i) => (obj[h] = r.c[i]?.v ?? r.c[i]?.f ?? ""));
    rows.push(obj);
  }
  if (!rows.length) throw new Error("GViz vacío");
  return rows;
}
async function loadSheetSmart(spreadsheetId: string, gid: string | number, label: string) {
  try {
    return await fetchCsv(spreadsheetId, gid);
  } catch {
    try {
      return await fetchGviz(spreadsheetId, gid);
    } catch {
      throw new Error(`${label}: no se pudo leer (revisa permisos y gid).`);
    }
  }
}
function normalizeGoogleSheetUrl(url: string) {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = url.match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  const csvUrl = id ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}` : "";
  return { id, gid, csvUrl };
}
function simpleNorm(s: string) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
function sanitizeRut(r: string) {
  return (r || "").replace(/\./g, "").toUpperCase();
}

/* === Imagen a dataURL para PDF (soporta data: URIs) === */
async function fetchImageAsDataURL(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  try {
    if (/^data:image\/(png|jpeg|jpg);base64,/i.test(url)) {
      const fmt = /png/i.test(url) ? "PNG" : "JPEG";
      return { dataUrl: url, format: fmt as any };
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const format = /png/i.test(blob.type) ? "PNG" : "JPEG";
    const reader = new FileReader();
    const p = new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error("no se pudo leer imagen"));
      reader.onload = () => resolve(String(reader.result));
    });
    reader.readAsDataURL(blob);
    const dataUrl = await p;
    return { dataUrl, format };
  } catch {
    return null;
  }
}

/* === NUEVO: obtener tamaño de imagen para mantener proporción === */
async function getImageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}

/* ===================== TIPOS ===================== */
type VentasRow = {
  DocDate?: any;
  "Rut Cliente"?: string;
  "Nombre Cliente"?: string;
  ItemCode?: string;
  Dscription?: string;
  "Cantidad Kilos"?: number | string;
  "Global Venta"?: number | string;
  "Èmpleado Ventas"?: string;
  "Empleado ventas"?: string;
  "Direccion"?: string;
  "Comuna"?: string;
  "Ciudad"?: string;
  "Codigo Cliente"?: string;
  "odigo liente"?: string;
};
type ComodatoRow = {
  "Rut Cliente"?: string;
  Total?: number | string;
  "Codigo Producto"?: string;
  "Producto"?: string;
  "Periodo"?: any;
};
type CatalogItem = { code: string; name: string; price_list?: number; cost?: number; kilos?: number };
type HistRow = {
  code: string;
  name: string;
  kilos6m: number;
  kgMes: number;
  venta6m: number;
  ventaMes: number;
  precioPromKg: number;
  margenDirectoPct: number;
  mgn1$: number;
  comodatoAsignado$: number;
  mgn2$: number;
  mgn2Pct: number;
  mgn3$: number;
  mgn3Pct: number;
};
type ComodatoView = {
  code: string;
  name: string;
  total: number;
  contratoMeses: number;
  cuotasRestantes: number;
  periodoTexto: string;
  valorCuota: number;
};
type ProposedItem = {
  code: string;
  name: string;
  qty: number;
  unit: number;
  total: number;
  contractMonths: number;
  period: string;
  monthlyFee: number;
};
type ClienteOpt = { code: string; name: string; direccion: string; ejecutivo: string };

/* ===================== COMPONENTE ===================== */
export default function Page() {
  // admin=1 para ver fuentes
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    setAdmin(u.searchParams.get("admin") === "1");
  }, []);

  // URLs (persisten)
  const [ventasUrl, setVentasUrl] = useLocalStorage("ventas.url", DEFAULT_VENTAS_URL);
  const [comodatosUrl, setComodatosUrl] = useLocalStorage("comodatos.url", DEFAULT_COMODATOS_URL);
  const [catalogUrl, setCatalogUrl] = useLocalStorage("catalog.url", DEFAULT_CATALOG_URL);
  const [snUrl, setSnUrl] = useLocalStorage("sn.url", DEFAULT_SN_URL);
  const [logoUrl, setLogoUrl] = useLocalStorage("pdf.logoUrl", "");

  // Parámetros
  const [fechaEval, setFechaEval] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [clienteCodigo, setClienteCodigo] = useState<string>("");
  const [rutFiltro, setRutFiltro] = useLocalStorage("cliente.rut", "");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [clienteDireccion, setClienteDireccion] = useState<string>("");
  const [ejecutivoNombre, setEjecutivoNombre] = useState<string>("");

  const [months, setMonths] = useLocalStorage<number>("comodato.meses", 24);
  const [commissionPct, setCommissionPct] = useLocalStorage<number>("com.base", 0.02);
  const [usePriceListAsCost, setUsePriceListAsCost] = useLocalStorage<boolean>("catalog.usePLasCost", true);

  // Estados
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({});
  const [hist6m, setHist6m] = useState<HistRow[]>([]);
  const [promVentaMensual6m, setPromVentaMensual6m] = useState(0);
  const [comodatoMensual6m, setComodatoMensual6m] = useState(0);
  const [relComVta6m, setRelComVta6m] = useState(0);
  const [commissionFinal6m, setCommissionFinal6m] = useState(0);
  const [loadError, setLoadError] = useState<string>("");
  const [comodatosView, setComodatosView] = useState<ComodatoView[]>([]);
  const [proposed, setProposed] = useLocalStorage<ProposedItem[]>("comodato.propuestos", []);
  const [totalVentaMes, setTotalVentaMes] = useState(0);
  const [totalMgn3, setTotalMgn3] = useState(0);
  const [showAllVentas, setShowAllVentas] = useState(false);
  const [showAllComodatos, setShowAllComodatos] = useState(false);

  // Cache ventas y opciones de código-cliente por RUT
  const [ventasCache, setVentasCache] = useState<VentasRow[] | null>(null);
  const [clienteCodOptions, setClienteCodOptions] = useState<ClienteOpt[]>([]);

  const viabilidadPct = totalVentaMes > 0 ? totalMgn3 / totalVentaMes : 0;
  const isViable = viabilidadPct >= VIABILITY_THRESHOLD;

  /* ======== Datalist productos ======== */
  type Option = { code: string; name: string; price: number };
  const [suggestions, setSuggestions] = useState<Option[]>([]);
  const catalogList = useMemo(
    () =>
      Object.values(catalog)
        .map((c) => ({ code: c.code, name: c.name, price: num(c.price_list ?? c.cost ?? 0) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [catalog]
  );
  const catalogByCode = useMemo(() => {
    const m = new Map<string, Option>();
    for (const c of catalogList) m.set(c.code.toUpperCase(), c);
    return m;
  }, [catalogList]);
  function refreshSuggestions(q: string) {
    const norm = simpleNorm(q);
    if (!norm) return setSuggestions([]);
    const list = catalogList.filter((c) => simpleNorm(c.code).includes(norm) || simpleNorm(c.name).includes(norm));
    setSuggestions(list.slice(0, 50));
  }
  function autocompleteFromCode(row: number, value: string) {
    const code = value.trim().toUpperCase();
    const hit = catalogByCode.get(code);
    if (hit) updateProposed(row, { code: hit.code, name: hit.name, unit: hit.price });
  }

  /* ---------- Cargar catálogo ---------- */
  useEffect(() => {
    (async () => {
      try {
        const { id, gid } = normalizeGoogleSheetUrl(catalogUrl);
        if (!id) throw new Error("URL de catálogo inválida.");
        const rows = await loadSheetSmart(id, gid, "Catálogo");
        const map: Record<string, CatalogItem> = {};
        for (const r of rows) {
          const code = String(r.code ?? r.Code ?? r.Codigo ?? r["code"] ?? "").trim().toUpperCase();
          if (!code) continue;
          map[code] = {
            code,
            name: String(r.name ?? r.Nombre ?? r.Producto ?? r["name"] ?? "").trim(),
            price_list: num(r.price_list ?? r["price_list"]),
            cost: num(r.cost ?? r["cost"]),
            kilos: num(r.kilos ?? r["kilos"]),
          };
        }
        setCatalog(map);
      } catch (e: any) {
        setLoadError(e?.message ?? "Error cargando catálogo");
      }
    })();
  }, [catalogUrl]);

  /* ---------- Helpers Propuestos ---------- */
  function addProposed() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setProposed([...proposed, { code: "", name: "", qty: 1, unit: 0, total: 0, contractMonths: months || 24, period: ym, monthlyFee: 0 }]);
  }
  function updateProposed(index: number, patch: Partial<ProposedItem>) {
    const next = [...proposed];
    const merged = { ...next[index], ...patch };
    merged.total = Math.max(0, Number(merged.qty || 0)) * Math.max(0, Number(merged.unit || 0));
    merged.contractMonths = Math.max(1, Number(merged.contractMonths || 1));
    merged.monthlyFee = merged.contractMonths > 0 ? merged.total / merged.contractMonths : merged.total;
    next[index] = merged;
    setProposed(next);
  }
  function removeProposed(index: number) {
    const next = [...proposed];
    next.splice(index, 1);
    setProposed(next);
  }

  /* ---------- Ventas cache ---------- */
  async function ensureVentasCache() {
    if (ventasCache) return ventasCache;
    const { id: vId, gid: vGid } = normalizeGoogleSheetUrl(ventasUrl);
    if (!vId) throw new Error("URL de ventas inválida.");
    const rows = (await loadSheetSmart(vId, vGid, "Ventas 6M")) as VentasRow[];
    setVentasCache(rows);
    return rows;
  }

  async function autofillByCodigoCliente(code: string) {
    try {
      const rows = await ensureVentasCache();
      const codigoNorm = String(code || "").trim().toUpperCase();
      if (!codigoNorm) return;
      const hit =
        rows.find((r) => String(r["Codigo Cliente"] ?? r["odigo liente"] ?? "").toString().trim().toUpperCase() === codigoNorm) ||
        null;
      if (!hit) return;
      const rut = String(hit["Rut Cliente"] ?? "").trim();
      const nom = String(hit["Nombre Cliente"] ?? "").trim();
      const dirBase = String(hit["Direccion"] ?? "").trim();
      const comuna = String(hit["Comuna"] ?? "").trim();
      const ciudad = String(hit["Ciudad"] ?? "").trim();
      const direccion = [dirBase, comuna, ciudad].filter(Boolean).join(", ");
      const ej = String(hit["Èmpleado Ventas"] ?? hit["Empleado ventas"] ?? "").trim();
      setRutFiltro(rut);
      setClienteNombre(nom);
      setClienteDireccion(direccion);
      setEjecutivoNombre(ej);
    } catch (e: any) {
      setLoadError(e?.message ?? "No se pudo autocompletar por código");
    }
  }

  /* ---------- Opciones de Código cliente por RUT (usa Maestro SN y si no, Ventas 6M) ---------- */
  async function recalcClienteCodOptions() {
    try {
      if (!rutFiltro) {
        setClienteCodOptions([]);
        return;
      }
      const rutSan = sanitizeRut(rutFiltro);

      // 1) Maestro SN
      let opts: ClienteOpt[] = [];
      const { id: snId, gid: snGid } = normalizeGoogleSheetUrl(snUrl || "");
      if (snId) {
        try {
          const rows = await loadSheetSmart(snId, snGid, "Maestro SN");
          const map = new Map<string, ClienteOpt>();
          for (const r of rows) {
            const rv = sanitizeRut(String(r["RUT"] ?? r.Rut ?? r.rut ?? ""));
            if (rutSan && rv !== rutSan) continue;

            const code = String(r["CardCode"] ?? r.CardCode ?? "").trim().toUpperCase();
            if (!code) continue;

            const name = String(r["CardName"] ?? r.CardName ?? "").trim();
            const dirBase = String(r["Direccion Despacho"] ?? r["Dirección Despacho"] ?? "").trim();
            const comuna = String(r["Despacho Comuna"] ?? "").trim();
            const ciudad = String(r["Despacho Ciudad"] ?? "").trim();
            const direccion = [dirBase, comuna, ciudad].filter(Boolean).join(", ");
            const ejecutivo = String(r["Empleado Ventas"] ?? r["Èmpleado Ventas"] ?? r["Empleado ventas"] ?? "").trim();

            map.set(code, { code, name, direccion, ejecutivo });
          }
          opts = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
        } catch {
          opts = [];
        }
      }

      // 2) Respaldo: Ventas 6M
      if (!opts.length) {
        const rows = await ensureVentasCache();
        const map = new Map<string, ClienteOpt>();
        for (const r of rows) {
          const rv = sanitizeRut(String(r["Rut Cliente"] ?? ""));
          if (rutSan && rv !== rutSan) continue;

          const code = String(r["Codigo Cliente"] ?? r["odigo liente"] ?? "").trim().toUpperCase();
          if (!code) continue;

          const name = String(r["Nombre Cliente"] ?? "").trim();
          const dirBase = String(r["Direccion"] ?? "").trim();
          const comuna = String(r["Comuna"] ?? "").trim();
          const ciudad = String(r["Ciudad"] ?? "").trim();
          const direccion = [dirBase, comuna, ciudad].filter(Boolean).join(", ");
          const ejecutivo = String(r["Èmpleado Ventas"] ?? r["Empleado ventas"] ?? "").trim();

          map.set(code, { code, name, direccion, ejecutivo });
        }
        opts = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
      }

      setClienteCodOptions(opts);

      if (opts.length && !opts.some((o) => o.code === (clienteCodigo || "").toUpperCase())) {
        setClienteCodigo(opts[0].code);
        applyClienteOption(opts[0]);
      }
    } catch {
      setClienteCodOptions([]);
    }
  }

  function applyClienteOption(optOrCode: string | ClienteOpt) {
    const opt =
      typeof optOrCode === "string"
        ? clienteCodOptions.find((o) => o.code === optOrCode.toUpperCase())
        : optOrCode;
    if (!opt) return;
    setClienteNombre(opt.name);
    setClienteDireccion(opt.direccion);
    setEjecutivoNombre(opt.ejecutivo);
  }

  useEffect(() => {
    recalcClienteCodOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutFiltro, ventasCache, snUrl]);

  /* ---------- Cargar histórico 6M + Comodatos ---------- */
  async function cargarHistorico6M() {
    setLoadError("");
    try {
      const { id: vId, gid: vGid } = normalizeGoogleSheetUrl(ventasUrl);
      if (!vId) throw new Error("URL de ventas inválida.");
      const ventasRows = (await loadSheetSmart(vId, vGid, "Ventas 6M")) as VentasRow[];
      setVentasCache(ventasRows);

      const { start, end } = rango6Meses(new Date());
      const rutSan = sanitizeRut(rutFiltro);

      const ventasFiltradas = ventasRows.filter((r) => {
        const fecha = parseDateLike(r.DocDate);
        if (!fecha) return false;
        if (rutSan) {
          const rv = sanitizeRut(String(r["Rut Cliente"] ?? ""));
          if (rv !== rutSan) return false;
        }
        return fecha >= start && fecha < end;
      });

      // Datos cliente base
      const ref = ventasFiltradas[0];
      if (ref) {
        setClienteNombre(String(ref["Nombre Cliente"] ?? ""));
        const dirBase = String(ref["Direccion"] ?? "").trim();
        const comuna = String(ref["Comuna"] ?? "").trim();
        const ciudad = String(ref["Ciudad"] ?? "").trim();
        setClienteDireccion([dirBase, comuna, ciudad].filter(Boolean).join(", "));
        const ej = String(ref["Èmpleado Ventas"] ?? ref["Empleado ventas"] ?? "").trim();
        setEjecutivoNombre(ej);
        setClienteCodigo(String(ref["Codigo Cliente"] ?? ref["odigo liente"] ?? ""));
      }

      // Agregado por producto (solo "PT")
      const agregados = new Map<string, HistRow>();
      for (const r of ventasFiltradas) {
        const rawCode = String(r.ItemCode ?? "").trim();
        if (!rawCode) continue;
        const code = rawCode.toUpperCase();
        if (!/PT/i.test(code)) continue;
        const name = String(r.Dscription ?? "").trim();
        const kg = num(r["Cantidad Kilos"]);
        const venta = num(r["Global Venta"]);
        if (!agregados.has(code)) {
          agregados.set(code, {
            code, name, kilos6m: 0, kgMes: 0, venta6m: 0, ventaMes: 0,
            precioPromKg: 0, margenDirectoPct: 0, mgn1$: 0, comodatoAsignado$: 0, mgn2$: 0, mgn2Pct: 0, mgn3$: 0, mgn3Pct: 0,
          });
        }
        const row = agregados.get(code)!;
        row.kilos6m += kg;
        row.venta6m += venta;
        if (!row.name) row.name = name;
      }

      let result: HistRow[] = [];
      for (const r of agregados.values()) {
        const item = catalog[r.code];
        const costoKg =
          item?.cost !== undefined && item?.cost !== null
            ? Number(item.cost)
            : usePriceListAsCost
            ? Number(item?.price_list ?? 0)
            : 0;
        const precioPromKg = r.kilos6m > 0 ? r.venta6m / r.kilos6m : 0;
        const margenDirectoPct = precioPromKg > 0 ? (precioPromKg - costoKg) / precioPromKg : 0;
        result.push({ ...r, kgMes: r.kilos6m / 6, ventaMes: r.venta6m / 6, precioPromKg, margenDirectoPct });
      }

      const venta6mTotal = result.reduce((a, x) => a + x.venta6m, 0);
      const ventaMesProm = venta6mTotal / 6;

      // Comodatos históricos
      const { id: cId, gid: cGid } = normalizeGoogleSheetUrl(comodatosUrl);
      if (!cId) throw new Error("URL de comodatos inválida.");
      const comodatos = (await loadSheetSmart(cId, cGid, "Comodatos")) as ComodatoRow[];
      const comCliente = comodatos.filter((r) => {
        if (!rutSan) return true;
        const rc = sanitizeRut(String(r["Rut Cliente"] ?? ""));
        return rc === rutSan;
      });

      const hoy = new Date();
      const contratoDefault = Math.max(1, Number(months || 1));
      const comodatosV: ComodatoView[] = comCliente.map((r) => {
        const code = String(r["Codigo Producto"] ?? "").trim().toUpperCase();
        const name = String(r["Producto"] ?? "").trim();
        const total = num(r.Total);
        const periodoDate = parsePeriodoToDate(r["Periodo"]);
        const periodoTexto = r["Periodo"]
          ? String(r["Periodo"])
          : periodoDate
          ? `${periodoDate.getFullYear()}-${String(periodoDate.getMonth() + 1).padStart(2, "0")}`
          : "—";
        let cuotasRestantes = contratoDefault;
        if (periodoDate) {
          const transcurridos = Math.max(0, diffMonths(periodoDate, hoy));
          cuotasRestantes = Math.max(0, contratoDefault - transcurridos);
        }
        const valorCuota = contratoDefault > 0 ? total / contratoDefault : total;
        return { code, name, total, contratoMeses: contratoDefault, cuotasRestantes, periodoTexto, valorCuota };
      });

      // Propuestos
      const proposedWithTotals = proposed
        .map((p) => ({
          ...p,
          qty: Math.max(0, Number(p.qty || 0)),
          unit: Math.max(0, Number(p.unit || 0)),
          contractMonths: Math.max(1, Number(p.contractMonths || months || 1)),
        }))
        .map((p) => ({ ...p, total: p.qty * p.unit, monthlyFee: (p.qty * p.unit) / p.contractMonths }));

      const comodatoMensualHistorico = comodatosV.reduce((a, r) => a + r.valorCuota, 0);
      const comodatoMensualPropuesto = proposedWithTotals.reduce((a, r) => a + r.monthlyFee, 0);
      const comodatoMensual = comodatoMensualHistorico + comodatoMensualPropuesto;

      const relacion = ventaMesProm > 0 ? comodatoMensual / ventaMesProm : 0;
      const comFinal = commissionPct * Math.max(0, 1 - relacion);

      const totalKgMes = result.reduce((a, r) => a + r.kgMes, 0);
      let sumVentaMes = 0;
      let sumMgn3 = 0;
      result = result.map((r) => {
        const mgn1 = r.ventaMes * r.margenDirectoPct;
        const comodatoAsig = totalKgMes > 0 ? (comodatoMensual / totalKgMes) * r.kgMes : 0;
        const mgn2 = mgn1 - comodatoAsig;
        const mgn2Pct = r.ventaMes > 0 ? mgn2 / r.ventaMes : 0;
        const mgn3 = mgn2 - comFinal * r.ventaMes;
        const mgn3Pct = r.ventaMes > 0 ? mgn3 / r.ventaMes : 0;
        sumVentaMes += r.ventaMes;
        sumMgn3 += mgn3;
        return { ...r, mgn1$: mgn1, comodatoAsignado$: comodatoAsig, mgn2$: mgn2, mgn2Pct, mgn3$: mgn3, mgn3Pct };
      });

      setHist6m(result.sort((a, b) => b.venta6m - a.venta6m));
      setPromVentaMensual6m(ventaMesProm);
      setComodatoMensual6m(comodatoMensual);
      setRelComVta6m(relacion);
      setCommissionFinal6m(comFinal);
      setComodatosView(comodatosV);
      setTotalVentaMes(sumVentaMes);
      setTotalMgn3(sumMgn3);
    } catch (e: any) {
      setLoadError(e?.message ?? "Error cargando datos");
    }
  }

  // Totales de cuota (propuestos)
  const cuotaVigenteTotal = comodatosView.reduce((a, r) => a + r.valorCuota, 0);
  const cuotaSimuladaTotal = proposed.reduce((a, r) => a + (r.monthlyFee || 0), 0);
  const nuevaCuotaTotal = cuotaVigenteTotal + cuotaSimuladaTotal;

  /* ---------- PDF (alineaciones + LOGO proporcional) ---------- */
  async function descargarPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const BLUE = { r: 31, g: 78, b: 216 }; // #1f4ed8
    const GREEN = { r: 22, g: 163, b: 74 };
    const RED = { r: 220, g: 38, b: 38 };

    const W = doc.internal.pageSize.getWidth();
    const M = 36; // margen
    let y = 0;

    // Header azul
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.rect(0, 0, W, 80, "F");
    y = 80;

    // Logo proporcional + Título
    let titleX = M + 140; // fallback si no hay logo
    if (logoUrl) {
      const img = await fetchImageAsDataURL(logoUrl);
      if (img) {
        const dims = await getImageSize(img.dataUrl);
        const MAX_W = 160;
        const MAX_H = 40;
        let drawW = 120;
        let drawH = 40;
        if (dims) {
          const ar = dims.w / dims.h;
          const boxAr = MAX_W / MAX_H;
          if (ar > boxAr) {
            drawW = MAX_W;
            drawH = MAX_W / ar;
          } else {
            drawH = MAX_H;
            drawW = MAX_H * ar;
          }
        }
        doc.addImage(img.dataUrl, img.format, M, 20, drawW, drawH);
        titleX = M + drawW + 24;
      }
    }
    // Título
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Solicitud Evaluación de Comodato", titleX, 45);
    doc.setTextColor(0, 0, 0);

    const drawSectionHeader = (title: string) => {
      doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.rect(M, y + 16, W - 2 * M, 24, "F");
      doc.text(title, M + 10, y + 33);
      doc.setTextColor(0, 0, 0);
      y += 16 + 24 + 8;
    };

    const drawKVTable = (rows: [string, string][]) => {
      const col1 = 120; // etiqueta más angosta => valores más a la izquierda
      const col2 = W - 2 * M - col1;
      const rowH = 18;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      rows.forEach(([k, v], idx) => {
        const py = y + idx * rowH;
        doc.line(M, py, W - M, py);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(k, M + 6, py + 13);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(v || "—", M + col1 + 6, py + 13, { maxWidth: col2 - 12 });
      });
      const endY = y + rows.length * rowH;
      doc.line(M, endY, W - M, endY);
      y = endY + 12;
    };

    const drawSimpleTable = (headers: string[], rows: (string | number)[][]) => {
      const tableW = W - 2 * M;
      const widths = [0.18, 0.42, 0.14, 0.13, 0.13].map((p) => Math.floor(tableW * p));
      // Header
      doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      let x = M; const th = 20;
      doc.rect(M, y, tableW, th, "F");
      headers.forEach((h, i) => { doc.text(h, x + 6, y + 13); x += widths[i]; });
      y += th;
      // Filas
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const rowH = 16;
      rows.forEach((r) => {
        let px = M;
        r.forEach((cell, i) => {
          const txt = typeof cell === "string" ? cell : String(cell ?? "");
          doc.text(txt, px + 6, y + 12, { maxWidth: widths[i] - 12 });
          px += widths[i];
        });
        y += rowH;
        if (y > 760) { doc.addPage(); y = 48; }
      });
      y += 8;
    };

    // ===== Datos del cliente =====
    drawSectionHeader("Datos del cliente");
    drawKVTable([
      ["Fecha", `${fechaEval}`],
      ["Cliente", `${clienteNombre || "—"}`],
      ["RUT", `${rutFiltro || "—"}`],
      ["Dirección", `${clienteDireccion || "—"}`],
      ["Ejecutivo", `${ejecutivoNombre || "—"}`],
    ]);

    // ===== KPIs =====
    drawSectionHeader("KPIs");
    drawKVTable([
      ["Prom. venta mensual ", money(promVentaMensual6m)],
      ["Comodato mensual ", money(comodatoMensual6m)],
      ["% Relación cdto/vta", pct(relComVta6m)],
      ["% Comisión final", pct(commissionFinal6m)],
    ]);

    // Estado
    const label = isViable ? "Viable" : "No viable";
    const color = isViable ? GREEN : RED;
    doc.setFillColor(color.r, color.g, color.b);
    doc.setTextColor(255, 255, 255);
    doc.rect(M, y, 160, 30, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`Estado: ${label}`, M + 10, y + 20);
    doc.setTextColor(0, 0, 0);
    y += 42;

    // ===== Evaluación en vivo =====
    drawSectionHeader("Evaluación en vivo — Nuevos equipos");
    const headers = ["Código", "Descripción", "Cantidad", "Valor unitario", "Valor total"];
    const rows = (proposed.length ? proposed : []).map((p) => [
      p.code || "", p.name || "", String(p.qty || 0), money(p.unit || 0), money(p.total || 0),
    ]);
    drawSimpleTable(headers, rows);

    const fname = `Solicitud_Comodato_${(clienteNombre || "Cliente").replace(/[^A-Za-z0-9_-]+/g, "_")}_${fechaEval}.pdf`;
    doc.save(fname);
    return fname;
  }

  function descargarYEnviar() {
    if (!isViable) {
      alert("Solo se envía por correo si el estado es Viable.");
      return;
    }
    descargarPdf().then(() => {
      const to = "patricia.acuna@spartan.cl";
      const subject = encodeURIComponent(`Solicitud Evaluación de Comodato — ${clienteNombre || "Cliente"}`);
      const body = encodeURIComponent("Estimada, se solicita gestionar VB a comodato. Saludos.");
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }

  /* ------- Limpiar para nuevo cliente ------- */
  function limpiarTodo() {
    setRutFiltro("");
    setClienteCodigo("");
    setClienteNombre("");
    setClienteDireccion("");
    setEjecutivoNombre("");
    setHist6m([]);
    setComodatosView([]);
    setProposed([]);
    setPromVentaMensual6m(0);
    setComodatoMensual6m(0);
    setRelComVta6m(0);
    setCommissionFinal6m(0);
    setTotalVentaMes(0);
    setTotalMgn3(0);
    setVentasCache(null);
    setClienteCodOptions([]);
    setShowAllVentas(false);
    setShowAllComodatos(false);
  }

  /* ============= UI ============= */
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header solicitado tal cual */}
      <header className="sticky top-0 z-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />
        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">Comodatos – Clientes Activos</h1>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded bg-white/20 text-white px-3 py-1 text-xs sm:text-sm hover:bg-white/30">⟵ Volver</Link>
          </div>
        </div>
      </header>

      {/* Datalist catálogo productos */}
      <datalist id={SUGGEST_ID}>
        {suggestions.map((o) => (
          <option key={o.code} value={o.code} label={`${o.code} — ${o.name}`} />
        ))}
      </datalist>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {loadError && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}

        {/* Fuentes (solo admin=1) */}
        {admin && (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">⚙️ Fuentes (Google Sheets)</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Ventas (últimos 6 meses)
                <input className="mt-1 w-full rounded border px-2 py-1" value={ventasUrl} onChange={(e) => setVentasUrl(e.target.value)} />
              </label>
              <label className="text-sm">
                Comodatos
                <input className="mt-1 w-full rounded border px-2 py-1" value={comodatosUrl} onChange={(e) => setComodatosUrl(e.target.value)} />
              </label>
              <label className="text-sm md:col-span-2">
                Catálogo (costos)
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input className="flex-1 rounded border px-2 py-1" value={catalogUrl} onChange={(e) => setCatalogUrl(e.target.value)} />
                  <label className="ml-2 inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={usePriceListAsCost} onChange={(e) => setUsePriceListAsCost(e.target.checked)} />
                    <span>Usar price_list si falta costo</span>
                  </label>
                </div>
              </label>
              <label className="text-sm md:col-span-2">
                Maestro clientes (SN)
                <input className="mt-1 w-full rounded border px-2 py-1" value={snUrl} onChange={(e) => setSnUrl(e.target.value)} />
              </label>
              <label className="text-sm md:col-span-2">
                Logo (URL imagen o data:image/png;base64,...)
                <input className="mt-1 w-full rounded border px-2 py-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png o data:..." />
                <label className="text-xs md:col-span-2">
  Subir logo (evita CORS)
  <input
    type="file"
    accept="image/*"
    className="mt-1 block w-full text-sm"
    onChange={(e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => setLogoUrl(String(reader.result)); // guarda como data URL
      reader.readAsDataURL(f);
    }}
  />
  <span className="text-[11px] text-zinc-500">
    Se guardará como Data URL para que siempre aparezca en el PDF.
  </span>
</label>

              </label>
            </div>
          </section>
        )}

        {/* Parámetros y búsqueda */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">📊 Evaluación de Comodatos</h2>

          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span>Fecha</span>
              <input type="date" className="w-40 rounded border px-2 py-1" value={fechaEval} onChange={(e) => setFechaEval(e.target.value)} />
            </label>

            {/* Código cliente — Dirección */}
            <label className="flex items-center gap-2">
              <span>Código cliente</span>
              {clienteCodOptions.length > 0 ? (
                <select
                  className="w-72 rounded border px-2 py-1"
                  value={clienteCodigo}
                  onChange={(e) => {
                    const code = e.target.value;
                    setClienteCodigo(code);
                    applyClienteOption(code);
                  }}
                >
                  {clienteCodOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.code} — {o.direccion || "s/dirección"}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-44 rounded border px-2 py-1"
                  placeholder="Ej: C01234"
                  value={clienteCodigo}
                  onChange={(e) => setClienteCodigo(e.target.value)}
                  onBlur={(e) => autofillByCodigoCliente(e.target.value)}
                />
              )}
            </label>

            <label className="flex items-center gap-2">
              <span>RUT</span>
              <input className="w-44 rounded border px-2 py-1" placeholder="Ej: 76.123.456-7" value={rutFiltro} onChange={(e) => setRutFiltro(e.target.value)} />
            </label>

            <label className="flex items-center gap-2">
              <span>Cliente</span>
              <input className="w-72 rounded border px-2 py-1 bg-zinc-50 text-zinc-600" placeholder="—" value={clienteNombre} readOnly />
            </label>

            <label className="flex items-center gap-2">
              <span>Dirección</span>
              <input className="w-[30rem] rounded border px-2 py-1 bg-zinc-50 text-zinc-600" placeholder="—" value={clienteDireccion} readOnly />
            </label>

            <label className="flex items-center gap-2">
              <span>Ejecutivo</span>
              <input className="w-60 rounded border px-2 py-1 bg-zinc-50 text-zinc-600" placeholder="—" value={ejecutivoNombre} readOnly />
            </label>

            <label className="flex items-center gap-2">
              <span>Meses contrato (def.)</span>
              <input type="number" min={1} className="w-24 rounded border px-2 py-1 text-right" value={months} onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))} />
            </label>

            <label className="flex items-center gap-2">
              <span>% Comisión base</span>
              <input type="number" step={0.001} className="w-24 rounded border px-2 py-1 text-right" value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} />
            </label>

            <button onClick={cargarHistorico6M} className="rounded bg-[#2B6CFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1F5AE6]">
              Buscar
            </button>
            <button onClick={limpiarTodo} className="rounded bg-zinc-200 px-3 py-2 text-xs hover:bg-zinc-300">
              Limpiar
            </button>
          </div>

          {/* KPIs compactos */}
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Prom. venta mensual (6m)</div>
              <div className="mt-1 text-lg font-semibold leading-tight">{money(promVentaMensual6m)}</div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Comodato mensual (H+P)</div>
              <div className="mt-1 text-lg font-semibold leading-tight">{money(comodatoMensual6m)}</div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">% Relación comodato/venta</div>
              <div className="mt-1 text-lg font-semibold leading-tight">{pct(relComVta6m)}</div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">% Comisión final</div>
              <div className="mt-1 text-lg font-semibold leading-tight">{pct(commissionFinal6m)}</div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Estado</div>
              <div className={`mt-1 inline-flex items-center rounded-xl px-4 py-2 text-xl font-extrabold ${isViable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {isViable ? "Viable" : "No viable"}
              </div>
            </div>
          </div>

          {/* Acciones PDF */}
          <div className="mt-4 flex gap-2">
            <button onClick={descargarPdf} className="rounded bg-zinc-200 px-3 py-2 text-xs hover:bg-zinc-300">Descargar PDF</button>
            <button onClick={descargarYEnviar} className={`rounded px-3 py-2 text-xs text-white ${isViable ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-400 cursor-not-allowed"}`}>
              Descargar y enviar (si Viable)
            </button>
          </div>
        </section>

        {/* Comodatos históricos */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">🧾 Comodatos históricos (cliente)</h2>
            {comodatosView.length > 5 && (
              <button className="text-xs underline" onClick={() => setShowAllComodatos((v) => !v)}>
                {showAllComodatos ? "Mostrar menos" : "Mostrar todos"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Valor total</th>
                  <th className="px-2 py-1 text-right">Contrato (meses)</th>
                  <th className="px-2 py-1 text-right">Restantes</th>
                  <th className="px-2 py-1 text-left">Instalación (Periodo)</th>
                  <th className="px-2 py-1 text-right">Valor cuota</th>
                </tr>
              </thead>
              <tbody>
                {comodatosView.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center text-zinc-500">Sin datos.</td></tr>}
                {(showAllComodatos ? comodatosView : comodatosView.slice(0, 5)).map((r, i) => (
                  <tr key={`${r.code}-${i}`} className="border-b">
                    <td className="px-2 py-1">{r.code}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1 text-right">{money(r.total)}</td>
                    <td className="px-2 py-1 text-right">{r.contratoMeses}</td>
                    <td className="px-2 py-1 text-right">{r.cuotasRestantes}</td>
                    <td className="px-2 py-1">{r.periodoTexto}</td>
                    <td className="px-2 py-1 text-right">{money(r.valorCuota)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ventas 6M (PT) */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">📈 Top productos (últimos 6 meses, prom. mensual)</h2>
            {hist6m.length > 5 && (
              <button className="text-xs underline" onClick={() => setShowAllVentas((v) => !v)}>
                {showAllVentas ? "Mostrar menos" : "Mostrar todos"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Total kilos</th>
                  <th className="px-2 py-1 text-right">Kg/mes</th>
                  <th className="px-2 py-1 text-right">Venta 6m</th>
                  <th className="px-2 py-1 text-right">Venta prom (mes)</th>
                  <th className="px-2 py-1 text-right">Precio venta kg</th>
                </tr>
              </thead>
              <tbody>
                {hist6m.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center text-zinc-500">Sin datos.</td></tr>}
                {(showAllVentas ? hist6m : hist6m.slice(0, 5)).map((r) => (
                  <tr key={r.code} className="border-b">
                    <td className="px-2 py-1">{r.code}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1 text-right">{r.kilos6m.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{r.kgMes.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-right">{money(r.venta6m)}</td>
                    <td className="px-2 py-1 text-right">{money(r.ventaMes)}</td>
                    <td className="px-2 py-1 text-right">{money(r.precioPromKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Comodatos a evaluar (nuevos) */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">➕ Evaluación en vivo — Nuevos equipos</h2>
            <div className="flex gap-2">
              <button className="rounded bg-zinc-100 px-3 py-1 text-xs" type="button" onClick={addProposed}>+ Equipo</button>
              <button className="rounded bg-[#2B6CFF] px-3 py-1 text-xs text-white hover:bg-[#1F5AE6]" type="button" onClick={cargarHistorico6M}>Recalcular</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Cantidad</th>
                  <th className="px-2 py-1 text-right">Valor unitario</th>
                  <th className="px-2 py-1 text-right">Valor total</th>
                  <th className="px-2 py-1 text-right">Contrato (meses)</th>
                  <th className="px-2 py-1 text-left">Instalación (Periodo)</th>
                  <th className="px-2 py-1 text-right">Valor cuota</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {proposed.length === 0 && <tr><td colSpan={9} className="px-2 py-4 text-center text-zinc-500">Sin equipos agregados.</td></tr>}
                {proposed.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1">
                      <input
                        list={SUGGEST_ID}
                        className="w-56 rounded border px-2 py-1"
                        placeholder="Código"
                        value={p.code}
                        onChange={(e) => { const val = e.target.value; updateProposed(i, { code: val }); refreshSuggestions(val); autocompleteFromCode(i, val); }}
                        onBlur={(e) => autocompleteFromCode(i, e.target.value)}
                        onFocus={(e) => refreshSuggestions(e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input className="w-64 rounded border px-2 py-1" value={p.name} onChange={(e) => updateProposed(i, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input type="number" min={0} className="w-24 rounded border px-2 py-1 text-right" value={p.qty} onChange={(e) => updateProposed(i, { qty: Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input type="number" min={0} className="w-32 rounded border px-2 py-1 text-right" value={p.unit} onChange={(e) => updateProposed(i, { unit: Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1 text-right">{money(p.total)}</td>
                    <td className="px-2 py-1 text-right">
                      <input type="number" min={1} className="w-28 rounded border px-2 py-1 text-right" value={p.contractMonths} onChange={(e) => updateProposed(i, { contractMonths: Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="month" className="rounded border px-2 py-1" value={p.period} onChange={(e) => updateProposed(i, { period: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 text-right">{money(p.monthlyFee)}</td>
                    <td className="px-2 py-1 text-right">
                      <button className="text-xs text-red-600" onClick={() => removeProposed(i)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumen de cuota */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-5 shadow-sm">
              <div className="text-xs text-zinc-500">Cuota vigente</div>
              <div className="text-2xl font-semibold">{money(cuotaVigenteTotal)}</div>
            </div>
            <div className="rounded-2xl border p-5 shadow-sm">
              <div className="text-xs text-zinc-500">Cuota simulada</div>
              <div className="text-2xl font-semibold">{money(cuotaSimuladaTotal)}</div>
            </div>
            <div className="rounded-2xl border p-5 shadow-sm">
              <div className="text-xs text-zinc-500">Nueva cuota</div>
              <div className="text-2xl font-semibold">{money(nuevaCuotaTotal)}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
