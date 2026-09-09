
import React, { useState } from 'react';
import { CloudUpload, X, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { syncBackupToFirebase } from '../utils/dataProcessor';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BackupReminderModal: React.FC<BackupReminderModalProps> = ({ isOpen, onClose }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const success = await syncBackupToFirebase();
      if (success) {
        alert('Historial .json guardado exitosamente en Firebase Cloud.');
      } else {
        alert('No se pudo guardar en Firebase Cloud.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-nucleo/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-calido overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="relative p-8 text-center space-y-6">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-violeta/20 hover:text-nucleo transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="mx-auto w-20 h-20 bg-violeta/10 rounded-3xl flex items-center justify-center text-violeta relative">
            <ShieldCheck size={40} />
            <div className="absolute -top-2 -right-2 bg-ionizado text-white p-1.5 rounded-full border-4 border-white">
              <AlertCircle size={14} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-[900] text-nucleo tracking-tighter uppercase">¡Cambios Guardados!</h2>
            <p className="text-violeta/60 text-sm font-medium leading-relaxed">
              Tus observaciones están respaldadas. Para hacerlas accesibles desde cualquier otro computador, guárdalas directamente en la nube de Firebase.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="group flex items-center justify-center gap-3 w-full bg-[#461D77] hover:bg-[#321159] text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-nucleo/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Guardando en Firebase...
                </>
              ) : (
                <>
                  <CloudUpload size={16} /> Guardar Historial en Firebase
                </>
              )}
            </button>
            <button 
              onClick={onClose}
              className="w-full bg-calido hover:bg-calido/80 text-violeta/40 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Continuar trabajando
            </button>
          </div>
          
          <p className="text-[8px] font-bold text-violeta/20 uppercase tracking-widest">
            SQM Operaciones • Nube Firebase Sincronizada v2.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackupReminderModal;
