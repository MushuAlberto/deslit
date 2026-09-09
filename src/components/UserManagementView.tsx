import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, logActivity, SystemUser } from '../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { User, Lock, KeyRound, Plus, Trash2, ArrowLeft, Loader2, Key, Users, CheckCircle, ShieldAlert, X, Sparkles, Cpu, Save } from 'lucide-react';

interface UserManagementViewProps {
  currentUser: SystemUser;
  onBack: () => void;
  onUpdateCurrentUser?: (user: SystemUser) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, onBack, onUpdateCurrentUser }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    role: 'supervision' as 'admin' | 'jefe_turno' | 'supervision'
  });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<SystemUser | null>(null);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // AI Configuration States
  const [aiSettings, setAiSettings] = useState({
    activeAi: 'gemini' as 'gemini' | 'glm',
    enableGemini: true,
    enableGlm: true,
    enableShiftAnalysis: true,
    enableJustificationRefinement: true
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // States for pending user AI configuration changes
  const [pendingUserAiChanges, setPendingUserAiChanges] = useState<Record<string, boolean>>({});
  const [savingUserAi, setSavingUserAi] = useState(false);

  // AI Diagnostic States
  const [testingAi, setTestingAi] = useState<'gemini' | 'glm' | null>(null);
  const [testResult, setTestResult] = useState<{
    model: 'gemini' | 'glm';
    success: boolean;
    message: string;
    latencyMs?: number;
    modelUsed?: string;
  } | null>(null);

  const handleTestAiConnection = async (model: 'gemini' | 'glm') => {
    setTestingAi(model);
    setTestResult(null);
    try {
      const response = await fetch("/api/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        const snippet = text.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        throw new Error(`El servidor no respondió con JSON (Código HTTP ${response.status}). Detalle: "${snippet || 'Vacío'}"`);
      }

      const result = await response.json();
      setTestResult({
        model,
        success: response.ok && result.success === true,
        message: result.message || "Error inesperado durante la prueba.",
        latencyMs: result.latencyMs,
        modelUsed: result.modelUsed
      });
    } catch (err: any) {
      setTestResult({
        model,
        success: false,
        message: `Error de conexión: ${err.message || err}`
      });
    } finally {
      setTestingAi(null);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'users'));
      const list: SystemUser[] = [];
      qSnap.forEach((docSnap) => {
        list.push(docSnap.data() as SystemUser);
      });
      setUsers(list);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const docRef = doc(db, 'system_config', 'ai_settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAiSettings({
          activeAi: data.activeAi || 'gemini',
          enableGemini: data.enableGemini !== false,
          enableGlm: data.enableGlm !== false,
          enableShiftAnalysis: data.enableShiftAnalysis !== false,
          enableJustificationRefinement: data.enableJustificationRefinement !== false
        });
      } else {
        // Bootstrap default config if non-existent
        const defaultSettings = {
          activeAi: 'gemini',
          enableGemini: true,
          enableGlm: true,
          enableShiftAnalysis: true,
          enableJustificationRefinement: true,
          lastUpdatedBy: 'system',
          lastUpdatedAt: new Date().toISOString()
        };
        await setDoc(docRef, defaultSettings);
        setAiSettings({
          activeAi: 'gemini',
          enableGemini: true,
          enableGlm: true,
          enableShiftAnalysis: true,
          enableJustificationRefinement: true
        });
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const docRef = doc(db, 'system_config', 'ai_settings');
      const payload = {
        activeAi: aiSettings.activeAi,
        enableGemini: aiSettings.enableGemini,
        enableGlm: aiSettings.enableGlm,
        enableShiftAnalysis: aiSettings.enableShiftAnalysis,
        enableJustificationRefinement: aiSettings.enableJustificationRefinement,
        lastUpdatedBy: currentUser.name,
        lastUpdatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload);

      await logActivity(
        currentUser,
        'Configuración IA Actualizada',
        `Se actualizó la configuración de IA. Motor activo: ${aiSettings.activeAi.toUpperCase()}. Habilitados: Gemini=${aiSettings.enableGemini ? 'SÍ' : 'NO'}, GLM=${aiSettings.enableGlm ? 'SÍ' : 'NO'}. CambioTurno=${aiSettings.enableShiftAnalysis ? 'SÍ' : 'NO'}, RefinarJustif=${aiSettings.enableJustificationRefinement ? 'SÍ' : 'NO'}`
      );

      setStatusMsg({ type: 'success', text: 'Configuración de Inteligencia Artificial guardada correctamente.' });
    } catch (error) {
      console.error('Error saving AI settings:', error);
      setStatusMsg({ type: 'error', text: 'Error de red o permisos al guardar la configuración de IA.' });
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    // Validate inputs
    const usernameClean = newUser.username.trim().toLowerCase();
    const nameClean = newUser.name.trim();
    if (!usernameClean || !nameClean || !newUser.password) {
      setStatusMsg({ type: 'error', text: 'Todos los campos son obligatorios.' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameClean)) {
      setStatusMsg({ type: 'error', text: 'El nombre de usuario solo debe contener letras, números o subguión [_].' });
      return;
    }

    // Check if user already exists
    if (users.some(u => u.username === usernameClean)) {
      setStatusMsg({ type: 'error', text: 'El nombre de usuario ya está registrado en el sistema.' });
      return;
    }

    setSaving(true);
    const userId = usernameClean;
    const userDocPayload: SystemUser = {
      userId,
      username: usernameClean,
      password: newUser.password,
      name: nameClean,
      role: newUser.role,
      lastLogin: '',
      enableAi: true
    };

    try {
      await setDoc(doc(db, 'users', userId), userDocPayload);
      
      // Log activity
      await logActivity(
        currentUser,
        'Usuario Creado',
        `Se creó el perfil de: ${nameClean} (Usuario: @${usernameClean}) con rol: ${newUser.role}`
      );

      setStatusMsg({ type: 'success', text: `Usuario @${usernameClean} creado exitosamente.` });
      setNewUser({ username: '', password: '', name: '', role: 'supervision' });
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user profile:', error);
      setStatusMsg({ type: 'error', text: 'Error de red o permisos al almacenar el usuario.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = (userToDelete: SystemUser) => {
    if (userToDelete.userId === currentUser.userId) {
      alert('No puedes eliminar tu propio usuario en sesión.');
      return;
    }

    if (userToDelete.userId === 'admin') {
      alert('No se permite eliminar la cuenta de administración principal.');
      return;
    }

    setDeleteCandidate(userToDelete);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteCandidate) return;

    // A fail-safe allows using the logged in user's password, 'ctapia', or master 'MIRAME'
    const correctPasswords = [
      currentUser.password,
      'ctapia',
      'MIRAME'
    ].filter(Boolean);

    if (!correctPasswords.includes(adminPasswordConfirm)) {
      setPasswordError(true);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', deleteCandidate.userId));
      
      // Log activity
      await logActivity(
        currentUser,
        'Usuario Eliminado',
        `Se eliminó la cuenta de: ${deleteCandidate.name} (Usuario: @${deleteCandidate.username}) - [Contraseña Confirmada]`
      );

      setStatusMsg({ type: 'success', text: `Usuario @${deleteCandidate.username} eliminado correctamente.` });
      setDeleteCandidate(null);
      await fetchUsers();
    } catch (e) {
      console.error('Error deleting user:', e);
      setStatusMsg({ type: 'error', text: 'Fallo al eliminar el registro en Firestore.' });
      setDeleteCandidate(null);
    }
  };

  const handleToggleUserAi = (targetUser: SystemUser) => {
    const isAiCurrentlyEnabled = targetUser.enableAi !== false;
    const newVal = !isAiCurrentlyEnabled;

    // Update locally in users array to slide toggle immediately
    setUsers(prev => prev.map(u => u.userId === targetUser.userId ? { ...u, enableAi: newVal } : u));

    // Store in pending changes
    setPendingUserAiChanges(prev => ({
      ...prev,
      [targetUser.userId]: newVal
    }));
  };

  const handleSaveUserAiChanges = async () => {
    setSavingUserAi(true);
    setStatusMsg({ type: '', text: '' });
    try {
      let loggedSelfUpdate = false;
      let selfUpdatedUser: SystemUser | null = null;
      const entries = Object.entries(pendingUserAiChanges);

      for (const [userId, enableAi] of entries) {
        const targetUser = users.find(u => u.userId === userId);
        if (targetUser) {
          const updatedUser = {
            ...targetUser,
            enableAi
          };
          await setDoc(doc(db, 'users', userId), updatedUser);
          
          if (userId === currentUser.userId) {
            loggedSelfUpdate = true;
            selfUpdatedUser = updatedUser;
          }

          await logActivity(
            currentUser,
            'Permisos IA Actualizados',
            `Se ${enableAi ? 'habilitó' : 'deshabilitó'} el uso de Inteligencia Artificial para el usuario ${targetUser.name} (@${targetUser.username})`
          );
        }
      }

      if (loggedSelfUpdate && selfUpdatedUser && onUpdateCurrentUser) {
        onUpdateCurrentUser(selfUpdatedUser);
      }

      setStatusMsg({ type: 'success', text: `Se guardaron con éxito los accesos de IA para ${entries.length} usuario(s) en Firestore.` });
      setPendingUserAiChanges({});
    } catch (error) {
      console.error('Error saving user AI changes:', error);
      setStatusMsg({ type: 'error', text: 'Error de red o permisos al guardar los accesos de IA en Firestore.' });
    } finally {
      setSavingUserAi(false);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Administrador';
    if (role === 'jefe_turno') return 'Jefe Turno';
    return 'Supervisor';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] p-6 md:p-10 z-10 relative flex flex-col justify-between">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec02_1px,transparent_1px),linear-gradient(to_bottom,#7177ec02_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto w-full space-y-8 flex-grow">
        {/* HEADER */}
        <header className="flex items-center gap-4 bg-white/60 backdrop-blur-md rounded-3xl border border-white p-6 shadow-sm">
          <button 
            onClick={onBack}
            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] font-black tracking-widest text-[#4e2283] uppercase bg-[#4e2283]/10 px-2.5 py-1 rounded-full">
              ADMINISTRA ACCESOS
            </span>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-1">Gestión de Usuarios</h1>
          </div>
        </header>

        {statusMsg.text && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 flex items-center gap-3 border ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
            <span className="text-xs font-black tracking-wide">{statusMsg.text}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          {/* LEFT COLUMN: CREATE USER & AI CONFIGURATION */}
          <div className="lg:col-span-5 space-y-6">
            {/* CREATE PROFILE FORM */}
            <div className="bg-white border border-white rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Añadir registro</span>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Crear Nuevo Usuario</h2>
                <p className="text-xs font-medium text-slate-500">Asigne clave de acceso y nivel de rol corporativo correspondiente.</p>
              </div>

            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Nombre de Usuario (Para login)
                </label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="Ej. jperez (letras y números)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Contraseña de acceso
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Establezca contraseña"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Rol y Permisos
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer appearance-none"
                >
                  <option value="supervision">Supervisor (Solo Módulo SdA)</option>
                  <option value="jefe_turno">Jefe Turno (Módulos de Jefe Turno y SdA)</option>
                  <option value="admin">Administrador (Acceso y Gestión Total)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#461D77] hover:bg-[#321159] disabled:bg-[#461D77]/50 text-white font-extrabold text-[10px] tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg transition-all duration-300 uppercase cursor-pointer mt-2"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin text-white" />
                ) : (
                  <>
                    <Plus size={14} /> Registrar Usuario
                  </>
                )}
              </button>
            </form>
          </div>

          {/* CONFIGURACIÓN IA (SOLO ADMIN) */}
          {currentUser.role === 'admin' && (
            <div className="bg-white border border-white rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest text-[#461D77] uppercase bg-[#461D77]/10 px-2.5 py-1 rounded-full flex-none w-fit inline-block mb-1">
                  Motores Inteligentes
                </span>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#4e2283]" /> Configuración de IA
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Controle qué Inteligencias Artificiales están activas y cuál actúa por defecto.
                </p>
              </div>

              {loadingSettings ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#461D77] mb-2" />
                  <p className="font-mono text-[9px] uppercase tracking-widest">Cargando parámetros...</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Disponibilidad de motores */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Habilitar Motores en la Aplicación
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Gemini Switch */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !aiSettings.enableGemini;
                          if (!nextVal && !aiSettings.enableGlm) return; 
                          setAiSettings({
                            ...aiSettings,
                            enableGemini: nextVal,
                            activeAi: !nextVal && aiSettings.activeAi === 'gemini' ? 'glm' : aiSettings.activeAi
                          });
                        }}
                        className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-24 cursor-pointer ${
                          aiSettings.enableGemini 
                            ? 'bg-[#461D77]/5 border-[#461D77]/20 shadow-sm' 
                            : 'bg-slate-50/50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-xs text-slate-800">Gemini 3.5</span>
                          <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableGemini ? 'bg-[#461D77]' : 'bg-slate-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow-md transition-transform transform ${aiSettings.enableGemini ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium leading-tight">Google AI Flash</span>
                      </button>

                      {/* OpenRouter Gemma Switch */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !aiSettings.enableGlm;
                          if (!nextVal && !aiSettings.enableGemini) return;
                          setAiSettings({
                            ...aiSettings,
                            enableGlm: nextVal,
                            activeAi: !nextVal && aiSettings.activeAi === 'glm' ? 'gemini' : aiSettings.activeAi
                          });
                        }}
                        className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-24 cursor-pointer ${
                          aiSettings.enableGlm 
                            ? 'bg-amber-500/5 border-amber-500/20 shadow-sm' 
                            : 'bg-slate-50/50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-xs text-slate-800">Gemma Free</span>
                          <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableGlm ? 'bg-amber-500' : 'bg-slate-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow-md transition-transform transform ${aiSettings.enableGlm ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium leading-tight">OpenRouter Free</span>
                      </button>
                    </div>
                  </div>

                  {/* Motor predeterminado */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Motor de Análisis por Defecto
                    </label>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        disabled={!aiSettings.enableGemini}
                        onClick={() => setAiSettings({ ...aiSettings, activeAi: 'gemini' })}
                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-black tracking-wider transition-all uppercase cursor-pointer ${
                          aiSettings.activeAi === 'gemini'
                            ? 'bg-[#461D77] text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Gemini 3.5
                      </button>
                      <button
                        type="button"
                        disabled={!aiSettings.enableGlm}
                        onClick={() => setAiSettings({ ...aiSettings, activeAi: 'glm' })}
                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-black tracking-wider transition-all uppercase cursor-pointer ${
                          aiSettings.activeAi === 'glm'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Gemma (OpenRouter)
                      </button>
                    </div>
                  </div>

                  {/* Habilitar en Módulos específicos */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Activar IA por Módulo
                    </label>
                    <div className="space-y-2.5">
                      {/* Cambio de Turno Toggle */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-xs text-slate-800">Cambio de Turno</p>
                          <p className="text-[10px] text-slate-500 font-medium">Resumen y análisis operativo</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAiSettings({
                            ...aiSettings,
                            enableShiftAnalysis: !aiSettings.enableShiftAnalysis
                          })}
                          className={`w-10 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableShiftAnalysis ? 'bg-[#461D77]' : 'bg-slate-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform transform ${aiSettings.enableShiftAnalysis ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Informe Operativo Toggle */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-xs text-slate-800">Informe Operativo</p>
                          <p className="text-[10px] text-slate-500 font-medium">Reescritura de Justificación de desempeño</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAiSettings({
                            ...aiSettings,
                            enableJustificationRefinement: !aiSettings.enableJustificationRefinement
                          })}
                          className={`w-10 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableJustificationRefinement ? 'bg-[#461D77]' : 'bg-slate-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform transform ${aiSettings.enableJustificationRefinement ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full bg-[#461D77] hover:bg-[#321159] disabled:bg-[#461D77]/50 text-white font-extrabold text-[10px] tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg transition-all duration-300 uppercase cursor-pointer"
                  >
                    {savingSettings ? (
                      <Loader2 size={14} className="animate-spin text-white" />
                    ) : (
                      <>
                        <Cpu size={14} /> Guardar Configuración de IA
                      </>
                    )}
                  </button>

                  {/* Panel de Diagnóstico y Conectividad en Tiempo Real */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">
                      Panel de Diagnóstico de Conectividad
                    </label>
                    <p className="text-[10px] font-medium text-slate-500 leading-tight">
                      Verifique en tiempo real el estado y la latencia de las conexiones con los motores de Inteligencia Artificial de forma segura en el servidor.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={testingAi !== null}
                        onClick={() => handleTestAiConnection('gemini')}
                        className="flex-1 py-2 px-3 bg-slate-50 hover:bg-[#461D77]/5 border border-slate-200 hover:border-[#461D77]/30 rounded-xl text-[10px] font-extrabold text-slate-700 hover:text-[#461D77] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
                      >
                        {testingAi === 'gemini' ? (
                          <>
                            <Loader2 size={11} className="animate-spin text-[#461D77]" />
                            Probando...
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} className="text-[#461D77]" />
                            Probar Gemini
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={testingAi !== null}
                        onClick={() => handleTestAiConnection('glm')}
                        className="flex-1 py-2 px-3 bg-slate-50 hover:bg-amber-500/5 border border-slate-200 hover:border-amber-500/30 rounded-xl text-[10px] font-extrabold text-slate-700 hover:text-amber-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
                      >
                        {testingAi === 'glm' ? (
                          <>
                            <Loader2 size={11} className="animate-spin text-amber-500" />
                            Probando...
                          </>
                        ) : (
                          <>
                            <Cpu size={11} className="text-amber-500" />
                            Probar Gemma
                          </>
                        )}
                      </button>
                    </div>

                    {/* Diagnostic Result Banner */}
                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3.5 rounded-2xl border text-[10px] leading-relaxed font-medium flex flex-col gap-1.5 shadow-sm ${
                          testResult.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black uppercase tracking-wider text-[9px]">
                          <span className="flex items-center gap-1.5">
                            {testResult.success ? (
                              <CheckCircle size={12} className="text-emerald-600" />
                            ) : (
                              <ShieldAlert size={12} className="text-rose-600" />
                            )}
                            Diagnóstico: {testResult.model === 'gemini' ? 'Google Gemini' : 'Google Gemma (OpenRouter)'}
                          </span>
                          {testResult.success && testResult.latencyMs !== undefined && (
                            <span className="font-mono text-emerald-600 text-[8px] bg-emerald-100/50 px-1.5 py-0.5 rounded">
                              {testResult.latencyMs} ms
                            </span>
                          )}
                        </div>
                        <p>{testResult.message}</p>
                        {testResult.success && testResult.modelUsed && (
                          <div className="font-mono text-[8px] text-slate-400 uppercase mt-0.5 border-t border-slate-200/50 pt-1.5 flex justify-between">
                            <span>Motor en producción:</span>
                            <span className="font-extrabold">{testResult.modelUsed}</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

          {/* ACTIVE DIRECTORY LIST */}
          <div className="lg:col-span-7 bg-white/95 border border-white rounded-[2rem] p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Directorio Activo</h2>
            <p className="text-xs font-medium text-slate-500 mb-2">Listado general de usuarios autorizados en la base de datos Firestore.</p>

            {/* Unsaved user AI changes banner */}
            {Object.keys(pendingUserAiChanges).length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 no-print shadow-sm"
              >
                <div className="flex items-center gap-2.5 text-amber-800">
                  <Sparkles size={16} className="text-amber-600 animate-spin" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider">Permisos de IA Modificados</p>
                    <p className="text-[11px] text-amber-700 font-medium">Hay cambios pendientes de guardar para {Object.keys(pendingUserAiChanges).length} usuario(s).</p>
                  </div>
                </div>
                <button
                  onClick={handleSaveUserAiChanges}
                  disabled={savingUserAi}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white font-extrabold text-[10px] tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all duration-300 uppercase cursor-pointer"
                >
                  {savingUserAi ? (
                    <Loader2 size={12} className="animate-spin text-white" />
                  ) : (
                    <>
                      <Save size={12} /> Guardar Cambios
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#461D77] mb-2" />
                <p className="font-mono text-[10px] uppercase tracking-widest">Leyendo base de datos...</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-slate-100">
                {users.map((user) => (
                  <div key={user.userId} className="pt-4 first:pt-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#461D77]/10 to-[#7177EC]/10 flex items-center justify-center text-[#461D77] font-black text-sm">
                        {user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 text-sm">{user.name}</span>
                          <span className="font-mono text-[9px] text-[#4e2283] font-black uppercase bg-[#4e2283]/5 px-2 py-0.5 rounded-full border border-[#4e2283]/10">
                            {getRoleLabel(user.role)}
                          </span>
                          {pendingUserAiChanges[user.userId] !== undefined && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight animate-pulse">
                              Modificado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">@{user.username} &bull; Contraseña: <span className="font-bold text-slate-700">{user.userId === currentUser.userId ? user.password : '••••••••'}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* AI Access Toggle */}
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest mb-1">IA Activa</span>
                        <button
                          type="button"
                          onClick={() => handleToggleUserAi(user)}
                          title={user.enableAi !== false ? "Desactivar Inteligencia Artificial para este usuario" : "Activar Inteligencia Artificial para este usuario"}
                          className={`w-9 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer ${user.enableAi !== false ? 'bg-[#461D77]' : 'bg-slate-300'}`}
                        >
                          <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform transform ${user.enableAi !== false ? 'translate-x-4.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.userId === currentUser.userId || user.userId === 'admin'}
                        className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="py-8 text-center mt-12 border-t border-slate-200/50 relative z-10">
        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em]">
          NOVANDINO LOGÍSTICA &bull; GESTIÓN SECTORIAL SEGURA DE ACCESOS
        </p>
      </footer>

      {deleteCandidate && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-[2rem] p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1c1917] text-lg uppercase tracking-tight">Confirmar Eliminación</h3>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Acción Destructiva</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteCandidate(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Por motivos de seguridad, para eliminar la cuenta de <strong className="text-slate-800">@{deleteCandidate.username} ({deleteCandidate.name})</strong>, debe confirmar ingresando su contraseña de administrador.
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
                    passwordError ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[#461D77] focus:border-[#461D77] focus:bg-white focus:shadow-md'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-widest mt-1">Contraseña Incorrecta</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-200 hover:scale-[1.02] active:scale-95"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
