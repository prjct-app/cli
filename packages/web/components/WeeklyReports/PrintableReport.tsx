'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Rocket, CheckCircle2, Bug, Calendar, Printer, ArrowLeft } from 'lucide-react'
import {
  filterDataByWeek,
  formatDateRange,
  type WeekData,
} from '@/lib/generate-week-report'
import type { StatsResult } from '@/lib/services/stats.server'

interface PrintableReportProps {
  stats: StatsResult
  projectName: string
  selectedWeeks: number[]
  year: number
}

export function PrintableReport({
  stats,
  projectName,
  selectedWeeks,
  year,
}: PrintableReportProps) {
  const params = useParams()
  const projectId = params.id as string

  const weekDataList = useMemo(() => {
    return selectedWeeks.map(w => filterDataByWeek(stats, year, w))
  }, [stats, year, selectedWeeks])

  // Aggregate data
  const allShipped = weekDataList.flatMap(w => w.shipped)
  const uniqueShipsMap = new Map<string, typeof allShipped[0]>()
  for (const ship of allShipped) {
    if (!uniqueShipsMap.has(ship.name)) {
      uniqueShipsMap.set(ship.name, ship)
    }
  }
  // Sort by date descending (most recent first)
  const uniqueShips = Array.from(uniqueShipsMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Group ships by date for display
  const shipsByDate = new Map<string, typeof uniqueShips>()
  for (const ship of uniqueShips) {
    const dateKey = ship.date
    if (!shipsByDate.has(dateKey)) {
      shipsByDate.set(dateKey, [])
    }
    shipsByDate.get(dateKey)!.push(ship)
  }

  const totalTasks = weekDataList.reduce((sum, w) => sum + w.tasksCompleted, 0)
  const totalBugs = weekDataList.reduce((sum, w) => sum + w.bugsFixed, 0)
  const totalDays = weekDataList.reduce((sum, w) => sum + w.activeDays, 0)

  // Date range
  const firstWeek = weekDataList[0]
  const lastWeek = weekDataList[weekDataList.length - 1]
  const dateRangeStr = weekDataList.length === 1
    ? formatDateRange(firstWeek.startDate, firstWeek.endDate)
    : formatDateRange(firstWeek.startDate, lastWeek.endDate)

  const weekLabel = weekDataList.length === 1
    ? `Semana ${firstWeek.week}`
    : `Semanas ${firstWeek.week}-${lastWeek.week}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Action buttons - hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex items-center gap-2">
        <Link
          href={`/project/${projectId}/reports`}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          Regresar
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      {/* Printable content */}
      <div className="max-w-2xl mx-auto p-8 print:p-0 print:max-w-none">
        {/* Header */}
        <header className="mb-8 pb-6 border-b-2 border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{projectName}</h1>
          <p className="text-lg text-gray-600">
            Reporte de Progreso - {weekLabel}
          </p>
          <p className="text-gray-500">{dateRangeStr}, {year}</p>
        </header>

        {/* Stats Summary */}
        <section className="mb-8">
          <div className="grid grid-cols-4 gap-4">
            <StatBox
              icon={<Rocket className="h-6 w-6" />}
              value={uniqueShips.length}
              label="Entregados"
              color="text-emerald-600"
            />
            <StatBox
              icon={<CheckCircle2 className="h-6 w-6" />}
              value={totalTasks}
              label="Tareas"
              color="text-blue-600"
            />
            <StatBox
              icon={<Bug className="h-6 w-6" />}
              value={totalBugs}
              label="Bugs"
              color="text-orange-600"
            />
            <StatBox
              icon={<Calendar className="h-6 w-6" />}
              value={totalDays}
              label="Dias Activos"
              color="text-purple-600"
            />
          </div>
        </section>

        {/* Shipped Features grouped by date */}
        {uniqueShips.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-emerald-600" />
              Entregado
            </h2>
            <div className="space-y-5">
              {Array.from(shipsByDate.entries()).map(([date, ships]) => (
                <div key={date}>
                  <p className="text-sm font-medium text-gray-500 mb-2">
                    {new Date(date).toLocaleDateString('es-MX', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <ul className="space-y-2 pl-4 border-l-2 border-emerald-200">
                    {ships.map((ship, i) => (
                      <li key={i} className="pl-3 text-gray-700">
                        <span className="font-medium">{ship.name}</span>
                        {ship.version && (
                          <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {ship.version}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Activity Details */}
        {(totalTasks > 0 || totalBugs > 0) && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              Actividad
            </h2>
            <ul className="space-y-2 text-gray-700">
              {totalTasks > 0 && (
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  {totalTasks} tarea{totalTasks !== 1 ? 's' : ''} completada{totalTasks !== 1 ? 's' : ''}
                </li>
              )}
              {totalBugs > 0 && (
                <li className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-orange-500" />
                  {totalBugs} bug{totalBugs !== 1 ? 's' : ''} corregido{totalBugs !== 1 ? 's' : ''}
                </li>
              )}
              {totalDays > 0 && (
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  {totalDays} dia{totalDays !== 1 ? 's' : ''} activo{totalDays !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* No activity message */}
        {uniqueShips.length === 0 && totalTasks === 0 && totalBugs === 0 && (
          <section className="mb-8 p-6 bg-gray-50 rounded-lg text-center text-gray-500">
            Sin actividad registrada para este periodo
          </section>
        )}

        {/* Next Steps placeholder */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Siguiente
          </h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-gray-400">&#x2022;</span>
              <span className="italic text-gray-400">[Pendiente por definir]</span>
            </li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-400 text-center print:mt-8">
          <p>Generado con prjct - {new Date().toLocaleDateString('es-MX')}</p>
        </footer>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 1in;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}

interface StatBoxProps {
  icon: React.ReactNode
  value: number
  label: string
  color: string
}

function StatBox({ icon, value, label, color }: StatBoxProps) {
  return (
    <div className="text-center p-4 border border-gray-200 rounded-lg">
      <div className={`${color} flex justify-center mb-2`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}
