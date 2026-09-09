
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, Download, Calendar,
  MapPin, Clock, ArrowLeft, Truck, FileText, ChevronDown, Filter, Loader2, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { normalizeCompanyName, formatDateToCL } from '../utils/dataProcessor';
import { NovandinoLogo } from './BrandLogo';
import { logActivity, SystemUser } from '../services/firebase';

// Declaraciones para librerías cargadas vía script en index.html
declare const html2canvas: any;
declare const jspdf: any;

interface ArrivalData {
  fecha: string;
  destino: string;
  empresa: string;
  hora: number;
}

interface LlegadaEquiposProps {
  currentUser: SystemUser | null;
  onBack: () => void;
}

const CHART_COLORS = ['#461D77', '#3FAA88', '#C59E4D', '#7177EC', '#4FD1C5', '#171717'];

const getBase64FromUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image at ${url}`);
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error(`Image at ${url} is empty (0 bytes)`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const CompanyLogo: React.FC<{ company: string; className?: string }> = ({ company, className = '' }) => {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const compUpper = String(company || '').trim().toUpperCase();
    
    // Choose the logo filename
    let filename = '';
    if (compUpper.includes("COSEDUCAM")) {
      filename = 'coseducam.png';
    } else if (compUpper.includes("M&Q") || compUpper.includes("M & Q")) {
      filename = 'mq.png';
    } else if (compUpper.includes("M S & D") || compUpper.includes("MSD") || compUpper.includes("M S AND D")) {
      filename = 'msd.png';
    } else if (compUpper.includes("JORQUERA")) {
      filename = 'jorquera.png';
    } else if (compUpper.includes("AG SERVICES") || compUpper.includes("AG ")) {
      filename = 'ag.png';
    }

    if (!filename) {
      setHasError(true);
      return;
    }

    const tryLoad = async () => {
      try {
        const b64 = await getBase64FromUrl(`/${filename}`);
        if (active) {
          setLogoSrc(b64);
          setHasError(false);
        }
      } catch (err) {
        console.warn(`Could not load PNG logo for ${company} from /${filename}:`, err);
        if (active) setHasError(true);
      }
    };

    tryLoad();
    return () => {
      active = false;
    };
  }, [company]);

  if (logoSrc && !hasError) {
    return (
      <div className={`flex items-center justify-center p-2 h-full w-full ${className}`}>
        <img
          src={logoSrc}
          alt={company}
          className="max-w-full max-h-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  const compUpper = String(company || '').trim().toUpperCase();

  if (compUpper.includes("COSEDUCAM")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 L85,32 L85,68 L50,85 L15,68 L15,32 Z" fill="#fff" stroke="#f59e0b" strokeWidth="6" />
          <circle cx="50" cy="50" r="28" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" fill="none" />
          <text x="50" y="58" textAnchor="middle" fill="#f59e0b" fontFamily="system-ui, sans-serif" fontSize="22" fontWeight="900" stroke="none">CS</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-amber-600 uppercase leading-none">COSEDUCAM</span>
      </div>
    );
  }
  if (compUpper.includes("M&Q") || compUpper.includes("M & Q")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="20" y="20" width="60" height="60" rx="16" fill="#fff" stroke="#4f46e5" strokeWidth="6" />
          <path d="M32,65 V35 L50,53 L68,35 V65" stroke="#4f46e5" strokeWidth="8" fill="none" />
          <circle cx="68" cy="68" r="10" fill="#fff" stroke="#4f46e5" strokeWidth="3" />
          <path d="M68,68 L77,77" stroke="#4f46e5" strokeWidth="4" />
        </svg>
        <span className="text-[8px] font-black tracking-tight text-indigo-600 uppercase leading-none">M&Q SPA</span>
      </div>
    );
  }
  if (compUpper.includes("M S & D") || compUpper.includes("MSD") || compUpper.includes("M S AND D")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 L85,32 V68 L50,85 L15,68 V32 Z" fill="#fff" stroke="#7177EC" strokeWidth="6" />
          <path d="M28,45 Q50,70 72,45" stroke="#7177EC" strokeWidth="6" fill="none" />
          <text x="50" y="54" textAnchor="middle" fill="#7177EC" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="900" letterSpacing="-0.02em" stroke="none">MSD</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-indigo-500 uppercase leading-none">M S & D SPA</span>
      </div>
    );
  }
  if (compUpper.includes("JORQUERA")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="50,15 88,40 88,80 12,80 12,40" fill="#fff" stroke="#0d9488" strokeWidth="6" />
          <path d="M25,50 L50,28 L75,50" stroke="#0d9488" strokeWidth="7" fill="none" />
          <text x="50" y="72" textAnchor="middle" fill="#0d9488" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="900" stroke="none">JQ</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-teal-600 uppercase leading-none">JORQUERA</span>
      </div>
    );
  }
  if (compUpper.includes("AG SERVICES") || compUpper.includes("AG ")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="50" r="38" fill="#fff" stroke="#0284c7" strokeWidth="6" />
          <circle cx="50" cy="50" r="28" fill="#0284c7" />
          <text x="50" y="58" textAnchor="middle" fill="#fff" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="950" stroke="none">AG</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-sky-600 uppercase leading-none">AG SERVICES</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full text-violeta ${className}`}>
      <Truck size={36} className="text-[#461D77]" />
      <span className="text-[8px] font-black tracking-tight text-[#461D77] uppercase leading-none mt-1">{company.slice(0, 12)}</span>
    </div>
  );
};

export const LlegadaEquipos: React.FC<LlegadaEquiposProps> = ({ currentUser, onBack }) => {
  const [data, setData] = useState<ArrivalData[]>(() => {
    try {
      const saved = localStorage.getItem('sqm_llegadas_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [hourRange, setHourRange] = useState<[number, number]>([0, 23]);

  // Handle setting initial date and company on mount if data already exists
  useEffect(() => {
    if (data.length > 0 && !selectedDate) {
      const dates = [...new Set(data.map(r => r.fecha))].sort().reverse();
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        const dayData = data.filter(r => r.fecha === dates[0]);
        const cos = [...new Set(dayData.map(r => r.empresa))].sort();
        if (cos.length > 0) setSelectedCompany(cos[0]);
      }
    }
  }, [data, selectedDate]);

  const processFile = useCallback((file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
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

        if (jsonData.length < 2) throw new Error("Archivo vacío.");

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

        const processed: ArrivalData[] = jsonData.slice(startRow + 1).map(row => {
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
        }).filter((r): r is ArrivalData => r !== null && !!r.fecha && !!r.empresa);

        if (processed.length === 0) throw new Error("No se procesaron datos.");

        setData(processed);
        localStorage.setItem('sqm_llegadas_data', JSON.stringify(processed));

        // Record Arrivals excel upload audit log in Firestore
        if (currentUser) {
          logActivity(
            currentUser,
            'Carga de Datos',
            `Cargó archivo base Excel (${file.name}) con ${processed.length} registros de tránsito y llegadas de equipos.`
          ).catch(err => console.error('Error logging arrivals excel upload:', err));
        }
        const dates = [...new Set(processed.map(r => r.fecha))].sort().reverse();
        if (dates.length > 0) {
          setSelectedDate(dates[0]);
          const dayData = processed.filter(r => r.fecha === dates[0]);
          const cos = [...new Set(dayData.map(r => r.empresa))].sort();
          if (cos.length > 0) setSelectedCompany(cos[0]);
        }
      } catch (err) {
        console.error("Error procesando Excel:", err);
        alert("Error al cargar el archivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleExportPDF = async () => {
    if (exportingPDF) return;
    setExportingPDF(true);
    setExportProgress('Iniciando exportación...');
    
    const chartSection = document.getElementById('arrival-chart-section');
    const tableSection = document.getElementById('arrival-table-section');

    if (!chartSection || !tableSection) {
      alert('Error: No se pudieron encontrar las áreas del reporte.');
      setExportingPDF(false);
      return;
    }

    try {
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      setExportProgress('Capturando visualizaciones...');
      const [chartCanvas, tableCanvas] = await Promise.all([
        html2canvas(chartSection, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000
        }),
        html2canvas(tableSection, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000
        })
      ]);

      setExportProgress('Procesando página 1 (Horizontal)...');
      const chartImg = chartCanvas.toDataURL('image/jpeg', 0.90);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const chartRatio = chartCanvas.height / chartCanvas.width;
      const finalChartWidth = pdfWidth - 20;
      const finalChartHeight = finalChartWidth * chartRatio;
      pdf.addImage(chartImg, 'JPEG', 10, 10, finalChartWidth, finalChartHeight);

      setExportProgress('Procesando página 2 (Vertical)...');
      pdf.addPage('a4', 'portrait');
      const tableImg = tableCanvas.toDataURL('image/jpeg', 0.90);
      const pdfPortWidth = pdf.internal.pageSize.getWidth();
      const tableRatio = tableCanvas.height / tableCanvas.width;
      const finalTableWidth = pdfPortWidth - 20;
      const finalTableHeight = finalTableWidth * tableRatio;
      
      // Ajuste de margen superior para centrar mejor si la tabla es corta, 
      // o pegarla arriba si es larga.
      const yOffset = finalTableHeight > 250 ? 10 : 15;
      pdf.addImage(tableImg, 'JPEG', 10, yOffset, finalTableWidth, finalTableHeight);

      setExportProgress('Finalizando archivo...');

      // Record download audit log (before pdf.save to guarantee standard execution flow)
      if (currentUser) {
        logActivity(
          currentUser,
          'Descargó PDF',
          `Descargó reporte de llegadas en PDF de la empresa ${selectedCompany} para la fecha ${formatDateToCL(selectedDate)}.`
        ).catch(err => console.error('Error logging PDF download:', err));
      }

      pdf.save(`Reporte_Llegadas_${selectedCompany}_${selectedDate}.pdf`);

    } catch (error) {
      console.error('Error crítico en exportación PDF:', error);
      alert('Hubo un problema al generar el reporte. Intente nuevamente.');
    } finally {
      setExportingPDF(false);
      setExportProgress('');
    }
  };

  const companies = useMemo(() => {
    const dayData = data.filter(d => d.fecha === selectedDate);
    return [...new Set(dayData.map(d => d.empresa))].sort();
  }, [data, selectedDate]);

  const allDestinations = useMemo(() => {
    const dayData = data.filter(d => d.fecha === selectedDate && d.empresa === selectedCompany);
    return [...new Set(dayData.map(d => d.destino))].sort();
  }, [data, selectedDate, selectedCompany]);

  useMemo(() => {
    setSelectedDestinations(allDestinations);
  }, [allDestinations]);

  const filteredData = useMemo(() => {
    return data.filter(d =>
      d.fecha === selectedDate &&
      d.empresa === selectedCompany &&
      selectedDestinations.includes(d.destino) &&
      d.hora >= hourRange[0] && d.hora <= hourRange[1] + 0.99
    );
  }, [data, selectedDate, selectedCompany, selectedDestinations, hourRange]);

  const chartData = useMemo(() => {
    const hours: Record<number, Record<string, number>> = {};
    for (let i = hourRange[0]; i <= hourRange[1]; i++) {
      hours[i] = { hora: i };
      selectedDestinations.forEach(dest => {
        hours[i][dest] = 0;
      });
    }

    filteredData.forEach(d => {
      const h = Math.floor(d.hora);
      if (hours[h] && hours[h][d.destino] !== undefined) {
        hours[h][d.destino]++;
      }
    });

    return Object.values(hours).map(h => ({
      ...h,
      horaStr: `${String(h.hora).padStart(2, '0')}:00`
    }));
  }, [filteredData, selectedDestinations, hourRange]);

  const pivotTable = useMemo(() => {
    const table: Record<number, Record<string, number>> = {};
    filteredData.forEach(d => {
      const h = Math.floor(d.hora);
      if (!table[h]) table[h] = {};
      table[h][d.destino] = (table[h][d.destino] || 0) + 1;
    });

    return Object.entries(table)
      .map(([h, counts]) => ({ hora: Number(h), ...counts }))
      .sort((a, b) => a.hora - b.hora);
  }, [filteredData, selectedDestinations]);

  return (
    <div className="min-h-screen bg-calido flex flex-col font-sans text-tecnico">
      <header className="bg-white border-b border-calido px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm no-print">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <ArrowLeft size={20} />
          </button>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-nucleo tracking-tight leading-none uppercase">Llegada de Equipos</h1>
            <p className="text-[10px] font-bold text-violeta/40 uppercase tracking-widest mt-1">Control de Acceso</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data.length > 0 && (
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-[#003595]/10 cursor-pointer"
            >
              {[...new Set(data.map(d => d.fecha))].sort().reverse().map((d: any) => <option key={d} value={d}>{formatDateToCL(d)}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 bg-[#003595] hover:bg-[#002a75] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-900/10">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Subir Excel
            <input type="file" className="hidden" accept=".xlsx,.xlsm" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
          </label>
        </div>
      </header >

      <main className="flex-1 p-8 max-w-[1400px] mx-auto w-full space-y-8">
        {data.length === 0 ? (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl shadow-calido/50 flex items-center justify-center text-violeta/10 border border-calido">
              <Truck size={48} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-nucleo tracking-tight uppercase">Dashboard Logístico</h2>
              <p className="text-violeta/40 max-w-sm font-medium">Cargue el reporte de jornada para visualizar el flujo de entrada de equipos por empresa y destino.</p>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
              <div className="lg:col-span-1 bg-white p-6 rounded-[2rem] border border-calido shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-nucleo mb-2">
                  <Filter size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-violeta/40">Filtros</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-violeta/40 px-1">Seleccionar Empresa</label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="w-full bg-calido border border-calido rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-nucleo/5 transition-all"
                  >
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="lg:col-span-3 bg-white p-6 rounded-[2rem] border border-calido shadow-sm">
                <div className="flex flex-col h-full justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-violeta/40">Destinos de {selectedCompany}</span>
                    <button
                      onClick={() => setSelectedDestinations(allDestinations)}
                      className="text-[9px] font-black uppercase text-nucleo hover:underline"
                    >
                      Seleccionar Todos
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allDestinations.map(dest => (
                      <button
                        key={dest}
                        onClick={() => setSelectedDestinations(prev => prev.includes(dest) ? prev.filter(d => d !== dest) : [...prev, dest])}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedDestinations.includes(dest)
                          ? 'bg-nucleo text-white border-nucleo shadow-md shadow-nucleo/20'
                          : 'bg-calido text-violeta/40 border-calido hover:bg-calido/80'
                          }`}
                      >
                        {dest}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: GRÁFICO (HORIZONTAL) */}
            <div id="arrival-chart-section" className="bg-white rounded-[3rem] border border-calido shadow-xl overflow-hidden mb-8" style={{ backgroundColor: '#ffffff' }}>
              <div className="relative h-64 overflow-hidden bg-gradient-to-r from-[#1e1b4b] via-[#311042] to-[#1e1b4b]">
                {/* Technical grid overlay representing mining and logistic coordinates */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:1.5rem_1.5rem]" />
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-violeta/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-nucleo/15 rounded-full blur-[80px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/95 via-[#0f172a]/45 to-transparent" />
                
                <div className="absolute bottom-6 left-10 flex items-end gap-6">
                  <div className="bg-white p-2 rounded-2xl shadow-2xl flex items-center justify-center w-32 h-32 border-4 border-white/20 backdrop-blur-sm overflow-hidden">
                    <CompanyLogo company={selectedCompany} />
                  </div>
                  <div className="mb-2">
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{selectedCompany}</h2>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Reporte de Flujo de Equipos • {formatDateToCL(selectedDate)}</p>
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-8">
                <div>
                  <h3 className="text-xl font-black text-tecnico uppercase tracking-tight">ANÁLISIS DE FRECUENCIA</h3>
                  <p className="text-[10px] font-bold text-violeta/40 uppercase tracking-widest">LLEGADAS POR HORA Y PUNTO DE DESTINO</p>
                </div>

                <div className="h-[450px] w-full bg-calido/50 rounded-3xl p-6 border border-calido">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="horaStr" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                        labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      {selectedDestinations.map((dest, i) => (
                        <Line
                          key={dest}
                          type="monotone"
                          dataKey={dest}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={4}
                          dot={{ r: 4, fill: '#fff', strokeWidth: 3 }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: TABLA (VERTICAL) - OPTIMIZADA PARA QUE QUEPAN TODOS LOS DATOS */}
            <div id="arrival-table-section" className="bg-white rounded-[2.5rem] border border-calido shadow-xl p-8 space-y-6 overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex justify-between items-start border-b border-slate-100 pb-6" style={{ borderBottomColor: '#f1f5f9' }}>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-tecnico uppercase tracking-tight" style={{ color: '#171717' }}>TABLA DE CONTROL OPERATIVO</h3>
                  <p className="text-[10px] font-black text-violeta/40 uppercase tracking-widest leading-none" style={{ color: '#7177EC', opacity: 0.7 }}>CONSOLIDADO NUMÉRICO DE EQUIPOS • {selectedCompany}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-violeta/20 uppercase tracking-widest leading-none" style={{ color: '#7177EC', opacity: 0.4 }}>FECHA REPORTE: {formatDateToCL(selectedDate)}</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <table className="w-full text-left border-collapse" style={{ backgroundColor: '#ffffff', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th 
                        className="px-6 py-4 text-[11px] font-black uppercase text-violeta/40 tracking-widest" 
                        style={{ backgroundColor: '#FAF5E6', color: '#7177EC', borderBottom: '2px solid #e2e8f0', padding: '14px 16px', fontWeight: '900', letterSpacing: '0.05em' }}
                      >
                        Hora
                      </th>
                      {selectedDestinations.map(dest => (
                        <th 
                          key={dest} 
                          className="px-6 py-4 text-[11px] font-black uppercase text-nucleo tracking-tighter text-center" 
                          style={{ backgroundColor: '#FAF5E6', color: '#461D77', borderBottom: '2px solid #e2e8f0', padding: '14px 16px', fontWeight: '900', textAlign: 'center' }}
                        >
                          {dest}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" style={{ borderColor: '#e2e8f0' }}>
                    {pivotTable.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td 
                          className="px-6 py-3 text-lg font-black text-tecnico bg-calido/30" 
                          style={{ backgroundColor: '#FAF8F0', color: '#171717', borderBottom: '1px solid #e2e8f0', fontWeight: '900', padding: '12px 16px' }}
                        >
                          {String(row.hora).padStart(2, '0')}:00
                        </td>
                        {selectedDestinations.map(dest => (
                          <td 
                            key={dest} 
                            className="px-6 py-3 text-center" 
                            style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '12px 16px', textAlign: 'center' }}
                          >
                            <span 
                              className={`inline-block px-4 py-1.5 rounded-xl text-lg font-black ${row[dest] > 0 ? 'bg-nucleo/10 text-nucleo' : 'text-violeta/10'}`}
                              style={row[dest] > 0 
                                ? { backgroundColor: '#F1ECF7', color: '#461D77', padding: '6px 16px', borderRadius: '12px', display: 'inline-block', fontWeight: '900' } 
                                : { color: '#E2E6FA', padding: '6px 16px', display: 'inline-block', fontWeight: '500' }
                              }
                            >
                              {row[dest] || 0}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#0f172a' }}>
                      <td 
                        className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest" 
                        style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '950', borderTop: '2px solid #0f172a', padding: '16px' }}
                      >
                        TOTAL JORNADA
                      </td>
                      {selectedDestinations.map(dest => (
                        <td 
                          key={dest} 
                          className="px-6 py-4 text-xl font-black text-white text-center" 
                          style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '950', textAlign: 'center', borderTop: '2px solid #0f172a', padding: '16px' }}
                        >
                          {pivotTable.reduce((acc, curr) => acc + (curr[dest] || 0), 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* BLOQUE DE BOTÓN: FUERA DEL ID CAPTURADO PARA EL PDF */}
            <div className="no-print pt-4" data-html2canvas-ignore="true">
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="w-full bg-tecnico hover:bg-black text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-tecnico/10 active:scale-95"
              >
                {exportingPDF ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span className="animate-pulse">{exportProgress || 'GENERANDO...'}</span>
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    <span>GENERAR REPORTE PDF (PAGINACIÓN AUTOMÁTICA)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-8 flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-ionizado flex items-center justify-center text-white shadow-lg shadow-ionizado/20">
            <Calendar size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-black text-nucleo uppercase tracking-[0.2em] leading-none mb-1">Sistema de Gestión Logística</span>
            <span className="text-[9px] font-bold text-violeta/40 uppercase tracking-widest">v3.10.0</span>
          </div>
        </div>
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em] text-center md:text-right">Proyecto Dashboard Operativo • Confidencial</p>
      </footer>
    </div >
  );
};
