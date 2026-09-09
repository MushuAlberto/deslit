
import React from 'react';
import {
  X, Truck, FileBarChart, History, AlertCircle, Info, CheckCircle2,
  ChevronRight, FileSpreadsheet, FileJson
} from 'lucide-react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstructionModal: React.FC<InstructionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-nucleo/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl border border-calido overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-calido px-10 py-8 border-b border-calido flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-nucleo">
              <Info size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-[900] text-nucleo tracking-tighter uppercase leading-none">Guía de Operación Inteligente</h2>
              <p className="text-[10px] font-black text-violeta/40 uppercase tracking-widest mt-1">Sistema de Gestión Logística v3.1</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-violeta/20 hover:text-nucleo transition-colors bg-white rounded-full shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Módulo 1 */}
            <div className="bg-white border border-calido rounded-[2rem] p-6 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-litio/10 text-litio rounded-xl flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <h3 className="font-black text-nucleo uppercase text-xs tracking-tight">1. Llegada de Equipos</h3>
              </div>
              <div className="bg-litio/10 p-3 rounded-xl border border-litio/20">
                <p className="text-[9px] font-black text-litio uppercase tracking-wider mb-1">Cargar Archivo:</p>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-litio" />
                  <span className="text-[10px] font-bold text-tecnico">02.- Histórico Romanas</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-violeta/60 leading-relaxed">Procesa el flujo de entrada de camiones. Genera análisis de frecuencia por hora y tablas de control por empresa y destino.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Gráficos de frecuencia</li>
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Reportes con branding</li>
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> PDF para correo</li>
                </ul>
              </div>
            </div>

            {/* Módulo 2 */}
            <div className="bg-white border border-calido rounded-[2rem] p-6 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-ionizado/10 text-ionizado rounded-xl flex items-center justify-center">
                  <FileBarChart size={20} />
                </div>
                <h3 className="font-black text-nucleo uppercase text-xs tracking-tight">2. Informe Operativo</h3>
              </div>
              <div className="bg-ionizado/10 p-3 rounded-xl border border-ionizado/20">
                <p className="text-[9px] font-black text-ionizado uppercase tracking-wider mb-1">Cargar Archivo:</p>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-ionizado" />
                  <span className="text-[10px] font-bold text-tecnico">08.- Tablero Despachos 2026</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-violeta/60 leading-relaxed">Núcleo analítico diario. Compara tonelaje y tiempos meta contra real. Redacción técnica ejecutiva para justificaciones.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Protocolo Redacción Técnica</li>
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Exportación Oficio PDF (Adjunto)</li>
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Captura PNG</li>
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Memoria JSON</li>
                </ul>
              </div>
            </div>

            {/* Módulo 3 */}
            <div className="bg-white border border-calido rounded-[2rem] p-6 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violeta/10 text-violeta rounded-xl flex items-center justify-center">
                  <History size={20} />
                </div>
                <h3 className="font-black text-nucleo uppercase text-xs tracking-tight">3. Memoria Operativa</h3>
              </div>
              <div className="bg-violeta/10 p-3 rounded-xl border border-violeta/20">
                <p className="text-[9px] font-black text-violeta uppercase tracking-wider mb-1">Cargar Archivo:</p>
                <div className="flex items-center gap-2">
                  <FileJson size={14} className="text-violeta" />
                  <span className="text-[10px] font-bold text-tecnico">Respaldo Operacional (.json)</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-violeta/60 leading-relaxed">Centro de seguridad histórica. Permite importar justificaciones pasadas y auditar el historial sin re-procesar Excel.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Persistencia de datos</li>
                  <li className="flex items-center gap-2 text-[10px] font-bold text-tecnico"><CheckCircle2 size={12} className="text-ionizado" /> Auditoría rápida</li>
                </ul>
                <div className="mt-2 p-2 bg-mineral/10 rounded-lg border border-mineral/20 flex items-start gap-2">
                  <AlertCircle size={10} className="text-mineral mt-0.5 shrink-0" />
                  <p className="text-[9px] font-bold text-mineral leading-tight">
                    Si borras el historial/caché: Carga los archivos .json creados en el "Informe Operativo" (Memoria Diaria).
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Technical Note */}
          <div className="bg-calido border border-calido p-6 rounded-[2rem] flex items-start gap-4">
            <div className="p-2 bg-white text-violeta/20 rounded-lg shrink-0 shadow-sm">
              <AlertCircle size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-tecnico uppercase tracking-widest">Nota técnica de compatibilidad</p>
              <p className="text-[11px] text-violeta/60 font-medium leading-relaxed">
                Asegúrate de que los archivos Excel mantengan las cabeceras originales para que los algoritmos de detección automática de columnas funcionen sin errores. No modifiques el nombre de las columnas en los archivos maestros.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 bg-white border-t border-calido flex justify-center shrink-0">
          <button
            onClick={onClose}
            className="group flex items-center justify-center gap-3 bg-nucleo hover:bg-black text-white px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-nucleo/10 transition-all active:scale-95"
          >
            Comenzar Operación
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionModal;
