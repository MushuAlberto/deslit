/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DailyLog {
  id: string; // Unique identifier (e.g. date string)
  fecha: string; // ISO date string "YYYY-MM-DD"
  toneladasProgramadas: number;
  toneladasDespachadas: number;
  viajesProgramados: number;
  viajesRealizados: number;
  m3Despachados: number;
  lceProgramado: number; // Daily or target factor
  lceActual: number;
  nivelPozasPqlc: string; // "S/D" or specific percentage/status string
  productividad?: number; // Optional productivity calculation overrides
}

export interface MonthSummary {
  mes: string; // e.g. "mayo-2026"
  tonelajeProgramadoAcumulado: number;
  tonelajeDespachadoAcumulado: number;
  cumplimientoTonelaje: number;
  viajesProgramadosAcumulados: number;
  viajesDespachadosAcumulados: number;
  cumplimientoViajes: number;
  m3Acumulados: number;
  lceProgramadoTotal: number;
  lceActualTotal: number;
  lceCumplimiento: number;
  promedioCamionTon: number;
  promedioCamionM3: number;
  cantidadCamiones: number;
  productividadMes: number;
  productividadMeta: number;
}

export interface ExcelOverrides {
  tonelajeAcumulado?: number;
  m3Acumulados?: number;
  promedioCamionTon?: number;
  promedioCamionM3?: number;
  cantidadCamiones?: number;
  productividadMes?: number;
  lceActualTotal?: number;
  lceProgramadoTotal?: number;
  tonelajeProgramadoAcumulado?: number;
  viajesProgramadosAcumulados?: number;
}

export interface ParseResult {
  logs: DailyLog[];
  overrides?: ExcelOverrides;
}
