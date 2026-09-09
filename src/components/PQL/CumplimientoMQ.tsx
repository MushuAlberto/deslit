import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, Upload, X, ChevronRight, BarChart3, TrendingUp, TrendingDown, AlertCircle, 
  Calendar, CheckCircle, HelpCircle, Activity, ClipboardCheck, Target, Gauge, Zap, Package, Truck,
  Download, Loader2, Image as ImageIcon, FileText, MessageSquare
} from 'lucide-react';
import { 
  BarChart, Bar, Cell, LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { toPng } from 'html-to-image';
import { NovandinoLogo } from '../BrandLogo';

interface CumplimientoRow {
  fecha: Date;
  dayLabel: string;
  sol: number;
  real: number;
  equipos: number;
  ton: number;
  prod: number;
  defDia: number;
  defAcumVueltas: number;
  defTonDia: number;
  defAcumTon: number;
}

interface CumplimientoMQProps {
  onBack: () => void;
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_FULL_TO_ABBR: { [key: string]: string } = {
  enero: 'ene', febrero: 'feb', marzo: 'mar', abril: 'abr', mayo: 'may', junio: 'jun',
  julio: 'jul', agosto: 'ago', septiembre: 'sep', setiembre: 'sep', octubre: 'oct',
  noviembre: 'nov', diciembre: 'dic'
};

export const CumplimientoMQ: React.FC<CumplimientoMQProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<{ [key: string]: CumplimientoRow[] }>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [noteText, setNoteText] = useState<string>('');

  const stripAccents = (s: string) => {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const parseSheet = (ws: XLSX.WorkSheet): CumplimientoRow[] | null => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
    let headerRow = -1;
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
      const cell = aoa[i] && aoa[i][0];
      if (cell && stripAccents(String(cell)).trim().toLowerCase() === 'fecha') {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) return null;
    const rows: CumplimientoRow[] = [];
    
    for (let r = headerRow + 2; r < aoa.length; r++) {
      const row = aoa[r];
      // Skip undefined or non-array rows
      if (!row || !Array.isArray(row)) continue;

      // Skip rows where every single cell is null, undefined, or empty/whitespace
      const isEntirelyBlank = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
      if (isEntirelyBlank) continue;

      const fechaVal = row[0];
      // Skip rows with missing or blank date
      if (fechaVal === null || fechaVal === undefined || String(fechaVal).trim() === '') continue;

      // Skip summary / total / average rows
      const fechaStr = stripAccents(String(fechaVal)).trim().toLowerCase();
      if (/^(total|totales|promedio|promedios|resumen|subtotal|suma)/i.test(fechaStr)) {
        continue;
      }

      let fecha: Date | null = null;
      if (fechaVal instanceof Date) {
        fecha = fechaVal;
      } else if (typeof fechaVal === 'number') {
        fecha = new Date((fechaVal - 25569) * 86400 * 1000);
      } else if (typeof fechaVal === 'string') {
        const parsed = new Date(fechaVal);
        if (!isNaN(parsed.getTime())) fecha = parsed;
      }

      // If invalid date, skip this row
      if (!fecha || isNaN(fecha.getTime())) continue;

      const solRaw = row[1];
      const realRaw = row[2];
      const equiposRaw = row[3];
      const tonRaw = row[4];
      const prodRaw = row[5];
      const defDiaRaw = row[6];
      const defAcumVueltasRaw = row[7];
      const defTonDiaRaw = row[8];
      const defAcumTonRaw = row[9];

      // Check if all data fields in the row are empty or blank
      const isSolEmpty = solRaw === null || solRaw === undefined || String(solRaw).trim() === '';
      const isRealEmpty = realRaw === null || realRaw === undefined || String(realRaw).trim() === '';
      const isTonEmpty = tonRaw === null || tonRaw === undefined || String(tonRaw).trim() === '';
      const isEquiposEmpty = equiposRaw === null || equiposRaw === undefined || String(equiposRaw).trim() === '';

      // Skip if completely empty metrics
      if (isSolEmpty && isRealEmpty && isTonEmpty && isEquiposEmpty) {
        continue;
      }

      // Skip unrecorded/unworked future days where both requested and real are blank
      if (isSolEmpty && isRealEmpty) {
        continue;
      }

      let sol = Number(solRaw) || 0;
      const real = Number(realRaw) || 0;
      const equipos = Number(equiposRaw) || 0;
      const ton = Number(tonRaw) || 0;
      const prod = Number(prodRaw) || 0;
      let defDia = Number(defDiaRaw) || 0;
      const defAcumVueltas = Number(defAcumVueltasRaw) || 0;
      const defTonDia = Number(defTonDiaRaw) || 0;
      const defAcumTon = Number(defAcumTonRaw) || 0;

      // If sol is missing or 0 but defDia exists, infer sol = real - defDia
      if (sol === 0 && defDia !== 0 && real > 0) {
        const inferred = real - defDia;
        if (inferred > 0) sol = inferred;
      }

      // If every numeric column is exactly 0 and no operations were recorded, treat as empty row
      if (sol === 0 && real === 0 && equipos === 0 && ton === 0 && prod === 0 && defDia === 0) {
        continue;
      }

      rows.push({
        fecha,
        dayLabel: String(fecha.getUTCDate()).padStart(2, '0') + '-' + MONTH_ABBR[fecha.getUTCMonth()],
        sol,
        real,
        equipos,
        ton,
        prod,
        defDia,
        defAcumVueltas,
        defTonDia,
        defAcumTon,
      });
    }

    // Forward and backward fill for sol (meta planificada) so dashed target line extends through all operational days
    let runningSol = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].sol > 0) {
        runningSol = rows[i].sol;
      } else if (runningSol > 0 && rows[i].real > 0) {
        rows[i].sol = runningSol;
        if (rows[i].defDia === 0) {
          rows[i].defDia = rows[i].real - rows[i].sol;
        }
      }
    }
    if (runningSol > 0) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].sol === 0 && rows[i].real > 0) {
          rows[i].sol = runningSol;
          if (rows[i].defDia === 0) {
            rows[i].defDia = rows[i].real - rows[i].sol;
          }
        } else if (rows[i].sol > 0) {
          runningSol = rows[i].sol;
        }
      }
    }

    return rows;
  };

  const guessDefaultSheet = (sheetNames: string[], fileName: string): string => {
    const norm = stripAccents(fileName.toLowerCase());
    let abbrev: string | null = null;
    for (const full in MONTH_FULL_TO_ABBR) {
      if (norm.includes(full)) {
        abbrev = MONTH_FULL_TO_ABBR[full];
        break;
      }
    }
    const yearMatch = norm.match(/(20\d{2})/);
    const year2 = yearMatch ? yearMatch[1].slice(2) : null;

    if (abbrev) {
      const match = sheetNames.find(n => {
        const sn = stripAccents(n.toLowerCase());
        return sn.startsWith(abbrev!) && (!year2 || sn.includes(year2));
      });
      if (match) return match;
      const matchLoose = sheetNames.find(n => stripAccents(n.toLowerCase()).startsWith(abbrev!));
      if (matchLoose) return matchLoose;
    }
    
    return sheetNames[sheetNames.length - 1] || sheetNames[0];
  };

  const handleFileProcess = async (fileToProcess: File) => {
    const validExt = /\.xlsx?$/i.test(fileToProcess.name);
    if (!validExt) {
      setStatusMsg({ text: 'Formato no soportado. Sube un archivo .xlsx o .xls', isError: true });
      return;
    }
    try {
      const buf = await fileToProcess.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const parsedSheets: { [key: string]: CumplimientoRow[] } = {};
      
      wb.SheetNames.forEach(name => {
        const parsed = parseSheet(wb.Sheets[name]);
        if (parsed !== null && parsed.length > 0) {
          parsedSheets[name] = parsed;
        }
      });

      const validSheets = Object.keys(parsedSheets);
      if (validSheets.length === 0) {
        setStatusMsg({ text: 'No se encontró ninguna hoja con formato reconocible (columna "Fecha"). Revisa el archivo.', isError: true });
        return;
      }

      setWorkbookSheets(parsedSheets);
      setFile(fileToProcess);
      
      const defaultSheet = guessDefaultSheet(validSheets, fileToProcess.name);
      setSelectedSheet(defaultSheet);
      setStatusMsg({ text: `Archivo cargado con éxito. Se detectaron ${validSheets.length} hojas operacionales.`, isError: false });
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: 'No se pudo leer el archivo. Verifica que sea un Excel válido con formato M&Q.', isError: true });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const resetState = () => {
    setFile(null);
    setWorkbookSheets({});
    setSelectedSheet('');
    setStatusMsg(null);
  };

  // Active data calculation
  const currentData = useMemo(() => {
    if (!selectedSheet || !workbookSheets[selectedSheet]) return [];
    return workbookSheets[selectedSheet];
  }, [selectedSheet, workbookSheets]);

  // KPIs calculations
  const kpis = useMemo(() => {
    if (currentData.length === 0) return null;
    // Filter to get only days that have actually been operated (real > 0 or tonnage > 0)
    const operatedDays = currentData.filter(r => r.real > 0 || r.ton > 0);
    const lastOperated = operatedDays.length > 0 ? operatedDays[operatedDays.length - 1] : currentData[currentData.length - 1];

    const totalSol = operatedDays.reduce((a, r) => a + r.sol, 0);
    const totalReal = operatedDays.reduce((a, r) => a + r.real, 0);
    const cumplPct = totalSol > 0 ? (totalReal / totalSol * 100) : 0;
    const deficitVueltas = lastOperated.defAcumVueltas;
    const deficitTon = lastOperated.defAcumTon;
    const avgProd = operatedDays.length > 0 ? (operatedDays.reduce((a, r) => a + r.prod, 0) / operatedDays.length) : 0;
    
    // Last 3 days trend
    const last3 = operatedDays.slice(-3);
    const last3Sum = last3.reduce((a, r) => a + r.defDia, 0);

    return {
      cumplPct,
      totalReal,
      totalSol,
      deficitVueltas,
      deficitTon,
      avgProd,
      last3Sum,
      trendUp: last3Sum >= 0
    };
  }, [currentData]);

  // Critical Days (Anomalies)
  const criticalDays = useMemo(() => {
    if (currentData.length === 0) return [];
    return [...currentData]
      .sort((a, b) => a.defDia - b.defDia)
      .slice(0, 3);
  }, [currentData]);

  // Date of the last data row in the Excel sheet
  const lastDateStr = useMemo(() => {
    if (currentData.length === 0) return '';
    const lastRow = currentData[currentData.length - 1];
    if (!lastRow || !lastRow.fecha) return '';
    const d = lastRow.fecha;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }, [currentData]);

  const [downloadingPng, setDownloadingPng] = useState(false);

  const handleDownloadPNG = async () => {
    const element = document.getElementById('cumplimiento-mq-dashboard-capture');
    if (!element) return;
    setDownloadingPng(true);
    try {
      await new Promise(r => setTimeout(r, 120));

      const width = Math.max(element.scrollWidth, 1200) + 48;
      const height = element.scrollHeight + 48;

      const dataUrl = await toPng(element, {
        width: width,
        height: height,
        backgroundColor: '#FAF5E6',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.getAttribute('data-ignore-capture') === 'true') {
            return false;
          }
          return true;
        },
        style: {
          borderRadius: '0px',
          padding: '24px',
          margin: '0px',
          height: 'auto',
          maxHeight: 'none',
          overflow: 'visible'
        }
      });

      const link = document.createElement('a');
      const sheetTag = selectedSheet ? `_${selectedSheet.replace(/\s+/g, '_')}` : '';
      const dateTag = lastDateStr ? `_${lastDateStr}` : '';
      link.download = `Cumplimiento_MQ_SLIT${sheetTag}${dateTag}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Audit log to Firebase if available
      try {
        const savedUser = localStorage.getItem('sqm_current_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const { logActivity } = await import('../../services/firebase');
          logActivity(
            parsedUser,
            'Descargó PNG',
            `Descargó reporte completo de Cumplimiento M&Q SLIT (${selectedSheet || ''}) en formato PNG.`
          );
        }
      } catch (logErr) {
        console.error('Error logging PNG download:', logErr);
      }
    } catch (error) {
      console.error('Error generating PNG:', error);
      setStatusMsg({ text: 'No se pudo generar la imagen PNG. Intenta nuevamente.', isError: true });
    } finally {
      setDownloadingPng(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#FAF5E6] font-sans text-[#171717] overflow-hidden">
      
      {/* SIDEBAR FOR ACTIONS */}
      <aside className="w-[300px] bg-[#DCDDEE] border-r border-[#7177EC]/20 flex flex-col no-print shrink-0">
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-[#461D77] hover:text-[#34155b] font-black text-[10px] uppercase tracking-widest transition-colors mb-2 group cursor-pointer"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Volver a Módulo PQL
          </button>

          <div className="bg-white p-5 rounded-3xl border border-[#DCDDEE] flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-[#7177EC]">
              <ClipboardCheck size={18} />
              <span className="font-black text-[10px] tracking-wider uppercase">CUMPLIMIENTO PQL</span>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Monitoreo integral de cumplimiento de metas de despacho M&Q, toneladas y rendimiento de flota mensual.
            </p>
          </div>

          {/* EXPORT ACTIONS */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#7177EC]">Exportación de Reporte</p>
            <div className="bg-white p-5 rounded-3xl border border-[#DCDDEE] space-y-3 shadow-sm">
              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={!file || currentData.length === 0 || downloadingPng}
                className="w-full bg-[#461D77] hover:bg-[#381660] text-white disabled:bg-slate-300 disabled:cursor-not-allowed font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
              >
                {downloadingPng ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[#3FAA88]" />
                    <span>Generando PNG...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} className="text-[#4FD1C5]" />
                    <span>Descargar Imagen PNG</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 font-medium text-center leading-tight">
                Incluye encabezado Novandino, métricas, gráficos y tabla completa.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#7177EC]">Configuración de Visualización</p>
            <div className="bg-white p-5 rounded-3xl border border-[#DCDDEE] space-y-4 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Mes / Hoja Operativa</label>
                <select 
                  value={selectedSheet} 
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  disabled={Object.keys(workbookSheets).length === 0}
                  className="w-full bg-[#F8FAFC] border border-[#DCDDEE] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] outline-none focus:border-[#7177EC] focus:ring-2 focus:ring-[#7177EC]/20 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {Object.keys(workbookSheets).length === 0 ? (
                    <option>— Sin datos —</option>
                  ) : (
                    Object.keys(workbookSheets).map(sheetName => (
                      <option key={sheetName} value={sheetName}>{sheetName}</option>
                    ))
                  )}
                </select>
              </div>

              {file && (
                <div className="pt-2 border-t border-[#DCDDEE] flex items-center justify-between">
                  <span className="text-[8px] font-black bg-[#3FAA88]/15 text-[#3FAA88] border border-[#3FAA88]/30 px-2.5 py-0.5 rounded-full uppercase truncate max-w-[150px]">
                    {file.name}
                  </span>
                  <button 
                    onClick={resetState}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remover Archivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#FAF5E6] overflow-y-auto">
        
        {/* HEADER BAR */}
        <header className="bg-white/90 backdrop-blur-md border-b border-[#DCDDEE] px-8 py-5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-[#4FD1C5]/15 text-[#0d9488] border border-[#4FD1C5]/30 uppercase">
                PQL • Planta Química Litio
              </span>
              {selectedSheet && (
                <span className="text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-[#461D77]/10 text-[#461D77] border border-[#461D77]/20 uppercase">
                  PERÍODO: {selectedSheet}
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-[#171717] tracking-tight uppercase mt-1">
              Cumplimiento M&Q • Operación SLIT
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={14} className="text-[#461D77]" />
            <span className="font-mono text-[11px] font-bold">Última Actualización: {new Date().toLocaleDateString('es-CL')}</span>
          </div>
        </header>

        {/* CONTENT */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
          
          {/* UPLOAD ZONE (If no file is uploaded) */}
          {!file && (
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-[2.5rem] p-12 text-center transition-all ${
                dragActive 
                  ? 'border-[#461D77] bg-[#461D77]/5 shadow-md' 
                  : 'border-[#DCDDEE] bg-white hover:border-[#7177EC] shadow-sm'
              }`}
            >
              <div className="w-20 h-20 rounded-3xl bg-[#FAF5E6] border border-[#DCDDEE] flex items-center justify-center mx-auto shadow-inner mb-6">
                <Upload size={38} className="text-[#461D77]" />
              </div>
              <h2 className="text-xl font-black text-[#171717] uppercase mb-2">Carga tu Archivo M&Q Mensual</h2>
              <p className="text-slate-600 text-xs font-medium max-w-md mx-auto leading-relaxed mb-6">
                Arrastra o haz clic para subir el archivo de cumplimiento de Novandino (.xlsx). El sistema procesará cada pestaña de mes automáticamente.
              </p>
              <input 
                type="file" 
                id="pqlFileInput" 
                accept=".xlsx,.xls" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => document.getElementById('pqlFileInput')?.click()}
                className="bg-[#7177EC] hover:bg-[#5e64e3] text-white font-black text-[10px] uppercase tracking-widest px-8 py-3.5 rounded-2xl transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95"
              >
                Buscar Archivo en mi PC
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs shadow-xs ${
              statusMsg.isError 
                ? 'bg-[#C59E4D]/15 border-[#C59E4D]/30 text-[#8c6b24]' 
                : 'bg-[#3FAA88]/10 border-[#3FAA88]/30 text-[#256c55]'
            }`}>
              <AlertCircle size={16} />
              <span className="font-bold">{statusMsg.text}</span>
            </div>
          )}

          {/* DASHBOARD CONTENT (Active only if data exists) */}
          {file && currentData.length > 0 && kpis && (
            <div id="cumplimiento-mq-dashboard-capture" className="space-y-6 animate-fade-in p-2">
              
              {/* ENCABEZADO INTEGRADO: LOGO NOVANDINO, FECHA Y OPERACIÓN */}
              <div className="bg-white px-7 py-5 rounded-[2.2rem] border border-[#DCDDEE] shadow-sm flex flex-col gap-4">
                {/* Fila Superior: Logo Novandino y Fecha Jornada */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#DCDDEE]/60">
                  <div className="flex items-center">
                    <NovandinoLogo className="h-20 md:h-24 w-auto" variant="medium" />
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-[10px] md:text-xs font-black text-[#7177EC] tracking-[0.2em] uppercase">
                      FECHA JORNADA
                    </p>
                    <p className="text-sm md:text-base font-black text-[#3FAA88] tracking-tight font-mono mt-0.5">
                      {lastDateStr || '—'}
                    </p>
                  </div>
                </div>

                {/* Fila Inferior: Logo Empresa y Título Operación */}
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2.5 rounded-2xl border border-[#DCDDEE] shadow-sm flex items-center justify-center h-16 w-24 shrink-0 overflow-hidden">
                    <img 
                      src="/mq.png" 
                      alt="Logo M&Q" 
                      className="max-h-full max-w-full object-contain scale-110"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2.5">
                    <h2 className="text-lg md:text-xl font-black text-[#171717] tracking-tight">
                      Cumplimiento M&Q
                    </h2>
                    <span className="hidden sm:inline-block text-slate-300 font-bold">•</span>
                    <span className="text-xs md:text-sm font-bold text-[#7177EC] uppercase tracking-wider">
                      Operación SLIT
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* CUMPLIMIENTO DEL MES */}
                <div className="bg-white p-6 rounded-[2.2rem] border border-[#DCDDEE] shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(70,29,119,0.06)] hover:border-[#7177EC]/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-[#461D77]/5 text-[#461D77] flex items-center justify-center group-hover:bg-[#461D77] group-hover:text-white transition-all duration-300">
                      <Target className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight ${
                      kpis.cumplPct >= 95 
                        ? 'bg-[#3FAA88]/10 text-[#3FAA88] border border-[#3FAA88]/30' 
                        : 'bg-[#C59E4D]/15 text-[#C59E4D] border border-[#C59E4D]/30'
                    }`}>
                      {kpis.cumplPct >= 100 ? 'Meta Superada' : kpis.cumplPct >= 90 ? 'En Rango' : 'Bajo Meta'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CUMPLIMIENTO DEL MES</p>
                    <h3 className="text-3xl lg:text-4xl font-[900] text-[#171717] tracking-tight flex items-baseline gap-1 font-sans">
                      {kpis.cumplPct.toFixed(1)}<span className="text-slate-400 text-sm font-bold">%</span>
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#DCDDEE]/60 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 font-medium">{kpis.totalReal} de {kpis.totalSol} vueltas</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Realizadas</span>
                  </div>
                </div>

                {/* DÉFICIT ACUMULADO */}
                <div className="bg-white p-6 rounded-[2.2rem] border border-[#DCDDEE] shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(70,29,119,0.06)] hover:border-[#7177EC]/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      kpis.deficitVueltas >= 0 
                        ? 'bg-[#3FAA88]/10 text-[#3FAA88] group-hover:bg-[#3FAA88] group-hover:text-white' 
                        : 'bg-[#C59E4D]/15 text-[#C59E4D] group-hover:bg-[#C59E4D] group-hover:text-white'
                    }`}>
                      {kpis.deficitVueltas >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight ${
                      kpis.deficitVueltas >= 0 
                        ? 'bg-[#3FAA88]/10 text-[#3FAA88] border border-[#3FAA88]/30' 
                        : 'bg-[#C59E4D]/15 text-[#C59E4D] border border-[#C59E4D]/30'
                    }`}>
                      {kpis.deficitVueltas >= 0 ? '+ Superávit' : 'Déficit'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">DÉFICIT ACUMULADO</p>
                    <h3 className={`text-3xl lg:text-4xl font-[900] tracking-tight flex items-baseline gap-1.5 font-sans ${
                      kpis.deficitVueltas >= 0 ? 'text-[#3FAA88]' : 'text-[#C59E4D]'
                    }`}>
                      {kpis.deficitVueltas > 0 ? `+${kpis.deficitVueltas}` : kpis.deficitVueltas}
                      <span className="text-slate-400 text-xs font-semibold uppercase">vueltas</span>
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#DCDDEE]/60 flex items-center justify-between text-xs font-mono">
                    <span className={`font-bold ${kpis.deficitVueltas >= 0 ? 'text-[#3FAA88]' : 'text-[#C59E4D]'}`}>
                      {Math.round(kpis.deficitTon).toLocaleString('es-CL')} ton
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">vs. Plan</span>
                  </div>
                </div>

                {/* PRODUCTIVIDAD PROMEDIO */}
                <div className="bg-white p-6 rounded-[2.2rem] border border-[#DCDDEE] shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(70,29,119,0.06)] hover:border-[#7177EC]/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-[#461D77]/5 text-[#461D77] flex items-center justify-center group-hover:bg-[#461D77] group-hover:text-white transition-all duration-300">
                      <Gauge className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight bg-[#4FD1C5]/10 text-[#0d9488] border border-[#4FD1C5]/30">
                      Rendimiento
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PRODUCTIVIDAD PROMEDIO</p>
                    <h3 className="text-3xl lg:text-4xl font-[900] text-[#171717] tracking-tight flex items-baseline gap-1.5 font-sans">
                      {kpis.avgProd.toFixed(2)}<span className="text-slate-400 text-xs font-semibold uppercase">ton/vuelta</span>
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#DCDDEE]/60 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 font-medium">Promedio del mes</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Días activos</span>
                  </div>
                </div>

                {/* TENDENCIA ÚLTIMOS 3 DÍAS */}
                <div className="bg-white p-6 rounded-[2.2rem] border border-[#DCDDEE] shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(70,29,119,0.06)] hover:border-[#7177EC]/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      kpis.last3Sum >= 0 
                        ? 'bg-[#3FAA88]/10 text-[#3FAA88] group-hover:bg-[#3FAA88] group-hover:text-white' 
                        : 'bg-[#C59E4D]/15 text-[#C59E4D] group-hover:bg-[#C59E4D] group-hover:text-white'
                    }`}>
                      <Activity className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight ${
                      kpis.last3Sum >= 0 
                        ? 'bg-[#3FAA88]/10 text-[#3FAA88] border border-[#3FAA88]/30' 
                        : 'bg-[#C59E4D]/15 text-[#C59E4D] border border-[#C59E4D]/30'
                    }`}>
                      {kpis.last3Sum >= 0 ? 'Positiva' : 'Crítica'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TENDENCIA ÚLTIMOS 3 DÍAS</p>
                    <h3 className={`text-3xl lg:text-4xl font-[900] tracking-tight flex items-baseline gap-1.5 font-sans ${
                      kpis.last3Sum >= 0 ? 'text-[#3FAA88]' : 'text-[#C59E4D]'
                    }`}>
                      {kpis.last3Sum > 0 ? `+${kpis.last3Sum}` : kpis.last3Sum}
                      <span className="text-slate-400 text-xs font-semibold uppercase">vueltas</span>
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#DCDDEE]/60 flex items-center justify-between text-xs font-mono">
                    <span className={`font-bold ${kpis.last3Sum >= 0 ? 'text-[#3FAA88]' : 'text-[#C59E4D]'}`}>
                      {kpis.last3Sum >= 0 ? 'Revirtiendo déficit' : 'Profundizando déficit'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">3 Días</span>
                  </div>
                </div>
              </div>

              {/* ROUTE CHART */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-[#DCDDEE] shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-black text-[#171717] uppercase">CUMPLIMIENTO DIARIO</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Vueltas Reales vs. Meta Diaria</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#461D77]" />
                      <span className="text-[#171717]">Cumple Meta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#C59E4D]" />
                      <span className="text-[#171717]">Déficit</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="dayLabel" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold" 
                        tickLine={false} 
                      />
                      <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #DCDDEE', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }} 
                        labelStyle={{ fontWeight: 'black', fontSize: '11px', color: '#461D77' }}
                      />
                      <Bar 
                        dataKey="real" 
                        name="Vueltas Reales" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      >
                        {currentData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.defDia >= 0 ? '#461D77' : '#C59E4D'} 
                          />
                        ))}
                      </Bar>
                      <Line 
                        type="monotone" 
                        dataKey="sol" 
                        name="Meta Planificada" 
                        stroke="#7177EC" 
                        strokeWidth={1.75} 
                        strokeDasharray="5 5" 
                        dot={false}
                        connectNulls={true}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TWO COLUMNS CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cumulative Deficit Chart */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-[#DCDDEE] shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                  <h2 className="text-base font-black text-[#171717] uppercase">Déficit Acumulado del Mes</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 mb-6">Brecha acumulada en Toneladas</p>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pqlGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#461D77" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#461D77" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #DCDDEE' }} />
                        <Area 
                          type="monotone" 
                          dataKey="defAcumTon" 
                          name="Déficit Acum. (Ton)" 
                          stroke="#461D77" 
                          fillOpacity={1} 
                          fill="url(#pqlGrad)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Productivity Chart */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-[#DCDDEE] shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                  <h2 className="text-base font-black text-[#171717] uppercase">Productividad Diaria</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 mb-6">Rendimiento Promedio de Toneladas por Vuelta</p>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #DCDDEE' }} />
                        <Line 
                          type="monotone" 
                          dataKey="prod" 
                          name="Ton/Vuelta" 
                          stroke="#3FAA88" 
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#3FAA88', strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ANOMALIES/CRITICAL DAYS */}
              {criticalDays.length > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] border border-[#DCDDEE] shadow-sm">
                  <h2 className="text-base font-black text-[#171717] uppercase mb-1">Días Críticos del Mes</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-6">Jornadas con Mayor Caída de Cumplimiento Planificado</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {criticalDays.map((day, idx) => (
                      <div key={idx} className="bg-[#FAF5E6] p-5 rounded-3xl border border-[#C59E4D]/30 border-l-4 border-l-[#C59E4D] relative flex flex-col justify-between shadow-xs">
                        <div>
                          <p className="text-sm md:text-base font-black text-[#171717] uppercase tracking-wider">{day.dayLabel}</p>
                          <p className="text-2xl font-black text-[#C59E4D] mt-2 mb-1">{day.defDia} Vueltas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DAILY DETAILS TABLE */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-[#DCDDEE] shadow-sm overflow-hidden">
                <div className="mb-6">
                  <h2 className="text-base font-black text-[#171717] uppercase">Detalle Diario de Operación</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Registro unificado del cumplimiento M&Q SLIT</p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-[#DCDDEE] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <table className="min-w-full text-xs font-mono">
                    <thead>
                      <tr className="bg-[#DCDDEE]/30 text-slate-700 border-b border-[#DCDDEE]">
                        <th className="px-6 py-4 text-left font-black tracking-widest uppercase">Fecha</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Solicitadas</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Real</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">N° Equipos</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Tonelaje</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Productividad</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Déficit Día</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Déficit Acum.</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Déficit Ton</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Acum. Ton</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCDDEE] bg-white">
                      {currentData.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className="bg-white hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="px-6 py-4 text-left font-bold text-[#461D77]">{row.dayLabel}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">{row.sol}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">{row.real}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">{row.equipos}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">{row.ton.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">{row.prod.toFixed(2)}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defDia < 0 ? 'text-[#C59E4D]' : 'text-[#3FAA88]'}`}>{row.defDia}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defAcumVueltas < 0 ? 'text-[#C59E4D]' : 'text-[#3FAA88]'}`}>{row.defAcumVueltas}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defTonDia < 0 ? 'text-[#C59E4D]' : 'text-[#3FAA88]'}`}>{Math.round(row.defTonDia).toLocaleString('es-CL')}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defAcumTon < 0 ? 'text-[#C59E4D]' : 'text-[#3FAA88]'}`}>{Math.round(row.defAcumTon).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CUADRO DE NOTAS / OBSERVACIONES OPERATIVAS */}
                {/* Formulario Interactivo (visible en pantalla para editar, ignorado en la captura para mostrar la tarjeta limpia) */}
                <div data-ignore-capture="true" className="mt-5 pt-5 border-t border-[#DCDDEE]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[#7177EC]" />
                      <span className="text-xs font-black uppercase tracking-wider text-[#171717]">Notas y Observaciones de la Jornada</span>
                    </div>
                    {noteText.trim().length > 0 ? (
                      <span className="text-[10px] font-bold text-[#3FAA88] bg-[#3FAA88]/10 border border-[#3FAA88]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle size={12} /> Se incluirá en la exportación PNG
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Opcional (se omite en el PNG si está vacío)
                      </span>
                    )}
                  </div>
                  
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escribe aquí notas, justificaciones de desvíos, condiciones climáticas o comentarios operacionales (opcional)..."
                    rows={3}
                    className="w-full text-xs font-medium text-slate-800 bg-[#FAF5E6]/60 hover:bg-[#FAF5E6] focus:bg-white border border-[#DCDDEE] focus:border-[#7177EC] rounded-2xl p-3.5 outline-none transition-all resize-y shadow-2xs placeholder:text-slate-400 placeholder:italic"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
                    <span>* Si no ingresas texto, el reporte PNG omitirá automáticamente este cuadro sin dejar espacios vacíos.</span>
                    {noteText.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setNoteText('')}
                        className="text-slate-400 hover:text-red-500 font-bold transition-colors cursor-pointer"
                      >
                        Limpiar nota
                      </button>
                    )}
                  </div>
                </div>

                {/* TARJETA FORMATEADA DE NOTAS (Se muestra en la captura y en la vista cuando hay texto; se omite al 100% si está vacío) */}
                {noteText.trim().length > 0 && (
                  <div className="mt-4 p-5 rounded-3xl bg-[#FAF5E6] border border-[#7177EC]/30 border-l-4 border-l-[#7177EC] shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7177EC] mb-2 flex items-center gap-1.5">
                      <FileText size={14} className="text-[#7177EC]" /> Notas y Observaciones Operativas
                    </p>
                    <p className="text-xs font-medium text-[#171717] leading-relaxed whitespace-pre-wrap">
                      {noteText.trim()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
