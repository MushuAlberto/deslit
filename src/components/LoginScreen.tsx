import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, User, LogIn, KeyRound, ShieldAlert, Loader2, Check } from 'lucide-react';
import { NovandinoLogo } from './BrandLogo';
import { db, bootstrapPredefinedUsers, logActivity, SystemUser } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface LoginScreenProps {
  onLoginSuccess: (user: SystemUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // Run bootstrap so the 6 predefined users exist in Firestore
        await bootstrapPredefinedUsers();

        const querySnapshot = await getDocs(collection(db, 'users'));
        const users: SystemUser[] = [];
        querySnapshot.forEach((docSnap) => {
          users.push(docSnap.data() as SystemUser);
        });

        if (users.length > 0) {
          // Sort alphabetically by name
          users.sort((a, b) => a.name.localeCompare(b.name));
          setUsersList(users);
          const defaultUser = users.find(u => u.role === 'admin') || users[0];
          setSelectedUserId(defaultUser.userId);
        } else {
          throw new Error('No users found in collection.');
        }
      } catch (err) {
        console.error('Error fetching users from Firestore, using fallback:', err);
        const fallbackUsers: SystemUser[] = [
          { userId: 'ctapia', username: 'ctapia', password: 'ctapia', name: 'Cristian Tapia', role: 'admin' },
          { userId: 'mtoledo', username: 'mtoledo', password: 'mtoledo', name: 'Mauricio Toledo', role: 'jefe_turno' },
          { userId: 'rbarraza', username: 'rbarraza', password: 'rbarraza', name: 'Raul Barraza', role: 'jefe_turno' },
          { userId: 'marevalo', username: 'marevalo', password: 'marevalo', name: 'Marcelo Arevalo', role: 'supervision' },
          { userId: 'rogalde', username: 'rogalde', password: 'rogalde', name: 'Roberto Ogalde', role: 'supervision' },
          { userId: 'wcastillo', username: 'wcastillo', password: 'wcastillo', name: 'Walter Castillo', role: 'supervision' },
        ];
        fallbackUsers.sort((a, b) => a.name.localeCompare(b.name));
        setUsersList(fallbackUsers);
        setSelectedUserId('ctapia');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const user = usersList.find(u => u.userId === selectedUserId);
    if (!user) {
      setErrorMsg('Usuario inválido.');
      return;
    }

    if (user.password !== password) {
      setErrorMsg('Contraseña incorrecta. Intente nuevamente.');
      // Log failed login
      await logActivity(user, 'Intento de Inicio Fallido', 'Ingresó una clave incorrecta.');
      return;
    }

    setSigningIn(true);
    try {
      // Log successful login
      await logActivity(user, 'Inicio de Sesión', 'El usuario inició sesión con éxito desde la PWA.');
      onLoginSuccess(user);
    } catch (err) {
      console.error('Error during successful login recording:', err);
      onLoginSuccess(user);
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#1e1b4b] via-[#311042] to-[#110e2e] flex flex-col items-center justify-center p-6 text-white relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec04_1px,transparent_1px),linear-gradient(to_bottom,#7177ec04_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />
        <Loader2 className="w-10 h-10 animate-spin text-[#4FD1C5] mb-5" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#4FD1C5] animate-pulse">Sincronizando con Firebase Firestore...</p>
      </div>
    );
  }

  // Sort and display role types
  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Administración';
    if (role === 'jefe_turno') return 'Jefe de Turno';
    return 'Supervisión';
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] relative overflow-hidden flex items-center justify-center p-4">
      {/* Decorative tech background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec04_1px,transparent_1px),linear-gradient(to_bottom,#7177ec04_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />
      
      {/* Blurred colored spots */}
      <div className="absolute top-10 left-12 w-96 h-96 bg-[#7177EC]/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-12 w-96 h-96 bg-[#461D77]/8 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 14 }}
        className="relative z-10 w-full max-w-lg bg-white/70 backdrop-blur-xl border border-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col gap-8"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <NovandinoLogo className="h-16 w-auto" variant="small" />
          <div className="h-[2px] w-24 bg-[#461D77]/20 rounded-full" />
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 bg-[#4e2283]/10 text-[#4e2283] text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase">
              Centro de Despacho M1
            </span>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Control de Acceso</h1>
            <p className="text-xs font-semibold text-slate-500 leading-relaxed max-w-sm">
              Seleccione su perfil de usuario correspondiente e ingrese su contraseña para firmar e ingresar a la PWA.
            </p>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-6">
          {/* USER SELECTION DROP DOWN */}
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1.5">
              <User size={13} /> Seleccionar Perfil
            </label>
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full bg-white/90 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-3xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#461D77]/5 transition-all appearance-none cursor-pointer"
              >
                {usersList.map((u) => (
                  <option key={u.userId} value={u.userId}>{u.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* PASSWORD INPUT CODE */}
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1.5">
              <Lock size={13} /> Contraseña de Acceso
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Ingrese contraseña asignada"
                className="w-full bg-white/90 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-3xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 placeholder-slate-400 outline-none focus:ring-4 focus:ring-[#461D77]/5 transition-all"
              />
              <KeyRound size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-red-50 text-red-600 rounded-2xl px-4 py-3 flex items-start gap-2.5 border border-red-200"
            >
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span className="text-xs font-black tracking-wide leading-relaxed">{errorMsg}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            className="w-full bg-[#461D77] hover:bg-[#321159] disabled:bg-[#461D77]/50 text-white font-extrabold text-xs uppercase tracking-[0.2em] py-4.5 rounded-3xl flex items-center justify-center gap-2 shadow-lg shadow-[#461D77]/10 transition-all duration-300 cursor-pointer"
          >
            {signingIn ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <>
                <LogIn size={14} /> Firmar y Acceder
              </>
            )}
          </button>
        </form>

        <div className="flex justify-between items-center text-[9px] text-slate-400 font-[900] tracking-widest uppercase border-t border-slate-200/50 pt-5">
          <span>NOVANDINO LOGÍSTICA</span>
          <span>&bull;</span>
          <span>PWA creada y diseñada por Cristian Tapia Espinoza</span>
        </div>
      </motion.div>
    </div>
  );
};
