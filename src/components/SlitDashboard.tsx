import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, LabelList
} from 'recharts';
import { 
  Home, TrendingUp, Truck, Target, Scale, Eye, Award, BarChart3, Calendar, ShieldCheck, ArrowLeft, Filter,
  Clock, ClipboardCheck, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2, Package, MapPin
} from 'lucide-react';
import { normalizeCompanyName, normalizeHeader, cleanNumeric, parseExcelTime, formatNumberWithDecimals } from '../utils/dataProcessor';

interface SlitRow {
  Fecha: string;
  Producto: string;
  Destino: string;
  Ton_Prog: number;
  Ton_Real: number;
  Eq_Prog: number;
  Eq_Real: number;
  Regulacion_Real: number;
}

interface SlitDashboardProps {
  data: any[];
  onBack: () => void;
}

// Robust helper to extract the transport company (empresa) from the "Destino" string
const getCompanyFromDestino = (destino: string): string => {
  const destUpper = String(destino || '').trim().toUpperCase();
  if (destUpper.includes('COSEDUCAM')) return 'COSEDUCAM';
  if (destUpper.includes('M&Q') || destUpper.includes('M & Q') || destUpper.includes('M Q') || destUpper.includes('MINING & QUARRYING') || destUpper.includes('MINING AND QUARRYING')) return 'M&Q SPA';
  if (destUpper.includes('M S & D') || destUpper.includes('M S D') || destUpper.includes('MS&D') || destUpper.includes('MINING SERVICES')) return 'M S & D SPA';
  if (destUpper.includes('JORQUERA')) return 'JORQUERA TRANSPORTE S.A.';
  if (destUpper.includes('AG SERVICES') || destUpper.includes('AG SERVICE')) return 'AG SERVICES';
  
  // Fallback cleanup
  const firstWord = destUpper.split(' ')[0] || 'OTRA';
  if (['COYA', 'TOCOPILLA', 'LAGUNAS', 'S/D', 'SD', 'PRODUCTO', 'FAENA', 'SALAR', 'SDA', 'PANG'].includes(firstWord)) {
    return 'MINEX / OTRA';
  }
  return firstWord;
};

const formatDateToCL = (dateStr: string): string => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
};

const mapArrivalCompanyToStandard = (co: string): string => {
  const upper = String(co || '').trim().toUpperCase();
  if (upper.includes('COSEDUCAM')) return 'COSEDUCAM';
  if (upper.includes('M&Q') || upper.includes('MQ')) return 'M&Q SPA';
  if (upper.includes('M S & D') || upper.includes('MSD') || upper.includes('MINING SERVICES')) return 'M S & D SPA';
  if (upper.includes('JORQUERA')) return 'JORQUERA TRANSPORTE S.A.';
  if (upper.includes('AG SERVICES') || upper.includes('AG SERVICE')) return 'AG SERVICES';
  return upper;
};

export const SlitDashboard: React.FC<SlitDashboardProps> = ({ data = [], onBack }) => {
  // Local state for Base de Datos (Informe Operativo)
  const [operationalRawData, setOperationalRawData] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('sqm_raw_data');
      return saved ? JSON.parse(saved) : (data || []);
    } catch {
      return data || [];
    }
  });

  // Local state for Llegada de Equipos
  const [arrivalRawState, setArrivalRawState] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('sqm_llegadas_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI States for file upload integration
  const [showUploadCenter, setShowUploadCenter] = useState(true);
  const [dragOverOps, setDragOverOps] = useState(false);
  const [dragOverArrivals, setDragOverArrivals] = useState(false);
  const [uploadingOps, setUploadingOps] = useState(false);
  const [uploadingArrivals, setUploadingArrivals] = useState(false);
  const [errorMsgOps, setErrorMsgOps] = useState<string | null>(null);
  const [errorMsgArrivals, setErrorMsgArrivals] = useState<string | null>(null);
  const [successMsgOps, setSuccessMsgOps] = useState<string | null>(null);
  const [successMsgArrivals, setSuccessMsgArrivals] = useState<string | null>(null);

  // Excel parsing executors
  const handleUploadOperationalFile = (file: File) => {
    setUploadingOps(true);
    setErrorMsgOps(null);
    setSuccessMsgOps(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n => n === "Base de Datos") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
        if (jsonData.length < 2) throw new Error("Planilla vacía o estructura errónea.");

        let bestHeaderRowIdx = 0;
        let bestMatchCount = -1;
        let bestIdxs: Record<string, number> = {};
        let bestHeadersList: string[] = [];

        const scanLimit = Math.min(jsonData.length, 15);
        for (let rIdx = 0; rIdx < scanLimit; rIdx++) {
          const rowHeaders = Array.from(jsonData[rIdx] || []).map(h => normalizeHeader(h));
          const getIdxForHeaders = (
            aliases: string[], 
            fuzzyKeywords?: { mustContain: string[], orContain?: string[] }[]
          ): number => {
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 2) continue;
              const exactIdx = rowHeaders.findIndex(h => h === normAlias);
              if (exactIdx !== -1) return exactIdx;
            }
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 3) continue;
              const partialIdx = rowHeaders.findIndex(h => h && (h.includes(normAlias) || normAlias.includes(h)));
              if (partialIdx !== -1) return partialIdx;
            }
            if (fuzzyKeywords) {
              for (const fk of fuzzyKeywords) {
                const foundIdx = rowHeaders.findIndex(h => {
                  if (!h) return false;
                  const hasAllMust = fk.mustContain.every(term => h.includes(term));
                  if (!hasAllMust) return false;
                  if (fk.orContain && fk.orContain.length > 0) {
                    return fk.orContain.some(term => h.includes(term));
                  }
                  return true;
                });
                if (foundIdx !== -1) return foundIdx;
              }
            }
            return -1;
          };

          const currentIdxs = {
            fecha: getIdxForHeaders(["FECHA", "JORNADA", "DIA"], [{ mustContain: ["FECHA"] }, { mustContain: ["JORNADA"] }]),
            producto: getIdxForHeaders(["PRODUCTO", "NIVEL", "PRODUCTO META", "PROD"], [{ mustContain: ["PRODUCTO"] }, { mustContain: ["PROD", "META"] }, { mustContain: ["NIVEL"] }]),
            destino: getIdxForHeaders(["DESTINO", "UBICACION", "UBICACIÓN", "ENTREGA", "PUNTO ENTREGA", "DES"], [{ mustContain: ["DESTIN"] }, { mustContain: ["UBICAC"] }, { mustContain: ["ENTREG"] }]),
            empresa: getIdxForHeaders(["EMPRESA", "TRANSPORTISTA", "EMPRESA TRANSPORTE", "FLETERO", "COMPAÑÍA", "CÍA", "COMPAÑIA", "CIA"], [{ mustContain: ["EMPRES"] }, { mustContain: ["FLETER"] }, { mustContain: ["TRANSP"] }]),
            tonProg: getIdxForHeaders(["TON PROG", "PROGRAMADO", "TONELADAS PROGRAMADAS", "TONELADAS PROG", "TONELADA PROGRAMADA"], [{ mustContain: ["TON", "PROG"] }, { mustContain: ["TONELADA", "PROG"] }]),
            tonReal: getIdxForHeaders(["TON REAL", "REAL", "TONELADAS REALES", "TONELADA REAL"], [{ mustContain: ["TON", "REAL"] }, { mustContain: ["TONELADA", "REAL"] }]),
            eqProg: getIdxForHeaders(["EQ PROG", "EQUIPOS PROGRAMADOS", "EQUIPOS PROG", "FLOTA PROGRAMADA", "FLOTA PROG"], [{ mustContain: ["FLOTA", "PROG"] }, { mustContain: ["EQUIP", "PROG"] }]),
            eqReal: getIdxForHeaders(["EQ REAL", "EQUIPOS REALES", "EQ REALES", "FLOTA REAL", "FLOTA REALES", "INTENSIDAD FLOTA", "INTENSIDAD DE FLOTA"], [{ mustContain: ["FLOTA", "REAL"] }, { mustContain: ["EQUIP", "REAL"] }]),
            regReal: getIdxForHeaders(["REGULACION REAL", "REGULACION", "PORCENTAJE DE REGULACION", "REGULACION REAL %", "% REGULALION", "% REGULACION", "REGULACION %", "REG REAL"], [{ mustContain: ["REGULAC"] }]),
            sda: getIdxForHeaders(["SDA HRS", "SDA", "SDA HOURS", "SDA H"], [{ mustContain: ["SDA"] }]),
            pang: getIdxForHeaders(["PANG HRS", "PANG", "PANG HOURS"], [{ mustContain: ["PANG"] }]),
            faenaMeta: getIdxForHeaders(["FAENA META HRS", "FAENA META"], [{ mustContain: ["FAENA", "META"] }]),
            faenaReal: getIdxForHeaders(["FAENA REAL HRS", "FAENA REAL"], [{ mustContain: ["FAENA", "REAL"] }])
          };

          const matchCount = Object.values(currentIdxs).filter(v => v !== -1).length;
          if (matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestHeaderRowIdx = rIdx;
            bestIdxs = currentIdxs;
            bestHeadersList = rowHeaders;
          }
        }

        const idx = bestIdxs;
        const rows = jsonData.slice(bestHeaderRowIdx + 1);

        if (idx.fecha === -1) {
          throw new Error("No se pudo mapear la columna base FECHA u operacionales obligatorias.");
        }

        const processed = rows.map((row) => {
          if (!row || row[idx.fecha] === undefined || row[idx.fecha] === null) return null;
          
          let dateStr = '';
          const rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else {
            const rawVal = String(rawDate).trim();
            if (rawVal.includes('/')) {
              const pts = rawVal.split('/');
              if (pts[2]?.length === 4) dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
            } else if (rawVal.includes('-')) {
              const pts = rawVal.split('-');
              if (pts[0]?.length === 4) {
                dateStr = rawVal;
              } else if (pts[2]?.length === 4) {
                dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
              }
            }
          }
          if (!dateStr || dateStr === 'undefined') return null;

          const valAF = row[31] !== undefined && row[31] !== null ? String(row[31]).trim().toUpperCase() : '';
          const isSlit = valAF === 'SLIT' || valAF.includes('SLIT');

          const finalProduct = isSlit ? valAF : (idx.producto !== -1 ? String(row[idx.producto]).trim().toUpperCase() : 'DESCONOCIDO');

          return {
            Fecha: dateStr,
            Producto: finalProduct,
            Destino: idx.destino !== -1 ? String(row[idx.destino]).trim().toUpperCase() : 'S/D',
            EmpresaMapped: idx.empresa !== -1 ? String(row[idx.empresa] || '').trim().toUpperCase() : '',
            Ton_Prog: isSlit ? cleanNumeric(row[33]) : (idx.tonProg !== -1 ? cleanNumeric(row[idx.tonProg]) : 0), // AH
            Ton_Real: isSlit ? cleanNumeric(row[34]) : (idx.tonReal !== -1 ? cleanNumeric(row[idx.tonReal]) : 0), // AI
            Eq_Prog: isSlit ? cleanNumeric(row[35]) : (idx.eqProg !== -1 ? cleanNumeric(row[idx.eqProg]) : 0),   // AJ
            Eq_Real: isSlit ? cleanNumeric(row[36]) : (idx.eqReal !== -1 ? cleanNumeric(row[idx.eqReal]) : 0),   // AK
            Regulacion_Real: idx.regReal !== -1 ? (() => {
              const raw = row[idx.regReal];
              const val = cleanNumeric(raw);
              if (val > 0 && val <= 1.0) return val * 100;
              return val;
            })() : (isSlit ? (() => {
              const val38 = cleanNumeric(row[38]); // col AM: fallback % Regulación
              if (val38 > 0) {
                return val38 > 0 && val38 <= 1.0 ? val38 * 100 : val38;
              }
              const val37 = cleanNumeric(row[37]); // col AL fallback
              return val37 > 0 && val37 <= 1.0 ? val37 * 100 : val37;
            })() : 0),
            sdaHours: idx.sda !== -1 ? parseExcelTime(row[idx.sda]) : 0,
            pangHours: idx.pang !== -1 ? parseExcelTime(row[idx.pang]) : 0,
            faenaMetaHours: isSlit ? parseExcelTime(row[49]) : (idx.faenaMeta !== -1 ? parseExcelTime(row[idx.faenaMeta]) : 0), // AX
            faenaRealHours: isSlit ? parseExcelTime(row[50]) : (idx.faenaReal !== -1 ? parseExcelTime(row[idx.faenaReal]) : 0), // AY

            // Custom fields mapped exactly from corresponding columns:
            col_TiempoInteriorFaenaProdMeta: parseExcelTime(row[49]), // AX (index 49)
            col_TiempoInteriorFaenaReal: parseExcelTime(row[50]), // AY (index 50)
            col_PromedioCargaMeta: cleanNumeric(row[47]), // AV (index 47)
            col_PromedioCargaReal: cleanNumeric(row[48]), // AW (index 48)
            col_TonProg: cleanNumeric(row[33]), // AH (index 33)
            col_TonReal: cleanNumeric(row[34]), // AI (index 34)
            col_EqProg: cleanNumeric(row[35]), // AJ (index 35)
            col_EqReal: cleanNumeric(row[36]), // AK (index 36)
            col_PercentCumplimiento: (() => {
              const val = cleanNumeric(row[37]); // AL (index 37)
              return val > 0 && val <= 1.0 ? val * 100 : val;
            })(),
            col_CantidadRegulaciones: cleanNumeric(row[44]), // AS (index 44)
            col_MqAljibesProg: cleanNumeric(row[12]), // M (index 12)
            col_MqAljibesReal: cleanNumeric(row[13]), // N (index 13)
            col_JorqueraAljibesProg: cleanNumeric(row[20]), // U (index 20)
            col_JorqueraAljibesReal: cleanNumeric(row[21])  // V (index 21)
          };
        }).filter(r => r !== null);

        if (processed.length === 0) throw new Error("No se encontraron registros operacionales válidos.");

        setOperationalRawData(processed);
        localStorage.setItem('sqm_raw_data', JSON.stringify(processed));
        setSuccessMsgOps(`¡Informe operativo de despacho cargado con éxito! Detected ${processed.filter((p: any) => String(p.Producto).toUpperCase().includes('SLIT')).length} registros SLIT.`);
        setTimeout(() => setSuccessMsgOps(null), 6000);
      } catch (err: any) {
        console.error("Error al procesar archivo operativo en modulo SLIT:", err);
        setErrorMsgOps(err.message || "Error al procesar la planilla.");
        setTimeout(() => setErrorMsgOps(null), 6000);
      } finally {
        setUploadingOps(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUploadArrivalsFile = (file: File) => {
    setUploadingArrivals(true);
    setErrorMsgArrivals(null);
    setSuccessMsgArrivals(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n =>
          n.toUpperCase().includes("BASE") ||
          n.toUpperCase().includes("LLEGADA") ||
          n.toUpperCase().includes("DATOS")
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
        if (jsonData.length < 2) throw new Error("Plantilla de llegada vacía.");

        let headerIdx = -1;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i].map(c => String(c || '').toUpperCase());
          if (row.includes('FECHA') || row.includes('EMPRESA') || row.includes('PRODUCTO')) {
            headerIdx = i;
            break;
          }
        }

        const startRow = headerIdx !== -1 ? headerIdx : 0;
        const headers = jsonData[startRow].map(h => String(h || '').toUpperCase().trim());
        const getIdx = (name: string, fallback: number) => {
          const found = headers.findIndex(h => h.includes(name.toUpperCase()));
          return found !== -1 ? found : fallback;
        };

        const idx = {
          fecha: getIdx("FECHA", 0),
          destino: getIdx("DESTINO", 3),
          empresa: getIdx("EMPRESA", 11),
          hora: getIdx("HORA", 14)
        };

        const processed = jsonData.slice(startRow + 1).map(row => {
          if (!row || row.length < 2) return null;

          let dateStr = '';
          const rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const d = new Date((rawDate - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              else dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          if (!dateStr) return null;

          let horaNum = 0;
          const rawHora = row[idx.hora];
          if (rawHora instanceof Date) {
            horaNum = rawHora.getHours() + (rawHora.getMinutes() / 60);
          } else if (typeof rawHora === 'string' && rawHora.includes(':')) {
            const parts = rawHora.split(':').map(Number);
            horaNum = (parts[0] || 0) + ((parts[1] || 0) / 60);
          } else if (typeof rawHora === 'number') {
            horaNum = rawHora * 24;
          }

          return {
            fecha: dateStr,
            destino: String(row[idx.destino] || 'SIN DESTINO').trim().toUpperCase(),
            empresa: normalizeCompanyName(row[idx.empresa]),
            hora: horaNum
          };
        }).filter(r => r !== null && !!r.fecha && !!r.empresa);

        if (processed.length === 0) throw new Error("No se procesaron transitos válidos.");

        setArrivalRawState(processed);
        localStorage.setItem('sqm_llegadas_data', JSON.stringify(processed));
        setSuccessMsgArrivals(`¡Llegadas de flota cargadas y sincronizadas correctas! Detected ${processed.length} tránsitos.`);
        setTimeout(() => setSuccessMsgArrivals(null), 6000);
      } catch (err: any) {
        console.error("Error al procesar archivo de llegada en modulo SLIT:", err);
        setErrorMsgArrivals(err.message || "Error al procesar bitácora.");
        setTimeout(() => setErrorMsgArrivals(null), 6000);
      } finally {
        setUploadingArrivals(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Load Llegada de Equipos data filtered specifically for SLIT companies
  const arrivalRawData = useMemo(() => {
    return (arrivalRawState || [])
      .map((row: any) => ({
        ...row,
        empresaStandard: mapArrivalCompanyToStandard(row.empresa)
      }))
      .filter((row: any) => row.empresaStandard === 'M&Q SPA' || row.empresaStandard === 'JORQUERA TRANSPORTE S.A.');
  }, [arrivalRawState]);

  // 1. Process and filter only SLIT rows for the 2 target companies
  const slitData = useMemo(() => {
    return (operationalRawData || [])
      .filter((row: any) => {
        const prod = String(row.Producto || '').trim().toUpperCase();
        return prod === 'SLIT' || prod.includes('SLIT');
      })
      .map((row: any) => {
        // Intelligent company determination waterfall for SLIT records
        let company = 'MINEX / OTRA';
        const rawEmp = String(row.EmpresaMapped || '').trim().toUpperCase();
        if (rawEmp) {
          company = mapArrivalCompanyToStandard(rawEmp);
        }
        
        // Waterfall check: Aljibes columns
        if (company === 'MINEX / OTRA') {
          const mqProg = Number(row.col_MqAljibesProg) || 0;
          const mqReal = Number(row.col_MqAljibesReal) || 0;
          const jorqProg = Number(row.col_JorqueraAljibesProg) || 0;
          const jorqReal = Number(row.col_JorqueraAljibesReal) || 0;
          
          if (mqProg > 0 || mqReal > 0) {
            company = 'M&Q SPA';
          } else if (jorqProg > 0 || jorqReal > 0) {
            company = 'JORQUERA TRANSPORTE S.A.';
          }
        }
        
        // Fallback: Check Destino text content
        if (company === 'MINEX / OTRA') {
          company = getCompanyFromDestino(row.Destino);
        }

        return {
          Fecha: row.Fecha,
          Producto: row.Producto,
          Destino: row.Destino,
          Empresa: company,
          Ton_Prog: Number(row.Ton_Prog) || 0,
          Ton_Real: Number(row.Ton_Real) || 0,
          Eq_Prog: Number(row.Eq_Prog) || 0,
          Eq_Real: Number(row.Eq_Real) || 0,
          Regulacion_Real: Number(row.Regulacion_Real) || 0,

          // Custom columns propagated from Excel parsing
          col_TiempoInteriorFaenaProdMeta: Number(row.col_TiempoInteriorFaenaProdMeta) || 0,
          col_TiempoInteriorFaenaReal: Number(row.col_TiempoInteriorFaenaReal) || 0,
          col_PromedioCargaMeta: Number(row.col_PromedioCargaMeta) || 0,
          col_PromedioCargaReal: Number(row.col_PromedioCargaReal) || 0,
          col_TonProg: Number(row.col_TonProg) || 0,
          col_TonReal: Number(row.col_TonReal) || 0,
          col_EqProg: Number(row.col_EqProg) || 0,
          col_EqReal: Number(row.col_EqReal) || 0,
          col_PercentCumplimiento: Number(row.col_PercentCumplimiento) || 0,
          col_CantidadRegulaciones: Number(row.col_CantidadRegulaciones) || 0,
          col_MqAljibesProg: Number(row.col_MqAljibesProg) || 0,
          col_MqAljibesReal: Number(row.col_MqAljibesReal) || 0,
          col_JorqueraAljibesProg: Number(row.col_JorqueraAljibesProg) || 0,
          col_JorqueraAljibesReal: Number(row.col_JorqueraAljibesReal) || 0
        };
      })
      .filter((row: any) => row.Empresa === 'M&Q SPA' || row.Empresa === 'JORQUERA TRANSPORTE S.A.');
  }, [operationalRawData]);


  // Extract unique sorted dates for option selections
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(slitData.map(r => r.Fecha))];
    return dates.sort(); // Ascending chronological: oldest first
  }, [slitData]);

  const uniqueDatesDesc = useMemo(() => {
    return [...uniqueDates].reverse(); // Descending: newest first
  }, [uniqueDates]);

  // Admin filter states
  const [filterType, setFilterType] = useState<'all' | 'single' | 'range'>('all');
  const [singleDate, setSingleDate] = useState<string>(() => {
    return uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : ''; // Default to newest
  });
  const [startDate, setStartDate] = useState<string>(() => {
    return uniqueDates.length > 0 ? uniqueDates[0] : ''; // Default to oldest
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : ''; // Default to newest
  });

  // Keep filter dates synchronized when uniqueDates updates (e.g. after file upload or localstorage sync)
  useEffect(() => {
    if (uniqueDates.length > 0) {
      if (!singleDate || !uniqueDates.includes(singleDate)) {
        setSingleDate(uniqueDates[uniqueDates.length - 1]);
      }
      if (!startDate || !uniqueDates.includes(startDate)) {
        setStartDate(uniqueDates[0]);
      }
      if (!endDate || !uniqueDates.includes(endDate)) {
        setEndDate(uniqueDates[uniqueDates.length - 1]);
      }
    }
  }, [uniqueDates, singleDate, startDate, endDate]);

  // Filter raw data based on selections
  const filteredSlitRows = useMemo(() => {
    if (filterType === 'all') {
      return slitData;
    }
    if (filterType === 'single') {
      return slitData.filter(r => r.Fecha === singleDate);
    }
    if (filterType === 'range') {
      const start = startDate <= endDate ? startDate : endDate;
      const end = startDate <= endDate ? endDate : startDate;
      return slitData.filter(r => r.Fecha >= start && r.Fecha <= end);
    }
    return slitData;
  }, [slitData, filterType, singleDate, startDate, endDate]);

  // Helper to determine if we should plot a historical timeline or a single category representation
  const showAsTimeline = useMemo(() => {
    if (filterType === 'all') return true;
    if (filterType === 'range') {
      const start = startDate <= endDate ? startDate : endDate;
      const end = startDate <= endDate ? endDate : startDate;
      return start !== end;
    }
    return false;
  }, [filterType, startDate, endDate]);

  const formatHoursToTime = (hours: number): string => {
    if (isNaN(hours) || hours <= 0) return "0:00";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const IndicatorRow = ({ label, value, color = 'text-[#461D77]' }: any) => (
    <div className="flex justify-between items-center py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/55 px-2 rounded-xl transition-colors">
      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-[900] ${color} tracking-tight uppercase`}>{value}</span>
    </div>
  );

  // Aggregate metrics
  const stats = useMemo(() => {
    const count = filteredSlitRows.length;
    const progTon = filteredSlitRows.reduce((a, b) => a + b.Ton_Prog, 0);
    const realTon = filteredSlitRows.reduce((a, b) => a + b.Ton_Real, 0);
    const progEq = filteredSlitRows.reduce((a, b) => a + b.Eq_Prog, 0);
    const realEq = filteredSlitRows.reduce((a, b) => a + b.Eq_Real, 0);
    const compliance = progTon > 0 ? (realTon / progTon) * 100 : 0;
    
    // Unique companies
    const activeCompanies = [...new Set(filteredSlitRows.map(r => r.Empresa))].length;

    // 1. Destinations frequency to find mainDest
    const destinations: Record<string, number> = {};
    filteredSlitRows.forEach(d => {
      const dest = String(d.Destino || 'S/D');
      destinations[dest] = (destinations[dest] || 0) + 1;
    });
    const mainDestEntry = Object.entries(destinations).sort((a, b) => b[1] - a[1])[0];
    const mainDest = mainDestEntry ? mainDestEntry[0] : 'S/D';

    // 2. Average regulacion real
    const avgReg = filteredSlitRows.length > 0 
      ? (filteredSlitRows.reduce((a, b) => a + (b.Regulacion_Real || 0), 0) / filteredSlitRows.length)
      : 0;

    // 3. Average load factor
    const avgLoad = realEq > 0 ? (realTon / realEq) : 0;

    // 4. Time calculations
    const faenaRealHoursList = filteredSlitRows.map(d => Number(d.col_TiempoInteriorFaenaReal) || 0).filter(v => v > 0);
    const faenaMetaHoursList = filteredSlitRows.map(d => Number(d.col_TiempoInteriorFaenaProdMeta) || 0).filter(v => v > 0);
    const avgFaenaReal = faenaRealHoursList.length > 0 
      ? (faenaRealHoursList.reduce((a, b) => a + b, 0) / faenaRealHoursList.length) 
      : 0;
    const avgFaenaMeta = faenaMetaHoursList.length > 0 
      ? (faenaMetaHoursList.reduce((a, b) => a + b, 0) / faenaMetaHoursList.length) 
      : 0;

    const isTonDeviation = compliance < 90;
    const isTimeDeviation = avgFaenaReal > 0 && avgFaenaMeta > 0 && (avgFaenaReal - avgFaenaMeta) >= (10 / 60);
    const hasAnyDeviation = isTonDeviation || isTimeDeviation;

    return {
      count,
      progTon,
      realTon,
      progEq,
      realEq,
      compliance,
      activeCompanies,
      tonDiff: realTon - progTon,
      eqDiff: realEq - progEq,
      mainDest,
      avgReg,
      avgLoad,
      avgFaenaReal,
      avgFaenaMeta,
      isTonDeviation,
      isTimeDeviation,
      hasAnyDeviation
    };
  }, [filteredSlitRows]);

  // Filter core transit arrivals based on selection
  const filteredArrivalRows = useMemo(() => {
    if (filterType === 'all') {
      return arrivalRawData;
    }
    if (filterType === 'single') {
      return arrivalRawData.filter((r: any) => r.fecha === singleDate);
    }
    if (filterType === 'range') {
      const start = startDate <= endDate ? startDate : endDate;
      const end = startDate <= endDate ? endDate : startDate;
      return arrivalRawData.filter((r: any) => r.fecha >= start && r.fecha <= end);
    }
    return arrivalRawData;
  }, [arrivalRawData, filterType, singleDate, startDate, endDate]);

  // Combined statistics
  const crossStats = useMemo(() => {
    const totalArrivals = filteredArrivalRows.length;
    const hasArrivalsData = arrivalRawData.length > 0;
    const activeEqReal = stats.realEq;
    const globalTripsPerTruck = activeEqReal > 0 ? (totalArrivals / activeEqReal) : 0;
    const globalTonsPerTrip = totalArrivals > 0 ? (stats.realTon / totalArrivals) : 0;

    return {
      totalArrivals,
      hasArrivalsData,
      globalTripsPerTruck: Number(globalTripsPerTruck.toFixed(2)),
      globalTonsPerTrip: Number(globalTonsPerTrip.toFixed(1))
    };
  }, [filteredArrivalRows, arrivalRawData, stats]);

  const crossCompanyAnalytics = useMemo(() => {
    // Get all unique companies from both datasets
    const uniqueCos = [...new Set([
      ...filteredSlitRows.map(r => r.Empresa),
      ...filteredArrivalRows.map(r => r.empresaStandard)
    ])].filter(Boolean);

    return uniqueCos.map(co => {
      const slitRows = filteredSlitRows.filter(r => r.Empresa === co);
      const arrivalRows = filteredArrivalRows.filter(r => r.empresaStandard === co);

      const tonsReal = slitRows.reduce((sum, r) => sum + r.Ton_Real, 0);
      const eqReal = slitRows.reduce((sum, r) => sum + r.Eq_Real, 0);
      const physicalArrivals = arrivalRows.length;

      // Viajes promedio por camión
      const tripsPerTruck = eqReal > 0 ? (physicalArrivals / eqReal) : 0;
      // Toneladas promedio por viaje físico
      const tonsPerTrip = physicalArrivals > 0 ? (tonsReal / physicalArrivals) : 0;

      return {
        name: co,
        tonsReal: Number(tonsReal.toFixed(2)),
        eqReal,
        physicalArrivals,
        tripsPerTruck: Number(tripsPerTruck.toFixed(1)),
        tonsPerTrip: Number(tonsPerTrip.toFixed(1))
      };
    }).sort((a, b) => b.tonsReal - a.tonsReal);
  }, [filteredSlitRows, filteredArrivalRows]);

  // Timeline of arrivals vs tons
  const crossTimelineData = useMemo(() => {
    if (!showAsTimeline) return [];
    
    // Group by Fecha
    const grouped: Record<string, { name: string; dateLabel: string; RealTon: number; Arribos: number }> = {};
    
    filteredSlitRows.forEach(row => {
      if (!grouped[row.Fecha]) {
        grouped[row.Fecha] = { name: row.Fecha, dateLabel: formatDateToCL(row.Fecha), RealTon: 0, Arribos: 0 };
      }
      grouped[row.Fecha].RealTon += row.Ton_Real;
    });

    filteredArrivalRows.forEach(row => {
      if (!grouped[row.fecha]) {
        grouped[row.fecha] = { name: row.fecha, dateLabel: formatDateToCL(row.fecha), RealTon: 0, Arribos: 0 };
      }
      grouped[row.fecha].Arribos += 1;
    });

    return Object.values(grouped)
      .map(item => ({
        ...item,
        RealTon: Number(item.RealTon.toFixed(2))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSlitRows, filteredArrivalRows, showAsTimeline]);

  // NEW ANALYSIS DATASET: Process the 14 custom columns requested by the user
  const customColumnsData = useMemo(() => {
    // 1. Group by date to show trends over time
    const groupedByDate: Record<string, any> = {};
    
    filteredSlitRows.forEach((row: any) => {
      const dt = row.Fecha;
      if (!groupedByDate[dt]) {
        groupedByDate[dt] = {
          date: dt,
          dateLabel: formatDateToCL(dt),
          // Time Inside Faena (Meta AX vs Real AY)
          timeInsideFaenaMetaSum: 0,
          timeInsideFaenaMetaCount: 0,
          timeInsideFaenaRealSum: 0,
          timeInsideFaenaRealCount: 0,
          // Average Load (Meta AV vs Real AW)
          avgLoadMetaSum: 0,
          avgLoadMetaCount: 0,
          avgLoadRealSum: 0,
          avgLoadRealCount: 0,
          // Totals for Ton, Eq, Compliance, Regulations
          tonProg: 0,
          tonReal: 0,
          eqProg: 0,
          eqReal: 0,
          complianceSum: 0,
          complianceCount: 0,
          regulationsCount: 0,
          // Aljibes water bowsers
          mqAljibesProg: 0,
          mqAljibesReal: 0,
          jorqueraAljibesProg: 0,
          jorqueraAljibesReal: 0
        };
      }
      
      const g = groupedByDate[dt];
      
      if (row.col_TiempoInteriorFaenaProdMeta > 0) {
        g.timeInsideFaenaMetaSum += row.col_TiempoInteriorFaenaProdMeta;
        g.timeInsideFaenaMetaCount++;
      }
      if (row.col_TiempoInteriorFaenaReal > 0) {
        g.timeInsideFaenaRealSum += row.col_TiempoInteriorFaenaReal;
        g.timeInsideFaenaRealCount++;
      }
      
      if (row.col_PromedioCargaMeta > 0) {
        g.avgLoadMetaSum += row.col_PromedioCargaMeta;
        g.avgLoadMetaCount++;
      }
      if (row.col_PromedioCargaReal > 0) {
        g.avgLoadRealSum += row.col_PromedioCargaReal;
        g.avgLoadRealCount++;
      }
      
      g.tonProg += row.col_TonProg || 0;
      g.tonReal += row.col_TonReal || 0;
      g.eqProg += row.col_EqProg || 0;
      g.eqReal += row.col_EqReal || 0;
      
      if (row.col_PercentCumplimiento > 0) {
        g.complianceSum += row.col_PercentCumplimiento;
        g.complianceCount++;
      }
      
      g.regulationsCount += row.col_CantidadRegulaciones || 0;
      
      g.mqAljibesProg += row.col_MqAljibesProg || 0;
      g.mqAljibesReal += row.col_MqAljibesReal || 0;
      g.jorqueraAljibesProg += row.col_JorqueraAljibesProg || 0;
      g.jorqueraAljibesReal += row.col_JorqueraAljibesReal || 0;
    });
    
    const timeTrend = Object.values(groupedByDate).map((g: any) => {
      const timeMeta = g.timeInsideFaenaMetaCount > 0 ? (g.timeInsideFaenaMetaSum / g.timeInsideFaenaMetaCount) : 0;
      const timeReal = g.timeInsideFaenaRealCount > 0 ? (g.timeInsideFaenaRealSum / g.timeInsideFaenaRealCount) : 0;
      const loadMeta = g.avgLoadMetaCount > 0 ? (g.avgLoadMetaSum / g.avgLoadMetaCount) : 0;
      const loadReal = g.avgLoadRealCount > 0 ? (g.avgLoadRealSum / g.avgLoadRealCount) : 0;
      const avgCompliance = g.complianceCount > 0 ? (g.complianceSum / g.complianceCount) : (g.tonProg > 0 ? (g.tonReal / g.tonProg) * 100 : 0);
      
      return {
        date: g.date,
        dateLabel: g.dateLabel,
        timeInsideFaenaMeta: Number(timeMeta.toFixed(2)),
        timeInsideFaenaReal: Number(timeReal.toFixed(2)),
        avgLoadMeta: Number(loadMeta.toFixed(1)),
        avgLoadReal: Number(loadReal.toFixed(1)),
        tonProg: Number(g.tonProg.toFixed(2)),
        tonReal: Number(g.tonReal.toFixed(2)),
        eqProg: g.eqProg,
        eqReal: g.eqReal,
        compliancePercent: Number(avgCompliance.toFixed(1)),
        regulationsCount: g.regulationsCount,
        mqAljibesProg: g.mqAljibesProg,
        mqAljibesReal: g.mqAljibesReal,
        jorqueraAljibesProg: g.jorqueraAljibesProg,
        jorqueraAljibesReal: g.jorqueraAljibesReal,
        totalAljibesProg: g.mqAljibesProg + g.jorqueraAljibesProg,
        totalAljibesReal: g.mqAljibesReal + g.jorqueraAljibesReal
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    // 2. Global averages/sums for summary cards
    let globalTimeMetaSum = 0;
    let globalTimeMetaCount = 0;
    let globalTimeRealSum = 0;
    let globalTimeRealCount = 0;
    
    let globalLoadMetaSum = 0;
    let globalLoadMetaCount = 0;
    let globalLoadRealSum = 0;
    let globalLoadRealCount = 0;
    
    let globalTonProg = 0;
    let globalTonReal = 0;
    let globalEqProg = 0;
    let globalEqReal = 0;
    let globalComplianceSum = 0;
    let globalComplianceCount = 0;
    let globalRegulations = 0;
    
    let globalMqAljibesProg = 0;
    let globalMqAljibesReal = 0;
    let globalJorqueraAljibesProg = 0;
    let globalJorqueraAljibesReal = 0;
    
    filteredSlitRows.forEach((row: any) => {
      if (row.col_TiempoInteriorFaenaProdMeta > 0) {
        globalTimeMetaSum += row.col_TiempoInteriorFaenaProdMeta;
        globalTimeMetaCount++;
      }
      if (row.col_TiempoInteriorFaenaReal > 0) {
        globalTimeRealSum += row.col_TiempoInteriorFaenaReal;
        globalTimeRealCount++;
      }
      if (row.col_PromedioCargaMeta > 0) {
        globalLoadMetaSum += row.col_PromedioCargaMeta;
        globalLoadMetaCount++;
      }
      if (row.col_PromedioCargaReal > 0) {
        globalLoadRealSum += row.col_PromedioCargaReal;
        globalLoadRealCount++;
      }
      
      globalTonProg += row.col_TonProg || 0;
      globalTonReal += row.col_TonReal || 0;
      globalEqProg += row.col_EqProg || 0;
      globalEqReal += row.col_EqReal || 0;
      
      if (row.col_PercentCumplimiento > 0) {
        globalComplianceSum += row.col_PercentCumplimiento;
        globalComplianceCount++;
      }
      globalRegulations += row.col_CantidadRegulaciones || 0;
      
      globalMqAljibesProg += row.col_MqAljibesProg || 0;
      globalMqAljibesReal += row.col_MqAljibesReal || 0;
      globalJorqueraAljibesProg += row.col_JorqueraAljibesProg || 0;
      globalJorqueraAljibesReal += row.col_JorqueraAljibesReal || 0;
    });
    
    const globalTimeInsideFaenaMeta = globalTimeMetaCount > 0 ? (globalTimeMetaSum / globalTimeMetaCount) : 0;
    const globalTimeInsideFaenaReal = globalTimeRealCount > 0 ? (globalTimeRealSum / globalTimeRealCount) : 0;
    
    const globalAvgLoadMeta = globalLoadMetaCount > 0 ? (globalLoadMetaSum / globalLoadMetaCount) : 0;
    const globalAvgLoadReal = globalLoadRealCount > 0 ? (globalLoadRealSum / globalLoadRealCount) : 0;
    
    const globalPercentCompliance = globalComplianceCount > 0 ? (globalComplianceSum / globalComplianceCount) : (globalTonProg > 0 ? (globalTonReal / globalTonProg) * 100 : 0);
    
    const aljibesData = [
      { name: 'M&Q Aljibes', Programado: globalMqAljibesProg, Real: globalMqAljibesReal },
      { name: 'Jorquera Aljibes', Programado: globalJorqueraAljibesProg, Real: globalJorqueraAljibesReal }
    ];
    
    return {
      timeTrend,
      aljibesData,
      summary: {
        timeMeta: Number(globalTimeInsideFaenaMeta.toFixed(2)),
        timeReal: Number(globalTimeInsideFaenaReal.toFixed(2)),
        loadMeta: Number(globalAvgLoadMeta.toFixed(1)),
        loadReal: Number(globalAvgLoadReal.toFixed(1)),
        tonProg: Number(globalTonProg.toFixed(2)),
        tonReal: Number(globalTonReal.toFixed(2)),
        eqProg: globalEqProg,
        eqReal: globalEqReal,
        compliancePercent: Number(globalPercentCompliance.toFixed(1)),
        totalRegulations: globalRegulations,
        mqAljibesProg: globalMqAljibesProg,
        mqAljibesReal: globalMqAljibesReal,
        jorqueraAljibesProg: globalJorqueraAljibesProg,
        jorqueraAljibesReal: globalJorqueraAljibesReal
      }
    };
  }, [filteredSlitRows]);

  // Chart data: Tonnage by Company
  const companyTonnageData = useMemo(() => {
    const grouped: Record<string, { name: string; Programado: number; Real: number }> = {};
    filteredSlitRows.forEach(row => {
      const emp = row.Empresa;
      if (!grouped[emp]) {
        grouped[emp] = { name: emp, Programado: 0, Real: 0 };
      }
      grouped[emp].Programado += row.Ton_Prog;
      grouped[emp].Real += row.Ton_Real;
    });
    return Object.values(grouped).map(item => ({
      ...item,
      Programado: Number(item.Programado.toFixed(2)),
      Real: Number(item.Real.toFixed(2))
    })).sort((a, b) => b.Real - a.Real);
  }, [filteredSlitRows]);

  // Chart data: Equipos by Company
  const companyEquiposData = useMemo(() => {
    const grouped: Record<string, { name: string; Programado: number; Real: number }> = {};
    filteredSlitRows.forEach(row => {
      const emp = row.Empresa;
      if (!grouped[emp]) {
        grouped[emp] = { name: emp, Programado: 0, Real: 0 };
      }
      grouped[emp].Programado += row.Eq_Prog;
      grouped[emp].Real += row.Eq_Real;
    });
    return Object.values(grouped).sort((a, b) => b.Real - a.Real);
  }, [filteredSlitRows]);

  // Chart data: Timeline representation (Historical progression when "all dates" is active, or just day details)
  const timelineData = useMemo(() => {
    const grouped: Record<string, { name: string; dateLabel: string; ProgramadoTon: number; RealTon: number; ProgramadoEq: number; RealEq: number }> = {};
    const groupKey = showAsTimeline ? 'Fecha' : 'Empresa';
    
    filteredSlitRows.forEach(row => {
      const key = groupKey === 'Fecha' ? row.Fecha : row.Empresa;
      if (!grouped[key]) {
        grouped[key] = { 
          name: key, 
          dateLabel: groupKey === 'Fecha' ? formatDateToCL(row.Fecha) : key,
          ProgramadoTon: 0, 
          RealTon: 0,
          ProgramadoEq: 0,
          RealEq: 0
        };
      }
      grouped[key].ProgramadoTon += row.Ton_Prog;
      grouped[key].RealTon += row.Ton_Real;
      grouped[key].ProgramadoEq += row.Eq_Prog;
      grouped[key].RealEq += row.Eq_Real;
    });
    
    return Object.values(grouped)
       .map(item => ({
         ...item,
         ProgramadoTon: Number(item.ProgramadoTon.toFixed(2)),
         RealTon: Number(item.RealTon.toFixed(2))
       }))
       .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSlitRows, showAsTimeline]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] flex flex-col justify-between">
      
      {/* Decorative background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec03_1px,transparent_1px),linear-gradient(to_bottom,#7177ec03_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />
      
      <div className="relative z-10 w-full max-w-[102rem] mx-auto px-6 py-6 md:py-10 flex-grow flex flex-col gap-6 md:gap-8">
        
        {/* Header bar */}
        <header className="w-full bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onBack}
              className="w-11 h-11 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1.5 bg-[#461D77]/10 text-[#461D77] text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
                <ShieldCheck size={11} /> Módulo Administración Exclusiva
              </span>
              <h1 className="text-2xl font-[900] text-slate-800 tracking-tighter uppercase leading-none">ANALÍTICA DE PRODUCTO: SLIT</h1>
            </div>
          </div>

          {/* Quick actions & stats indicators */}
          <div className="flex flex-wrap items-center gap-4 bg-white/40 border border-white/50 p-2 rounded-2xl">
            <button 
              type="button"
              onClick={() => setShowUploadCenter(!showUploadCenter)}
              className="px-4 py-2 bg-[#461D77] hover:bg-[#5C2B95] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Upload size={13} className={uploadingOps || uploadingArrivals ? "animate-spin" : ""} />
              {showUploadCenter ? 'Ocultar Panel Excel' : 'Cargar Planillas Excel'}
            </button>

            <div className="text-right border-l border-slate-200/60 pl-3">
              <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-widest">PRODUCTO ACTIVO</span>
              <span className="text-xs font-black text-[#461D77] bg-[#461D77]/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">LITIO SLIT</span>
            </div>
          </div>
        </header>

        {/* --------------------- CENTRO DE CARGA DIRECTA DE PLANILLAS --------------------- */}
        {showUploadCenter && (
          <section className="w-full bg-white/75 backdrop-blur-xl p-8 rounded-[2.5rem] border border-[#461D77]/10 shadow-sm space-y-6 animate-fadeIn relative z-20">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#461D77]/5 rounded-bl-full pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-0.5">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="text-[#461D77]" size={20} />
                  Centro de Carga y Sincronización Doble (SLIT)
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Cargue de forma directa las planillas para actualizar en tiempo real el universo de despacho y tránsitos SLIT.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowUploadCenter(false)}
                className="text-xs font-black text-[#461D77] hover:text-[#5C2B95] uppercase tracking-wider underline cursor-pointer"
              >
                Ocultar panel
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
              
              {/* UPLOADER 1: INFORME OPERATIVO */}
              <div 
                className={`border-2 border-dashed rounded-[2rem] p-6 transition-all flex flex-col justify-between min-h-[240px] ${
                  dragOverOps 
                    ? 'border-[#461D77] bg-[#461D77]/5' 
                    : 'border-slate-200 hover:border-slate-300 bg-white/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverOps(true); }}
                onDragLeave={() => setDragOverOps(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverOps(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleUploadOperationalFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-[#461D77]/10 text-[#461D77] rounded-full">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">1. Informe Operativo</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Planilla de Base de Datos General</p>
                      </div>
                    </div>
                    {operationalRawData.length > 0 ? (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1 uppercase tracking-wide flex items-center gap-1 font-mono">
                        <CheckCircle2 size={12} /> {operationalRawData.length} Regs
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1 uppercase tracking-wide">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 font-medium leading-normal mb-4">
                    Contiene las toneladas, equipos programados/reales, cumplimientos, regulaciones totales y dotaciones de aljibes (AX, AY, AV, AW, AH, AI, AJ, AK, AL, AS, M, N, U, V).
                  </p>
                  
                  {/* Status Indicator inside Zone */}
                  <div className="text-[11px] font-semibold text-slate-500 bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 flex flex-col gap-1">
                    <span className="font-bold text-[#461D77] uppercase text-[9px] tracking-wider leading-none mb-1">Filtro automático M9 para SLIT:</span>
                    <div>• M&Q / JORQUERA detectadas en base: <strong className="text-slate-800 font-bold">{slitData.length} filas coinciden</strong></div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <label className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#461D77] to-[#5C2B95] hover:opacity-95 text-white py-3 px-4 rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer select-none">
                    {uploadingOps ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> PROCESANDO PLANILLA...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Cargar Informe Operativo
                      </>
                    )}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.xlsm" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadOperationalFile(e.target.files[0]);
                        }
                      }}
                      disabled={uploadingOps}
                    />
                  </label>

                  {errorMsgOps && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 flex items-start gap-2 animate-fadeIn font-mono">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsgOps}</span>
                    </div>
                  )}

                  {successMsgOps && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-600 flex items-start gap-2 animate-fadeIn font-mono">
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                      <span>{successMsgOps}</span>
                    </div>
                  )}
                </div>
              </div>


              {/* UPLOADER 2: LLEGADA DE EQUIPOS */}
              <div 
                className={`border-2 border-dashed rounded-[2rem] p-6 transition-all flex flex-col justify-between min-h-[240px] ${
                  dragOverArrivals 
                    ? 'border-[#3FAA88] bg-[#3FAA88]/5' 
                    : 'border-slate-200 hover:border-slate-300 bg-white/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverArrivals(true); }}
                onDragLeave={() => setDragOverArrivals(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverArrivals(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleUploadArrivalsFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-[#3FAA88]/10 text-[#3FAA88] rounded-full">
                        <Truck size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">2. Llegada de Equipos</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bitácora de Tránsito / Retornos</p>
                      </div>
                    </div>
                    {arrivalRawData.length > 0 ? (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1 uppercase tracking-wide flex items-center gap-1 font-mono">
                        <CheckCircle2 size={12} /> {arrivalRawData.length} Arribos
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1 uppercase tracking-wide">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 font-medium leading-normal mb-4">
                    Registra los tránsitos y arribos físicos de camiones de la bitácora de control de flota, permitiendo analizar la cargabilidad y rotación real por empresa.
                  </p>

                  {/* Status Indicator inside Zone */}
                  <div className="text-[11px] font-semibold text-slate-500 bg-slate-50/50 border border-slate-100/80 rounded-xl p-3 flex flex-col gap-1">
                    <span className="font-bold text-[#3FAA88] uppercase text-[9px] tracking-wider leading-none mb-1">Rotación y Arribos sincronizados:</span>
                    <div>• Total Arribos en el set: <strong className="text-slate-800 font-bold">{arrivalRawState.length} tránsitos generales</strong></div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <label className="w-full flex items-center justify-center gap-2 bg-[#3FAA88] hover:bg-[#328e71] text-white py-3 px-4 rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer select-none">
                    {uploadingArrivals ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> PROCESANDO BITÁCORA...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Cargar Llegada de Equipos
                      </>
                    )}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.xlsm" 
                      className="hidden"  
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadArrivalsFile(e.target.files[0]);
                        }
                      }}
                      disabled={uploadingArrivals}
                    />
                  </label>

                  {errorMsgArrivals && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 flex items-start gap-2 animate-fadeIn font-mono">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsgArrivals}</span>
                    </div>
                  )}

                  {successMsgArrivals && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-600 flex items-start gap-2 animate-fadeIn font-mono">
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                      <span>{successMsgArrivals}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Filters control bar */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="p-3 bg-violet-600/10 text-[#461D77] rounded-2xl flex items-center justify-center shrink-0">
              <Filter size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Rango de Consulta Operativa</h2>
              <p className="text-xs text-slate-400 font-medium leading-none mt-0.5">Defina el alcance temporal para analizar los KPIs de despacho para Litio SLIT.</p>
            </div>
          </div>

          {/* Filter Type Pills & Inputs Container */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 transition-all duration-300">
            {/* Filter Mode Selector Pills */}
            <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 shrink-0">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === 'all' 
                    ? 'bg-white text-[#461D77] shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Histórico Completo
              </button>
              <button
                type="button"
                onClick={() => setFilterType('single')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === 'single' 
                    ? 'bg-white text-[#461D77] shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Día Único
              </button>
              <button
                type="button"
                onClick={() => setFilterType('range')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === 'range' 
                    ? 'bg-white text-[#461D77] shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Rango Personalizado
              </button>
            </div>

            {/* Date selections rendering */}
            <div className="flex flex-wrap items-center gap-3">
              {filterType === 'single' && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">FECHA:</span>
                  <select
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-black text-[#461D77] outline-none focus:ring-4 focus:ring-[#461D77]/10"
                  >
                    {uniqueDatesDesc.map(d => (
                      <option key={d} value={d}>{formatDateToCL(d)}</option>
                    ))}
                  </select>
                </div>
              )}

              {filterType === 'range' && (
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">DESDE:</span>
                    <select
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-black text-[#461D77] outline-none focus:ring-4 focus:ring-[#461D77]/10"
                    >
                      {uniqueDates.map(d => (
                        <option key={d} value={d}>{formatDateToCL(d)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">HASTA:</span>
                    <select
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-black text-[#461D77] outline-none focus:ring-4 focus:ring-[#461D77]/10"
                    >
                      {uniqueDates.map(d => (
                        <option key={d} value={d}>{formatDateToCL(d)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {filterType === 'all' && (
                <div className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-2xl uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Consolidadas {uniqueDates.length} jornadas operativas
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ----- AUDITORÍA DE DESEMPEÑO SLIT (MATCHING IMAGE EXACTLY) ----- */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          
          {/* Section title & header inside the card container to match exact image framing */}
          <div className="flex justify-between items-end border-b border-slate-100 pb-3">
            <div className="space-y-0.5 animate-fadeIn">
              <p className="text-[10px] font-black text-[#3FAA88] uppercase tracking-[0.3em]">AUDITORÍA DE DESEMPEÑO</p>
              <h2 className="text-6xl font-[950] text-[#461D77] tracking-tighter leading-none uppercase">SLIT</h2>
            </div>
            <div className="bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase mb-1">
              ÍTEM 1 / 7
            </div>
          </div>

          {/* Centered compliance status pill */}
          <div className="flex flex-col items-center pt-1">
            <div className={`px-8 py-2 rounded-full ${stats.hasAnyDeviation ? 'bg-rose-500 text-white animate-pulse' : 'bg-[#3FAA88]/10 text-[#3FAA88]'} text-[10px] font-black tracking-[0.25em] shadow-sm uppercase`}>
              {stats.hasAnyDeviation ? 'REQUIERE JUSTIFICACIÓN TÉCNICA' : 'CUMPLIMIENTO OPERATIVO EXITOSO'}
            </div>
          </div>

          {/* Cards Row: Grid of 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: CARGA REAL */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-slate-50 text-slate-500 group-hover:text-[#461D77] rounded-xl transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <div className={`text-[10px] font-black px-3 py-1 rounded-full ${stats.tonDiff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} uppercase tracking-tight`}>
                  {stats.tonDiff >= 0 ? '+' : ''}{formatNumberWithDecimals(stats.tonDiff, 2)} VS PROG
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CARGA REAL</p>
                <h3 className="text-3xl font-[900] text-slate-800 tracking-tight">{formatNumberWithDecimals(stats.realTon, 2)} Ton</h3>
              </div>
            </div>

            {/* Card 2: FLOTA REAL */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-slate-50 text-slate-500 group-hover:text-[#461D77] rounded-xl transition-colors">
                  <Truck className="w-5 h-5" />
                </div>
                <div className={`text-[10px] font-black px-3 py-1 rounded-full ${stats.eqDiff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} uppercase tracking-tight`}>
                  {stats.eqDiff >= 0 ? '+' : ''}{stats.eqDiff} VS PROG
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">FLOTA REAL</p>
                <h3 className="text-3xl font-[900] text-slate-800 tracking-tight">{stats.realEq} EQ</h3>
              </div>
            </div>

            {/* Card 3: CUMPLIMIENTO */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-slate-50 text-slate-500 group-hover:text-[#461D77] rounded-xl transition-colors">
                  <Target className="w-5 h-5" />
                </div>
                <div className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                  stats.compliance >= 100 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                    : stats.compliance >= 90 
                      ? 'bg-amber-50 text-amber-600 border-amber-100' 
                      : 'bg-rose-50 text-rose-600 border-rose-100'
                } uppercase tracking-tight`}>
                  {(stats.compliance - 100) >= 0 ? '+' : ''}{(stats.compliance - 100).toFixed(1)} %
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CUMPLIMIENTO</p>
                <h3 className="text-3xl font-[900] text-[#461D77] tracking-tight">{stats.compliance.toFixed(1)}%</h3>
              </div>
            </div>

            {/* Card 4: DESTINO CRÍTICO */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-end relative overflow-hidden group">
              <div className="absolute top-6 right-6">
                <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-black text-[#461D77] uppercase tracking-widest mb-1">DESTINO CRÍTICO</p>
                <h3 className="text-2xl font-[900] text-[#461D77] tracking-tight uppercase truncate">
                  {stats.mainDest}
                </h3>
              </div>
            </div>

          </div>

          {/* Lower comparative chart & indicators table layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            
            {/* Chart module: 2/3 width */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { name: 'Tonelaje', Programado: stats.progTon, Real: stats.realTon },
                      { name: 'Equipos', Programado: stats.progEq, Real: stats.realEq }
                    ]} 
                    barGap={15} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }} />
                    <YAxis hide />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '10px', fontSize: '12px', fontWeight: '900' }} 
                      iconType="square" 
                      iconSize={8} 
                    />
                    <Bar isAnimationActive={false} dataKey="Programado" fill="#461D77" radius={[6, 6, 6, 6]} barSize={45}>
                      <LabelList dataKey="Programado" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#461D77', fontSize: '10px', fontWeight: '900' }} offset={8} />
                    </Bar>
                    <Bar isAnimationActive={false} dataKey="Real" fill="#3FAA88" radius={[6, 6, 6, 6]} barSize={45}>
                      <LabelList dataKey="Real" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#3FAA88', fontSize: '10px', fontWeight: '900' }} offset={8} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
 
            {/* Indicators table: 1/3 width */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center space-y-2">
              <IndicatorRow label="REGULACIONES" value={`${formatNumberWithDecimals(stats.avgReg, 1)}%`} />
              <IndicatorRow label="FACTOR CARGA" value={`${stats.avgLoad.toFixed(1)} T/EQ`} />
              <div className="h-px bg-slate-200/60 w-full my-2" />
              <IndicatorRow label="TPO. REAL" value={formatHoursToTime(stats.avgFaenaReal)} color={stats.avgFaenaReal > stats.avgFaenaMeta && (stats.avgFaenaReal - stats.avgFaenaMeta) >= (10 / 60) ? 'text-rose-600' : 'text-[#3FAA88]'} />
              <IndicatorRow label="TPO. META" value={formatHoursToTime(stats.avgFaenaMeta)} />
            </div>

          </div>

          {/* Persistence date flag label at the bottom outer corner */}
          <div className="flex justify-end pr-1 pt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              PERSISTENCIA LOCAL: {filterType === 'single' ? singleDate : filterType === 'range' ? `${startDate} / ${endDate}` : 'CONSOLIDADO GENERAL'} &bull; SLIT
            </span>
          </div>

        </div>

        {/* EMPALME DE DOS ARCHIVOS: ANÁLISIS CRUZADO OPERATIVO VS TRÁNSITO (Llegada de Equipos & Informe Operativo) */}
        <section className="bg-gradient-to-br from-[#fdfcfb] to-[#eceaf3] p-8 rounded-[2.5rem] border border-[#461D77]/10 shadow-sm space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#7177ec]/5 rounded-full blur-[80px]" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 bg-[#461D77]/10 text-[#461D77] text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase">
                <Truck size={10} className="animate-bounce" /> Integración de Dos Archivos Excel
              </span>
              <h2 className="text-xl font-[900] text-slate-800 tracking-tight uppercase">Analítica Cruzacional: Informe Operativo vs Tránsito</h2>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Intersección inteligente de datos declarados (Despacho SLIT) con los registros físicos cargados del archivo de Llegada de Equipos.
              </p>
            </div>
            
            <div className="text-xs font-bold text-slate-400 font-mono bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-2xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              Estado de Sincronización: <span className={crossStats.hasArrivalsData ? "text-emerald-600 font-black" : "text-amber-500 font-black"}>{crossStats.hasArrivalsData ? "CONECTADO" : "PENDIENTE DE CARGA"}</span>
            </div>
          </div>

          {!crossStats.hasArrivalsData ? (
            <div className="p-8 bg-white/60 border border-slate-200 rounded-[2rem] text-center max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Truck size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Archivo de Llegada de Equipos no Detectado</h3>
                <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto leading-relaxed">
                  Para habilitar y sincronizar las capas de gráficos de rotación de flota y cargabilidad promedio, suba primero el archivo Excel correspondiente en el módulo de <strong className="text-[#461D77] font-black cursor-pointer hover:underline">"Llegada de Equipos"</strong>. El sistema cruzará ambas fuentes automáticamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* CROSS KPIs CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Physical Arrivals */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/50 rounded-bl-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arribos Físicos de Flota</span>
                    <span className="text-indigo-600 bg-indigo-50 p-2.5 rounded-xl text-xs"><Truck size={14} /></span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-[900] text-slate-800 tracking-tight">{crossStats.totalArrivals} Arribos</h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">Registrados en bitácora de tránsito.</p>
                  </div>
                </div>

                {/* 2. Rotation / Trips per Truck */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50/50 rounded-bl-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rotación (Promedio Viajes)</span>
                    <span className="text-[#461D77] bg-[#461D77]/10 p-2.5 rounded-xl text-xs"><TrendingUp size={14} /></span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-[900] text-slate-800 tracking-tight">{crossStats.globalTripsPerTruck} Viajes / Eq</h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">Viajes por camión activo en las jornadas.</p>
                  </div>
                </div>

                {/* 3. Load Factor (Tons/Trip) */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-teal-50/50 rounded-bl-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargabilidad Real Promedio</span>
                    <span className="text-[#3FAA88] bg-[#3FAA88]/10 p-2.5 rounded-xl text-xs"><Scale size={14} /></span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-[900] text-slate-800 tracking-tight">{crossStats.globalTonsPerTrip} Tons / Viaje</h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">Peso transportado promedio por viaje.</p>
                  </div>
                </div>

              </div>

              {/* CROSS SPECIALIST CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Visual 1: Rotación (Viajes/Vehículo) por Empresa */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">EFICIENCIA OPERATIVA JORNAL</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Rotación de Flota (Viajes por Camión por Empresa)</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crossCompanyAnalytics} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} viajes/eq`, 'Rotación']} />
                        <Bar dataKey="tripsPerTruck" name="Viajes/Camión" fill="#5c3db5" radius={[4, 4, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Visual 2: Factor de Carga (Tons/Trip) por Empresa */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-black text-teal-600 uppercase tracking-[0.2em]">APROVECHAMIENTO ÚTIL</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Factor de Carga Promedio (Kilogramos/Viaje)</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crossCompanyAnalytics} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} Ton/Viaje`, 'Factor de Carga']} />
                        <Bar dataKey="tonsPerTrip" name="Tons/Viaje" fill="#3FAA88" radius={[4, 4, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Visual 3 (Optional Timeline Integration on Historical view) */}
              {showAsTimeline && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm w-full">
                  <div>
                    <span className="text-[9px] font-black text-purple-600 uppercase tracking-[0.2em]">CORRELACIÓN TEMPORAL</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Sincronía de Ritmos: Toneladas Reales vs Frecuencia de Arribos en el Tiempo</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={crossTimelineData} margin={{ top: 20, right: 15, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#5c3db5' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px' }} />
                        <Line yAxisId="left" type="monotone" dataKey="RealTon" name="Tonelaje Real (Ton)" stroke="#3FAA88" strokeWidth={3} dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="Arribos" name="Arribos Físicos (Frecuencia)" stroke="#5c3db5" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Error / No Data warning */}
        {slitData.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-8 rounded-3xl text-center space-y-3">
            <Eye size={36} className="mx-auto text-amber-500" />
            <h3 className="text-base font-black uppercase tracking-wider">SIN REGISTROS DE PRODUCTO "SLIT"</h3>
            <p className="text-xs font-semibold text-slate-500 max-w-sm mx-auto">
              No se han encontrado registros del producto SLIT en la base de datos Excel actualmente guardada en el sistema. Debe cargar un Excel con este producto en el módulo de "Informe Operativo" para habilitar las capas de gráficos.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* CHARTS CONTAINER GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* CHART 1: Tonelaje total programado vs tonelaje total real (General) */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-[#461D77] uppercase tracking-[0.2em]">RENDIMIENTO GENERAL</span>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Tons: Programado vs Real (Consolidado)</h3>
                </div>
                
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {showAsTimeline ? (
                      // Area Chart over historical days
                      <AreaChart data={timelineData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="ProgramadoTon" name="Prog Ton" stroke="#461D77" fillOpacity={0.05} fill="#461D77" strokeWidth={2} />
                        <Area type="monotone" dataKey="RealTon" name="Real Ton" stroke="#3FAA88" fillOpacity={0.15} fill="#3FAA88" strokeWidth={3} />
                      </AreaChart>
                    ) : (
                      // Double Column Chart comparing general tons for the day
                      <BarChart data={[{ name: 'General', Programado: stats.progTon, Real: stats.realTon }]} barGap={12} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                        <Bar dataKey="Programado" name="Prog Ton" fill="#461D77" radius={[4, 4, 0, 0]} barSize={55} />
                        <Bar dataKey="Real" name="Real Ton" fill="#3FAA88" radius={[4, 4, 0, 0]} barSize={55} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 2: Tonelaje total programadovs tonelaje total real (por empresas) */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-[#3FAA88] uppercase tracking-[0.2em]">EFICIENCIA POR TRANSPORTISTA</span>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Tons: Programado vs Real (Por Empresas)</h3>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyTonnageData} barGap={4} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar dataKey="Programado" name="Prog Ton" fill="#461D77" radius={[4, 4, 0, 0]} barSize={25} />
                      <Bar dataKey="Real" name="Real Ton" fill="#3FAA88" radius={[4, 4, 0, 0]} barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 3: Equipos real vs programados (General) */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-[#7177EC] uppercase tracking-[0.2em]">LOGÍSTICA DE ACCESO</span>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Equipos: Programado vs Real (Consolidado)</h3>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {showAsTimeline ? (
                      // Line chart comparing total equipment over dates
                      <LineChart data={timelineData} margin={{ top: 20, right: 15, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                        <Line type="step" dataKey="ProgramadoEq" name="Prog EQ" stroke="#461D77" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="RealEq" name="Real EQ" stroke="#3FAA88" strokeWidth={3} dot={{ r: 5 }} />
                      </LineChart>
                    ) : (
                      // Single day bar comparison for overall transport equipment
                      <BarChart data={[{ name: 'General', Programado: stats.progEq, Real: stats.realEq }]} barGap={12} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                        <Bar dataKey="Programado" name="Prog EQ" fill="#461D77" radius={[4, 4, 0, 0]} barSize={55} />
                        <Bar dataKey="Real" name="Real EQ" fill="#3FAA88" radius={[4, 4, 0, 0]} barSize={55} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 4: Equipos real vs programados por empresas */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em]">OPERADORES EN FAENA</span>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none mt-1 mb-6">Equipos: Programado vs Real (Por Empresas)</h3>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyEquiposData} barGap={4} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                      <Bar dataKey="Programado" name="Prog EQ" fill="#461D77" radius={[4, 4, 0, 0]} barSize={25} />
                      <Bar dataKey="Real" name="Real EQ" fill="#3FAA88" radius={[4, 4, 0, 0]} barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* BRAND NEW SECTION: ANALÍTICA DE INDICADORES EN FAENA (M, N, U, V, AH, AI, AJ, AK, AL, AS, AV, AW, AX, AY) */}
            <section className="bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#3FAA88]/5 rounded-full blur-[90px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#461D77]/5 rounded-full blur-[90px] pointer-events-none" />
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 bg-[#3FAA88]/10 text-[#3FAA88] text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase">
                    <BarChart3 size={10} /> Analítica Avanzada Integrada
                  </span>
                  <h2 className="text-xl font-[900] text-slate-800 tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#461D77] to-[#3FAA88]">Control de Indicadores Críticos (Variables Operativas)</h2>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Sincronización de tiempos en interior faena, factores de carga promedio, asignación de flota de aljibes (M&Q y Jorquera), y control de calibraciones/regulaciones.
                  </p>
                </div>
              </div>

              {/* SPECIAL KPI OVERVIEW CARD GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Time Inside Faena */}
                {(() => {
                  const isTimeOver = customColumnsData.summary.timeReal > 0 && 
                    customColumnsData.summary.timeMeta > 0 && 
                    (customColumnsData.summary.timeReal - customColumnsData.summary.timeMeta) >= (10 / 60);
                  return (
                    <div className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between ${isTimeOver ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tiempo Interior Faena</span>
                          <h4 className={`text-xl font-black font-mono ${isTimeOver ? 'text-rose-600' : 'text-slate-800'}`}>
                            {customColumnsData.summary.timeReal.toFixed(2)}h
                          </h4>
                        </div>
                        <span className={`p-2 rounded-xl text-xs ${isTimeOver ? 'text-rose-600 bg-rose-100' : 'text-purple-600 bg-purple-50'}`}>
                          <Clock size={16} />
                        </span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                        <span>Meta Planificada (AX):</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-slate-700 font-black">{customColumnsData.summary.timeMeta.toFixed(2)}h</span>
                          {isTimeOver && (
                            <span className="text-[8px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 uppercase">
                              +10m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Average Load Factor */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promedio Carga Real</span>
                      <h4 className="text-xl font-black text-slate-800 font-mono">
                        {customColumnsData.summary.loadReal.toFixed(1)} T
                      </h4>
                    </div>
                    <span className="text-teal-600 bg-teal-50 p-2 rounded-xl text-xs"><Scale size={16} /></span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                    <span>Carga Meta (AV):</span>
                    <span className="font-mono text-slate-700 font-black">{customColumnsData.summary.loadMeta.toFixed(1)} T</span>
                  </div>
                </div>

                {/* Aljibes Allocated */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Aljibes en Faena</span>
                      <h4 className="text-xl font-black text-slate-800 font-mono">
                        {(customColumnsData.summary.mqAljibesReal + customColumnsData.summary.jorqueraAljibesReal).toLocaleString()} EQ
                      </h4>
                    </div>
                    <span className="text-blue-600 bg-blue-50 p-2 rounded-xl text-xs"><Truck size={16} /></span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                    <span>Programados (Col M+U):</span>
                    <span className="font-mono text-slate-700 font-black">{(customColumnsData.summary.mqAljibesProg + customColumnsData.summary.jorqueraAljibesProg).toLocaleString()} EQ</span>
                  </div>
                </div>

                {/* Regulations Total */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Regulaciones Totales</span>
                      <h4 className="text-xl font-black text-slate-800 font-mono">
                        {customColumnsData.summary.totalRegulations} Regs
                      </h4>
                    </div>
                    <span className="text-amber-500 bg-amber-50 p-2 rounded-xl text-xs"><ClipboardCheck size={16} /></span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                    <span>Tendencia % Cumpl.:</span>
                    <span className="font-mono text-slate-700 font-black">{customColumnsData.summary.compliancePercent}%</span>
                  </div>
                </div>

              </div>

              {/* ADVANCED CHARTS CONTAINER GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. Cycle Times: Meta vs Real */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <span className="text-[9px] font-black text-purple-600 uppercase tracking-[0.2em]">EFICIENCIA DE TIEMPO</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1">Tiempo Interior Faena (Real AY vs Meta AX en Horas)</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={customColumnsData.timeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTimeReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#461D77" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#461D77" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTimeMeta" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7177ec" stopOpacity={0.05}/>
                            <stop offset="95%" stopColor="#7177ec" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} hrs`, 'Tiempo']} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '9px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="timeInsideFaenaMeta" name="Meta (AX)" stroke="#7177ec" strokeWidth={2} fillOpacity={1} fill="url(#colorTimeMeta)" />
                        <Area type="monotone" dataKey="timeInsideFaenaReal" name="Real (AY)" stroke="#461D77" strokeWidth={3} fillOpacity={1} fill="url(#colorTimeReal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Load Factor: Meta vs Real */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <span className="text-[9px] font-black text-teal-600 uppercase tracking-[0.2em]">RENDIMIENTO UNITARIO DE CARGA</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1">Factor Promedio de Carga (Real AW vs Meta AV)</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={customColumnsData.timeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} Ton`, 'Promedio Carga']} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '9px', fontWeight: 'bold' }} />
                        <Line type="monotone" dataKey="avgLoadMeta" name="Meta (AV)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="avgLoadReal" name="Real (AW)" stroke="#3FAA88" strokeWidth={3} dot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Aljibes Allocation: M&Q vs Jorquera */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">EQUIPAMIENTO DE APOYO VIAL</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1">Asignación de Aljibes de Agua (Programado vs Real)</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customColumnsData.aljibesData} barGap={8} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '9px', fontWeight: 'bold' }} />
                        <Bar dataKey="Programado" name="Prog Aljibes (Col M/U)" fill="#7177ec" radius={[4, 4, 0, 0]} barSize={40} />
                        <Bar dataKey="Real" name="Real Aljibes (Col N/V)" fill="#461D77" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Regulations & Compliance Trend */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em]">CONTROL DE CUMPLIMIENTO & CALIBRACIONES</span>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none mt-1">Cantidad de Regulaciones Totales vs Trend de Cumplimiento (%)</h3>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={customColumnsData.timeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#d97706' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '9px', fontWeight: 'bold' }} />
                        <Line yAxisId="left" type="monotone" dataKey="compliancePercent" name="Cumplimiento (% col AL)" stroke="#3FAA88" strokeWidth={3} dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="regulationsCount" name="Regulaciones (Cant AS)" stroke="#d97706" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </section>

            {/* DETAILED DATA TABLE */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black text-purple-700 uppercase tracking-widest leading-none">REGISTRO ANALÍTICO</p>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-1">Resumen Diario de Despacho SLIT</h3>
                </div>
                <div className="text-[10px] bg-slate-200/60 font-semibold px-4 py-1.5 rounded-full text-slate-700 uppercase tracking-wider">
                  {stats.count} registros filtrados
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Empresa (Grupo)</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Eje / Destino Orig.</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Tons Prog</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Tons Real</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Eq Prog</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Eq Real</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Desviación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSlitRows.map((row, rIdx) => {
                      const tonDiff = row.Ton_Real - row.Ton_Prog;
                      const devPct = row.Ton_Prog > 0 ? (row.Ton_Real / row.Ton_Prog) * 100 : 0;
                      const timeReal = Number(row.col_TiempoInteriorFaenaReal) || 0;
                      const timeMeta = Number(row.col_TiempoInteriorFaenaProdMeta) || 0;
                      const isTimeDev = timeReal > 0 && timeMeta > 0 && (timeReal - timeMeta) >= (10 / 60);

                      return (
                        <tr key={rIdx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all font-sans">
                          <td className="p-4 text-xs font-black text-slate-500 font-mono">{formatDateToCL(row.Fecha)}</td>
                          <td className="p-4 text-xs font-extrabold text-[#461D77] uppercase">{row.Empresa}</td>
                          <td className="p-4 text-xs font-bold text-slate-600 uppercase">{row.Destino}</td>
                          <td className="p-4 text-xs font-bold text-slate-600 text-right font-mono">{formatNumberWithDecimals(row.Ton_Prog, 2)}</td>
                          <td className="p-4 text-xs font-bold text-slate-800 text-right font-mono">{formatNumberWithDecimals(row.Ton_Real, 2)}</td>
                          <td className="p-4 text-xs font-bold text-slate-500 text-right font-mono">{row.Eq_Prog}</td>
                          <td className="p-4 text-xs font-bold text-slate-800 text-right font-mono">{row.Eq_Real}</td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-block px-3 py-1 rounded-xl text-[9px] font-black border ${
                                devPct >= 100 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : devPct >= 90 
                                    ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                    : 'bg-rose-50 text-rose-600 border-rose-100 font-bold'
                              }`}>
                                {devPct.toFixed(0)}%
                              </span>
                              {isTimeDev && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[8px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                                  +10m tpo
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* FOOTER */}
      <footer className="py-6 bg-white/40 border-t border-slate-200/55 text-center mt-12 z-10 relative">
        <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-[0.2em] leading-none mb-1">
          SUBGERENCIA LOGÍSTICA LITIO &bull; PRODUCTO SLIT &bull; NOVANDINO
        </p>
        <p className="text-[8px] text-slate-400 font-bold tracking-widest">
          SISTEMA DE ADMINISTRACIÓN DE FLOTAS &bull; JORNADA 2026.2
        </p>
      </footer>

    </div>
  );
};

export default SlitDashboard;
