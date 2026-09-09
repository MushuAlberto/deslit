import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, Loader2,
  Home, Truck, Image as ImageIcon,
  Clock, BarChart3, TrendingUp, Target, Users, Scale, ClipboardCheck, FileText, Download,
  Mail, Send, X, Lock, ArrowLeft
} from 'lucide-react';
import ChartCard from './ChartCard';
import ProductDetailSection from './ProductDetailSection';
import MainMenu from './MainMenu';
import { LlegadaEquipos } from './LlegadaEquipos';
import { MemoryModule } from './MemoryModule';
import DdDTablero from './DdDTablero';
import { SlitDashboard } from './SlitDashboard';
import ReportFooter from './ReportFooter';
import InstructionModal from './InstructionModal';
import { ImageGallery } from './ImageGallery';
import { PasswordPrompt } from './PasswordPrompt';
import CambioDeTurno from './CambioDeTurno';
import LCEModule from './LCE/LCEModule';
import { CumplimientoMQ } from './PQL/CumplimientoMQ';
import { CumplimientoJorquera } from './PQL/CumplimientoJorquera';
import { CloudUpload } from 'lucide-react';
import { cleanNumeric, parseExcelTime, formatHoursToTime, formatDateToCL, downloadBackupJSON, syncBackupToFirebase, normalizeHeader, formatNumberWithDecimals, separateBischofitaByDest, isProductNovandino, isProductSQM, formatCLB } from '../utils/dataProcessor';
import { NovandinoLogo } from './BrandLogo';

// Firebase imports
import { SystemUser, logActivity } from '../services/firebase';
import { LoginScreen } from './LoginScreen';
import { ActivityLogsView } from './ActivityLogsView';
import { UserManagementView } from './UserManagementView';

declare const html2canvas: any;
declare const jspdf: any;

const App: React.FC = () => {
  // Session details stored in state and localStorage
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('sqm_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState<'menu' | 'llegada' | 'informe-novandino' | 'informe-sqm' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs' | 'slit' | 'cumplimiento-mq' | 'cumplimiento-jorquera'>('menu');
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<{ view: 'memoria' | 'galeria' | 'cambioTurno' | 'lce', name: string } | null>(null);
  const [isJefeTurnoUnlocked, setIsJefeTurnoUnlocked] = useState(false);
  const [uploadError, setUploadError] = useState<{
    message: string;
    missingColumns?: string[];
    foundHeaders?: string[];
  } | null>(null);

  // Outlook email prefill state
  const [isOutlookModalOpen, setIsOutlookModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('cristiantapia.espinoza@gmail.com');
  const [emailCC, setEmailCC] = useState('operaciones@novandino.cl, despacho@novandino.cl');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Sync access state with user roles on change and save session to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sqm_current_user', JSON.stringify(currentUser));
      if (currentUser.role === 'admin' || currentUser.role === 'jefe_turno') {
        setIsJefeTurnoUnlocked(true);
      } else {
        setIsJefeTurnoUnlocked(false);
      }
    } else {
      localStorage.removeItem('sqm_current_user');
    }
  }, [currentUser]);

  // Track interface transitions
  useEffect(() => {
    if (currentUser && view !== 'menu') {
      logActivity(currentUser, 'Ingreso a Módulo', `Ingresó al módulo: ${view.toUpperCase()}`);
    }
  }, [view, currentUser]);

  useEffect(() => {
    const savedData = localStorage.getItem('sqm_raw_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.length > 0) {
          const totalTon = parsed.reduce((a: number, b: any) => a + (Number(b.Ton_Real) || 0), 0);
          const totalEq = parsed.reduce((a: number, b: any) => a + (Number(b.Eq_Real) || 0), 0);
          if (totalTon === 0 && totalEq === 0) {
            localStorage.removeItem('sqm_raw_data');
            return;
          }
        }
        setRawData(parsed);
        const dates = [...new Set(parsed.map((r: any) => r.Fecha))].sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0] as string);
      } catch (e) {
        localStorage.removeItem('sqm_raw_data');
      }
    }
  }, []);

  const isRunning = loading || exportingPDF || exportingImage;

  const handleLogout = () => {
    if (currentUser) {
      logActivity(currentUser, 'Cierre de Sesión', 'El usuario cerró sesión voluntariamente.');
    }
    setCurrentUser(null);
    setIsJefeTurnoUnlocked(false);
    localStorage.removeItem('sqm_current_user');
    setView('menu');
  };

  const handleExportPDF = async () => {
    if (exportingPDF) return;
    setExportingPDF(true);
    document.body.classList.add('is-exporting');
    await new Promise(r => setTimeout(r, 300));
    try {
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'legal', compress: true });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pdfWidth - margin * 2;
      const captureOptions = { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', imageTimeout: 15000 };
      const coverEl = document.getElementById('pdf-cover-page');
      if (coverEl) {
        const coverCanvas = await html2canvas(coverEl, captureOptions);
        const coverImg = coverCanvas.toDataURL('image/jpeg', 0.95);
        const coverRatio = coverCanvas.height / coverCanvas.width;
        const coverHeight = usableWidth * coverRatio;
        const coverY = coverHeight < pdfHeight - margin * 2 ? (pdfHeight - coverHeight) / 2 : margin;
        pdf.addImage(coverImg, 'JPEG', margin, coverY, usableWidth, coverHeight);
      }
      const productSections = document.querySelectorAll('[id^="product-section-"]');
      for (let i = 0; i < productSections.length; i++) {
        pdf.addPage('legal', 'portrait');
        const section = productSections[i] as HTMLElement;
        const canvas = await html2canvas(section, captureOptions);
        const img = canvas.toDataURL('image/jpeg', 0.95);
        const ratio = canvas.height / canvas.width;
        let imgHeight = usableWidth * ratio;
        if (imgHeight > pdfHeight - margin * 2) {
          const scaledWidth = (pdfHeight - margin * 2) / ratio;
          const xOffset = margin + (usableWidth - scaledWidth) / 2;
          pdf.addImage(img, 'JPEG', xOffset, margin, scaledWidth, pdfHeight - margin * 2);
        } else {
          pdf.addImage(img, 'JPEG', margin, margin, usableWidth, imgHeight);
        }
      }
      const fileTitle = view === 'informe-sqm' ? 'Informe_Operativo_SQM_NY' : 'Informe_Operativo_Novandino';
      pdf.save(`${fileTitle}_${selectedDate}.pdf`);

      // Record download audit log
      if (currentUser) {
        logActivity(currentUser, 'Exportó PDF', `Exportó el reporte operativo PDF de la jornada ${formatDateToCL(selectedDate)}.`);
      }
    } catch (error) {
      console.error('Error en exportación PDF:', error);
      alert('Error al generar el PDF. Intente nuevamente.');
    } finally {
      document.body.classList.remove('is-exporting');
      setExportingPDF(false);
    }
  };

  const handleExportImage = async () => {
    if (exportingImage) return;
    setExportingImage(true);
    const element = document.getElementById('executive-summary-capture');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      const imgTitle = view === 'informe-sqm' ? 'Resumen_Operativo_SQM_NY' : 'Resumen_Operativo_Novandino';
      link.download = `${imgTitle}_${selectedDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Record image generation audit log
      if (currentUser) {
        logActivity(currentUser, 'Exportó PNG', `Descargó placa gráfica de KPIs principales para la jornada ${formatDateToCL(selectedDate)}.`);
      }
    } finally {
      setExportingImage(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n => n === "Base de Datos") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
        if (jsonData.length < 2) throw new Error("Archivo vacío o no estructurado.");
        
        // Find the best header row within first 15 rows
        let bestHeaderRowIdx = 0;
        let bestMatchCount = -1;
        let bestIdxs: Record<string, number> = {};
        let bestHeadersList: string[] = [];

        const scanLimit = Math.min(jsonData.length, 15);
        for (let rIdx = 0; rIdx < scanLimit; rIdx++) {
          const rowHeaders = Array.from(jsonData[rIdx] || []).map(h => {
            if (h === undefined || h === null) return '';
            return normalizeHeader(String(h));
          });
          
          const getIdxForHeaders = (
            aliases: string[], 
            fuzzyKeywords?: { mustContain: string[], orContain?: string[] }[]
          ): number => {
            // 1. Exact values
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 2) continue;
              const exactIdx = rowHeaders.findIndex(h => h === normAlias);
              if (exactIdx !== -1) return exactIdx;
            }
            // 2. Partial string matches (bidirectional includes checks)
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 3) continue;
              const partialIdx = rowHeaders.findIndex(h => h && (h.includes(normAlias) || normAlias.includes(h)));
              if (partialIdx !== -1) return partialIdx;
            }
            // 3. Fallback to fuzzy keyword heuristics (very powerful)
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
            fecha: getIdxForHeaders(
              ["FECHA", "JORNADA", "DIA"],
              [{ mustContain: ["FECHA"] }, { mustContain: ["JORNADA"] }]
            ),
            producto: getIdxForHeaders(
              ["PRODUCTO", "NIVEL", "PRODUCTO META", "PROD"],
              [{ mustContain: ["PRODUCTO"] }, { mustContain: ["PROD", "META"] }, { mustContain: ["NIVEL"] }]
            ),
            destino: getIdxForHeaders(
              ["DESTINO", "UBICACION", "UBICACIÓN", "ENTREGA", "PUNTO ENTREGA", "DES"],
              [{ mustContain: ["DESTIN"] }, { mustContain: ["UBICAC"] }, { mustContain: ["ENTREG"] }]
            ),
            empresa: getIdxForHeaders(
              ["EMPRESA", "TRANSPORTISTA", "EMPRESA TRANSPORTE", "FLETERO", "COMPAÑÍA", "CÍA", "COMPAÑIA", "CIA"],
              [{ mustContain: ["EMPRES"] }, { mustContain: ["FLETER"] }, { mustContain: ["TRANSP"] }]
            ),
            tonProg: getIdxForHeaders(
              ["TON PROG", "PROGRAMADO", "TONELADAS PROGRAMADAS", "TONELADAS PROG", "TONELADA PROGRAMADA"],
              [{ mustContain: ["TON", "PROG"] }, { mustContain: ["TONELADA", "PROG"] }]
            ),
            tonReal: getIdxForHeaders(
              ["TON REAL", "REAL", "TONELADAS REALES", "TONELADA REAL"],
              [{ mustContain: ["TON", "REAL"] }, { mustContain: ["TONELADA", "REAL"] }]
            ),
            eqProg: getIdxForHeaders(
              ["EQ PROG", "EQUIPOS PROGRAMADOS", "EQUIPOS PROG", "FLOTA PROGRAMADA", "FLOTA PROG"],
              [
                { mustContain: ["FLOTA", "PROG"] },
                { mustContain: ["EQUIP", "PROG"] },
                { mustContain: ["EQ", "PROG"] },
                { mustContain: ["FLOTA", "PROGRAMA"] },
                { mustContain: ["EQUIP", "PROGRAMA"] },
                { mustContain: ["EQ", "PROGRAMA"] }
              ]
            ),
            eqReal: getIdxForHeaders(
              ["EQ REAL", "EQUIPOS REALES", "EQ REALES", "FLOTA REAL", "FLOTA REALES", "INTENSIDAD FLOTA", "INTENSIDAD DE FLOTA"],
              [
                { mustContain: ["FLOTA", "REAL"] },
                { mustContain: ["EQUIP", "REAL"] },
                { mustContain: ["EQ", "REAL"] },
                { mustContain: ["CAMION", "REAL"] },
                { mustContain: ["FLOTA", "EFECTIV"] },
                { mustContain: ["EQUIP", "EFECTIV"] },
                { mustContain: ["EQ", "EFECTIV"] },
                { mustContain: ["FLOTA", "ACTIV"] },
                { mustContain: ["INTENSIDAD"] }
              ]
            ),
            regReal: getIdxForHeaders(
              ["REGULACION REAL", "REGULACION", "PORCENTAJE DE REGULACION", "REGULACION REAL %", "% REGULALION", "% REGULACION", "REGULACION %", "REG REAL"],
              [
                { mustContain: ["REGULAC"] },
                { mustContain: ["REGULAL"] },
                { mustContain: ["REGULA"] },
                { mustContain: ["%"], orContain: ["REG", "COMPL"] }
              ]
            ),
            sda: getIdxForHeaders(
              ["SDA HRS", "SDA", "SDA HOURS", "SDA H", "SDA (Hrs)", "FAENA SDA"],
              [{ mustContain: ["SDA"] }, { mustContain: ["S D A"] }, { mustContain: ["SANTIAGO"] }]
            ),
            pang: getIdxForHeaders(
              ["PANG HRS", "PANG", "PANG HOURS", "NY HRS", "NY", "TIEMPO GRAL FAENA NY", "NY (Hrs)", "FAENA NY", "N Y"],
              [{ mustContain: ["NY"] }, { mustContain: ["N Y"] }, { mustContain: ["NEWYORK"] }, { mustContain: ["NEW", "YORK"] }, { mustContain: ["PANG"] }]
            ),
            faenaMeta: getIdxForHeaders(
              ["FAENA META HRS", "FAENA META", "TIEMPO INTERIOR FAENA PRODUCTO META", "FAENA META HORAS", "FAENA META (Hrs)"],
              [{ mustContain: ["FAENA", "META"] }, { mustContain: ["META", "HRS"] }, { mustContain: ["META", "HOUR"] }]
            ),
            faenaReal: getIdxForHeaders(
              ["FAENA REAL HRS", "FAENA REAL", "TIEMPO INTERIOR FAENA REAL", "FAENA REAL HORAS", "FAENA REAL (Hrs)"],
              [{ mustContain: ["FAENA", "REAL"] }, { mustContain: ["REAL", "HRS"] }, { mustContain: ["REAL", "HOUR"] }]
            )
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
        const headers = bestHeadersList;
        const rows = jsonData.slice(bestHeaderRowIdx + 1);

        // Check only critical columns
        const criticalMissing: string[] = [];
        if (idx.fecha === -1) criticalMissing.push("Fecha (ej. FECHA, JORNADA, DIA)");
        if (idx.producto === -1) criticalMissing.push("Producto (ej. PRODUCTO, NIVEL, PRODUCTO META)");

        if (criticalMissing.length > 0) {
          setUploadError({
            message: `Columnas obligatorias faltantes en el Excel. No se encontró el encabezado para: ${criticalMissing.join(', ')}.`,
            missingColumns: criticalMissing,
            foundHeaders: headers.filter(h => h.trim() !== '')
          });
          throw new Error("No se pudo mapear la estructura obligatoria de columnas.");
        }
        
        const processed = rows.map((row) => {
          if (!row || row[idx.fecha] === undefined || row[idx.fecha] === null) return null;
          if (idx.producto !== -1 && (row[idx.producto] === undefined || row[idx.producto] === null)) return null;
          
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

          // Check column AF (index 31) explicitly for SLIT
          const valAF = row[31] !== undefined && row[31] !== null ? String(row[31]).trim().toUpperCase() : '';
          const isSlit = valAF === 'SLIT' || valAF.includes('SLIT');

          const finalProduct = formatCLB(isSlit ? valAF : (idx.producto !== -1 ? String(row[idx.producto]).trim().toUpperCase() : 'DESCONOCIDO'));

          return {
            Fecha: dateStr,
            Producto: finalProduct,
            Destino: idx.destino !== -1 ? formatCLB(String(row[idx.destino]).trim()).toUpperCase() : 'S/D',
            EmpresaMapped: idx.empresa !== -1 ? formatCLB(String(row[idx.empresa] || '').trim()).toUpperCase() : '',
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
        
        if (processed.length === 0) {
          throw new Error("No se encontraron registros de datos operativos válidos después del encabezado.");
        }

        localStorage.removeItem('sqm_raw_data');
        setRawData(processed);
        localStorage.setItem('sqm_raw_data', JSON.stringify(processed));
        const dates = [...new Set(processed.map(r => r.Fecha))].sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0]);
        
        // Log import action
        if (currentUser) {
          logActivity(currentUser, 'Carga de Datos', `Cargó archivo base Excel con ${processed.length} registros operativos.`);
        }
      } catch (err: any) {
        console.error("Error processing file:", err);
        setUploadError({
          message: err.message || 'Error desconocido al procesar el archivo Excel.'
        });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [currentUser]);

  const separatedRawData = useMemo(() => {
    return separateBischofitaByDest(rawData);
  }, [rawData]);

  const filteredData = useMemo(() => {
    const base = separatedRawData.filter(r => r.Fecha === selectedDate);
    if (view === 'informe-novandino') {
      return base.filter(r => isProductNovandino(r));
    }
    if (view === 'informe-sqm') {
      return base.filter(r => isProductSQM(r));
    }
    return base;
  }, [separatedRawData, selectedDate, view]);

  const availableDates = useMemo(() => {
    return [...new Set(rawData.map(r => r.Fecha))].sort();
  }, [rawData]);

  const previousDate = useMemo(() => {
    if (!selectedDate || availableDates.length <= 1) return null;
    const idx = availableDates.indexOf(selectedDate);
    if (idx > 0) {
      return availableDates[idx - 1];
    }
    return null;
  }, [selectedDate, availableDates]);

  const calculateMetricsForDate = useCallback((date: string | null) => {
    if (!date) return null;
    const base = separatedRawData.filter(r => r.Fecha === date);
    let filtered;
    if (view === 'informe-novandino') {
      filtered = base.filter(r => isProductNovandino(r));
    } else if (view === 'informe-sqm') {
      filtered = base.filter(r => isProductSQM(r));
    } else {
      filtered = base;
    }

    if (filtered.length === 0) return null;

    const totalTonReal = filtered.reduce((a, b) => a + b.Ton_Real, 0);
    const totalTonProg = filtered.reduce((a, b) => a + b.Ton_Prog, 0);
    const totalEqReal = filtered.reduce((a, b) => a + b.Eq_Real, 0);
    const totalEqProg = filtered.reduce((a, b) => a + (b.Eq_Prog || 0), 0);
    const avgReg = filtered.reduce((acc, d) => acc + (Number(d.Regulacion_Real) || 0), 0) / filtered.length;
    const validSdaTimes = filtered.map(d => d.sdaHours).filter(v => v > 0);
    const avgSda = validSdaTimes.length > 0 ? validSdaTimes.reduce((a, b) => a + b, 0) / validSdaTimes.length : 0;
    const validPangTimes = filtered.map(d => d.pangHours).filter(v => v > 0);
    const avgPang = validPangTimes.length > 0 ? validPangTimes.reduce((a, b) => a + b, 0) / validPangTimes.length : 0;
    const totalHoursInFaena = filtered.reduce((a, b) => a + b.faenaRealHours, 0);
    const productivity = totalHoursInFaena > 0 ? totalTonReal / totalHoursInFaena : 0;
    const compliance = totalTonProg > 0 ? (totalTonReal / totalTonProg) * 100 : 0;
    const avgLoad = totalEqReal > 0 ? totalTonReal / totalEqReal : 0;

    return {
      avgSda,
      avgPang,
      productivity,
      totalTonReal,
      compliance,
      totalEqReal,
      avgLoad,
      avgReg
    };
  }, [separatedRawData, view]);

  const currentMetrics = useMemo(() => {
    return calculateMetricsForDate(selectedDate);
  }, [selectedDate, calculateMetricsForDate]);

  const previousMetrics = useMemo(() => {
    return calculateMetricsForDate(previousDate);
  }, [previousDate, calculateMetricsForDate]);

  const operationalKPIs = useMemo(() => {
    if (!currentMetrics) return null;

    const {
      avgSda,
      avgPang,
      productivity,
      totalTonReal,
      compliance,
      totalEqReal,
      avgLoad,
      avgReg
    } = currentMetrics;

    const prev = previousMetrics;

    const getComparisonObj = (currVal: number, prevVal: number | undefined, type: 'time' | 'percent' | 'number' | 'decimal', unit: string, isLowerBetter: boolean = false) => {
      if (prevVal === undefined || prevVal === null) return null;
      
      if (type === 'time') {
        const diffMinutes = Math.round((currVal - prevVal) * 60);
        if (diffMinutes > 0) {
          return { text: `+${diffMinutes} min`, arrow: '↑', isPositive: isLowerBetter ? false : true, isChange: true };
        } else if (diffMinutes < 0) {
          return { text: `-${Math.abs(diffMinutes)} min`, arrow: '↓', isPositive: isLowerBetter ? true : false, isChange: true };
        }
        return { text: 'Sin cambios', arrow: '•', isPositive: null, isChange: false };
      }

      const diff = currVal - prevVal;
      if (Math.abs(diff) < 0.01) {
        return { text: 'Sin cambios', arrow: '•', isPositive: null, isChange: false };
      }

      let formattedDiff = '';
      if (type === 'percent') {
        formattedDiff = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
      } else if (type === 'decimal') {
        formattedDiff = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${unit}`;
      } else {
        formattedDiff = `${diff > 0 ? '+' : ''}${Math.round(diff).toLocaleString()} ${unit}`;
      }

      const isIncrease = diff > 0;
      const isPositive = isLowerBetter ? !isIncrease : isIncrease;

      return {
        text: formattedDiff,
        arrow: isIncrease ? '↑' : '↓',
        isPositive,
        isChange: true
      };
    };

    return [
      { 
        label: "Tiempo Gral. Faena (SdA) (2:00)", 
        value: formatHoursToTime(avgSda), 
        icon: <Clock className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgSda, prev?.avgSda, 'time', 'min', true) 
      },
      { 
        label: "Tiempo Gral. Faena (NY) (2:00)", 
        value: formatHoursToTime(avgPang), 
        icon: <Clock className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgPang, prev?.avgPang, 'time', 'min', true) 
      },
      { 
        label: "Productividad Diaria", 
        value: `${productivity.toFixed(1)} T/H`, 
        icon: <TrendingUp className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(productivity, prev?.productivity, 'decimal', 'T/H', false) 
      },
      { 
        label: "Carga Real Despachada", 
        value: `${formatNumberWithDecimals(totalTonReal, 2)} Ton`, 
        icon: <Truck className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(totalTonReal, prev?.totalTonReal, 'number', 'Ton', false) 
      },
      { 
        label: "Cumplimiento Programa", 
        value: `${compliance.toFixed(1)}%`, 
        icon: <Target className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(compliance, prev?.compliance, 'percent', '%', false) 
      },
      { 
        label: "Intensidad de Flota", 
        value: `${totalEqReal} EQ`, 
        icon: <Users className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(totalEqReal, prev?.totalEqReal, 'number', 'EQ', false) 
      },
      { 
        label: "Factor de Carga (Eficiencia)", 
        value: `${avgLoad.toFixed(1)} T/EQ`, 
        icon: <Scale className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgLoad, prev?.avgLoad, 'decimal', 'T/EQ', false) 
      },
      { 
        label: "Promedio % de Regulación", 
        value: `${Math.round(avgReg)}%`, 
        icon: <ClipboardCheck className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgReg, prev?.avgReg, 'percent', '%', false) 
      },
    ].filter(item => {
      if (view === 'informe-novandino' && item.label.startsWith("Tiempo Gral. Faena (NY)")) {
        return false;
      }
      if (view === 'informe-sqm' && item.label.startsWith("Tiempo Gral. Faena (SdA)")) {
        return false;
      }
      return true;
    });
  }, [currentMetrics, previousMetrics, view]);

  const productList = useMemo(() => {
    const products = [...new Set(filteredData.map(r => r.Producto as string))] as string[];
    return products.sort((a: string, b: string) => {
      const priority: Record<string, number> = { 'SLIT': 1, 'LSI (S)': 2 };
      const aPrio = priority[a] || 99;
      const bPrio = priority[b] || 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.localeCompare(b);
    });
  }, [filteredData]);

  // Dynamic email pre-fill calculations
  useEffect(() => {
    if (isOutlookModalOpen && selectedDate) {
      const isNovandino = view === 'informe-novandino';
      const typeStr = isNovandino ? 'NOVANDINO' : 'SQM NY';
      const formattedDate = formatDateToCL(selectedDate);
      setEmailSubject(`INFORME OPERATIVO ${typeStr} - JORNADA ${formattedDate}`);
      
      if (isNovandino) {
        setEmailTo('claudio.siniga@novandino.com, carlo.castellaro@novandino.com');
        setEmailCC('Despacho.Salar@sqm.com, carlos.diaz@novandino.com, carlos.mardones.luna@novandino.com, tamara.cabrera@novandino.com, hugo.morgado@novandino.com, Servicio.Transporte.Litio@sqm.com, tomislav.cvitanic@novandino.com, CoordinacionTerrestreLitio@novandino.com, jaime.ardiles@novandino.com');
        
        const bodyText = `Estimados, buen día.\n\n` +
          `Junto con saludar, comparto con ustedes el resumen de la gestión operativa correspondiente a la jornada recién pasada.\n` +
          `A continuación, se presenta la visualización del dashboard con los KPIs principales:\n\n` +
          `[Pegar Imagen PNG del Dashboard Aquí (Ctrl+V)]\n\n` +
          `Adjunto encontrarán el Informe Operativo detallado en PDF, donde se desglosa el detalle de desempeño, los destinos y el registro de eventos para cada línea de producto.\n\n` +
          `Atentamente,`;
        setEmailBody(bodyText);
      } else {
        setEmailTo('claudio.siniga@novandino.com, Allan.Duvauchelle@sqm.com');
        setEmailCC('Alejandro.Gomez@sqm.com, gilbert.maldonado@novandino.com, carlo.castellaro@novandino.com, sebastian.parada@novandino.com, Despacho.Salar@sqm.com, carlos.diaz@novandino.com, Servicio.Transporte.Litio@sqm.com, SupTransporteCS@sqm.com, Maria.Aguilera@sqm.com, andres.salinas.ignacio@novandino.com, jaime.ardiles@novandino.com, ControlProductosSalar@novandino.com');
        
        const bodyText = `Estimados, buen día.\n\n` +
          `Junto con saludar, comparto con ustedes el resumen de la gestión operativa correspondiente a la jornada recién pasada.\n` +
          `A continuación, se presenta la visualización del dashboard con los KPIs principales:\n\n` +
          `[Pegar Imagen PNG del Dashboard Aquí (Ctrl+V)]\n\n` +
          `Adjunto encontrarán el Informe Operativo detallado en PDF, donde se desglosa el detalle de desempeño, los destinos y el registro de eventos para cada línea de producto.\n\n` +
          `Atentamente,`;
        setEmailBody(bodyText);
      }
    }
  }, [isOutlookModalOpen, selectedDate, view, operationalKPIs, currentUser]);

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const handleSyncToFirebase = async (date: string) => {
    setIsSyncingFirebase(true);
    try {
      const success = await syncBackupToFirebase(date);
      if (success) {
        alert(`Historial .json del ${formatDateToCL(date)} guardado exitosamente en Firebase Cloud.`);
      } else {
        alert('No se pudo guardar el historial en Firebase. Verifique la conexión.');
      }
    } catch (err) {
      console.error('Error guardando en Firebase:', err);
      alert('Error al conectar con Firebase.');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleViewChange = (v: 'menu' | 'llegada' | 'informe-novandino' | 'informe-sqm' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs') => {
    if (v === 'memoria') {
      if (isJefeTurnoUnlocked) {
        setView('memoria');
      } else {
        setPasswordRequest({ view: 'memoria', name: 'Memoria' });
      }
    } else if (v === 'cambioTurno') {
      if (isJefeTurnoUnlocked) {
        setView('cambioTurno');
      } else {
        setPasswordRequest({ view: 'cambioTurno', name: 'Cambio de Turno' });
      }
    } else if (v === 'lce') {
      if (isJefeTurnoUnlocked) {
        setView('lce');
      } else {
        setPasswordRequest({ view: 'lce', name: 'Control LCE' });
      }
    } else {
      setView(v);
    }
  };

  const renderCurrentView = () => {
    if (view === 'logs' && (currentUser?.role === 'admin' || currentUser?.role === 'jefe_turno')) {
      return <ActivityLogsView currentUser={currentUser} onBack={() => setView('menu')} />;
    }
    if (view === 'users' && currentUser?.role === 'admin') {
      return <UserManagementView currentUser={currentUser} onBack={() => setView('menu')} onUpdateCurrentUser={setCurrentUser} />;
    }
    if (view === 'menu') return (
      <MainMenu 
        onSelectView={handleViewChange} 
        isJefeTurnoUnlocked={isJefeTurnoUnlocked}
        onUnlockJefeTurno={() => setIsJefeTurnoUnlocked(true)}
        currentUser={currentUser!}
        onLogout={handleLogout}
        initialLocation={activeLocation}
        onLocationChange={setActiveLocation}
      />
    );
    if (view === 'llegada') return <LlegadaEquipos currentUser={currentUser} onBack={() => setView('menu')} />;
    if (view === 'slit' && currentUser?.role === 'admin') {
      return <SlitDashboard data={rawData} onBack={() => setView('menu')} />;
    }
    if (view === 'memoria') return (
      <MemoryModule
        data={rawData}
        onBack={() => setView('menu')}
        onSelectDate={(d) => { setSelectedDate(d); setView('informe-novandino'); }}
      />
    );
    if (view === 'ddd') return (
      <DdDTablero
        data={rawData}
        selectedDate={selectedDate}
        onBack={() => setView('menu')}
      />
    );
    if (view === 'galeria') return (
      <ImageGallery 
        onBack={() => setView('menu')} 
        rawData={rawData}
        selectedDate={selectedDate}
      />
    );
    if (view === 'cambioTurno') return <CambioDeTurno onBack={() => setView('menu')} />;
    if (view === 'lce') return <LCEModule currentUser={currentUser} onBack={() => setView('menu')} />;
    if (view === 'cumplimiento-mq') return <CumplimientoMQ onBack={() => setView('menu')} />;
    if (view === 'cumplimiento-jorquera') return <CumplimientoJorquera onBack={() => setView('menu')} />;

    // fallback sidebar layout for standard dashboard view
    return (
      <div className="flex h-screen bg-calido font-sans text-tecnico overflow-hidden">
        <aside className="w-[300px] bg-levanda border-r border-violeta/20 flex flex-col no-print shrink-0">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            <div className="flex flex-col gap-2 mb-4">
              {activeLocation && (
                <button 
                  onClick={() => {
                    setView('menu');
                  }} 
                  className="flex items-center gap-2 text-[#461D77] hover:text-nucleo font-black text-[10px] uppercase tracking-widest transition-colors group cursor-pointer"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Volver a Módulo {activeLocation}
                </button>
              )}
              
              <button 
                onClick={() => {
                  setActiveLocation(null);
                  setView('menu');
                }} 
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-widest transition-colors group cursor-pointer"
              >
                <Home size={14} className="group-hover:-translate-x-1 transition-transform" /> Menú Principal
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-violeta">Cargar Datos</p>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-violeta/20 rounded-3xl cursor-pointer bg-white hover:border-ionizado hover:bg-calido transition-all">
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Upload className="w-8 h-8 text-violeta/30 mb-2" />
                  <p className="text-[10px] text-violeta/60 uppercase font-black tracking-widest">Base Excel</p>
                </div>
                <input type="file" className="hidden" accept=".xlsx,.xlsm" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
              </label>
            </div>
            {rawData.length > 0 && (
              <>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violeta">Jornada</p>
                  <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-white border border-violeta/20 rounded-2xl px-4 py-3 text-sm font-black text-tecnico outline-none focus:ring-4 focus:ring-ionizado/10">
                    {[...new Set(rawData.map(r => r.Fecha))].sort().reverse().map(d => <option key={d as string} value={d as string}>{formatDateToCL(d as string)}</option>)}
                  </select>
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-200/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#461D77] mb-1">Herramientas</p>
                  <button onClick={handleExportPDF} disabled={exportingPDF} className="w-full bg-white border border-violeta/20 text-nucleo py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:border-violeta/40 transition-all duration-200 premium-btn-transition cursor-pointer shadow-sm hover:shadow-md">
                    {exportingPDF ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Exportar PDF
                  </button>
                  <button onClick={handleExportImage} disabled={exportingImage} className="w-full bg-white border border-violeta/20 text-nucleo py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:border-violeta/40 transition-all duration-200 premium-btn-transition cursor-pointer shadow-sm hover:shadow-md">
                    {exportingImage ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Descargar PNG
                  </button>
                  <button 
                    onClick={() => setIsOutlookModalOpen(true)} 
                    className="w-full bg-white border-2 border-violeta text-violeta py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violeta/5 hover:border-violeta/60 transition-all duration-200 premium-btn-transition cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <Mail size={12} /> Compartir por Outlook
                  </button>

                  <button 
                    onClick={() => handleSyncToFirebase(selectedDate)} 
                    disabled={isSyncingFirebase}
                    className="w-full bg-[#461D77] text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#321159] transition-all duration-200 premium-btn-transition cursor-pointer shadow-lg shadow-nucleo/10 hover:shadow-nucleo/20 disabled:opacity-50"
                  >
                    {isSyncingFirebase ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Guardando en Firebase...
                      </>
                    ) : (
                      <>
                        <CloudUpload size={12} /> Guardar Historial en Firebase
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto relative bg-white">
          {isRunning && (
            <div className="absolute top-4 right-8 z-50 flex items-center gap-3 bg-white px-5 py-2 rounded-full shadow-2xl border border-violeta/10 animate-in fade-in slide-in-from-top-2 no-print">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-ionizado" />
              <span className="text-[10px] font-black text-violeta uppercase tracking-[0.2em]">Cargando Informe...</span>
            </div>
          )}
          <div className="max-w-5xl mx-auto p-8 space-y-0" id="dashboard-report">
            {rawData.length === 0 ? (
              <div className="py-20 flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-calido rounded-[2.5rem] flex items-center justify-center text-violeta/20"><BarChart3 size={48} /></div>
                <div>
                  <h2 className="text-3xl font-[900] text-nucleo tracking-tighter uppercase mb-2">Gestión de Despacho Litio</h2>
                  <p className="text-violeta/60 font-medium">Cargue un archivo base para iniciar el análisis operativo.</p>
                </div>

                {uploadError && (
                  <div className="w-full bg-rose-50 border border-rose-200 rounded-3xl p-6 text-left space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 font-extrabold shrink-0">!</div>
                      <div>
                        <h4 className="font-extrabold text-rose-950 text-sm">Error al Interpretar la Base de Datos</h4>
                        <p className="text-xs text-rose-800/80 mt-1">{uploadError.message}</p>
                      </div>
                    </div>

                    {uploadError.missingColumns && uploadError.missingColumns.length > 0 && (
                      <div className="bg-white/80 border border-rose-100 rounded-2xl p-4 text-xs space-y-2">
                        <span className="font-black text-[10px] text-rose-900 uppercase tracking-widest block">Columnas críticas faltantes:</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {uploadError.missingColumns.map((col, cIdx) => (
                            <span key={cIdx} className="bg-rose-100 text-rose-800 px-2 py-1 rounded-lg font-bold text-[10px]">{col}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadError.foundHeaders && uploadError.foundHeaders.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs space-y-2 max-h-40 overflow-y-auto">
                        <span className="font-black text-[10px] text-slate-700 uppercase tracking-widest block">Cabeceras leídas en el Excel:</span>
                        <p className="text-[10px] text-slate-500 mb-2">Asegúrese de renombrar las columnas relevantes para coincidir con el formato requerido:</p>
                        <div className="flex flex-wrap gap-1">
                          {uploadError.foundHeaders.map((hdr, hIdx) => (
                            <span key={hIdx} className="bg-slate-200/75 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono">{hdr}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (() => {
              const reportTitle = view === 'informe-sqm' ? 'INFORME OPERATIVO SQM NY' : 'INFORME OPERATIVO NOVANDINO';
              const reportSubtitle = view === 'informe-sqm' ? 'SUBGERENCIA LOGÍSTICA LITIO' : 'SUBGERENCIA LOGÍSTICA LITIO - DESPACHO LITIO';
              return (
                <>
                  <div id="pdf-cover-page" className="pdf-only page-break-after flex flex-col items-center justify-center min-h-[1000px] w-full bg-white text-center">
                    <div className="space-y-24 flex flex-col items-center w-full">
                      <div className="flex flex-col items-center justify-center text-center w-full">
                        <div className="flex flex-col items-center text-center">
                          <NovandinoLogo className="h-40 w-[600px] max-w-full mb-10" variant="large" />
                          <h1 className="text-[60px] font-[950] text-[#1e293b] tracking-[-0.04em] leading-tight uppercase">
                            {view === 'informe-sqm' ? (
                              <>
                                INFORME OPERATIVO<br />SQM NY
                              </>
                            ) : (
                              'INFORME OPERATIVO NOVANDINO'
                            )}
                          </h1>
                          <p className="text-slate-400 font-bold text-sm tracking-[0.4em] uppercase mt-3 whitespace-nowrap">{reportSubtitle}</p>
                        </div>
                      </div>
                      <div className="pt-20">
                        <p className="text-violeta/30 font-black text-xs tracking-[0.4em] uppercase mb-6">JORNADA CORRESPONDIENTE</p>
                        <p className="text-6xl font-[950] text-ionizado tracking-tighter">{formatDateToCL(selectedDate)}</p>
                      </div>
                    </div>
                  </div>
                  <div id="executive-summary-capture" className="no-pdf space-y-8 bg-white min-h-[1000px] flex flex-col mb-10 no-page-break">
                    <div className="bg-white p-8 space-y-10 flex-1">
                      <div className="flex justify-between items-start pb-8 border-b-2 border-calido">
                        <div className="flex flex-col items-start gap-4">
                          <NovandinoLogo className="h-32 w-[480px] max-w-full" variant="print" />
                          <div>
                            <h1 className="text-5xl font-[900] text-nucleo tracking-tighter leading-tight mb-1 uppercase">
                              {view === 'informe-sqm' ? (
                                <>
                                  INFORME OPERATIVO<br />SQM NY
                                </>
                              ) : (
                                'INFORME OPERATIVO NOVANDINO'
                              )}
                            </h1>
                            <p className="text-violeta font-bold text-[10px] tracking-[0.4em] uppercase">{reportSubtitle}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-violeta font-bold text-[10px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
                          <p className="text-2xl font-[900] text-ionizado tracking-tighter whitespace-nowrap">{formatDateToCL(selectedDate)}</p>
                        </div>
                      </div>
                    {filteredData.length > 0 && (
                      <div className="bg-white rounded-[2.5rem] p-10 border-2 border-ionizado/10 border-l-[12px] border-l-ionizado space-y-8 shadow-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-ionizado"><span className="font-black uppercase tracking-[0.3em] text-[10px]">KPIs OPERATIVOS</span></div>
                          <h2 className="text-4xl font-[900] text-nucleo tracking-tighter uppercase">Cumplimiento Global</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-4 pt-6">
                          {operationalKPIs?.map((kpi, idx) => {
                            return (
                              <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_12px_24px_-10px_rgba(70,29,119,0.05)] flex flex-col justify-between min-h-[145px] hover:shadow-[0_8px_30px_rgba(70,29,119,0.08)] hover:border-[#461D77]/15 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 inset-x-0 h-[3px] bg-slate-100 group-hover:bg-[#461D77]/80 transition-all duration-300 rounded-t-2xl"></div>
                                <div className="flex items-start gap-2.5">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-[#461D77]/8 group-hover:text-[#461D77] transition-all duration-300 shrink-0">
                                    {kpi.icon}
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-[#461D77] transition-colors duration-300 leading-tight block">
                                    {kpi.label}
                                  </span>
                                </div>
                                <div className="mt-3">
                                  <span className="text-3xl font-[900] tracking-tight text-slate-800 leading-none block">
                                    {kpi.value}
                                  </span>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-[8px] font-black text-black uppercase tracking-widest leading-none">vs día anterior</span>
                                  {kpi.comparison ? (
                                    <span className={`text-[10px] font-black flex items-center gap-0.5 select-none leading-none ${
                                      !kpi.comparison.isChange
                                        ? 'text-black'
                                        : kpi.comparison.isPositive
                                          ? 'text-emerald-600'
                                          : 'text-rose-600'
                                    }`} title="Comparado con la jornada anterior">
                                      <span className="text-[11px] font-bold leading-none">{kpi.comparison.arrow}</span>
                                      <span>{kpi.comparison.text}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-black italic font-black">S/D anterior</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="pt-6">
                      <ChartCard type="composed" xAxis="Producto" yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} title="Análisis Comparativo" data={filteredData} />
                    </div>
                  </div>
                  <div className="px-8 pb-8 mt-auto"><ReportFooter /></div>
                </div>
                {productList.map((prod, idx) => (
                  <div key={`${selectedDate}-${prod}`} id={`product-section-${idx}`} className="page-break-before bg-white block w-full pt-4" style={{ minHeight: '330mm' }}>
                    <div className="px-4">
                      <ProductDetailSection product={prod} data={filteredData.filter(d => d.Producto === prod)} allData={separatedRawData} date={selectedDate} index={idx + 1} total={productList.length} />
                    </div>
                    <div className="px-4 pb-6 mt-8"><ReportFooter /></div>
                  </div>
                ))}
              </>
              ); })()}
          </div>
        </main>
      </div>
    );
  };

  // If no user is logged in, interrupt rendering and enforce Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={setCurrentUser} />;
  }

  return (
    <>
      {renderCurrentView()}
      {passwordRequest && (
        <PasswordPrompt 
          correctPassword="MIRAME"
          moduleName={passwordRequest.name}
          onSuccess={() => { 
            setIsJefeTurnoUnlocked(true);
            setView(passwordRequest.view); 
            setPasswordRequest(null); 
          }}
          onCancel={() => setPasswordRequest(null)}
        />
      )}

      {/* Interactive Outlook Composer Assistant Modal */}
      {isOutlookModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2.2rem] shadow-2xl border border-black/[0.04] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="bg-slate-50/80 backdrop-blur-sm px-8 py-6 border-b border-black/[0.04] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violeta/10 text-violeta flex items-center justify-center shadow-sm">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-[900] text-slate-800 tracking-tight leading-none uppercase">Compartir por Outlook</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Asistente de correo corporativo</p>
                </div>
              </div>
              <button
                onClick={() => setIsOutlookModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full shadow-sm border border-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-8 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Destinatarios (Para)</label>
                    <Lock size={10} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={emailTo}
                    readOnly
                    className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed select-all outline-none"
                    placeholder="ejemplo@novandino.cl"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Copia (CC)</label>
                    <Lock size={10} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={emailCC}
                    readOnly
                    className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed select-all outline-none"
                    placeholder="ejemplo@novandino.cl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Asunto del Correo</label>
                  <Lock size={10} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={emailSubject}
                  readOnly
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed select-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vista Previa del Cuerpo</label>
                    <Lock size={10} className="text-slate-400" />
                  </div>
                  <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-wider">KPIs Generados</span>
                </div>
                <textarea
                  rows={8}
                  value={emailBody}
                  readOnly
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-500 cursor-not-allowed select-all outline-none leading-relaxed resize-none"
                />
              </div>
              
              <div className="bg-[#461D77]/5 border border-[#461D77]/10 p-4 rounded-2xl flex items-start gap-3">
                <div className="text-[#461D77] shrink-0 mt-0.5"><FileText size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#461D77]">Instrucciones de envío corporativo:</p>
                  <p className="text-[10px] text-slate-600 font-bold leading-relaxed mt-1">
                    1. Descarga el informe en PDF y PNG usando los botones del panel lateral izquierda.
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                    2. Haz clic en "Abrir Outlook" para iniciar la redacción con los destinatarios, CC y asunto pre-configurados.
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                    3. Pega la imagen PNG del dashboard directamente en el cuerpo del correo (Ctrl + V).
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                    4. Adjunta el archivo PDF descargado antes de presionar enviar.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-8 py-5 border-t border-black/[0.04] flex flex-col sm:flex-row sm:justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsOutlookModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              {/* Desktop Client button (mailto) */}
              <button
                onClick={() => {
                  const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCC)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  window.open(mailtoUrl, '_self');
                  setIsOutlookModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-violeta hover:bg-violeta/90 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-violeta/10"
              >
                <Send size={12} /> Abrir Outlook Escritorio
              </button>

              {/* Web Client button (M365) */}
              <button
                onClick={() => {
                  const owaUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(emailTo)}&cc=${encodeURIComponent(emailCC)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  window.open(owaUrl, '_blank');
                  setIsOutlookModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-600/10"
              >
                <Mail size={12} /> Abrir Outlook Web (365)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
