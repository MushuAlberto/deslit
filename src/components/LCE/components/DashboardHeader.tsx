/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Upload, RefreshCw, Calendar, FileSpreadsheet, CheckCircle2, AlertCircle, Image, Loader2, ShieldCheck } from "lucide-react";
import { formatFullDateSpanish } from "../data";

interface DashboardHeaderProps {
  selectedDate: string;
  allDates: string[];
  onDateChange: (date: string) => void;
  onFileUpload: (file: File) => void;
  onDownloadImage: () => void;
  onResetData: () => void;
  isCustomFileLoaded: boolean;
  fileName: string | null;
  isCapturing?: boolean;
  isEditingLce: boolean;
  onToggleEditingLce: () => void;
}

export function DashboardHeader({
  selectedDate,
  allDates,
  onDateChange,
  onFileUpload,
  onDownloadImage,
  onResetData,
  isCustomFileLoaded,
  fileName,
  isCapturing = false,
  isEditingLce,
  onToggleEditingLce,
}: DashboardHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls" && ext !== "xlsm" && ext !== "csv") {
      setUploadStatus("error");
      setStatusMessage("Formato inválido. Cargue un archivo Excel (.xlsx, .xls, .xlsm) o CSV.");
      return;
    }

    try {
      onFileUpload(file);
      setUploadStatus("success");
      setStatusMessage(`"${file.name}" cargado correctamente.`);
      setTimeout(() => {
        setUploadStatus("idle");
      }, 5000);
    } catch (err) {
      setUploadStatus("error");
      setStatusMessage("No se pudo procesar el archivo.");
    }
  };

  return (
    <header className="w-full bg-white text-tecnico rounded-xl p-6 shadow-md border border-[#D6CADF]">
      {/* Top Bar: Brand Logo & Information */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 border-b border-[#D6CADF]">
        {/* NOVANDINO Logo & Slogan */}
        <div className="flex items-center gap-4 self-start lg:self-center">
          <div className="relative flex items-center justify-center w-11 h-11 bg-nucleo rounded-lg shadow-lg">
            {/* Elegant Polygon N Logo representing Mining / Lithium */}
            <svg viewBox="0 0 100 100" className="w-7 h-7 fill-none stroke-current text-white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M25 80 V20 L75 80 V20" />
            </svg>
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-litio rounded-full animate-ping" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-litio rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xl tracking-widest text-[#461D77]">
                NOVANDINO
              </span>
              <span className="text-[10px] uppercase font-bold bg-[#ECE6F2] border border-[#A38EB9] text-nucleo px-1.5 py-0.5 rounded font-mono">
                LITIO
              </span>
            </div>
            <p className="text-[9px] tracking-[0.3em] text-[#737373] font-semibold uppercase">
              SOMOS LITIO, SOMOS FUTURO
            </p>
          </div>
        </div>

        {/* Corporate Titles */}
        <div className="text-center flex-1 select-none py-1">
          <h1 className="text-xl lg:text-2xl font-bold tracking-[0.05em] uppercase flex items-center justify-center flex-wrap gap-x-2.5">
            <span className="text-[#461D77] font-extrabold">DESPACHO DIARIO</span>
            <span className="text-[#DFD5E7] font-light">|</span>
            <span className="text-[#4E7A9F] font-light">CLORURO DE LITIO</span>
          </h1>
          <p className="text-[11px] lg:text-xs font-bold tracking-[0.05em] text-[#461D77] mt-1.5 uppercase flex items-center justify-center gap-1.5">
            <span>SUBGERENCIA LOGÍSTICA LITIO</span>
            <span className="text-[#461D77]/80">&middot;</span>
            <span>DESPACHO LITIO</span>
          </p>
          <p className="text-[9px] lg:text-[10px] font-semibold tracking-[0.4em] text-[#8E9AA6] uppercase mt-1.5">
            SALAR DE ATACAMA
          </p>
        </div>
      </div>

      {/* Control Area: Date Pickers & Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-6">
        
        {/* Date Selection Control */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-[#525252] flex items-center gap-1.5 font-bold tracking-widest uppercase">
            <Calendar className="w-3.5 h-3.5 text-nucleo" />
            Fecha de Reporte (Día de Control)
          </label>
          <div className="flex gap-2 items-center">
            <select
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="flex-1 bg-calido border border-[#DFD5E7] rounded-lg px-4 py-2.5 text-sm text-tecnico focus:outline-none focus:border-nucleo transition-colors cursor-pointer shadow-inner scrollbar-thin"
              id="date-select-picker"
            >
              {allDates.map((date) => {
                const dObj = new Date(date + "T00:00:00");
                const day = dObj.getDate();
                const month = dObj.toLocaleString("es-ES", { month: "short" });
                return (
                  <option key={date} value={date} className="bg-calido text-tecnico">
                    {date} — {day} de {month}
                  </option>
                );
              })}
            </select>
          </div>
          <p className="text-[11px] text-[#737373] mt-1 font-mono italic">
            Visualizando: {formatFullDateSpanish(selectedDate)}
          </p>
        </div>

        {/* Excel File Upload Area */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-[#525252] flex items-center gap-1.5 font-bold tracking-widest uppercase">
            <FileSpreadsheet className="w-3.5 h-3.5 text-nucleo" />
            Cargar Matriz de Datos (Excel / XLSM / CSV)
          </label>
          
          <div className="flex gap-2">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex-1 flex items-center justify-center gap-2 border border-dashed rounded-lg px-3 py-2 cursor-pointer transition-all duration-200 h-11 ${
                isDragOver
                  ? "border-nucleo bg-[#F5F2F9] text-nucleo"
                  : isCustomFileLoaded
                  ? "border-ionizado bg-[#FAFDFD] hover:bg-[#EBF7F3] text-ionizado"
                  : "border-[#DFD5E7] bg-[#FDFCF9] hover:bg-[#FAF5E6] text-[#525252]"
              }`}
              id="excel-drop-zone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.xlsm,.csv"
                className="hidden"
              />
              
              <Upload className={`w-4 h-4 ${isCustomFileLoaded ? "text-ionizado" : "text-nucleo"} shrink-0`} />
              <span className="text-xs truncate max-w-[130px] font-medium">
                {isCustomFileLoaded ? fileName : "Cargar Excel/CSV"}
              </span>

              {isCustomFileLoaded && (
                <span className="text-[9px] bg-[#EBF7F3] text-ionizado border border-[#CBE9DE] px-1 py-0.5 rounded font-mono uppercase shrink-0">
                  Activo
                </span>
              )}
            </div>

            <button
              onClick={onToggleEditingLce}
              className={`h-11 px-3.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 border shrink-0 ${
                isEditingLce 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md active:scale-95' 
                  : 'bg-[#F5F2F9] text-[#461D77] border-[#D6CADF] hover:bg-[#461D77] hover:text-white hover:border-[#461D77] active:scale-95'
              }`}
              title={isEditingLce ? "Guardar cambios de reprogramaciones LCE" : "Habilitar reprogramaciones y edición LCE"}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isEditingLce ? 'Guardar' : 'Modo Edición'}</span>
            </button>
          </div>

          {/* Feedback message overlay inside UI */}
          {uploadStatus !== "idle" && (
            <div className={`flex items-center gap-1.5 text-[10px] p-1.5 rounded mt-1 font-medium ${
              uploadStatus === "success" ? "bg-[#EBF7F3] text-ionizado border border-[#CBE9DE]" : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>
              {uploadStatus === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-ionizado flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Operational Actions */}
        <div className="flex flex-col gap-2 justify-end">
          <label className="text-[10px] text-[#525252] flex items-center gap-1.5 font-bold tracking-widest uppercase">
            Acciones Ejecutivas
          </label>
          <div className="grid grid-cols-2 gap-3 h-11">
            <button
              onClick={onDownloadImage}
              disabled={isCapturing}
              className={`flex items-center justify-center gap-2 bg-gradient-to-r from-nucleo to-[#7177EC] hover:from-nucleo/95 hover:to-[#7177EC]/95 active:scale-95 text-white transition-all rounded-lg text-xs font-bold uppercase tracking-widest shadow-md ${
                isCapturing ? "opacity-75 cursor-wait" : ""
              }`}
              title="Descargar reporte como imagen PNG de alta resolución"
              id="btn-download-dashboard-image"
            >
              {isCapturing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-litio" />
              ) : (
                <Image className="w-3.5 h-3.5 text-litio" />
              )}
              {isCapturing ? "Procesando..." : "Plantilla"}
            </button>
            <button
              onClick={onResetData}
              disabled={!isCustomFileLoaded}
              className={`flex items-center justify-center gap-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                isCustomFileLoaded
                  ? "bg-transparent hover:bg-rose-50 text-rose-600 border border-rose-300"
                  : "bg-transparent text-[#cccccc] border border-[#e5e5e5] pointer-events-none"
              }`}
              title="Restaurar base de datos histórica de de demostración"
              id="btn-reset-excel-data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCustomFileLoaded ? "animate-pulse" : ""}`} />
              Restaurar
            </button>
          </div>
        </div>

      </div>
    </header>
  );
}
