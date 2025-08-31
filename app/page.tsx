"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ReferenceLine } from "recharts";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

// Función para limpiar y convertir valores a número
const parseNumber = (value: any) => {
  if (!value) return 0;
  return Number(value.toString().replace(/[^0-9.-]+/g, ""));
};

export default function HomeMenu() {
  const search = useSearchParams();
  const isAdmin = (search.get("admin") || "") === "1";

  const [data, setData] = useState<string[][]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const spreadsheetId = "1GASOV0vl85q5STfvDn5hdZFD0Mwcj2SzXM6IqvgI50A";
        const gid = "1307924129"; // pestaña Metas
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

        const res = await fetch(url);
        const text = await res.text();
        const json = JSON.parse(text.substr(47).slice(0, -2));

        const rows = json.table.rows.map((r: any) =>
          r.c.map((c: any) => (c ? c.v : ""))
        );

        setData(rows);
      } catch (err) {
        console.error("Error cargando Google Sheets:", err);
      }
    };

    fetchData();
  }, []);

  // Filtrar solo filas de Gerencia = FB (Food)
  const foodData = data.filter((row) => row[1]?.toString().startsWith("FB"));

  // Calcular indicadores
  const totalMeta = foodData.reduce((sum, r) => sum + parseNumber(r[8]), 0); // Meta
  const totalVentas = foodData.reduce((sum, r) => sum + parseNumber(r[6]), 0); // Ventas
  const totalCumplimiento = foodData.reduce((sum, r) => sum + parseNumber(r[9]), 0); // Cumplimiento $

  // Porcentaje de cumplimiento
  const progreso = totalMeta > 0 ? (totalVentas / totalMeta) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ===== Topbar ===== */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />
        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center gap-4 md:gap-6">
            <img
              src={LOGO_URL}
              alt="Spartan"
              className="h-12 w-auto md:h-28 object-contain drop-shadow-sm"
            />
            <div className="min-w-0">
              <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">
                Spartan — Panel Principal
              </h1>
              <p className="mt-1 text-white/80 text-sm max-w-2xl">
                Visualiza los indicadores estratégicos y metas de la empresa.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ===== KPI / METAS FOOD ===== */}
      <main className="relative mx-auto max-w-7xl px-6 py-10">
        <section className="rounded-2xl border bg-white shadow-sm p-6">
          <h2 className="text-xl font-semibold text-[#2B6CFF] mb-4">
            📊 Resumen Metas Agosto Área FOOD
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            KPIs consolidados solo de la Gerencia <b>FB</b>.
          </p>

          {/* KPIs en tarjetas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 shadow text-center">
              <h3 className="text-lg font-bold text-[#1f4ed8]">Meta Total</h3>
              <p className="text-2xl font-semibold">
                {totalMeta.toLocaleString("es-CL")}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 shadow text-center">
              <h3 className="text-lg font-bold text-[#1f4ed8]">Total Ventas</h3>
              <p className="text-2xl font-semibold">
                {totalVentas.toLocaleString("es-CL")}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 shadow text-center">
              <h3 className="text-lg font-bold text-[#1f4ed8]">Cumplimiento $</h3>
              <p
                className={`text-2xl font-semibold ${
                  totalCumplimiento >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalCumplimiento.toLocaleString("es-CL")}
              </p>
            </div>
          </div>

          {/* Gráfico odómetro */}
          <div className="mt-10 flex flex-col items-center">
            <h3 className="text-lg font-bold text-center text-[#1f4ed8] mb-4">
              Avance de Ventas vs Meta
            </h3>

            <RadialBarChart
              width={320}
              height={160}
              cx="50%"
              cy="100%"
              innerRadius="80%"
              outerRadius="100%"
              barSize={20}
              data={[
                {
                  name: "Ventas",
                  value: totalVentas,
                  fill:
                    totalVentas >= totalMeta
                      ? "#4CAF50"
                      : totalVentas >= totalMeta * 0.8
                      ? "#F9D423"
                      : "#FF4E50",
                },
              ]}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, totalMeta]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar minAngle={15} background clockWise dataKey="value" />
              <ReferenceLine
                angle={0}
                value={totalMeta}
                stroke="#1f4ed8"
                strokeWidth={3}
              />
            </RadialBarChart>

            {/* Mostrar porcentaje en grande */}
            <p className="mt-4 text-3xl font-bold text-zinc-700">
              {progreso.toFixed(1)} %
            </p>
          </div>
        </section>

        {/* Accesos útiles solo admin */}
        {isAdmin && (
          <div className="mt-10 rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-900">
            <p className="text-sm text-zinc-600">
              ⚙️ Accesos rápidos para administración
            </p>
            <ul className="mt-2 list-disc list-inside text-sm text-zinc-700">
              <li>Configurar conexión de datos</li>
              <li>Actualizar fuentes de Comodatos</li>
            </ul>
          </div>
        )}
      </main>

      {/* ===== Botón flotante WhatsApp ===== */}
      <a
        href="https://wa.me/56075290961?text=Hola%20Silvana,%20necesito%20más%20información"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-[#25D366] hover:bg-[#1ebe5b] text-white rounded-full p-4 shadow-lg print:hidden"
        title="Escríbenos por WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 24 24"
          className="w-6 h-6"
        >
          <path d="M20.52 3.48A11.86 11.86 0 0012.07 0C5.58 0 .07 5.52.07 12c0 2.1.55 4.15 1.6 5.96L0 24l6.21-1.63A11.9 11.9 0 0012.07 24c6.49 0 11.93-5.52 11.93-12 0-3.18-1.24-6.17-3.48-8.52zm-8.45 18.07c-1.96 0-3.87-.53-5.54-1.54l-.39-.23-3.69.97.99-3.6-.25-.37a9.7 9.7 0 01-1.48-5.23c0-5.35 4.38-9.7 9.79-9.7a9.7 9.7 0 019.79 9.7c0 5.36-4.38 9.7-9.79 9.7zm5.36-7.3c-.29-.14-1.71-.84-1.97-.94-.26-.1-.45-.14-.64.14-.19.29-.74.94-.91 1.13-.17.19-.34.21-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36s-1 1-1 2.43 1.02 2.82 1.16 3.01c.14.19 2 3.06 4.84 4.29.68.29 1.21.46 1.63.59.68.22 1.29.19 1.77.12.54-.08 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.37-.07-.13-.26-.2-.55-.34z" />
        </svg>
      </a>
    </div>
  );
}
