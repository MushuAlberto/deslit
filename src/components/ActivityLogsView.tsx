import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, logActivity, SystemUser, handleFirestoreError, OperationType } from '../services/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { Calendar, User, Eye, Search, SlidersHorizontal, ArrowLeft, RefreshCw, ClipboardList, Clock, Loader2, Trash2, ShieldAlert, Lock, X, Download } from 'lucide-react';

interface ActivityLog {
  id?: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
}

interface ActivityLogsViewProps {
  currentUser: SystemUser;
  onBack: () => void;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ currentUser, onBack }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // States for secure admin-protected delete actions
  const [logToDelete, setLogToDelete] = useState<ActivityLog | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState<string>('');
  const [passwordError, setPasswordError] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'activity_logs'));
      const fetched: ActivityLog[] = [];
      qSnap.forEach((docSnap) => {
        const item = docSnap.data();
        fetched.push({
          id: docSnap.id,
          userId: item.userId || '',
          username: item.username || '',
          name: item.name || '',
          role: item.role || '',
          action: item.action || '',
          details: item.details || '',
          timestamp: item.timestamp || ''
        });
      });
      // Sort client-side by timestamp descending
      fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setLogs(fetched);
      setFilteredLogs(fetched);
    } catch (error) {
      console.error('Error fetching logs from Firestore:', error);
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogClick = (log: ActivityLog) => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setLogToDelete(log);
    setIsDeletingAll(false);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleClearAllLogsClick = () => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setIsDeletingAll(true);
    setLogToDelete(null);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleConfirmDelete = async () => {
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
      if (isDeletingAll) {
        // Clear all logs in Firestore
        const qSnap = await getDocs(collection(db, 'activity_logs'));
        const deletePromises: Promise<void>[] = [];
        qSnap.forEach((docSnap) => {
          deletePromises.push(deleteDoc(doc(db, 'activity_logs', docSnap.id)));
        });
        await Promise.all(deletePromises);

        // Record high severity log activity
        await logActivity(
          currentUser,
          'Historial Vaciado',
          'El administrador vació completamente el historial de registros de auditoría.'
        );

        alert('Historial de actividades eliminado correctamente.');
        setIsDeletingAll(false);
      } else if (logToDelete) {
        if (logToDelete.id) {
          await deleteDoc(doc(db, 'activity_logs', logToDelete.id));
          
          await logActivity(
            currentUser,
            'Registro Eliminado',
            `Se eliminó una entrada de auditoría (${logToDelete.action}: ${logToDelete.details}).`
          );
        }
        setLogToDelete(null);
      }

      await fetchLogs();
    } catch (error) {
      console.error('Error deleting logs:', error);
      alert('Hubo un error al intentar eliminar el registro.');
      handleFirestoreError(error, OperationType.DELETE, 'activity_logs');
    } finally {
      setIsDeletingAll(false);
      setLogToDelete(null);
    }
  };

  const downloadLogsToExcel = async () => {
    try {
      const { utils, writeFile } = await import('xlsx');
      
      const excelData = filteredLogs.map(log => ({
        'Fecha y Hora': formatDate(log.timestamp),
        'Nombre': log.name,
        'Cuenta': `@${log.username}`,
        'Rol': getRoleLabel(log.role),
        'Operación Realizada': log.action,
        'Detalles': log.details || ''
      }));

      const worksheet = utils.json_to_sheet(excelData);
      
      worksheet['!cols'] = [
        { wch: 22 }, // Fecha
        { wch: 25 }, // Nombre
        { wch: 15 }, // Cuenta
        { wch: 15 }, // Rol
        { wch: 25 }, // Operacion
        { wch: 60 }  // Detalles
      ];

      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Auditoría');
      
      const fileName = `Historial_Auditoria_${new Date().toISOString().slice(0,10)}.xlsx`;
      writeFile(workbook, fileName);

      try {
        await logActivity(
          currentUser,
          'Exportó Historial',
          `Exportó ${filteredLogs.length} registros de auditoría a formato Excel (${fileName}).`
        );
      } catch (err) {
        console.error('Error logging Excel download:', err);
      }
    } catch (error) {
      console.error('Error exporting logs to excel:', error);
      alert('Ocurrió un error al intentar exportar los registros a Excel.');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let result = logs;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        log => 
          log.name.toLowerCase().includes(term) || 
          log.username.toLowerCase().includes(term) || 
          log.action.toLowerCase().includes(term) ||
          log.details.toLowerCase().includes(term)
      );
    }

    if (selectedRole !== 'all') {
      result = result.filter(log => log.role === selectedRole);
    }

    if (selectedActionType !== 'all') {
      result = result.filter(log => {
        const actionLower = log.action.toLowerCase();
        if (selectedActionType === 'login') {
          return actionLower.includes('inicio') || 
                 actionLower.includes('sesión') || 
                 actionLower.includes('sesion') || 
                 actionLower.includes('cerró') || 
                 actionLower.includes('cerro') || 
                 actionLower.includes('ingres');
        }
        if (selectedActionType === 'export') {
          return actionLower.includes('export') || 
                 actionLower.includes('descarg') || 
                 actionLower.includes('pdf') || 
                 actionLower.includes('png') || 
                 actionLower.includes('imagen') || 
                 actionLower.includes('placa');
        }
        if (selectedActionType === 'file') {
          return actionLower.includes('excel') || 
                 actionLower.includes('archivo') || 
                 actionLower.includes('carga') || 
                 actionLower.includes('plantilla') || 
                 actionLower.includes('historial');
        }
        return true;
      });
    }

    if (startDate) {
      const startDateTime = new Date(startDate + 'T00:00:00').getTime();
      result = result.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startDateTime;
      });
    }

    if (endDate) {
      const endDateTime = new Date(endDate + 'T23:59:59').getTime();
      result = result.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime <= endDateTime;
      });
    }

    setFilteredLogs(result);
  }, [searchTerm, selectedRole, selectedActionType, startDate, endDate, logs]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'admin') return 'bg-red-50 text-red-600 border-red-200';
    if (role === 'jefe_turno') return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    return 'bg-teal-50 text-teal-600 border-teal-200';
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'ADMINISTRADOR';
    if (role === 'jefe_turno') return 'JEFE TURNO';
    return 'SUPERVISOR';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] p-6 md:p-10 z-10 relative flex flex-col justify-between">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec02_1px,transparent_1px),linear-gradient(to_bottom,#7177ec02_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto w-full space-y-8 flex-grow">
        {/* HEADER SECTION */}
        <header className="flex flex-col sm:flex-row items-center justify-between bg-white/60 backdrop-blur-md rounded-3xl border border-white p-6 gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="text-[9px] font-black tracking-widest text-[#4e2283] uppercase bg-[#4e2283]/10 px-2.5 py-1 rounded-full">
                AUDITORÍA ACTIVA
              </span>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-1">Historial de Actividades</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
              <button 
                onClick={handleClearAllLogsClick} 
                disabled={loading || logs.length === 0}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-2xl px-5 py-3 text-xs font-black text-red-600 tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Trash2 size={14} /> VACIAR HISTORIAL
              </button>
            )}

            <button 
              onClick={downloadLogsToExcel} 
              disabled={loading || filteredLogs.length === 0}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl px-5 py-3 text-xs font-black text-emerald-700 tracking-wider shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> DESCARGAR EXCEL
            </button>

            <button 
              onClick={fetchLogs} 
              disabled={loading}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-xs font-black text-slate-700 tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> REFRESCAR LOGS
            </button>
          </div>
        </header>

        {/* CONTROLS AREA */}
        <div className="bg-white/90 rounded-3xl p-6 border border-white shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search inputs */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar por usuario, acción, detalle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
              />
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Role filter dropdown */}
            <div className="w-full md:w-48 relative">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos los Roles</option>
                <option value="admin">Administrador</option>
                <option value="jefe_turno">Jefe Turno</option>
                <option value="supervision">Supervisor</option>
              </select>
            </div>

            {/* Action Group Filter option */}
            <div className="w-full md:w-48">
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todas las Acciónes</option>
                <option value="login">Inicios de Sesión</option>
                <option value="export">Exportaciones</option>
                <option value="file">Carga de Excel</option>
              </select>
            </div>
          </div>

          {/* Date range filter subpart */}
          <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#4e2283] tracking-wider mr-1">
                <Calendar size={13} /> Filtrar por Período:
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase">Desde</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase">Hasta</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[9px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1.5 rounded-xl ml-1"
                >
                  Limpiar Fechas
                </button>
              )}
            </div>

            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-right">
              Mostrando {filteredLogs.length} de {logs.length} registros
            </span>
          </div>
        </div>

        {/* LOGS LIST OR SPINNER */}
        <div className="bg-white/90 border border-white rounded-[2rem] shadow-sm overflow-hidden p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-[#461D77] mb-3" />
              <p className="font-mono text-xs uppercase tracking-widest text-slate-500">Cargando registros...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <ClipboardList className="mx-auto text-slate-300 mb-4" size={40} />
              <h3 className="font-black text-slate-800 text-sm tracking-tight uppercase">No se hallaron registros</h3>
              <p className="text-slate-500 font-medium text-xs mt-1">No hay operaciones registradas con los filtros actuales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black tracking-widest text-[#4e2283] uppercase bg-slate-50/70 rounded-xl">
                    <th className="py-4.5 px-4 font-black">Timestamp / Fecha</th>
                    <th className="py-4.5 px-4 font-black">Usuario</th>
                    <th className="py-4.5 px-4 font-black">Rol</th>
                    <th className="py-4.5 px-4 font-black">Operación Realizada</th>
                    <th className="py-4.5 px-4 font-black">Detalles Adicionales</th>
                    {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                      <th className="py-4.5 px-4 font-black text-center">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log, index) => (
                    <tr key={log.id || index} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="py-4 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-slate-400" />
                          {formatDate(log.timestamp)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs">{log.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">@{log.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-block border text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full ${getRoleBadgeColor(log.role)}`}>
                          {getRoleLabel(log.role)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-black text-[#461D77] text-xs uppercase tracking-wide">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-600 text-xs block max-w-sm break-words leading-relaxed">
                          {log.details || '-'}
                        </span>
                      </td>
                      {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => handleDeleteLogClick(log)}
                            title="Eliminar este registro de auditoría"
                            className="p-2 text-slate-300 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 inline-flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <footer className="py-8 text-center mt-12 border-t border-slate-200/50 relative z-10">
        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em]">
          NOVANDINO LOGÍSTICA &bull; AUDITORÍA CLOUD EN TIEMPO REAL
        </p>
      </footer>

      {/* CONFIRMATION PASSWORD MODAL */}
      {(logToDelete || isDeletingAll) && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1c1917] text-lg uppercase tracking-tight">Confirmar Eliminación</h3>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Acción Administrativa</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setLogToDelete(null);
                  setIsDeletingAll(false);
                }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              {isDeletingAll ? (
                <span>¿Está absolutamente seguro de que desea <strong className="text-red-600">VACIAR TODO el historial de auditoría</strong>? Esta acción borrará permanentemente todos los registros y no se puede deshacer.</span>
              ) : (
                <span>Para eliminar el registro de <strong className="text-slate-800">@{logToDelete?.username} ({logToDelete?.action})</strong>, debe confirmar ingresando su contraseña de administrador.</span>
              )}
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Contraseña del Administrador</label>
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDelete();
                  }}
                />
              </div>
              {passwordError && (
                <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-widest mt-1">Contraseña Incorrecta</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLogToDelete(null);
                  setIsDeletingAll(false);
                }}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-200 hover:scale-[1.02] active:scale-95"
              >
                Confirmar y Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
