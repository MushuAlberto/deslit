import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, FileText, TrendingUp, ArrowLeft, Image, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import CambioAnalisisComparativoChart, { formatDecimalToHHMM } from './CambioAnalisisComparativoChart';
import CambioAnalisisProductoChart from './CambioAnalisisProductoChart';
import { SimpleMarkdown } from './SimpleMarkdown';
import { analyzeProductData } from '../services/localAnalysisService';
import { cleanNumeric, parseExcelTime, normalizeHeader } from '../utils/dataProcessor';
import { generateShiftReportPDF } from '../utils/pdfGenerator';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from './Toast';

interface ChartData {
  name: string;
  producto: string;
  dateKey: string;
  Ton_Prog: number;
  Ton_Real: number;
  faenaMetaHours: number;
  faenaRealHours: number;
  destino: string;
}

const PRODUCTS_A = [
  "BISCHOFITA",
  "SAL 27/15",
  "SLIT",
  "LSI (S)",
  "NACL",
  "HALITA"
];

const PRODUCTS_B = [
  "MOP 70", "MOP TALCO", "MOP TALCO MAXIS", "MOP-G", "MOP-G (Rojo)",
  "MOP-G 59", "MOP-G O", "MOP-G PLUS", "MOP-G R 59", "MOP-GR PLUS",
  "MOP-H-AL", "MOP-H-BL", "MOP-S", "MOP-S 59", "MOP-S PLUS",
  "SILVINITA", "SOP-G", "SOP-H", "SOP-O", "SOP-S Talco",
  "USOP52", "MOP 50", "SOP FINO"
];

interface CambioDeTurnoProps {
  onBack: () => void;
}

export default function CambioDeTurno({ onBack }: CambioDeTurnoProps) {
  const { success, error: toastError, warning, info } = useToast();

  const [allData, setAllData] = useState<ChartData[]>([]);
  const [range1, setRange1] = useState({ start: '', end: '' });
  const [range2, setRange2] = useState({ start: '', end: '' });
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceFiles, setComplianceFiles] = useState<string[]>([]);

  // Drag & drop uploader states
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Global AI settings fetched dynamically from Firestore
  const [globalAiSettings, setGlobalAiSettings] = useState({
    activeAi: 'gemini' as 'gemini' | 'glm',
    enableGemini: true,
    enableGlm: true,
    enableShiftAnalysis: true,
    enableJustificationRefinement: true
  });
  const [userAiEnabled, setUserAiEnabled] = useState<boolean>(() => {
    try {
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        return parsedUser.enableAi !== false;
      }
    } catch (e) {
      console.error('Error parsing sqm_current_user for AI state in CambioDeTurno:', e);
    }
    return true; // Safe fallback
  });

  useEffect(() => {
    const fetchAiSettings = async () => {
      try {
        const docRef = doc(db, 'system_config', 'ai_settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGlobalAiSettings({
            activeAi: data.activeAi || 'gemini',
            enableGemini: data.enableGemini !== false,
            enableGlm: data.enableGlm !== false,
            enableShiftAnalysis: data.enableShiftAnalysis !== false,
            enableJustificationRefinement: data.enableJustificationRefinement !== false
          });
        }

        const savedUser = localStorage.getItem('sqm_current_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const userDocRef = doc(db, 'users', parsedUser.userId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserAiEnabled(userData.enableAi !== false);
          }
        }
      } catch (err) {
        console.error('Error fetching AI settings in CambioDeTurno:', err);
      }
    };
    fetchAiSettings();
  }, []);

  // Lifted analysis states for PDF generation
  const [novandinoAnalysis, setNovandinoAnalysis] = useState<string | null>(null);
  const [sqmAnalysis, setSqmAnalysis] = useState<string | null>(null);

  // Intentar cargar datos existentes desde localStorage al inicializar
  useEffect(() => {
    const savedData = localStorage.getItem('sqm_raw_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed && parsed.length > 0) {
          const mapped: ChartData[] = parsed.map((item: any) => ({
            name: item.Producto || 'SIN PRODUCTO',
            producto: item.Producto || 'SIN PRODUCTO',
            dateKey: item.Fecha,
            Ton_Prog: Number(item.Ton_Prog) || 0,
            Ton_Real: Number(item.Ton_Real) || 0,
            faenaMetaHours: Number(item.faenaMetaHours) || 0,
            faenaRealHours: Number(item.faenaRealHours) || 0,
            destino: item.Destino || 'N/A'
          }));
          setAllData(mapped);
          
          const dates = mapped.map(d => d.dateKey).filter(Boolean).sort();
          if (dates.length > 0) {
            setRange1({ start: dates[0], end: dates[dates.length - 1] });
            setRange2({ start: dates[0], end: dates[dates.length - 1] });
          }
          setFileName("Historial cargado automáticamente");
          setStatus('success');
        }
      } catch (e) {
        console.error("Error al cargar datos de localStorage:", e);
      }
    }
  }, []);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.json')) {
      reader.onload = (evt) => {
        try {
          const json = JSON.parse(evt.target?.result as string);
          setComplianceData(prev => [...prev, json]);
          setComplianceFiles(prev => [...prev, file.name]);
        } catch (err) {
          console.error("Error parsing JSON:", err);
          setError(`Error en JSON: ${file.name}`);
        }
      };
      reader.readAsText(file);
      return;
    }

    // Procesar archivo Excel
    setFileName(file.name);
    setStatus('idle');
    setError(null);

    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
        
        const targetSheetName = "Base de Datos";
        const wsname = wb.SheetNames.find(name => name === targetSheetName) || wb.SheetNames[0];
        
        if (!wsname) {
          throw new Error(`No se encontró la pestaña "${targetSheetName}" ni ninguna otra en el archivo.`);
        }

        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
        if (rawData.length < 2) throw new Error("Archivo vacío o estructura inválida.");

        // Detección dinámica de cabeceras similar a App.tsx
        const rawHeaders = rawData[0].map(h => String(h || '').trim());
        const normalizedHeaders = rawHeaders.map(h => normalizeHeader(h));
        
        const getIdx = (fieldName: string, aliases: string[], fallback: number): number => {
          for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            if (normAlias.length < 2) continue;
            const exactIdx = normalizedHeaders.findIndex(h => h === normAlias);
            if (exactIdx !== -1) return exactIdx;
          }
          for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            if (normAlias.length < 3) continue;
            const partialIdx = normalizedHeaders.findIndex(h => h.includes(normAlias));
            if (partialIdx !== -1) return partialIdx;
          }
          return fallback;
        };

        const idx = {
          fecha: getIdx("fecha", ["FECHA", "JORNADA", "DIA"], 1),
          producto: getIdx("producto", ["PRODUCTO", "NIVEL", "PRODUCTO META"], 5),
          destino: getIdx("destino", ["DESTINO", "UBICACION"], 6),
          tonProg: getIdx("tonProg", ["TON PROG", "PROGRAMADO", "TONELADAS PROGRAMADAS"], 7),
          tonReal: getIdx("tonReal", ["TON REAL", "TONELADAS REALES"], 8),
          faenaMeta: getIdx("faenaMeta", ["TIEMPO INTERIOR FAENA PRODUCTO META", "FAENA META", "META HRS"], 49),
          faenaReal: getIdx("faenaReal", ["TIEMPO INTERIOR FAENA REAL", "FAENA REAL", "REAL HRS"], 50)
        };

        const mappedData: ChartData[] = rawData.slice(1).map((row) => {
          if (!row || row.length < 2) return null;
          let dateVal = "";
          let rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateVal = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const d = new Date((rawDate - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) dateVal = d.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string' && rawDate.trim()) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) dateVal = d.toISOString().split('T')[0];
          }

          if (!dateVal) return null;

          const producto = String(row[idx.producto] || 'SIN PRODUCTO').toUpperCase().trim();
          const destino = row[idx.destino] ? String(row[idx.destino]).trim() : 'N/A';
          
          return {
            name: producto,
            producto: producto,
            dateKey: dateVal,
            Ton_Prog: cleanNumeric(row[idx.tonProg]),
            Ton_Real: cleanNumeric(row[idx.tonReal]),
            faenaMetaHours: parseExcelTime(row[idx.faenaMeta]),
            faenaRealHours: parseExcelTime(row[idx.faenaReal]),
            destino: destino,
          };
        }).filter((item): item is ChartData => item !== null);

        if (mappedData.length === 0) {
          throw new Error('No se encontraron datos válidos en las columnas del archivo.');
        }

        setAllData(mappedData);
        
        // Record Cambio De Turno excel upload activity log in Firestore
        try {
          const savedUser = localStorage.getItem('sqm_current_user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            const { logActivity } = await import('../services/firebase');
            await logActivity(
              parsedUser,
              'Carga de Datos',
              `Cargó de archivo base Excel (${file.name}) con ${mappedData.length} registros para Cambio de Turno.`
            );
          }
        } catch (err) {
          console.error('Error logging Cambio de Turno excel upload:', err);
        }
        
        const dates = mappedData.map(d => d.dateKey).sort();
        if (dates.length > 0) {
          setRange1({ start: dates[0], end: dates[dates.length - 1] });
          setRange2({ start: dates[0], end: dates[dates.length - 1] });
        }
        
        setStatus('success');
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al procesar el archivo Excel.');
        setStatus('error');
      }
    };

    reader.onerror = () => {
      setError('Error al leer el archivo.');
      setStatus('error');
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      setIsUploading(true);
      setUploadProgress(0);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsUploading(false);
              processFile(file);
              success(`Archivo ${file.name} procesado correctamente`, "Carga Completa");
            }, 300);
            return 100;
          }
          return prev + 10;
        });
      }, 40);
    }
  }, [processFile, success]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setIsUploading(true);
      setUploadProgress(0);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsUploading(false);
              processFile(file);
              success(`Archivo ${file.name} procesado correctamente`, "Carga Completa");
            }, 300);
            return 100;
          }
          return prev + 10;
        });
      }, 40);
    }
  }, [processFile, success]);

  const clearCompliance = () => {
    setComplianceData([]);
    setComplianceFiles([]);
  };

  const uniqueDates = Array.from(new Set(allData.map(d => d.dateKey))).sort();

  const getAggregatedData = (start: string, end: string, allowedProducts?: string[]) => {
    const filtered = allData.filter(d => {
      const dateInRange = (!start || !end) || (d.dateKey >= start && d.dateKey <= end);
      const productAllowed = !allowedProducts || allowedProducts.includes(d.producto);
      return dateInRange && productAllowed;
    });

    const groups: Record<string, {
      Ton_Prog: number;
      Ton_Real: number;
      faenaMetaHoursSum: number;
      faenaRealHoursSum: number;
      count: number;
    }> = {};

    filtered.forEach(item => {
      if (!groups[item.producto]) {
        groups[item.producto] = { Ton_Prog: 0, Ton_Real: 0, faenaMetaHoursSum: 0, faenaRealHoursSum: 0, count: 0 };
      }
      groups[item.producto].Ton_Prog += item.Ton_Prog;
      groups[item.producto].Ton_Real += item.Ton_Real;
      groups[item.producto].faenaMetaHoursSum += item.faenaMetaHours;
      groups[item.producto].faenaRealHoursSum += item.faenaRealHours;
      groups[item.producto].count += 1;
    });

    return Object.entries(groups).map(([name, g]) => ({
      name,
      Ton_Prog: g.Ton_Prog,
      Ton_Real: g.Ton_Real,
      faenaMetaHours: g.faenaMetaHoursSum / g.count,
      faenaRealHours: g.faenaRealHoursSum / g.count
    }));
  };

  const aggregatedData1 = React.useMemo(() => getAggregatedData(range1.start, range1.end, PRODUCTS_A), [allData, range1]);
  const aggregatedData2 = React.useMemo(() => getAggregatedData(range2.start, range2.end, PRODUCTS_B), [allData, range2]);

  const downloadTemplate = {
    _fn: async () => {
      const wsData = [
        { B: 'Fecha', AF: 'Producto', AH: 'Ton (Prog)', AI: 'Ton (Real)', AX: 'Meta Hrs', AY: 'Real Hrs' },
        { B: '2026-05-10', AF: 'SLIT', AH: 500, AI: 480, AX: '08:00', AY: '08:30' }
      ];
      const ws = XLSX.utils.json_to_sheet(wsData, { header: ["B", "AF", "AH", "AI", "AX", "AY"], skipHeader: true });
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Base de Datos");
      XLSX.writeFile(wb, "plantilla_comparativa.xlsx");

      // Record download audit log
      try {
        const savedUser = localStorage.getItem('sqm_current_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const { logActivity } = await import('../services/firebase');
          await logActivity(
            parsedUser,
            'Descargó Plantilla',
            'Descargó la plantilla Excel para análisis comparativo de cambios de turno (plantilla_comparativa.xlsx).'
          );
        }
      } catch (err) {
        console.error('Error logging template download:', err);
      }
    }
  }._fn;

  const downloadPDF = async (type: 'novandino' | 'sqm') => {
    const reportTitle = type === 'novandino' ? "NOVANDINO" : "SQM N.Y.";
    const reportData = type === 'novandino' ? aggregatedData1 : aggregatedData2;
    const reportRange = type === 'novandino' ? range1 : range2;
    const reportAnalysis = type === 'novandino' ? novandinoAnalysis : sqmAnalysis;
    
    setDownloadingPdf(true);
    info(`Iniciando generación de PDF de alta precisión en el servidor para ${reportTitle}...`, "Generando Reporte", 4000);
    
    try {
      const currentUserStr = localStorage.getItem('sqm_current_user');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      const operatorName = currentUser ? currentUser.name : '';

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: reportTitle,
          data: reportData,
          range: reportRange,
          analysis: reportAnalysis,
          operatorName: operatorName
        })
      });

      if (!response.ok) {
        throw new Error('La respuesta del servidor no fue exitosa');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Cambio_Turno_Server_${type.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success(`Reporte PDF de ${reportTitle} descargado correctamente`, "Generación Completada");

      // Log to Firestore
      try {
        if (currentUser) {
          const { logActivity } = await import('../services/firebase');
          await logActivity(
            currentUser,
            'Descargó PDF Servidor',
            `Exportó y descargó el Reporte PDF de alta precisión generado en el servidor para la faena ${reportTitle}.`
          );
        }
      } catch (logErr) {
        console.error('Error logging PDF server download:', logErr);
      }

    } catch (err) {
      console.error('Error fetching server-side PDF:', err);
      warning("No se pudo completar el PDF en el servidor. Utilizando motor del cliente como respaldo...", "Respaldo Activado");
      
      // Fallback to client-side generation
      try {
        generateShiftReportPDF({
          title: reportTitle,
          data: reportData,
          range: reportRange,
          analysis: reportAnalysis
        });
        success(`Reporte PDF de ${reportTitle} generado en el cliente`, "Descarga Exitosa");
      } catch (clientErr) {
        toastError("Fallo crítico: No se pudo generar el reporte en el cliente.", "Error");
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadPNG = (type: 'novandino' | 'sqm') => {
    const id = type === 'novandino' ? 'chart-table-container-NOVANDINO' : 'chart-table-container-SQM_N.Y.';
    const title = type === 'novandino' ? 'Novandino' : 'SQM N.Y.';
    const element = document.getElementById(id);
    if (!element) return;

    // Obtener las dimensiones reales totales para evitar recortes por plegado de pantalla (viewport fold)
    const width = element.scrollWidth + 64; // Compensar 32px de padding por lado
    const height = element.scrollHeight + 64; // Compensar 32px de padding arriba y abajo

    toPng(element, {
      width: width,
      height: height,
      backgroundColor: '#FAF5E6',
      style: {
        borderRadius: '0px',
        padding: '32px',
        margin: '0px',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible'
      },
      pixelRatio: 2
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `Grafico_y_Tabla_Comparativa_${type === 'novandino' ? 'Novandino' : 'SQM'}_${dateStr}.png`;
        link.href = dataUrl;
        link.click();

        // Log to Firestore
        try {
          const savedUser = localStorage.getItem('sqm_current_user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            import('../services/firebase').then(({ logActivity }) => {
              logActivity(
                parsedUser,
                'Descargó PNG',
                `Exportó y descargó el Gráfico y Tabla Comparativa de ${title} en formato PNG.`
              );
            });
          }
        } catch (err) {
          console.error('Error logging PNG download:', err);
        }
      })
      .catch((err) => {
        console.error('Error rendering PNG:', err);
      });
  };

  const AnalysisPanel = ({ title, data, range, setRange, colorIdx, complianceData, analysis, setAnalysis }: { 
    title: string, 
    data: any[], 
    range: {start: string, end: string}, 
    setRange: any,
    colorIdx: number,
    complianceData?: any[],
    analysis: string | null,
    setAnalysis: (val: string | null) => void
  }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [aiEngine, setAiEngine] = useState<'gemini' | 'glm'>(globalAiSettings.activeAi);

    useEffect(() => {
      setAiEngine(globalAiSettings.activeAi);
    }, [globalAiSettings.activeAi]);

    const handleRunAnalysis = async () => {
      if (data.length === 0) return;
      setIsAnalyzing(true);
      setAnalysis(""); 
      setIsEditing(false); 
      try {
        if (!globalAiSettings.enableShiftAnalysis || !userAiEnabled) {
          // Fallback deterministic local summary when AI is deactivated by the Admin or for the user
          await new Promise((resolve) => setTimeout(resolve, 800));

          const totalProg = data.reduce((acc, item) => acc + (item.Ton_Prog || 0), 0);
          const totalReal = data.reduce((acc, item) => acc + (item.Ton_Real || 0), 0);
          const pctCumplimiento = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;
          
          let text = `### **Resumen Ejecutivo - ${title}**\n\n`;
          text += `Durante el periodo seleccionado de la faena **${title}**, se planificó un total de **${Math.round(totalProg).toLocaleString()} Ton** de carga, alcanzando una ejecución de carga real de **${Math.round(totalReal).toLocaleString()} Ton** (que representa un **${pctCumplimiento.toFixed(1)}% de cumplimiento**).\n\n`;
          
          if (pctCumplimiento >= 100) {
            text += `La operación superó la meta definida con un excelente flujo de carguío y tránsito libre en boleterías y pesajes.\n\n`;
          } else if (pctCumplimiento >= 90) {
            text += `Se registra un ritmo constante dentro de los límites aceptables de la tolerancia operativa ordinaria, alcanzando un progreso cercano al óptimo.\n\n`;
          } else {
            text += `Se evidencia una desviación operativa con un cumplimiento inferior a la meta programada. Se recomienda revisar tiempos de de demora no identificados y cuellos de botella.\n\n`;
          }
          
          text += `### **Análisis de Desviaciones de Desempeño**\n\n`;
          text += `⚠️ *Nota: La funcionalidad de Inteligencia Artificial para análisis extendido ha sido desactivada temporalmente por el Administrador de la plataforma o para su usuario. Para volver a habilitar reportes enriquecidos con IA, active el interruptor correspondiente en el Panel de Usuarios o consulte con el Administrador.*`;

          setAnalysis(text);
        } else {
          await analyzeProductData(title, data, (partial) => {
            setAnalysis(partial);
          }, complianceData, range, aiEngine);
        }
      } catch (err) {
        console.error(err);
        setAnalysis(`Error al generar análisis: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      } finally {
        setIsAnalyzing(false);
      }
    };

    return (
      <div className="space-y-6">
        <div id={`chart-table-container-${title.replace(/\s+/g, '_')}`} className="space-y-6 flex flex-col">
          <div className="bg-white p-4 rounded-2xl border border-violeta/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-tighter ${colorIdx === 1 ? 'bg-nucleo/10 text-nucleo' : 'bg-mineral/10 text-mineral'}`}>
            {title}
          </h2>
          {uniqueDates.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-full sm:w-auto">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase px-2">Desde</span>
                <input 
                  type="date"
                  value={range.start}
                  min={uniqueDates[0]}
                  max={uniqueDates[uniqueDates.length - 1]}
                  onChange={(e) => setRange({ ...range, start: e.target.value })}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none px-2 cursor-pointer [color-scheme:light]"
                />
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase px-2">Hasta</span>
                <input 
                  type="date"
                  value={range.end}
                  min={range.start || uniqueDates[0]}
                  max={uniqueDates[uniqueDates.length - 1]}
                  onChange={(e) => setRange({ ...range, end: e.target.value })}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none px-2 cursor-pointer [color-scheme:light]"
                />
              </div>
            </div>
          )}
        </div>

        <CambioAnalisisComparativoChart data={data} title={title} />

        <div className="bg-white rounded-[2.5rem] border border-violeta/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">RESUMEN POR PRODUCTO</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Prod.</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Prog. Ton</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Real Ton</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Meta Hrs</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Real Hrs</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Estado / Semáforo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((item) => {
                  const progTon = item.Ton_Prog || 0;
                  const realTon = item.Ton_Real || 0;
                  const metaTime = item.faenaMetaHours || 0;
                  const realTime = item.faenaRealHours || 0;

                  // Reglas de negocio estrictas:
                  // 1. Alerta Naranja (Gobernanza) si Tonelaje > 0 pero Tiempo es igual a 0:00 (Inconsistencia)
                  // 2. Alerta Roja si realTon < progTon * 0.90 (inferior al 90% de lo planificado)
                  // 3. Alerta Roja si realTime > metaTime + 10 min (mayor por más de 10 minutos respecto a meta)
                  let alertType: 'red' | 'orange' | 'green' = 'green';
                  let alertMessage = '🟢 Dentro de Rango';

                  if (realTon > 0 && realTime <= 0) {
                    alertType = 'orange';
                    alertMessage = '🔶 Falla MIGTRA';
                  } else if (progTon > 0 && realTon < (progTon * 0.90)) {
                    alertType = 'red';
                    alertMessage = '🔴 Bajo Ton. (<90%)';
                  } else if (realTime > 0 && metaTime > 0 && (realTime - metaTime) > (10 / 60)) {
                    alertType = 'red';
                    alertMessage = '🔴 Exc. Tiempo (>10m)';
                  }

                  let badgeStyle = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                  if (alertType === 'red') {
                    badgeStyle = "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse";
                  } else if (alertType === 'orange') {
                    badgeStyle = "bg-amber-50 text-amber-700 border border-amber-200 font-extrabold";
                  }

                  return (
                    <tr key={item.name} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700">{item.name}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-right text-slate-400">
                        {Math.round(progTon).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-right">
                        <span className="text-violeta">{Math.round(realTon).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-right text-slate-400">
                        {formatDecimalToHHMM(metaTime)}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-right text-mineral">
                        {formatDecimalToHHMM(realTime)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${badgeStyle}`}>
                          {alertMessage}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium italic text-xs">Sin datos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Gráfico y tabla de tendencia diario del producto */}
        {data.length > 0 && (
          <CambioAnalisisProductoChart 
            allData={allData} 
            range={range} 
            visibleProducts={data.map(item => item.name)} 
          />
        )}

        {/* Panel de Análisis Operativo Local */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-24 h-24 text-white" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-violeta p-2 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-white text-sm font-black uppercase tracking-widest">Resumen y Análisis Operativo</h4>
                  <p className="text-slate-400 text-[10px] font-bold">Cálculos analíticos automáticos basados en datos de faena</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {(globalAiSettings.enableGemini || globalAiSettings.enableGlm) && (
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-white/5 mr-1">
                    {globalAiSettings.enableGemini && (
                      <button
                        type="button"
                        onClick={() => setAiEngine('gemini')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all uppercase cursor-pointer ${
                          aiEngine === 'gemini'
                            ? 'bg-violeta text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Gemini 3.5
                      </button>
                    )}
                    {globalAiSettings.enableGlm && (
                      <button
                        type="button"
                        onClick={() => setAiEngine('glm')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all uppercase cursor-pointer ${
                          aiEngine === 'glm'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Gemma (OpenRouter)
                      </button>
                    )}
                  </div>
                )}

                {analysis && !isAnalyzing && (
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black rounded-xl hover:bg-slate-700 transition-all uppercase tracking-widest"
                  >
                    {isEditing ? 'Vista Previa' : 'Editar Texto'}
                  </button>
                )}
                <button 
                  onClick={() => generateShiftReportPDF({ title, data, range, analysis })}
                  disabled={data.length === 0}
                  className="px-4 py-2 bg-violeta text-white text-[10px] font-black rounded-xl hover:bg-violeta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar PDF
                </button>
                <button 
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || data.length === 0}
                  className="px-6 py-2 bg-white text-slate-900 text-xs font-black rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generar Reporte
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="min-h-[100px] bg-slate-800/50 rounded-2xl p-6 border border-white/5">
              {analysis ? (
                isEditing ? (
                  <textarea
                    value={analysis}
                    onChange={(e) => setAnalysis(e.target.value)}
                    className="w-full h-[300px] bg-transparent text-slate-300 text-sm font-medium leading-relaxed outline-none border-none resize-none focus:ring-0"
                    placeholder="Edita el análisis aquí..."
                  />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-full text-slate-300 leading-relaxed">
                    <SimpleMarkdown content={analysis} />
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-slate-500 italic space-y-2">
                  <p className="text-xs font-medium">Haz clic en "Generar Reporte" para compilar el resumen operativo automático.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragOverCapture={(e) => { e.preventDefault(); setIsDragging(true); }}
      className="min-h-screen bg-calido p-4 md:p-8 max-w-[1800px] mx-auto space-y-6 relative"
    >
      {/* Screen-wide Drag & Drop Overlay Portal */}
      {isDragging && (
        <div 
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center border-8 border-dashed border-violeta m-4 rounded-[3rem] transition-all duration-300"
        >
          <div className="text-center p-8 space-y-4 max-w-md pointer-events-none">
            <div className="mx-auto w-20 h-20 bg-violeta/10 rounded-full flex items-center justify-center text-violeta animate-bounce">
              <Upload className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Suelta para Procesar</h2>
            <p className="text-slate-300 text-sm font-semibold">
              Suelta tu plantilla Excel o archivo JSON de justificación aquí para cargarlos instantáneamente.
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-violeta/10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-violeta tracking-tight">Análisis de Turno</h1>
            <p className="text-slate-500 text-sm font-medium italic">Modo Comparativo Dual: Suma de Tons vs Promedio de Horas</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {complianceFiles.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-tight">
                {complianceFiles.length} JSONs Incumplimiento
              </span>
              <button onClick={clearCompliance} className="p-1 hover:bg-amber-200 rounded-lg text-amber-600">
                <AlertCircle className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => downloadPDF('novandino')}
              disabled={aggregatedData1.length === 0 || downloadingPdf}
              className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-nucleo border-2 border-nucleo/10 hover:border-nucleo/30 rounded-xl transition-all active:scale-95 bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              PDF Novandino
            </button>
            <button 
              onClick={() => downloadPNG('novandino')}
              disabled={aggregatedData1.length === 0}
              className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-nucleo border-2 border-nucleo/10 hover:border-nucleo/30 rounded-xl transition-all active:scale-95 bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Image className="w-4 h-4" /> PNG Novandino
            </button>
            <button 
              onClick={() => downloadPDF('sqm')}
              disabled={aggregatedData2.length === 0 || downloadingPdf}
              className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-mineral border-2 border-mineral/10 hover:border-mineral/30 rounded-xl transition-all active:scale-95 bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              PDF SQM
            </button>
            <button 
              onClick={() => downloadPNG('sqm')}
              disabled={aggregatedData2.length === 0}
              className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-mineral border-2 border-mineral/10 hover:border-mineral/30 rounded-xl transition-all active:scale-95 bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Image className="w-4 h-4" /> PNG SQM
            </button>
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-violeta border-2 border-violeta/10 hover:border-violeta/30 rounded-xl transition-all active:scale-95 bg-white">
              <Download className="w-4 h-4" /> Plantilla
            </button>
            <label className="flex items-center gap-2 px-6 py-3 bg-violeta text-white font-bold rounded-xl cursor-pointer hover:bg-violeta/90 transition-all shadow-lg active:scale-95">
              <Upload className="w-4 h-4" /> <span>Cargar Archivos</span>
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv, .xlsm, .json" multiple onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      {fileName && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${status === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          {status === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
          <div className="flex-1">
            <span className="font-bold text-sm text-slate-800">{fileName}</span>
            {error && <p className="text-xs mt-1 font-medium text-rose-600">{error}</p>}
          </div>
          {status === 'success' && (
            <span className="text-[10px] font-black uppercase tracking-widest bg-violeta text-white px-3 py-1 rounded-lg">Cargado Exitosamente</span>
          )}
        </div>
      )}

      {/* Advanced interactive Drag & Drop landing zone if no data is loaded */}
      {allData.length === 0 ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative overflow-hidden min-h-[420px] flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] p-12 transition-all duration-300 bg-white ${
            isDragging 
              ? 'border-violeta bg-violeta/5 scale-[1.01] shadow-2xl' 
              : 'border-slate-200 hover:border-violeta/30 hover:bg-slate-50/50 shadow-sm'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center space-y-6 max-w-md w-full text-center">
              <div className="relative flex items-center justify-center w-20 h-20 bg-violeta/5 rounded-full">
                <Loader2 className="w-12 h-12 text-violeta animate-spin" />
                <span className="absolute text-[11px] font-black text-slate-800">{uploadProgress}%</span>
              </div>
              <div className="space-y-2 w-full">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Procesando Archivo Operativo</h3>
                <p className="text-[11px] text-slate-500 font-bold">Analizando cabeceras dinámicas y mapeando registros...</p>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-4 border border-slate-200">
                  <div 
                    className="h-full bg-violeta rounded-full transition-all duration-100 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-6 max-w-xl">
              <div className="p-6 bg-violeta/10 rounded-full text-violeta mb-1 animate-bounce">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-black text-violeta uppercase tracking-widest">Arrastra tus Archivos Aquí</h2>
                <p className="text-xs text-slate-500 font-semibold max-w-md leading-relaxed">
                  Soporta plantillas comparativas de turnos en formato <span className="text-emerald-600 font-bold">Excel (.xlsx, .xls)</span> o archivos de justificación <span className="text-amber-500 font-bold">JSON (.json)</span> de desviaciones.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Excel Base
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <FileText className="w-3.5 h-3.5 text-amber-500" /> JSON Justificaciones
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <label className="flex items-center gap-2 px-8 py-3.5 bg-violeta text-white font-black rounded-2xl cursor-pointer hover:bg-violeta/90 transition-all shadow-lg hover:shadow-violeta/20 active:scale-95 uppercase tracking-wider text-[10px]">
                  <Upload className="w-4 h-4" /> Seleccionar Archivo
                  <input type="file" className="hidden" accept=".xlsx, .xls, .csv, .xlsm, .json" multiple onChange={handleFileUpload} />
                </label>
                <button 
                  onClick={downloadTemplate} 
                  className="flex items-center gap-2 px-6 py-3.5 text-[10px] font-black text-slate-600 border-2 border-slate-200 hover:border-slate-300 rounded-2xl transition-all active:scale-95 bg-white uppercase tracking-wider cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Plantilla Base
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <main className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <AnalysisPanel 
            title="NOVANDINO" 
            data={aggregatedData1} 
            range={range1} 
            setRange={setRange1} 
            colorIdx={1} 
            complianceData={complianceData} 
            analysis={novandinoAnalysis}
            setAnalysis={setNovandinoAnalysis}
          />
          <AnalysisPanel 
            title="SQM N.Y." 
            data={aggregatedData2} 
            range={range2} 
            setRange={setRange2} 
            colorIdx={2} 
            complianceData={complianceData} 
            analysis={sqmAnalysis}
            setAnalysis={setSqmAnalysis}
          />
        </main>
      )}

      <footer className="text-center pb-8 border-t border-slate-100 pt-8 mt-12">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Excel Analytic Platform · Modo Dual Activo</p>
      </footer>
    </div>
  );
}
