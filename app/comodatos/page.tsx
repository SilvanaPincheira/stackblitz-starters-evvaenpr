"use client";

import Link from "next/link";

export default function ComodatosMenu() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1f4ed8] mb-6">
        Gestión de Comodatos
      </h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {/* Card: Evaluación de Negocio */}
        <Link
          href="/comodatos/negocios"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">
              Evaluación de Negocio
            </h2>
            <span className="text-3xl">📈</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Carga catálogo, arma la propuesta, calcula margen, comisión y genera PDF/Word.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Clientes Activos */}
        <Link
          href="/comodatos/clientes-activos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Clientes Activos
            </h2>
            <span className="text-3xl">🧪</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Lee ventas y comodatos vigentes (24m), calcula relación mensual y simula nuevas instalaciones.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Catálogo de Equipos */}
        <Link
          href="/comodatos/catalogos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Catálogo de Equipos
            </h2>
            <span className="text-3xl">📚</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Visualiza el catálogo (PDF) desde Google Drive con visor embebido.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}
