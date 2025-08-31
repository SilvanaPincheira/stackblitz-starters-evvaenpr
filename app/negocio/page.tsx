"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ===================== CONFIG ===================== */
const DEFAULT_CATALOG_URL =
  "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=0#gid=0";
const DEFAULT_LOGO =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";
const SUGGEST_ID = "catalog-suggest";
const VIABILITY_THRESHOLD = 0.005; // 0,50%

/* ===================== HELPERS ===================== */
function money(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function pct(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial as T;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : (initial as T);
  });
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

/* === CSV + GViz === */
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
  const csvUrl = id
    ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
    : "";
  return { id, gid, csvUrl };
}

/* === Img a dataURL (PDF) === */
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
async function getImageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}

/* ===================== TIPOS ===================== */
type CatalogItem = { code: string; name: string; price_list?: number; cost?: number; kilos?: number };
type SaleLine = { code: string; name: string; kilos: number; qty: number; priceKg: number; priceListaKg?: number; costKg?: number };
type ComLine = { code: string; name: string; priceContract: number; qty: number };

/* ===================== COMPONENTE ===================== */
export default function Page() {
  // Roles por URL: admin=2 (Administradora), admin=1 (Gerencia), sin parámetro (Usuario)
  const [adminLevel, setAdminLevel] = useState<number>(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const val = u.searchParams.get("admin");
    const lvl = val ? Number(val) : 0;
    setAdminLevel(Number.isFinite(lvl) ? Math.max(0, Math.min(2, Math.trunc(lvl))) : 0);
  }, []);

  // URLs (persisten)
  const [catalogUrl, setCatalogUrl] = useLocalStorage("eval.catalog.url", DEFAULT_CATALOG_URL);
  const [logoUrl, setLogoUrl] = useLocalStorage("eval.pdf.logoUrl", DEFAULT_LOGO);

  // Datos cliente
  const [fechaEval, setFechaEval] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  });
  const [clienteNombre, setClienteNombre] = useLocalStorage("eval.cliente.nombre", "");
  const [rut, setRut] = useLocalStorage("eval.cliente.rut", "");
  const [direccion, setDireccion] = useLocalStorage("eval.cliente.dir", "");
  const [ejecutivo, setEjecutivo] = useLocalStorage("eval.cliente.ej", "");

  // Parámetros
  const [months, setMonths] = useLocalStorage<number>("eval.meses", 24);
  const [commissionPct, setCommissionPct] = useLocalStorage<number>("eval.com.base", 0.105); // base

  // Catálogo y sugerencias
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({});
  type Option = { code: string; name: string; kilos: number; price: number; cost?: number };
  const options: Option[] = useMemo(
    () =>
      Object.values(catalog)
        .map((c) => ({
          code: c.code,
          name: c.name,
          kilos: num(c.kilos ?? 1),
          price: num(c.price_list ?? 0),
          cost: c.cost !== undefined ? num(c.cost) : undefined,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [catalog]
  );
  const mapByCode = useMemo(() => {
    const m = new Map<string, Option>();
    for (const o of options) m.set(o.code.toUpperCase(), o);
    return m;
  }, [options]);

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
            // Aceptar múltiples encabezados posibles para precio lista
            price_list: num(
              r.price_list ?? r["price_list"] ?? r.PrecioLista ?? r["Precio Lista"] ?? r.Precio ?? r["Precio"]
            ),
            // Aceptar variantes de costo si existen
            cost: (r.cost ?? r.Costo ?? r["Costo"]) !== undefined ? num(r.cost ?? r.Costo ?? r["Costo"]) : undefined,
            kilos: r.kilos !== undefined ? num(r.kilos) : 1,
          };
        }
        setCatalog(map);
      } catch (e) {
        // no-op si no hay catálogo accesible
      }
    })();
  }, [catalogUrl]);

  // Líneas
  const [sales, setSales] = useLocalStorage<SaleLine[]>("eval.ventas", []);
  const [comodatos, setComodatos] = useLocalStorage<ComLine[]>("eval.comodatos", []);

  function addSale() {
    setSales([...sales, { code: "", name: "", kilos: 1, qty: 1, priceKg: 0 }]);
  }
  function addCom() {
    setComodatos([...comodatos, { code: "", name: "", priceContract: 0, qty: 1 }]);
  }
  function rmSale(i: number) { const n = [...sales]; n.splice(i, 1); setSales(n); }
  function rmCom(i: number) { const n = [...comodatos]; n.splice(i, 1); setComodatos(n); }

  function fillFromCode(i: number, code: string) {
    const o = mapByCode.get(code.trim().toUpperCase());
    if (!o) return;
    const n = [...sales];
    n[i].code = o.code;
    n[i].name = o.name;
    n[i].kilos = o.kilos || 1;
    n[i].priceListaKg = o.price || 0; // precio lista desde catálogo
    if (n[i].priceKg === 0) n[i].priceKg = o.price || 0; // precio venta $/kg para el cliente
    if (o.cost !== undefined) n[i].costKg = o.cost;
    setSales(n);
  }
  function fillComFromCode(i: number, code: string) {
    const o = mapByCode.get(code.trim().toUpperCase());
    if (!o) return;
    const n = [...comodatos];
    n[i].code = o.code;
    n[i].name = o.name;
    if (n[i].priceContract === 0) n[i].priceContract = o.price || 0;
    setComodatos(n);
  }

  /* ===================== CÁLCULOS ===================== */
  const calc = useMemo(() => {
    // 0) Métricas por línea de producto
    const lines = sales.map((l) => {
      const kilosMes = (l.qty || 0) * (l.kilos || 1);
      const venta = (l.priceKg || 0) * kilosMes; // Precio venta mensual por fila (usa $/kg del cliente)
      const costKg = l.costKg !== undefined ? Number(l.costKg) : 0;
      const costo = (costKg || 0) * kilosMes;
      const mgnDirecto = venta - costo; // $
      const mgnDirPct = venta > 0 ? mgnDirecto / venta : 0;
      return { ...l, kilosMes, venta, costKg, costo, mgnDirecto, mgnDirPct, priceListaKg: l.priceListaKg ?? 0 };
    });

    const ventaTotal = lines.reduce((a, r) => a + r.venta, 0);

    // 1) Total Comodato (contrato) y Comodato mensual (prorrateado)
    const totalComodato = comodatos.reduce((a, r) => a + (r.priceContract || 0) * (r.qty || 0), 0);
    const comodatoMensual = months > 0 ? totalComodato / months : 0;

    // 2) Relación comodato/venta (global)
    const rel = ventaTotal > 0 ? comodatoMensual / ventaTotal : 0;

    // 3) Reparto del comodato POR KILOS
    const totalKilos = lines.reduce((a, r) => a + r.kilosMes, 0);

    // 4) Márgenes y comisión final por fila
    const withMgn = lines.map((r) => {
      const cdtoAsignado = totalKilos > 0 ? (r.kilosMes / totalKilos) * comodatoMensual : 0;
      // Comisión final según instrucción: comisión base * (1 - %relación cdto/venta)
      const comision = commissionPct * (1 - rel) * r.venta;
      const mgn2 = r.mgnDirecto - cdtoAsignado; // Mgn $ (2)
      const mgn2Pct = r.venta > 0 ? mgn2 / r.venta : 0; // Mgn % (2)
      const mgn3 = mgn2 - comision; // Mgn Final $ (3)
      const mgn3Pct = r.venta > 0 ? mgn3 / r.venta : 0; // Mgn Final % (3)
      return { ...r, cdtoAsignado, comision, mgn2, mgn2Pct, mgn3, mgn3Pct };
    });

    const mgn3Total = withMgn.reduce((a, r) => a + r.mgn3, 0);
    const comisionTotal = withMgn.reduce((a, r) => a + r.comision, 0);
    const mgnFinalPct = ventaTotal > 0 ? mgn3Total / ventaTotal : 0; // Viabilidad global

    return {
      lines: withMgn,
      ventaTotal,
      totalComodato,
      comodatoMensual,
      rel,
      mgnFinalPct,
      comFinalPct: ventaTotal > 0 ? comisionTotal / ventaTotal : 0,
    };
  }, [sales, comodatos, commissionPct, months]);

  const isViable = calc.mgnFinalPct >= VIABILITY_THRESHOLD;

  /* ===================== PDF ===================== */
  async function descargarPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const BLUE = { r: 31, g: 78, b: 216 }; // #1f4ed8
    const GREEN = { r: 22, g: 163, b: 74 };
    const RED = { r: 220, g: 38, b: 38 };

    const W = doc.internal.pageSize.getWidth();
    const M = 36; // margen
    let y = 0;

    // Header azul con logo a la izquierda y título a la derecha del logo
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.rect(0, 0, W, 80, "F");
    y = 80;

    let titleX = M + 140;
    if (logoUrl) {
      const img = await fetchImageAsDataURL(logoUrl);
      if (img) {
        const dims = await getImageSize(img.dataUrl);
        const MAX_W = 160;
        const MAX_H = 40; // altura fija aprox
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
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Evaluación de Negocio", titleX, 45);
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
      const col1 = 110;
      const col2 = W - 2 * M - col1;
      const rowH = 16;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      rows.forEach(([k, v], idx) => {
        const py = y + idx * rowH;
        doc.line(M, py, W - M, py);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(k, M + 4, py + 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(v || "—", M + col1 + 4, py + 12, { maxWidth: col2 - 8 });
      });
      const endY = y + rows.length * rowH;
      doc.line(M, endY, W - M, endY);
      y = endY + 10;
    };

    const drawSimpleTable = (headers: string[], rows: (string | number)[][], widthsPct: number[]) => {
      const tableW = W - 2 * M;
      const widths = widthsPct.map((p) => Math.floor(tableW * p));
      doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      let x = M;
      const th = 18;
      doc.rect(M, y, tableW, th, "F");
      headers.forEach((h, i) => {
        doc.text(h, x + 4, y + 12);
        x += widths[i];
      });
      y += th;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const rowH = 14;
      rows.forEach((r) => {
        let px = M;
        r.forEach((cell, i) => {
          const txt = typeof cell === "string" ? cell : String(cell ?? "");
          doc.text(txt, px + 4, y + 11, { maxWidth: widths[i] - 8 });
          px += widths[i];
        });
        y += rowH;
        if (y > 760) {
          doc.addPage();
          y = 48;
        }
      });
      y += 6;
    };

    // ===== Datos del cliente =====
    drawSectionHeader("Datos del cliente");
    drawKVTable([
      ["Fecha", `${fechaEval}`],
      ["Cliente", `${clienteNombre || "—"}`],
      ["RUT", `${rut || "—"}`],
      ["Dirección", `${direccion || "—"}`],
      ["Ejecutivo", `${ejecutivo || "—"}`],
    ]);

    // ===== KPIs =====
    drawSectionHeader("KPIs");
    drawKVTable([
      ["Venta mensual", money(calc.ventaTotal)],
      ["Comodato mensual", money(calc.comodatoMensual)],
      ["Meses contrato", String(months)],
      ["% Comisión base", pct(commissionPct)],
      ["% Relación cdto/vta", pct(calc.rel)],
      ["% Comisión final", pct(calc.comFinalPct)],
    ]);

    // Estado
    const label = isViable ? "Viable" : "No viable";
    const color = isViable ? GREEN : RED;
    doc.setFillColor(color.r, color.g, color.b);
    doc.setTextColor(255, 255, 255);
    doc.rect(M, y, 260, 30, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Estado: ${label}`, M + 10, y + 20);
    doc.setTextColor(0, 0, 0);
    y += 42;

    // ===== Productos (venta mensual) =====
    drawSectionHeader("Productos (venta mensual)");
    const prodHeaders = ["Código", "Descripción", "Cant.", "Precio venta $/kg", "Precio lista $/kg", "Subtotal"];
    const prodRows = (calc.lines.length ? calc.lines : []).map((r) => [
      r.code || "",
      r.name || "",
      String(r.qty || 0),
      money(r.priceKg || 0),
      money(r.priceListaKg || 0),
      money(r.venta || 0),
    ]);
    drawSimpleTable(prodHeaders, prodRows, [0.18, 0.38, 0.1, 0.12, 0.12, 0.1]);

    // ===== Equipos en comodato (contrato) =====
    drawSectionHeader("Equipos en comodato (contrato)");
    const comHeaders = ["Código", "Descripción", "Precio $/contrato", "Cant.", "Total contrato"];
    const comRows = (comodatos.length ? comodatos : []).map((l) => [
      l.code || "",
      l.name || "",
      money(l.priceContract || 0),
      String(l.qty || 0),
      money((l.priceContract || 0) * (l.qty || 0)),
    ]);
    drawSimpleTable(comHeaders, comRows, [0.18, 0.42, 0.16, 0.1, 0.14]);

    // Totales comodato
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Comodato contrato total: ${money(calc.totalComodato)}`, M, y + 8);
    doc.text(`Comodato mensual: ${money(calc.comodatoMensual)}`, M + 260, y + 8);

    const fname = `Evaluacion_${(clienteNombre || "Cliente")
      .replace(/[^A-Za-z0-9_-]+/g, "_")}_${fechaEval}.pdf`;
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
      const subject = encodeURIComponent(
        `Evaluación de Negocio — ${clienteNombre || "Cliente"}`
      );
      const body = encodeURIComponent(
        "Estimada, se solicita gestionar VB a comodato. Saludos."
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }

  function limpiarTodo() {
    setClienteNombre("");
    setRut("");
    setDireccion("");
    setEjecutivo("");
    setSales([]);
    setComodatos([]);
  }

  /* ============= UI ============= */
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />
        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
            <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">
              Evaluación de Negocio
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {adminLevel > 0 && (
              <span className="rounded bg-white/20 px-2 py-1 text-xs text-white">
                {adminLevel === 2 ? "Administradora" : "Gerencia"}
              </span>
            )}
            <Link
              href="/"
              className="rounded bg-white/20 text-white px-3 py-1 text-xs sm:text-sm hover:bg-white/30"
            >
              ⟵ Volver
            </Link>
          </div>
        </div>
      </header>

      {/* Datalist catálogo productos */}
      <datalist id={SUGGEST_ID}>
        {options.map((o) => (
          <option key={o.code} value={o.code} label={`${o.code} — ${o.name}`} />
        ))}
      </datalist>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Config (solo Administradora) */}
        {adminLevel === 2 && (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">⚙️ Configuración</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                Catálogo
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={catalogUrl}
                  onChange={(e) => setCatalogUrl(e.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                Logo PDF (URL o data:)
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </label>
            </div>

            {/* Subcálculos visibles solo en Configuración (Admin) */}
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">🔎 Subcálculos por producto</h3>
              {calc.lines.length === 0 ? (
                <div className="text-xs text-zinc-500">Sin productos.</div>
              ) : (
                <div className="space-y-2">
                  {calc.lines.map((r, i) => (
                    <div key={`sub-${i}`} className="rounded border p-2 text-[12px]">
                      <div className="font-medium">{r.code} — {r.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded border px-2 py-1">Kilos/mes: <b>{r.kilosMes.toLocaleString("es-CL")}</b></span>
                        <span className="rounded border px-2 py-1">Costo total: <b>{money(r.costo)}</b></span>
                        <span className="rounded border px-2 py-1">Mgn dir %: <b>{pct(r.mgnDirPct)}</b></span>
                        <span className="rounded border px-2 py-1">Cdto asignado: <b>{money(r.cdtoAsignado)}</b></span>
                        <span className="rounded border px-2 py-1">Mgn (2) %: <b>{pct(r.mgn2Pct)}</b></span>
                        <span className="rounded border px-2 py-1">Mgn final: <b>{pct(r.mgn3Pct)}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Parámetros + Cliente */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">📊 Parámetros y Cliente</h2>

          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span>Fecha</span>
              <input
                type="date"
                className="w-40 rounded border px-2 py-1"
                value={fechaEval}
                onChange={(e) => setFechaEval(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>RUT</span>
              <input
                className="w-40 rounded border px-2 py-1"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Cliente</span>
              <input
                className="w-72 rounded border px-2 py-1"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Dirección</span>
              <input
                className="w-[30rem] rounded border px-2 py-1"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Ejecutivo</span>
              <input
                className="w-60 rounded border px-2 py-1"
                value={ejecutivo}
                onChange={(e) => setEjecutivo(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Meses contrato</span>
              <input
                type="number"
                min={1}
                className="w-24 rounded border px-2 py-1 text-right"
                value={months}
                onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>% Comisión base</span>
              <input
                type="number"
                step={0.001}
                className="w-24 rounded border px-2 py-1 text-right"
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
              />
            </label>

            {/* Campo de solo lectura al lado de comisión base */}
            <label className="flex items-center gap-2">
              <span>% Comisión final</span>
              <input
                className="w-24 rounded border px-2 py-1 text-right bg-zinc-50"
                readOnly
                value={pct(calc.comFinalPct)}
              />
            </label>

            <button
              onClick={limpiarTodo}
              className="rounded bg-zinc-200 px-3 py-2 text-xs hover:bg-zinc-300"
            >
              Limpiar
            </button>
          </div>

          {/* KPIs */}
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Venta mensual</div>
              <div className="mt-1 text-lg font-semibold leading-tight">
                {money(calc.ventaTotal)}
              </div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Comodato contrato total</div>
              <div className="mt-1 text-lg font-semibold leading-tight">
                {money(calc.totalComodato)}
              </div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Comodato mensual</div>
              <div className="mt-1 text-lg font-semibold leading-tight">
                {money(calc.comodatoMensual)}
              </div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">% Relación comodato/venta</div>
              <div className="mt-1 text-lg font-semibold leading-tight">
                {pct(calc.rel)}
              </div>
            </div>
            <div className="rounded-2xl border p-3 shadow-sm">
              <div className="text-[11px] leading-none text-zinc-500">Estado</div>
              <div
                className={`mt-1 inline-flex items-center rounded-xl px-4 py-2 text-xl font-extrabold ${
                  isViable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {isViable ? "Viable" : "No viable"}
              </div>
            </div>
          </div>

          {/* Acciones PDF */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={descargarPdf}
              className="rounded bg-zinc-200 px-3 py-2 text-xs hover:bg-zinc-300"
            >
              Descargar PDF
            </button>
            <button
              onClick={descargarYEnviar}
              className={`rounded px-3 py-2 text-xs text-white ${
                isViable ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-400 cursor-not-allowed"
              }`}
            >
              Descargar y enviar (si Viable)
            </button>
          </div>
        </section>

        {/* Productos */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">📦 Productos — Venta mensual</h2>
            <div className="flex gap-2">
              <button
                className="rounded bg-zinc-100 px-3 py-1 text-xs"
                type="button"
                onClick={addSale}
              >
                + Producto
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Cant. (pres/mes)</th>
                  <th className="px-2 py-1 text-right">Precio venta $/kg</th>
                  <th className="px-2 py-1 text-right">Precio lista $/kg</th>
                  <th className="px-2 py-1 text-right">Subtotal venta</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-center text-zinc-500">
                      Sin productos agregados.
                    </td>
                  </tr>
                )}
                {calc.lines.map((r, i) => (
                  <React.Fragment key={i}>
                    {/* Fila de producto */}
                    <tr className="border-b align-top">
                      <td className="px-2 py-1">
                        <input
                          list={SUGGEST_ID}
                          className="w-44 rounded border px-2 py-1"
                          placeholder="Código"
                          value={sales[i].code}
                          onChange={(e) => {
                            const val = e.target.value;
                            const n = [...sales];
                            n[i].code = val.toUpperCase();
                            setSales(n);
                          }}
                          onBlur={(e) => fillFromCode(i, e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-64 rounded border px-2 py-1"
                          value={sales[i].name}
                          onChange={(e) => {
                            const n = [...sales];
                            n[i].name = e.target.value;
                            setSales(n);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-28 rounded border px-2 py-1 text-right"
                          value={sales[i].qty}
                          onChange={(e) => {
                            const n = [...sales];
                            n[i].qty = Number(e.target.value);
                            setSales(n);
                          }}
                        />
                      </td>
                      {/* Precio venta $/kg (editable) */}
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-28 rounded border px-2 py-1 text-right"
                          value={sales[i].priceKg}
                          onChange={(e) => {
                            const n = [...sales];
                            n[i].priceKg = Number(e.target.value);
                            setSales(n);
                          }}
                        />
                      </td>
                      {/* Precio lista $/kg (solo lectura, desde catálogo) */}
                      <td className="px-2 py-1 text-right">{money(sales[i].priceListaKg ?? 0)}</td>
                      {/* Subtotal (venta) */}
                      <td className="px-2 py-1 text-right">{money(r.venta)}</td>
                      <td className="px-2 py-1 text-right">
                        <button className="text-xs text-red-600" onClick={() => rmSale(i)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>

                    {/* Subcálculos debajo de cada código (incluye Kilos/mes) */}
                    {adminLevel === 2 && (
                    <tr className="bg-zinc-50">$1</tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Comodatos (contrato) */}
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">🛠️ Equipos en comodato (contrato)</h2>
            <div className="flex gap-2">
              <button className="rounded bg-zinc-100 px-3 py-1 text-xs" type="button" onClick={addCom}>
                + Equipo
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Precio $/contrato</th>
                  <th className="px-2 py-1 text-right">Cantidad</th>
                  <th className="px-2 py-1 text-right">Total contrato</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {comodatos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-zinc-500">
                      Sin equipos agregados.
                    </td>
                  </tr>
                )}
                {comodatos.map((l, i) => {
                  const total = (l.priceContract || 0) * (l.qty || 0);
                  return (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-1">
                        <input
                          list={SUGGEST_ID}
                          className="w-44 rounded border px-2 py-1"
                          placeholder="Código"
                          value={l.code}
                          onChange={(e) => {
                            const val = e.target.value;
                            const n = [...comodatos];
                            n[i].code = val.toUpperCase();
                            setComodatos(n);
                          }}
                          onBlur={(e) => fillComFromCode(i, e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-64 rounded border px-2 py-1"
                          value={l.name}
                          onChange={(e) => {
                            const n = [...comodatos];
                            n[i].name = e.target.value;
                            setComodatos(n);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-28 rounded border px-2 py-1 text-right"
                          value={l.priceContract}
                          onChange={(e) => {
                            const n = [...comodatos];
                            n[i].priceContract = Number(e.target.value);
                            setComodatos(n);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-24 rounded border px-2 py-1 text-right"
                          value={l.qty}
                          onChange={(e) => {
                            const n = [...comodatos];
                            n[i].qty = Number(e.target.value);
                            setComodatos(n);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">{money(total)}</td>
                      <td className="px-2 py-1 text-right">
                        <button className="text-xs text-red-600" onClick={() => rmCom(i)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {comodatos.length > 0 && (
                <tfoot>
                  <tr className="bg-zinc-50 font-semibold">
                    <td className="px-2 py-1" colSpan={4}>Comodato contrato total</td>
                    <td className="px-2 py-1 text-right">{money(calc.totalComodato)}</td>
                    <td />
                  </tr>
                  <tr className="bg-zinc-50">
                    <td className="px-2 py-1" colSpan={4}>Comodato mensual</td>
                    <td className="px-2 py-1 text-right">{money(calc.comodatoMensual)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}


