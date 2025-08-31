"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* =================== CONFIG =================== */
const SHEETS = {
  clientesCSV:
    "https://docs.google.com/spreadsheets/d/1kF0INEtwYDXhQCBPTVhU8NQI2URKoi99Hs43DTSO02I/export?format=csv&gid=161671364",
  catalogCSV:
    "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/export?format=csv&gid=0",
};

const BRAND = {
  name: "Spartan de Chile Ltda.",
  rut: "76.333.980-7",
  logo: "https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0",
  website: "https://www.spartan.cl",
  colors: { brandBlue: "#0B5FFF" },
};

/* =================== TIPOS =================== */
type SheetRow = Record<string, string>;
type QuoteItem = {
  code?: string;
  description: string;
  kilos?: number;
  qty: number;
  unitPrice: number;
  discountPct?: number;
};
type Party = {
  name: string;
  rut?: string;
  address?: string;
  clientCode?: string;
  condicionPago?: string;
  giro?: string;
};
type QuoteData = {
  number: string;
  dateISO: string;
  validity: string;
  client: Party;
  issuer: Party & { paymentTerms?: string; contact?: string; email?: string; phone?: string };
  items: QuoteItem[];
  taxPct?: number;
};

/* =================== HELPERS =================== */
const money = (n: number) =>
  (n || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
function toNumber(v?: string): number {
  return (
    Number(
      (v || "")
        .replace(/[^0-9,.-]/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(/,/, ".")
    ) || 0
  );
}

/* =================== PARSERS =================== */
function parseCSV(text: string): SheetRow[] {
  const rows = text.split(/\r?\n/).map((r) => r.split(","));
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o: SheetRow = {};
    header.forEach((h, i) => (o[h] = r[i] || ""));
    return o;
  });
}

/* =================== FETCH =================== */
async function fetchClientesAll(): Promise<SheetRow[]> {
  try {
    const r = await fetch(SHEETS.clientesCSV);
    if (r.ok) return parseCSV(await r.text());
  } catch {}
  return [];
}
async function fetchCatalogCSV(): Promise<SheetRow[]> {
  try {
    const r = await fetch(SHEETS.catalogCSV);
    if (r.ok) return parseCSV(await r.text());
  } catch {}
  return [];
}

/* =================== MAP =================== */
function mapCliente(r: SheetRow): Party {
  return {
    name: r["CardName"] || "",
    rut: r["RUT"] || "",
    clientCode: r["CardCode"] || "",
    address: [r["Direccion Despacho"], r["Despacho Comuna"], r["Despacho Ciudad"]]
      .filter(Boolean)
      .join(", "),
    condicionPago: r["Condicion pago"] || "",
    giro: r["Giro"] || "",
  };
}
function mapCatalogItem(r: SheetRow): QuoteItem {
  return {
    code: r["code"] || "",
    description: r["name"] || "",
    kilos: toNumber(r["kilos"]),
    qty: 1,
    unitPrice: toNumber(r["price_list"]),
    discountPct: 0,
  };
}

/* =================== DEFAULT =================== */
const DEFAULT_QUOTE: QuoteData = {
  number: "CTZ-2025-00001",
  dateISO: todayISO(),
  validity: "10 días",
  client: { name: "" },
  issuer: {
    name: BRAND.name,
    rut: BRAND.rut,
    address: "Alameda 1001, Santiago",
    paymentTerms: "30 días • Transferencia",
    contact: "",
    email: "",
    phone: "",
  },
  items: [],
  taxPct: 19,
};

/* =================== COMPONENTE =================== */
export default function CotizacionEjecutivaSheets({
  initial = DEFAULT_QUOTE,
}: {
  initial?: QuoteData;
}) {
  const [data, setData] = useState<QuoteData>(initial);
  const [clientes, setClientes] = useState<SheetRow[]>([]);
  const [catalogo, setCatalogo] = useState<SheetRow[]>([]);
  const [rutToken, setRutToken] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    (async () => {
      setClientes(await fetchClientesAll());
      setCatalogo(await fetchCatalogCSV());
    })();
  }, []);

  const totals = useMemo(() => {
    const rows = data.items.map((it) => {
      const precioVenta = (it.unitPrice || 0) * (1 - (it.discountPct || 0) / 100);
      return { sub: (it.kilos || 0) * (it.qty || 0) * precioVenta };
    });
    const subtotal = rows.reduce((a, r) => a + r.sub, 0);
    const tax = subtotal * ((data.taxPct ?? 19) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [data]);

  function setItem(i: number, p: Partial<QuoteItem>) {
    setData((s) => {
      const n = { ...s };
      n.items = [...s.items];
      n.items[i] = { ...n.items[i], ...p };
      return n;
    });
  }
  function addItem() {
    setData((s) => ({
      ...s,
      items: [
        ...s.items,
        { code: "", description: "", kilos: 0, qty: 1, unitPrice: 0, discountPct: 0 },
      ],
    }));
  }
  function removeItem(i: number) {
    setData((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }));
  }
  function printNow() {
    window.print();
  }
  function clearCliente() {
    setData((s) => ({ ...s, client: { name: "" } }));
    setRutToken("");
  }

  function handleSelectCliente(row: SheetRow) {
    const picked = mapCliente(row);
    setData((s) => ({ ...s, client: { ...s.client, ...picked } }));
    setRutToken(`${picked.rut} — ${picked.name}`);
    setShowSuggestions(false);
  }

  function autofillFromCatalog(i: number, token: string) {
    const raw = token.trim();
    const codeFromToken = raw.includes("—") ? raw.split("—")[0].trim() : raw;
    const findRow =
      catalogo.find((r) => normalize(r["code"] || "") === normalize(codeFromToken)) ||
      catalogo.find((r) => normalize(r["name"] || "") === normalize(raw)) ||
      catalogo.find((r) => normalize(r["code"] || "").startsWith(normalize(raw))) ||
      catalogo.find((r) => normalize(r["name"] || "").startsWith(normalize(raw))) ||
      catalogo.find(
        (r) =>
          normalize(r["code"] || "").includes(normalize(raw)) ||
          normalize(r["name"] || "").includes(normalize(raw))
      );
    if (!findRow) return;
    const item = mapCatalogItem(findRow);
    setItem(i, { ...item, qty: data.items[i]?.qty ?? 1 });
  }

  const filteredClientes = useMemo(() => {
    if (!rutToken) return [];
    const normQ = normalize(rutToken);
    return clientes
      .filter((r) => {
        const rut = normalize(r["RUT"] || "");
        const name = normalize(r["CardName"] || "");
        return rut.includes(normQ) || name.includes(normQ);
      })
      .slice(0, 50);
  }, [rutToken, clientes]);

  return (
    <>
      {/* SOLO imprimiremos #printArea */}
      <div id="printArea" className="p-6 text-[13px] bg-white relative min-h-screen">
        {/* Encabezado */}
        <header className="border-b pb-2 mb-4 flex justify-between items-center">
          <img src={BRAND.logo} alt="Logo" className="h-16" />
          <h1 className="text-blue-700 font-bold text-xl">COTIZACIÓN</h1>
          <div className="text-xs text-right bg-zinc-100 p-2 rounded">
            <div>N° {data.number}</div>
            <div>{data.dateISO}</div>
            <div>{data.validity}</div>
          </div>
        </header>

        {/* Cliente y Emisor */}
        <section className="grid grid-cols-2 gap-6 border-b pb-4 mb-4">
          {/* Cliente */}
          <Card title="Cliente">
            <div className="relative mb-2">
              <input
                placeholder="Escriba RUT o Nombre..."
                value={rutToken}
                onChange={(e) => {
                  setRutToken(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full border px-2 py-1"
              />
              <button
                onClick={clearCliente}
                className="absolute right-1 top-1 text-xs bg-red-100 border px-1"
              >
                X
              </button>
              {showSuggestions && filteredClientes.length > 0 && (
                <ul className="absolute z-10 bg-white border w-full max-h-64 overflow-y-auto text-xs">
                  {filteredClientes.map((r, i) => (
                    <li
                      key={i}
                      className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                      onClick={() => handleSelectCliente(r)}
                    >
                      {r["RUT"]} — {r["CardName"]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Field label="Razón Social">
              <input
                value={data.client.name || ""}
                onChange={(e) =>
                  setData((s) => ({ ...s, client: { ...s.client, name: e.target.value } }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Código Cliente">
              <input
                value={data.client.clientCode || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    client: { ...s.client, clientCode: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Dirección">
              <textarea
                value={data.client.address || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    client: { ...s.client, address: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Condición Pago">
              <input
                value={data.client.condicionPago || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    client: { ...s.client, condicionPago: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Giro">
              <input
                value={data.client.giro || ""}
                onChange={(e) =>
                  setData((s) => ({ ...s, client: { ...s.client, giro: e.target.value } }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
          </Card>

          {/* Emisor */}
          <Card title="Emisor">
            <Field label="Empresa">{data.issuer.name}</Field>
            <Field label="RUT">{data.issuer.rut}</Field>
            <Field label="Dirección">{data.issuer.address}</Field>
            <Field label="Ejecutivo">
              <input
                value={data.issuer.contact || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    issuer: { ...s.issuer, contact: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={data.issuer.email || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    issuer: { ...s.issuer, email: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Celular">
              <input
                value={data.issuer.phone || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    issuer: { ...s.issuer, phone: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
            <Field label="Forma de Pago">
              <input
                value={data.issuer.paymentTerms || ""}
                onChange={(e) =>
                  setData((s) => ({
                    ...s,
                    issuer: { ...s.issuer, paymentTerms: e.target.value },
                  }))
                }
                className="w-full border px-2 py-1"
              />
            </Field>
          </Card>
        </section>

        {/* Intro Productos */}
        <p className="mb-2 text-sm">
          De acuerdo a lo solicitado, tenemos el agrado de cotizar algunos de los
          productos que Spartan de Chile Ltda., fabrica y distribuye en el país, y/o
          maquinaria / accesorios de limpieza industrial.
        </p>

        {/* Productos */}
        <section>
          <h2 className="bg-blue-700 text-white px-3 py-1 rounded text-sm font-semibold mb-2 print:-webkit-print-color-adjust: exact">
            📦 Productos Cotizados
          </h2>
          <button
            onClick={addItem}
            className="bg-blue-600 text-white px-2 rounded mb-2 print:hidden"
          >
            + Ítem
          </button>
          <table className="w-full text-xs border border-collapse">
            <thead className="bg-blue-600 text-white print:-webkit-print-color-adjust: exact">
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Kilos</th>
                <th>Cantidad</th>
                <th>$/Kg</th>
                <th style={{ width: "60px" }}>Desc %</th>
                <th>Precio Venta</th>
                <th>Total</th>
                <th className="print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => {
                const precioVenta = (it.unitPrice || 0) * (1 - (it.discountPct || 0) / 100);
                const sub = (it.kilos || 0) * (it.qty || 0) * precioVenta;
                return (
                  <tr key={i} className="border-b text-blue-800">
                    <td>
                      <input
                        value={it.code || ""}
                        list="catalog-list"
                        onChange={(e) => setItem(i, { code: e.target.value })}
                        onBlur={(e) => autofillFromCatalog(i, e.target.value)}
                        className="border px-1 w-24"
                      />
                    </td>
                    <td>
                      <input
                        value={it.description}
                        onChange={(e) => setItem(i, { description: e.target.value })}
                        onBlur={(e) => autofillFromCatalog(i, e.target.value)}
                        className="border px-1 w-full"
                      />
                    </td>
                    <td>{it.kilos}</td>
                    <td>
                      <input
                        type="number"
                        value={it.qty}
                        onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                        className="border px-1 w-16 text-right"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })}
                        className="border px-1 w-20 text-right"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={it.discountPct ?? 0}
                        onChange={(e) => setItem(i, { discountPct: Number(e.target.value) })}
                        className="border px-1 w-14 text-right"
                      />
                    </td>
                    <td>{money(precioVenta)}</td>
                    <td>{money(sub)}</td>
                    <td className="print:hidden">
                      <button onClick={() => removeItem(i)}>❌</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="catalog-list">
            {catalogo.map((r, i) => (
              <option key={i} value={`${r["code"]} — ${r["name"]}`} />
            ))}
          </datalist>
        </section>

        {/* Totales */}
        <section className="mt-4">
          <div className="p-3 rounded bg-blue-50 border border-blue-200 w-64 ml-auto">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA</span>
              <span>{money(totals.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-blue-800">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </section>

        {/* Datos de Transferencia */}
        <section id="transferencia" className="mt-6 p-3 border rounded bg-zinc-50 text-xs relative">
          <div className="absolute top-2 right-2">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                BRAND.website
              )}`}
              alt="QR Spartan"
              className="border"
            />
          </div>
          <h3 className="font-semibold text-blue-700 mb-2">Datos de Transferencia</h3>
          <p>Banco: Crédito e Inversiones</p>
          <p>Titular: Spartan de Chile Ltda.</p>
          <p>RUT: 76.333.980-7</p>
          <p>N° Cuenta: 25067894</p>
          <p>Tipo de cuenta: Cta. Cte.</p>
          <p>Email comprobantes: horacio.pavez@spartan.cl</p>
        </section>

        {/* Footer */}
        <footer className="mt-6 flex justify-between text-sm text-zinc-500">
          <div className="w-64 text-center border-t pt-1">Firma y timbre</div>
          <button onClick={printNow} className="border px-3 py-1 print:hidden">
            Imprimir / PDF
          </button>
        </footer>
      </div>

      {/* Botón lateral Volver al Panel (oculto en impresión) */}
      <Link
        href="/"
        className="fixed top-1/2 right-0 -translate-y-1/2 rounded-l bg-blue-600 text-white px-3 py-2 text-sm shadow-lg hover:bg-blue-700 print:hidden"
      >
        ⟵ Volver
      </Link>

      <style jsx>{`
        /* Hacer que los colores de Tailwind se impriman fieles */
        :global(html), :global(body), :global(#printArea) {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* --------- MODO IMPRESIÓN --------- */
        @media print {
          /* Imprimir SOLO el área designada */
          body * {
            visibility: hidden !important;
          }
          #printArea, #printArea * {
            visibility: visible !important;
          }
          #printArea {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }

          /* Ocultar elementos de UI */
          .print\\:hidden {
            display: none !important;
          }

          /* Página tamaño Carta (Letter) con márgenes cómodos */
          @page {
            size: Letter;
            margin: 12mm;
          }

          /* Evitar cortes feos */
          header, footer, table, section, h1, h2, h3, .card {
            break-inside: avoid;
          }

          /* Asegurar fondo/colores en encabezados y thead */
          thead, .bg-blue-600, .bg-blue-700 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Mantener la caja de transferencia al final si hay espacio */
          #transferencia {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}

/* Helpers */
function Card({ title, children }: { title: string; children: any }) {
  return (
    <div className="card border rounded p-2 bg-white">
      <h3 className="text-blue-700 font-semibold border-b mb-1 text-xs uppercase">
        {title}
      </h3>
      <div className="space-y-1 text-[12px]">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: any }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2 mb-1">
      <div className="text-[11px] uppercase text-zinc-500">{label}</div>
      <div>{children}</div>
    </div>
  );
}
