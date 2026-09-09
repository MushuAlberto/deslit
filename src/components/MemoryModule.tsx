
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { 
  ArrowLeft, History, Calendar, ChevronRight, FileCheck, ClipboardList,
  MessageSquare, Download, Upload, AlertCircle, Trash2, Lock, ShieldAlert, X,
  Cloud, CloudUpload, CloudDownload, Database, RefreshCw, CheckCircle2
} from 'lucide-react';
import { formatDateToCL, downloadBackupJSON, syncBackupToFirebase } from '../utils/dataProcessor';
import { 
  SystemUser, 
  getOperationalReportsFromFirebase, 
  deleteOperationalReportFromFirebase,
  OperationalReportDoc
} from '../services/firebase';

interface MemoryModuleProps {
  data: any[];
  onBack: () => void;
  onSelectDate: (date: string) => void;
}

export const MemoryModule: React.FC<MemoryModuleProps> = ({ data, onBack, onSelectDate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Firebase Cloud Operational Reports
  const [cloudReports, setCloudReports] = useState<OperationalReportDoc[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [cloudSuccessMsg, setCloudSuccessMsg] = useState<string | null>(null);

  // States for securely deleting justifications / dates data
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);
  const [cloudReportToDelete, setCloudReportToDelete] = useState<OperationalReportDoc | null>(null);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Load current logged-in user 
  const currentUser = useMemo(() => {
    try {
      const saved = localStorage.getItem('sqm_current_user');
      return saved ? JSON.parse(saved) as SystemUser : null;
    } catch {
      return null;
    }
  }, []);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load cloud reports from Firebase Firestore
  const loadCloudReports = async () => {
    setIsLoadingCloud(true);
    try {
      const reports = await getOperationalReportsFromFirebase();
      setCloudReports(reports);
    } catch (err) {
      console.error('Error fetching cloud reports:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadCloudReports();
  }, [refreshTrigger]);

  // Sync current local backup to Firebase Cloud
  const handleSyncToFirebase = async () => {
    setIsSyncingToCloud(true);
    setCloudSuccessMsg(null);
    try {
      const success = await syncBackupToFirebase();
      if (success) {
        setCloudSuccessMsg("Historial .json guardado exitosamente en Firebase Cloud.");
        setTimeout(() => setCloudSuccessMsg(null), 4000);
        await loadCloudReports();
      } else {
        alert("No se pudo guardar el historial en Firebase. Verifique su conexión.");
      }
    } catch (err) {
      console.error('Error syncing to Firebase:', err);
      alert("Error al conectar con Firebase.");
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  // Restore a cloud JSON report to current local browser storage
  const handleRestoreFromCloud = (report: OperationalReportDoc) => {
    try {
      const backup = JSON.parse(report.backupData);
      let count = 0;
      Object.entries(backup).forEach(([key, value]) => {
        if (key.startsWith('sqm_')) {
          localStorage.setItem(key, value as string);
          count++;
        }
      });
      alert(`Informe del ${formatDateToCL(report.date)} cargado correctamente (${count} claves restauradas desde Firebase). La página se actualizará.`);
      window.location.reload();
    } catch (err) {
      console.error('Error parsing cloud report backup JSON:', err);
      alert("Error: El formato de los datos guardados en la nube no es válido.");
    }
  };

  // Download Cloud JSON report file
  const handleDownloadCloudJSON = (report: OperationalReportDoc) => {
    try {
      const blob = new Blob([report.backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Memoria_SQM_Firebase_${report.date}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al descargar el archivo desde la nube.");
    }
  };

  // Obtener fechas únicas que tienen datos
  const availableDates = useMemo(() => {
    const dates = [...new Set(data.map(r => r.Fecha))].sort().reverse();
    return dates.map(d => {
      const dayData = data.filter(r => r.Fecha === d);
      const products = [...new Set(dayData.map(r => r.Producto))];
      let justificationsCount = 0;
      
      products.forEach(p => {
        if (localStorage.getItem(`sqm_justification_${d}_${p}`)) {
          justificationsCount++;
        }
      });

      return {
        date: d,
        justificationsCount,
        totalProducts: products.length
      };
    });
  }, [data, refreshTrigger]);

  // Importar un archivo de respaldo JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        Object.entries(backup).forEach(([key, value]) => {
          if (key.startsWith('sqm_')) {
            localStorage.setItem(key, value as string);
          }
        });
        alert("Respaldo restaurado con éxito. La página se recargará.");
        window.location.reload();
      } catch (err) {
        alert("Error: El archivo de respaldo no es válido.");
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteDateClick = (date: string) => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setDateToDelete(date);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleDeleteCloudReportClick = (report: OperationalReportDoc) => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar registros de Firebase.");
      return;
    }
    setCloudReportToDelete(report);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleConfirmDeleteJustifications = async () => {
    if (!dateToDelete) return;

    const correctPasswords = [
      currentUser?.password,
      'ctapia',
      'MIRAME'
    ].filter(Boolean);

    if (!correctPasswords.includes(adminPasswordConfirm)) {
      setPasswordError(true);
      return;
    }

    try {
      const dayData = data.filter(r => r.Fecha === dateToDelete);
      const products = [...new Set(dayData.map(r => r.Producto))];

      products.forEach(p => {
        localStorage.removeItem(`sqm_justification_${dateToDelete}_${p}`);
      });

      localStorage.removeItem(`sqm_justification_${dateToDelete}`);

      const { logActivity } = await import('../services/firebase');
      await logActivity(
        currentUser,
        'Eliminó Justificaciones',
        `Eliminó todas las justificaciones asociadas a la fecha ${formatDateToCL(dateToDelete)}.`
      );

      setDateToDelete(null);
      setRefreshTrigger(prev => prev + 1);
      alert(`Información del día ${formatDateToCL(dateToDelete)} eliminada correctamente.`);
    } catch (err) {
      console.error('Error deleting justifications:', err);
      alert('Error técnico al intentar eliminar las justificaciones.');
      setDateToDelete(null);
    }
  };

  const handleConfirmDeleteCloudReport = async () => {
    if (!cloudReportToDelete) return;

    const correctPasswords = [
      currentUser?.password,
      'ctapia',
      'MIRAME'
    ].filter(Boolean);

    if (!correctPasswords.includes(adminPasswordConfirm)) {
      setPasswordError(true);
      return;
    }

    try {
      await deleteOperationalReportFromFirebase(cloudReportToDelete.id, currentUser);
      setCloudReportToDelete(null);
      setRefreshTrigger(prev => prev + 1);
      alert(`Informe del ${formatDateToCL(cloudReportToDelete.date)} eliminado de Firebase.`);
    } catch (err) {
      console.error('Error deleting cloud report:', err);
      alert('Error al eliminar el registro de Firebase.');
      setCloudReportToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <ArrowLeft size={20} />
          </button>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
              <History size={20} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Memoria Operativa & Nube Firebase</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Archivo de Historiales JSON Sincronizado</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSyncToFirebase}
            disabled={isSyncingToCloud}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-200 cursor-pointer"
          >
            {isSyncingToCloud ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Guardando en Nube...
              </>
            ) : (
              <>
                <CloudUpload size={14} /> Guardar Historial en Firebase
              </>
            )}
          </button>
          <button 
            onClick={downloadBackupJSON}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm cursor-pointer"
          >
            <Download size={14} /> Descargar .json Local
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm cursor-pointer"
          >
            <Upload size={14} /> Importar .json Local
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportBackup} 
            accept=".json" 
            className="hidden" 
          />
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-10">
        {cloudSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-sm">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span>{cloudSuccessMsg}</span>
          </div>
        )}

        {/* Banner informativo Firebase Cloud */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-7 rounded-[2.5rem] shadow-xl relative overflow-hidden flex items-start gap-5 border border-indigo-700/30">
          <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-300 border border-indigo-400/20 shrink-0 mt-1">
            <Database size={28} />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-200">
                Firebase Firestore Activo
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">• Sincronización Multidispositivo</span>
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight text-white">Historial Centralizado en la Nube</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium max-w-3xl">
              Los informes y respaldos .json guardados en Firebase Firestore están disponibles instantáneamente para consulta desde **cualquier computador** de la red. Al presionar **"Guardar Historial en Firebase"**, la información queda respaldada en el servidor sin depender del almacenamiento local de un solo equipo.
            </p>
          </div>
        </div>

        {/* Sección 1: Informes en Firebase Cloud */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Cloud size={18} className="text-indigo-600" />
                <h2 className="text-2xl font-[900] text-[#1e293b] tracking-tighter uppercase">Informes en Nube Firebase</h2>
              </div>
              <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase mt-0.5">Respaldos .json guardados en el servidor central</p>
            </div>
            <button 
              onClick={loadCloudReports}
              disabled={isLoadingCloud}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <RefreshCw size={12} className={isLoadingCloud ? "animate-spin" : ""} /> Actualizar Nube
            </button>
          </div>

          {isLoadingCloud ? (
            <div className="py-12 bg-white rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-indigo-500" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Consultando Firebase Firestore...</p>
            </div>
          ) : cloudReports.length === 0 ? (
            <div className="py-12 bg-white rounded-[2rem] border border-slate-200/60 p-8 text-center space-y-3">
              <Cloud size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No hay informes .json guardados en Firebase aún</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Haga clic en el botón <strong>"Guardar Historial en Firebase"</strong> para subir la memoria operativa actual a la nube.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {cloudReports.map((report) => (
                <div 
                  key={report.id}
                  className="bg-white p-5 rounded-[2rem] border border-indigo-100/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                      <CloudDownload size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">{formatDateToCL(report.date)}</span>
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{report.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        <span>Guardado por: <strong className="text-slate-700">{report.updatedBy || 'Sistema'}</strong></span>
                        <span>•</span>
                        <span>{new Date(report.updatedAt).toLocaleDateString('es-CL')} {new Date(report.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreFromCloud(report)}
                      title="Cargar este informe en esta computadora"
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <CloudDownload size={14} /> Cargar en Equipo
                    </button>
                    <button
                      onClick={() => handleDownloadCloudJSON(report)}
                      title="Descargar archivo JSON"
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all cursor-pointer"
                    >
                      <Download size={14} />
                    </button>
                    {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                      <button
                        onClick={() => handleDeleteCloudReportClick(report)}
                        title="Eliminar de Firebase"
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sección 2: Historial de Jornadas Locales */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="space-y-1">
            <h2 className="text-2xl font-[900] text-[#1e293b] tracking-tighter uppercase">Jornadas en Memoria Local</h2>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">Seleccione una fecha para revisar o editar sus observaciones</p>
          </div>

          {availableDates.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center space-y-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                <Calendar size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-black text-slate-800">No hay datos en memoria local</p>
                <p className="text-slate-400 text-xs max-w-xs font-medium">Cargue archivos Excel o restaure un informe guardado en la nube.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {availableDates.map((item) => (
                <button
                  key={item.date}
                  onClick={() => onSelectDate(item.date)}
                  className="group flex items-center justify-between bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-300 text-left cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center group-hover:bg-indigo-50 transition-colors">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Día</span>
                      <span className="text-xl font-black text-slate-800 group-hover:text-indigo-600 leading-none">{item.date.split('-')[2]}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-lg font-black text-[#1e293b] tracking-tight">{formatDateToCL(item.date)}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <ClipboardList size={12} className="text-slate-300" /> {item.totalProducts} Productos
                        </div>
                        <div className="w-1 h-1 bg-slate-200 rounded-full" />
                        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${item.justificationsCount > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                          <MessageSquare size={12} /> {item.justificationsCount} Justificaciones
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pr-2 relative z-10">
                     {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDeleteDateClick(item.date);
                         }}
                         title="Eliminar justificaciones locales de este día"
                         className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 flex items-center justify-center transition-all cursor-pointer"
                       >
                         <Trash2 size={15} />
                       </button>
                     )}
                     <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                        <ChevronRight size={18} />
                     </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 p-8 flex justify-center no-print">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">ARCHIVO HISTÓRICO FIREBASE • 2026</p>
      </footer>

      {/* Modal Confirmar Eliminación Local */}
      {dateToDelete && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-white max-w-md w-full rounded-[2rem] p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1c1917] text-lg uppercase tracking-tight">Confirmar Eliminación Local</h3>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Acción Destructiva Local</p>
                </div>
              </div>
              <button 
                onClick={() => setDateToDelete(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Por motivos de seguridad, para eliminar todas las observaciones registradas localmente para el día <strong className="text-slate-800">{formatDateToCL(dateToDelete)}</strong>, debe ingresar su contraseña de administrador.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Contraseña de Administrador</label>
              <div className="relative">
                <Lock className="absolute left-4 top-[1.125rem] w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingrese contraseña..."
                  className={`w-full py-3.5 pl-11 pr-4 bg-slate-50 border-2 rounded-xl text-sm font-bold text-slate-800 outline-none transition-all ${
                    passwordError ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-transparent focus:border-[#461D77] focus:bg-white focus:shadow-md'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-widest mt-1">Contraseña Incorrecta</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDateToDelete(null)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteJustifications}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-200 cursor-pointer"
              >
                Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación en Firebase Cloud */}
      {cloudReportToDelete && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-white max-w-md w-full rounded-[2rem] p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1c1917] text-lg uppercase tracking-tight">Eliminar de Firebase Nube</h3>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Servidor Cloud</p>
                </div>
              </div>
              <button 
                onClick={() => setCloudReportToDelete(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Esta acción eliminará de forma permanente el informe .json del día <strong className="text-slate-800">{formatDateToCL(cloudReportToDelete.date)}</strong> de la base de datos de Firebase. Ingrese su contraseña de administrador para proceder.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Contraseña de Administrador</label>
              <div className="relative">
                <Lock className="absolute left-4 top-[1.125rem] w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingrese contraseña..."
                  className={`w-full py-3.5 pl-11 pr-4 bg-slate-50 border-2 rounded-xl text-sm font-bold text-slate-800 outline-none transition-all ${
                    passwordError ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-transparent focus:border-[#461D77] focus:bg-white focus:shadow-md'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-widest mt-1">Contraseña Incorrecta</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCloudReportToDelete(null)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteCloudReport}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-200 cursor-pointer"
              >
                Eliminar de Nube
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
