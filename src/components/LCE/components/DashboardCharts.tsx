/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DailyLog } from "../types";
import { formatShortDateSpanish } from "../data";

// Custom larger, rotated labels for the Trips chart
const renderBar1Label = (props: any) => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || value === 0) return null;
  const cx = x + width / 2;
  const cy = y - 7;
  return (
    <text
      x={cx}
      y={cy}
      fill="#461D77"
      fontSize={12.5}
      fontWeight="black"
      fontFamily="JetBrains Mono"
      textAnchor="start"
      transform={`rotate(-45, ${cx}, ${cy})`}
    >
      {value}
    </text>
  );
};

// Custom larger, rotated labels for the LCE chart
const renderBar2Label = (props: any) => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || value === 0) return null;
  const cx = x + width / 2;
  const cy = y - 7;
  const formattedVal = typeof value === "number" ? value.toFixed(1) : value;
  return (
    <text
      x={cx}
      y={cy}
      fill="#3FAA88"
      fontSize={12.5}
      fontWeight="black"
      fontFamily="JetBrains Mono"
      textAnchor="start"
      transform={`rotate(-45, ${cx}, ${cy})`}
    >
      {formattedVal}
    </text>
  );
};

interface DashboardChartsProps {
  logs: DailyLog[];
  selectedDate: string;
  isCapturing?: boolean;
}

export function DashboardCharts({ logs, selectedDate, isCapturing }: DashboardChartsProps) {
  // Extract month year for labels
  const dObj = new Date(selectedDate + "T00:00:00");
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const activeMonthLabel = monthNames[dObj.getMonth()];
  const activeYear = dObj.getFullYear();

  // Prepare data for Chart 1: Viajes Programados vs Realizados
  // We'll format the X-axis label to show "DD-MMM-YYYY" elegantly
  const chart1Data = logs.map((log) => {
    return {
      name: formatShortDateSpanish(log.fecha),
      shortDay: new Date(log.fecha + "T00:00:00").getDate(),
      "Viajes Realizados (Vueltas Desp.)": log.viajesRealizados,
      "Viajes Programados (Vueltas Prog.)": log.viajesProgramados,
      isActive: log.fecha === selectedDate,
    };
  });

  // Prepare data for Chart 2: LCE SdA (Diario)
  const chart2Data = logs.map((log) => {
    return {
      day: new Date(log.fecha + "T00:00:00").getDate(),
      name: formatShortDateSpanish(log.fecha),
      "LCE Actual (SdA)": log.lceActual,
      isActive: log.fecha === selectedDate,
    };
  });

  // Custom tooltips to present numbers with Chilean/Spanish locale format
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-nucleo/15 rounded-lg p-3 shadow-lg font-sans select-none">
          <p className="text-xs text-tecnico/80 font-bold mb-1.5">{label}</p>
          <div className="space-y-1">
            {payload.map((item: any) => (
              <div key={item.name} className="flex justify-between items-center gap-6">
                <span className="text-[10px] text-tecnico/60 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
                  {item.name}
                </span>
                <span className="text-xs font-bold font-mono" style={{ color: item.color || item.fill }}>
                  {new Intl.NumberFormat("es-CL").format(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const chart1Content = (
    <>
      <CartesianGrid stroke="rgba(70, 29, 119, 0.05)" strokeDasharray="3 3" vertical={false} />
      
      <XAxis
        dataKey="name"
        stroke="#000000"
        fontSize={9}
        tickLine={false}
        dy={8}
        axisLine={false}
        tickFormatter={(val) => val.split("-")[0]} // Just show day numbers to de-clutter
      />
      <YAxis
        stroke="#000000"
        fontSize={9}
        axisLine={false}
        tickLine={false}
        domain={[0, "auto"]}
      />
      
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(70, 29, 119, 0.02)" }} />
      
      <Legend
        verticalAlign="bottom"
        height={36}
        iconType="circle"
        fontSize={10}
        wrapperStyle={{ paddingTop: "12px", fontSize: "10px", color: "#171717" }}
      />

      {/* Realized trips / Vueltas Desp. Bar */}
      <Bar
        dataKey="Viajes Realizados (Vueltas Desp.)"
        fill="#461D77"
        name="Vueltas Desp."
        radius={[3, 3, 0, 0]}
        label={renderBar1Label}
        isAnimationActive={!isCapturing}
      />

      {/* Programmed trips Target Line */}
      <Line
        type="monotone"
        dataKey="Viajes Programados (Vueltas Prog.)"
        stroke="#171717"
        strokeWidth={1.5}
        dot={{ r: 1.5, fill: "#171717", strokeWidth: 1 }}
        activeDot={{ r: 3.5 }}
        name="Vueltas Prog."
        strokeDasharray="3 3"
        isAnimationActive={!isCapturing}
      />
    </>
  );

  const chart2Content = (
    <>
      <CartesianGrid stroke="rgba(70, 29, 119, 0.05)" strokeDasharray="3 3" vertical={false} />
      
      <XAxis
        dataKey="day"
        stroke="#000000"
        fontSize={9}
        tickLine={false}
        dy={8}
        axisLine={false}
      />
      <YAxis
        stroke="#000000"
        fontSize={9}
        axisLine={false}
        tickLine={false}
        domain={[0, "auto"]}
      />
      
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(70, 29, 119, 0.02)" }} />
      
      <Legend
        verticalAlign="bottom"
        height={36}
        iconType="circle"
        fontSize={10}
        wrapperStyle={{ paddingTop: "12px", fontSize: "10px", color: "#171717" }}
      />

      {/* LCE actual bar */}
      <Bar
        dataKey="LCE Actual (SdA)"
        fill="#3FAA88"
        name="LCE (SdA)"
        radius={[3, 3, 0, 0]}
        label={renderBar2Label}
        isAnimationActive={!isCapturing}
      />
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-6 select-none">
      
      {/* CHART 1: Viajes Programados vs Viajes Realizados (Diario) */}
      <div className="bg-white rounded-xl p-5 border border-nucleo/10 shadow-sm flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-nucleo/5 mb-4">
          <div>
            <h3 className="text-sm font-bold text-tecnico uppercase">
              Viajes Programados vs Viajes Realizados (Diario)
            </h3>
            <p className="text-[10px] text-tecnico/50 font-semibold tracking-wider uppercase">
              Control diario del mes de {activeMonthLabel} {activeYear}
            </p>
          </div>
          <span className="text-[9px] bg-nucleo/5 text-[#461D77] border border-nucleo/15 px-2 py-0.5 rounded font-mono uppercase tracking-widest font-bold">
            Vueltas Despachadas
          </span>
        </div>

        {/* Responsive / Fixed chart container */}
        <div className="w-full h-80 flex items-center justify-center overflow-hidden">
          {isCapturing ? (
            <ComposedChart width={1120} height={320} data={chart1Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
              {chart1Content}
            </ComposedChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart1Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
                {chart1Content}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* CHART 2: LCE SdA (Diario) */}
      <div className="bg-white rounded-xl p-5 border border-nucleo/10 shadow-sm flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-nucleo/5 mb-4">
          <div>
            <h3 className="text-sm font-bold text-tecnico uppercase">
              LCE SdA (Diario)
            </h3>
            <p className="text-[10px] text-tecnico/50 font-semibold tracking-wider uppercase">
              Toneladas equivalentes de carbonato de litio diarias
            </p>
          </div>
          <span className="text-[9px] bg-[#3FAA88]/5 text-[#3FAA88] border border-[#3FAA88]/15 px-2 py-0.5 rounded font-mono uppercase tracking-widest font-bold">
            LCE (SdA)
          </span>
        </div>

        {/* Responsive / Fixed chart container */}
        <div className="w-full h-80 flex items-center justify-center overflow-hidden">
          {isCapturing ? (
            <ComposedChart width={1120} height={320} data={chart2Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
              {chart2Content}
            </ComposedChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart2Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
                {chart2Content}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="text-center" style={{ marginTop: "-8px", paddingBottom: "8px" }}>
        <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#94a3b8" }}>
          PWA creada y diseñada por Cristian Tapia Espinoza
        </p>
      </div>

    </div>
  );
}
