/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, Truck, Route, CalendarCheck, Percent, Layers, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { DailyLog, MonthSummary } from "../types";
import { formatShortDateSpanish } from "../data";

function CircularProgress({ percentage, color, trackColor = "#F5F2F9", size = 70 }: { percentage: number; color: string; trackColor?: string; size?: number }) {
  const strokeWidth = 6.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center Percentage Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black font-mono tracking-tighter" style={{ color }}>
          {new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(percentage)}%
        </span>
      </div>
    </div>
  );
}

interface KPICardsProps {
  currentLog: DailyLog;
  summary: MonthSummary;
  lceConfig: {
    inicioMes: number;
    reprogramaciones: Array<{ fecha: string; tonelaje: number }>;
  };
  onUpdateLceConfig: (config: {
    inicioMes: number;
    reprogramaciones: Array<{ fecha: string; tonelaje: number }>;
  }) => void;
  selectedDate: string;
  isEditingLce: boolean;
}

export function KPICards({ currentLog, summary, lceConfig, onUpdateLceConfig, selectedDate, isEditingLce }: KPICardsProps) {
  // Safe calculation helper of percentages
  const tonCompliance = currentLog.toneladasProgramadas > 0 
    ? (currentLog.toneladasDespachadas / currentLog.toneladasProgramadas) * 100 
    : 0;

  const tripsCompliance = currentLog.viajesProgramados > 0 
    ? (currentLog.viajesRealizados / currentLog.viajesProgramados) * 100 
    : 0;

  // Formatting helper
  const numFmt = (val: number, precision = 2) => 
    new Intl.NumberFormat("es-CL", { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(val);

  const intFmt = (val: number) => 
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(val);

  // Status Color Picker for Compliance matching our brand colors
  const getStatusColor = (percent: number) => {
    if (percent >= 100) return "text-ionizado bg-ionizado/10 border-ionizado/20";
    if (percent >= 90) return "text-nucleo bg-nucleo/10 border-nucleo/20";
    if (percent >= 75) return "text-mineral bg-mineral/10 border-mineral/20";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const getProgressBarColor = (percent: number) => {
    if (percent >= 100) return "bg-ionizado";
    if (percent >= 90) return "bg-nucleo";
    if (percent >= 75) return "bg-mineral";
    return "bg-rose-500";
  };

  const handleInicioMesChange = (val: number) => {
    onUpdateLceConfig({
      ...lceConfig,
      inicioMes: val
    });
  };

  const handleReproChange = (index: number, key: 'fecha' | 'tonelaje', val: any) => {
    const updatedRepro = [...lceConfig.reprogramaciones];
    if (!updatedRepro[index]) {
      updatedRepro[index] = { fecha: "", tonelaje: 0 };
    }
    updatedRepro[index] = {
      ...updatedRepro[index],
      [key]: val
    };
    onUpdateLceConfig({
      ...lceConfig,
      reprogramaciones: updatedRepro
    });
  };

  const handleRemoveRepro = (index: number) => {
    const updatedRepro = [...lceConfig.reprogramaciones];
    updatedRepro.splice(index, 1);
    onUpdateLceConfig({
      ...lceConfig,
      reprogramaciones: updatedRepro
    });
  };

  const dateObj = new Date(selectedDate + "T00:00:00");
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const currentMonthName = months[dateObj.getMonth()];

  function formatDateDMY(dateStr: string): string {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
  }

  return (
    <div className="space-y-4">
      {/* Top Row: Prog. Despacho (Toneladas) & (Viajes) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 select-none">
      
      {/* CARD 1: Programa Despacho (Toneladas) */}
      <div className="bg-white rounded-xl p-4 border border-[#D6CADF] shadow-sm flex flex-col justify-between relative overflow-hidden group">
        
        <div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-[10px] font-bold tracking-widest text-[#461D77] uppercase">
              Prog. Despacho (Toneladas)
            </span>
            <span className="text-[10px] font-mono text-[#461D77] px-2 py-0.5 bg-[#F5F2F9] rounded-lg border border-[#D6CADF]">
              {formatShortDateSpanish(currentLog.fecha)}
            </span>
          </div>

          <div className="my-2.5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-[#737373] font-medium">Programadas</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-[#171717]">
                  {numFmt(currentLog.toneladasProgramadas, 0)}
                </span>
                <span className="text-xs text-[#8e8e8e] font-medium">t</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-[#737373] font-medium font-sans">Despachadas</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-[#3FAA88]">
                  {numFmt(currentLog.toneladasDespachadas, 2)}
                </span>
                <span className="text-xs text-[#328C6E] font-medium">t</span>
              </div>
            </div>
          </div>

          {/* TRUCK SVG WITH LIQUID brine level reflecting actual dispatch compliance */}
          <div className="w-full h-24 my-2.5 bg-[#FAF5E6] rounded-xl relative flex items-center justify-center p-1 overflow-hidden border border-[#D6CADF]">
            {/* Ambient chemical background glow */}
            <div className="absolute -inset-1 opacity-5 bg-gradient-to-r from-nucleo to-litio blur-xl animate-pulse" />
            
            <svg viewBox="0 0 160 70" className="w-full max-w-[200px] h-20 relative z-10">
              {/* Ground road line */}
              <line x1="5" y1="58" x2="155" y2="58" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" strokeDasharray="3 3" />
              
              {/* Truck Cabin (Front) */}
              <path d="M120 30 H138 Q145 30 145 38 V54 H120 Z" fill="#171717" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" />
              {/* Cabin Glass */}
              <path d="M125 35 H135 Q138 35 138 40 V45 H125 Z" fill="#4FD1C5" opacity="0.6" className="animate-pulse" />
              {/* Cabin bumper & grill */}
              <rect x="141" y="48" width="6" height="6" rx="1" fill="#461D77" />
              <circle cx="143" cy="51" r="1.5" fill="#FAF5E6" />
              
              {/* Tanker Cylinder Back (Chassis & Tank) */}
              <rect x="15" y="20" width="102" height="30" rx="4" fill="#171717" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" />
              
              {/* Brine (Liquid Lithium Solution representation inside the tank of the truck!) */}
              <mask id="tank-mask">
                <rect x="16.5" y="21.5" width="99" height="27" rx="3" fill="white" />
              </mask>
              <g mask="url(#tank-mask)">
                {/* Simulated liquid gradient */}
                <rect
                  x="16.5"
                  y={`${50 - Math.min(27, Math.max(1, 27 * (tonCompliance / 100)))}`}
                  width="100"
                  height="30"
                  fill="#C2B2D6"
                />
                {/* Flowing liquid wave line */}
                <path
                  d="M16 35 Q 40 33, 64 35 T 112 35 V 50 H 16 Z"
                  fill="url(#liquid-grad)"
                  className="animate-pulse opacity-80"
                />
              </g>

              {/* Tank labels - enlarged font size for superior readability */}
              <text x="65" y="38.5" fill="#FAF5E6" fontSize="11.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                {numFmt(currentLog.toneladasDespachadas, 1)} t
              </text>
              
              {/* Truck Wheels */}
              <circle cx="32" cy="56" r="8" fill="#171717" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" />
              <circle cx="32" cy="56" r="3" fill="#FAF5E6" opacity="0.8" />
              <circle cx="50" cy="56" r="8" fill="#171717" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" />
              <circle cx="50" cy="56" r="3" fill="#FAF5E6" opacity="0.8" />
              <circle cx="95" cy="56" r="8" fill="#171717" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" />
              <circle cx="95" cy="56" r="3" fill="#FAF5E6" opacity="0.8" />
              <circle cx="132" cy="56" r="8" fill="#171717" stroke="rgba(70, 29, 119, 0.15)" strokeWidth="1.5" />
              <circle cx="132" cy="56" r="3" fill="#FAF5E6" opacity="0.8" />
            </svg>

            {/* Gradient definition */}
            <svg width="0" height="0">
              <defs>
                <linearGradient id="liquid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#461D77" />
                  <stop offset="100%" stopColor="#4FD1C5" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* COMPLIANCE PERCENTAGE */}
        <div className="mt-3 pt-2 border-t border-[#F0EBF5] flex items-center justify-between">
          <span className="text-[10px] text-[#737373] font-semibold uppercase flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-nucleo" /> Cumplimiento Diario
          </span>
          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${getStatusColor(tonCompliance)}`}>
            {numFmt(tonCompliance, 1)}%
          </span>
        </div>
        
        {/* Progress horizontal Indicator bar */}
        <div className="w-full bg-[#FAF5E6] h-1.5 rounded-full mt-2 overflow-hidden border border-[#F0EBF5]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(tonCompliance)}`}
            style={{ width: `${Math.min(100, tonCompliance)}%` }}
          />
        </div>
      </div>

      {/* CARD 2: Programa Despacho (Viajes) */}
      <div className="bg-white rounded-xl p-4 border border-[#D6CADF] shadow-sm flex flex-col justify-between relative overflow-hidden group">
        
        <div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-[10px] font-bold tracking-widest text-[#461D77] uppercase">
              Prog. Despacho (Viajes)
            </span>
            <span className="text-[10px] font-mono text-[#461D77] px-2 py-0.5 bg-[#F5F2F9] rounded-lg border border-[#D6CADF]">
              Diario
            </span>
          </div>

          <div className="my-2.5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-[#737373] font-medium">Programados</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-[#171717]">
                  {intFmt(currentLog.viajesProgramados)}
                </span>
                <span className="text-xs text-[#8e8e8e] font-medium">Viajes</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-[#737373] font-medium">Realizados</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-[#3FAA88]">
                  {intFmt(currentLog.viajesRealizados)}
                </span>
                <span className="text-xs text-[#328C6E] font-medium">Viajes</span>
              </div>
            </div>
          </div>

          {/* COMPACT COMPARATIVE BAR CHART */}
          <div className="w-full h-20 my-2.5 bg-[#FAF5E6] rounded-xl border border-[#D6CADF] p-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Programado", viajes: currentLog.viajesProgramados },
                  { name: "Realizado", viajes: currentLog.viajesRealizados }
                ]}
                margin={{ top: 8, right: 10, left: 10, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  fontSize={10}
                  fontWeight="600"
                  tickLine={false}
                  axisLine={false}
                  stroke="#5E6366"
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(70, 29, 119, 0.04)', radius: 4 }}
                  formatter={(value: any) => [intFmt(value) + " Viajes", ""]}
                  labelStyle={{ display: 'none' }}
                  contentStyle={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    borderRadius: '6px',
                    border: '1px solid rgba(70, 29, 119, 0.12)',
                    padding: '4px 8px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                  }}
                />
                <Bar dataKey="viajes" radius={[4, 4, 0, 0]} barSize={32}>
                  {/* Programados (deep violet), Realizados (teal/emerald) */}
                  <Cell fill="#461D77" />
                  <Cell fill="#3FAA88" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* COMPLIANCE PERCENTAGE */}
        <div className="mt-3 pt-2 border-t border-[#F0EBF5] flex items-center justify-between">
          <span className="text-[10px] text-[#737373] font-semibold uppercase flex items-center gap-1">
            <Route className="w-3.5 h-3.5 text-nucleo" /> Vueltas Diarias
          </span>
          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${getStatusColor(tripsCompliance)}`}>
            {numFmt(tripsCompliance, 1)}%
          </span>
        </div>
        
        {/* Progress horizontal Indicator bar */}
        <div className="w-full bg-[#FAF5E6] h-1.5 rounded-full mt-2 overflow-hidden border border-[#F0EBF5]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(tripsCompliance)}`}
            style={{ width: `${Math.min(100, tripsCompliance)}%` }}
          />
        </div>
      </div>
      </div>

      {/* Bottom Row: Cumplimiento MTD & LCE - Salar de Atacama */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CARD 3: Cumplimiento Mes en Curso (MTD Accums) */}
        <div className="bg-white rounded-xl p-4 border border-[#D6CADF] shadow-sm flex flex-col justify-between relative overflow-hidden group">
        
        <div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-[10px] font-bold tracking-widest text-[#461D77] uppercase">
              Cumplimiento MTD ({summary.mes})
            </span>
            <span className="text-[10px] font-semibold text-[#461D77] px-2 py-0.5 bg-[#F5F2F9] rounded-lg border border-[#D6CADF] flex items-center gap-1 font-mono font-bold">
              <TrendingUp className="w-3" /> ACUM.
            </span>
          </div>

          <div className="my-3 space-y-3">
            {/* Tonelaje Row */}
            <div className="bg-[#FCFBF9] p-4 rounded-xl border border-[#D6CADF]/40 shadow-sm flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-xs md:text-[13px] text-[#404040] font-black tracking-tight block">
                  Tonelaje Acumulado
                </span>
                <div className="space-y-0.5">
                  <div className="text-[11px] text-[#737373] font-semibold font-mono">
                    Prog: <span className="font-bold text-[#525252]">{numFmt(summary.tonelajeProgramadoAcumulado, 0)} t</span>
                  </div>
                  <div className="text-[13px] font-bold font-mono text-[#461D77]">
                    Real: <span className="font-black text-nucleo">{numFmt(summary.tonelajeDespachadoAcumulado, 2)} t</span>
                  </div>
                </div>
              </div>
              <CircularProgress percentage={summary.cumplimientoTonelaje} color="#461D77" />
            </div>

            {/* Viajes Row */}
            <div className="bg-[#FCFBF9] p-4 rounded-xl border border-[#D6CADF]/40 shadow-sm flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-xs md:text-[13px] text-[#404040] font-black tracking-tight block">
                  Viajes Acumulados
                </span>
                <div className="space-y-0.5">
                  <div className="text-[11px] text-[#737373] font-semibold font-mono">
                    Prog: <span className="font-bold text-[#525252]">{intFmt(summary.viajesProgramadosAcumulados)} viajes</span>
                  </div>
                  <div className="text-[13px] font-bold font-mono text-[#3FAA88]">
                    Real: <span className="font-black text-ionizado">{intFmt(summary.viajesDespachadosAcumulados)} viajes</span>
                  </div>
                </div>
              </div>
              <CircularProgress percentage={summary.cumplimientoViajes} color="#3FAA88" />
            </div>
          </div>
        </div>

        {/* CUMPLIMIENTO GLOBAL DE VIAJES */}
        <div className="mt-2 pt-2 border-t border-[#F0EBF5] flex items-center justify-between">
          <span className="text-[10px] text-[#737373] font-semibold uppercase flex items-center gap-1">
            <CalendarCheck className="w-3.5 h-3.5 text-nucleo" /> Estado Meso-Mensual
          </span>
          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${getStatusColor(summary.cumplimientoTonelaje)}`}>
            {numFmt(summary.cumplimientoTonelaje, 1)}% MTD
          </span>
        </div>
      </div>

      {/* CARD 4: LCE - Salar de Atacama */}
      <div className="bg-white rounded-xl p-6 border border-[#D6CADF] shadow-sm flex flex-col justify-between relative overflow-hidden group">
      {/* Card Header */}
      <div className="flex justify-between items-center gap-2 mb-6 pb-4 border-b border-[#F0EBF5]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 bg-[#461D77] rounded-full" />
          <span className="text-xs font-black tracking-wider text-[#461D77] uppercase">
            LCE - Salar de Atacama
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold font-mono text-[#461D77] px-3 py-1 bg-[#F5F2F9] rounded-full border border-[#D6CADF] shadow-sm">
            Acum. Mes
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
        {/* Left Column: Metric Cards */}
        <div className="lg:col-span-3 space-y-3">
          {isEditingLce ? (
            // Edit Mode Fields
            <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-[#D6CADF]">
              <div>
                <label className="block text-[10px] font-bold text-[#461D77] uppercase tracking-wider mb-1">
                  Producción {currentMonthName} LCE : Inicio Mes (t)
                </label>
                <input
                  type="number"
                  value={lceConfig.inicioMes}
                  onChange={(e) => handleInicioMesChange(Number(e.target.value))}
                  className="w-full bg-white text-sm font-semibold text-[#171717] px-3 py-2 rounded-lg border border-[#D6CADF] focus:outline-none focus:ring-1 focus:ring-[#461D77] font-mono"
                  placeholder="Ej. 18500"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-[#D6CADF]/50">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#461D77] uppercase tracking-wider">
                    Reprogramaciones Manuales (Máx 3)
                  </span>
                </div>

                {[0, 1, 2].map((index) => {
                  const repro = lceConfig.reprogramaciones[index] || { fecha: "", tonelaje: 0 };
                  return (
                    <div key={index} className="flex gap-2 items-center bg-white p-2.5 rounded-lg border border-[#D6CADF]/60">
                      <div className="flex-1">
                        <span className="block text-[8px] font-black text-[#737373] uppercase mb-0.5">Fecha</span>
                        <input
                          type="date"
                          value={repro.fecha}
                          onChange={(e) => handleReproChange(index, 'fecha', e.target.value)}
                          className="w-full text-xs font-semibold text-[#171717] p-1 bg-slate-50 rounded border border-[#D6CADF]/40 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="block text-[8px] font-black text-[#737373] uppercase mb-0.5">Toneladas (t)</span>
                        <input
                          type="number"
                          value={repro.tonelaje || ""}
                          onChange={(e) => handleReproChange(index, 'tonelaje', Number(e.target.value))}
                          className="w-full text-xs font-semibold text-[#171717] p-1 bg-slate-50 rounded border border-[#D6CADF]/40 focus:outline-none font-mono"
                          placeholder="Ej. 20500"
                        />
                      </div>
                      {repro.fecha || repro.tonelaje > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveRepro(index)}
                          className="mt-3 text-red-600 hover:text-red-800 text-[10px] font-bold uppercase tracking-wider px-1.5 py-1 rounded hover:bg-red-50"
                        >
                          X
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Display Mode
            <>
              {/* 1. Inicio Mes */}
              <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#D6CADF]/50 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-[#8e8e8e] font-bold uppercase tracking-wider">
                    PRODUCCION {currentMonthName} LCE : INICIO MES
                  </p>
                  <p className="text-lg font-extrabold text-[#171717] mt-0.5 font-mono">
                    {numFmt(lceConfig.inicioMes, 0)} <span className="text-xs text-[#8e8e8e] font-medium font-sans">t</span>
                  </p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#D6CADF]" />
              </div>

              {/* 2. Reprogramaciones list */}
              {lceConfig.reprogramaciones && lceConfig.reprogramaciones.filter(r => r.fecha && r.tonelaje > 0).map((repro, idx) => (
                <div key={idx} className="bg-[#FCFBF9] p-3 rounded-xl border border-[#D6CADF]/50 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] text-[#8e8e8e] font-bold uppercase tracking-wider">
                      REPROGRAMACION PRODUCCION {currentMonthName} LCE : {formatDateDMY(repro.fecha)}
                    </p>
                    <p className="text-lg font-extrabold text-[#171717] mt-0.5 font-mono">
                      {numFmt(repro.tonelaje, 0)} <span className="text-xs text-[#8e8e8e] font-medium font-sans">t</span>
                    </p>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#461D77]" />
                </div>
              ))}

              {/* 3. Actual SDA */}
              <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#D6CADF]/50 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-[#8e8e8e] font-bold uppercase tracking-wider">
                    ACTUAL SDA
                  </p>
                  <p className="text-lg font-extrabold text-nucleo mt-0.5 font-mono">
                    {numFmt(summary.lceActualTotal, 2)} <span className="text-xs text-[#8e8e8e] font-medium font-sans">t</span>
                  </p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-nucleo" />
              </div>

              {/* 4. Programado */}
              <div className="bg-[#FCFBF9] p-3 rounded-xl border border-[#D6CADF]/50 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-[#8e8e8e] font-bold uppercase tracking-wider">
                    PROGRAMADO
                  </p>
                  <p className="text-lg font-extrabold text-[#525252] mt-0.5 font-mono">
                    {numFmt(summary.lceProgramadoTotal, 0)} <span className="text-xs text-[#8e8e8e] font-medium font-sans">t</span>
                  </p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
              </div>
            </>
          )}
        </div>

        {/* Right Column: Donut Chart Gauge */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-2">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full rotate-270 drop-shadow-sm">
              <defs>
                <linearGradient id="donut-grad-premium-large" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#461D77" />
                  <stop offset="40%" stopColor="#7177EC" />
                  <stop offset="100%" stopColor="#3FAA88" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="41" fill="transparent" stroke="rgba(70, 29, 119, 0.03)" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#FAF5E6" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="url(#donut-grad-premium-large)"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min(100, summary.lceCumplimiento) / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col justify-center items-center">
              <span className="text-2xl font-black font-mono text-tecnico leading-none select-none tracking-tight">
                {numFmt(summary.lceCumplimiento, 0)}%
              </span>
              <span className="text-[7px] text-[#8e8e8e] uppercase font-black tracking-widest mt-1">
                Meta LCE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* POZAS MONITOR & FOOTER STATUS */}
      <div className="mt-6 pt-4 border-t border-[#F0EBF5] flex items-center justify-between">
        <span className="text-[10px] text-[#737373] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#461D77]" /> NIVEL POZAS PQLC:
        </span>
        <span className={`text-[10px] font-bold font-mono px-3 py-1 rounded-full border transition-colors ${
          currentLog.nivelPozasPqlc === "S/D" 
            ? "bg-[#FAF5E6] text-[#8e8e8e] border-[#D6CADF]" 
            : "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0] shadow-sm"
        }`}>
          {currentLog.nivelPozasPqlc}
        </span>
      </div>
    </div>
    </div>
  </div>
  );
}
