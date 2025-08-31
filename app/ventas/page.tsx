"use client";

import Link from "next/link";

export default function VentasPage() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <h1 className="text-2xl font-bold text-[#2B6CFF] mb-6">📊 Módulo de Ventas</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cotizaciones */}
        <Link
          href="/ventas/cotizacion"
          className="block rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-[#2B6CFF] mb-2">📄 Cotizaciones</h2>
          <p className="text-sm text-zinc-600">
            Genera y gestiona cotizaciones para tus clientes.
          </p>
        </Link>

        {/* Nota de Venta */}
        <Link
          href="/ventas/notaventas"
          className="block rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-[#2B6CFF] mb-2">📝 Nota de Venta</h2>
          <p className="text-sm text-zinc-600">
            Crea y administra notas de venta con precios especiales y descuentos.
          </p>
        </Link>
      </div>
    </div>
  );
}
