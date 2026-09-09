import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Truck, 
  FileBarChart, 
  History, 
  ChevronRight, 
  BarChart3, 
  Image as ImageIcon, 
  RefreshCw, 
  ClipboardList, 
  Clock, 
  Calendar, 
  User, 
  Activity, 
  ShieldAlert,
  Sliders,
  ExternalLink,
  Key,
  Lock,
  X,
  CheckCircle,
  AlertTriangle,
  Building2,
  ArrowLeft,
  Layers,
  Factory,
  Warehouse,
  MapPin
} from 'lucide-react';
import { NovandinoLogo } from './BrandLogo';
import { PasswordPrompt } from './PasswordPrompt';

interface MainMenuProps {
  onSelectView: (view: 'llegada' | 'informe-novandino' | 'informe-sqm' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs' | 'slit' | 'cumplimiento-mq' | 'cumplimiento-jorquera') => void;
  isJefeTurnoUnlocked: boolean;
  onUnlockJefeTurno: () => void;
  currentUser: any;
  onLogout: () => void;
  initialLocation?: string | null;
  onLocationChange?: (location: string | null) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
  onSelectView, 
  isJefeTurnoUnlocked, 
  onUnlockJefeTurno, 
  currentUser, 
  onLogout,
  initialLocation = null,
  onLocationChange
}) => {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'supervision' | 'jefe_turno'>('supervision');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [openedLocation, setOpenedLocation] = useState<string | null>(initialLocation);
  const [unlockedLocations, setUnlockedLocations] = useState<Record<string, boolean>>({});
  const [locationPasswordPrompt, setLocationPasswordPrompt] = useState<{ id: string; name: string } | null>(null);

  // Sync state if initialLocation changes
  useEffect(() => {
    setOpenedLocation(initialLocation);
  }, [initialLocation]);

  // Sync state upward when openedLocation changes
  useEffect(() => {
    if (onLocationChange) {
      onLocationChange(openedLocation);
    }
  }, [openedLocation, onLocationChange]);

  const locationModules = [
    {
      id: 'SdA',
      title: 'SdA',
      fullName: 'SALAR DE ATACAMA',
      subtitle: 'SALAR DE ATACAMA',
      badge: 'OPERACIÓN DE CAMPO',
      status: '5 MÓDULOS ACTIVOS',
      description: 'Módulo integral Salar de Atacama. Acceso a Informes de Despacho Novandino y SQM NY, Llegada de Equipos, Análisis Técnico DdD y Galería Operativa.',
      icon: Building2,
      gradient: 'from-violet-500/10 via-[#461D77]/5 to-[#461D77]/10',
      borderColor: 'border-[#461D77]/30',
      iconBg: 'bg-[#461D77] text-white',
      badgeBg: 'bg-[#461D77]/10 text-[#461D77]',
    },
    {
      id: 'PQL',
      title: 'PQL',
      fullName: 'PLANTA QUÍMICA LITIO',
      subtitle: 'PLANTA QUÍMICA LITIO',
      badge: 'PLANTA QUÍMICA',
      status: 'CONECTADO',
      description: 'Análisis y seguimiento de cumplimiento de despacho M&Q, volumen transportado y desviaciones operacionales.',
      icon: Factory,
      gradient: 'from-blue-500/10 via-indigo-500/5 to-indigo-600/10',
      borderColor: 'border-indigo-500/30',
      iconBg: 'bg-indigo-600 text-white',
      badgeBg: 'bg-indigo-500/10 text-indigo-700',
    },
    {
      id: 'CLB',
      title: 'CLB',
      fullName: 'CENTRO LOGÍSTICO BAQUEDANO',
      subtitle: 'CENTRO LOGÍSTICO BAQUEDANO',
      badge: 'CENTRO LOGÍSTICO',
      status: 'MÓDULO EN BLANCO',
      description: 'Módulo integral Centro Logístico Baquedano. Espacio en blanco listo para la asignación de nuevos componentes.',
      icon: Warehouse,
      gradient: 'from-emerald-500/10 via-teal-500/5 to-teal-600/10',
      borderColor: 'border-teal-500/30',
      iconBg: 'bg-teal-700 text-white',
      badgeBg: 'bg-teal-500/10 text-teal-800',
    },
    {
      id: 'PANG',
      title: 'PANG',
      fullName: 'PUERTO ANGAMOS',
      subtitle: 'PUERTO ANGAMOS',
      badge: 'BASE OPERATIVA',
      status: 'MÓDULO EN BLANCO',
      description: 'Módulo integral Puerto Angamos. Espacio en blanco listo para la asignación de nuevos componentes.',
      icon: MapPin,
      gradient: 'from-amber-500/10 via-orange-500/5 to-amber-600/10',
      borderColor: 'border-amber-500/30',
      iconBg: 'bg-amber-600 text-white',
      badgeBg: 'bg-amber-500/10 text-amber-800',
    },
  ];

  // Force active tab to supervision on load if supervisor
  useEffect(() => {
    if (currentUser?.role === 'supervision') {
      setActiveTab('supervision');
    }
  }, [currentUser]);

  // States for the custom Change Password modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passSaving, setPassSaving] = useState(false);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (passwordCurrent !== currentUser?.password) {
      setPassError('La contraseña actual es incorrecta.');
      return;
    }

    if (passwordNew.trim().length < 4) {
      setPassError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (passwordNew !== passwordConfirm) {
      setPassError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setPassSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db, logActivity } = await import('../services/firebase');
      
      const updatedUser = {
        ...currentUser,
        password: passwordNew
      };

      await setDoc(doc(db, 'users', currentUser.userId), updatedUser);
      
      // Sync change locally within persistent localStorage
      localStorage.setItem('sqm_current_user', JSON.stringify(updatedUser));
      
      // Overwrite current reference
      if (currentUser) {
        currentUser.password = passwordNew;
      }

      await logActivity(currentUser, 'Cambió Contraseña', `El usuario ${currentUser.name} actualizó su contraseña de acceso exitosamente.`);
      
      setPassSuccess('¡Contraseña actualizada correctamente!');
      setPasswordCurrent('');
      setPasswordNew('');
      setPasswordConfirm('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPassSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Error updating password:', err);
      setPassError('Fallo al registrar nueva clave. Intente de nuevo.');
    } finally {
      setPassSaving(false);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      setDateStr(now.toLocaleDateString('es-CL', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleJefeTurnoClick = () => {
    if (isJefeTurnoUnlocked) {
      setActiveTab('jefe_turno');
    } else {
      setShowPasswordPrompt(true);
    }
  };

  // Stagger animations config
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        damping: 15 
      }
    }
  };

  const cardsData: Array<{
    id: 'llegada' | 'informe-novandino' | 'informe-sqm' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs' | 'slit';
    title: string;
    subtitle: string;
    description: string;
    icon: any;
    color: string;
    iconBg: string;
    accentColor: string;
    isFeature?: boolean;
    badge: string;
    status: string;
    group: 'supervision' | 'jefe_turno';
  }> = [
    {
      id: 'informe-novandino',
      title: 'Informe Operativo Novandino',
      subtitle: 'Dashboard Principal',
      description: 'Informe diario consolidado de turnos, estadísticas de despachos de litio en tiempo real y exportación profesional automatizada a reportes PDF o formato de imagen de alta resolución.',
      icon: FileBarChart,
      color: 'from-violet-500/10 via-[#461D77]/5 to-[#461D77]/10 border-[#461D77]/20',
      iconBg: 'bg-[#461D77]/10 text-[#461D77]',
      accentColor: '#461D77',
      isFeature: true, // Takes more grid columns on desktop for visual weight
      badge: 'MÓDULO DESPACHO',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'informe-sqm',
      title: 'Informe Operativo SQM NY',
      subtitle: 'Dashboard SQM NY',
      description: 'Informe diario consolidado de turnos, estadísticas de despachos de litio en tiempo real y exportación profesional automatizada a reportes PDF o formato de imagen de alta resolución.',
      icon: FileBarChart,
      color: 'from-violet-500/10 via-[#461D77]/5 to-[#461D77]/10 border-[#461D77]/20',
      iconBg: 'bg-[#461D77]/10 text-[#461D77]',
      accentColor: '#461D77',
      isFeature: true, // Takes more grid columns on desktop for visual weight
      badge: 'MÓDULO DESPACHO',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'llegada' as const,
      title: 'Llegada de Equipos',
      subtitle: 'Tránsito & Flujo',
      description: 'Análisis minucioso del flujo de transporte, verificación de llegada, frecuencia de cargas estimadas y control integral de flotas en tránsito hacia faenas de litio.',
      icon: Truck,
      color: 'from-teal-500/10 via-[#3FAA88]/5 to-[#3FAA88]/10 border-[#3FAA88]/20',
      iconBg: 'bg-[#3FAA88]/10 text-[#3FAA88]',
      accentColor: '#3FAA88',
      isFeature: true,
      badge: 'LOGÍSTICA IN SITU',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'lce' as const,
      title: 'Control LCE',
      subtitle: 'Cumplimiento Salar',
      description: 'Tablero de control y balance de cloruro de litio (LCE) equivalente. Monitoreo constante del cumplimiento de despacho in-situ en el Salar de Atacama.',
      icon: ClipboardList,
      color: 'from-cyan-500/10 via-[#4FD1C5]/5 to-[#4FD1C5]/10 border-[#4FD1C5]/20',
      iconBg: 'bg-[#4FD1C5]/15 text-[#2cbba5]',
      accentColor: '#4FD1C5',
      badge: 'SALAR DE ATACAMA',
      status: 'ESTADÍSTICAS',
      group: 'jefe_turno' as const
    },
    {
      id: 'ddd' as const,
      title: 'Análisis Técnico',
      subtitle: 'Diálogo de Desempeño',
      description: 'Análisis detallado de indicadores del Tablero M1. Herramientas técnicas estructuradas para reuniones operativas sistemáticas de Desempeño (DdD).',
      icon: BarChart3,
      color: 'from-amber-600/10 via-[#C59E4D]/5 to-[#C59E4D]/10 border-[#C59E4D]/25',
      iconBg: 'bg-[#C59E4D]/15 text-[#b28b3b]',
      accentColor: '#C59E4D',
      badge: 'SALA REUNIÓN M1',
      status: 'ESTRATÉGICO',
      group: 'supervision' as const
    },
    {
      id: 'cambioTurno' as const,
      title: 'Cambio de Turno',
      subtitle: 'Relevo & Rendimiento',
      description: 'Sincronización fluida de datos operativos para la entrega e inicio de jornadas de trabajo, con cálculo automático de traslape y rendimiento de flota.',
      icon: RefreshCw,
      color: 'from-sky-500/10 via-[#7177EC]/5 to-[#7177EC]/10 border-[#7177EC]/20',
      iconBg: 'bg-[#7177EC]/10 text-[#7177EC]',
      accentColor: '#7177EC',
      badge: 'ENTREGA DE SECCIÓN',
      status: 'SINCRONIZADO',
      group: 'jefe_turno' as const
    },
    {
      id: 'galeria' as const,
      title: 'Galería Operativa',
      subtitle: 'Registro de Evidencia',
      description: 'Galería visual autoadministrable de fotos y reportes gráficos tomados en terreno. Soporta carga instantánea, carrusel y catalogación de novedades.',
      icon: ImageIcon,
      color: 'from-purple-500/10 via-levanda/10 to-levanda/20 border-violeta/15',
      iconBg: 'bg-violeta/10 text-violeta',
      accentColor: '#7177EC',
      badge: 'SOPORTE EN TERRENO',
      status: 'REGISTRO',
      group: 'supervision' as const
    },
    {
      id: 'memoria' as const,
      title: 'Memoria Histórica',
      subtitle: 'Historial de Respaldos',
      description: 'Base de conocimiento y bitácora de respaldo de jornadas operativas anteriores. Recupera, visualiza e importa consolidados históricos con un solo clic.',
      icon: History,
      color: 'from-zinc-500/10 via-slate-100 to-slate-200 border-slate-300/40',
      iconBg: 'bg-slate-500/10 text-slate-700',
      accentColor: '#171717',
      badge: 'ARCHIVO SEGURADO',
      status: 'SISTEMA LOCAL',
      group: 'jefe_turno' as const
    }
  ];

  // Módulo SLIT has been removed as requested

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] relative overflow-x-hidden overflow-y-auto flex flex-col justify-between">
      
      {/* Decorative High-End Tech background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec04_1px,transparent_1px),linear-gradient(to_bottom,#7177ec04_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />
      
      {/* Dynamic backdrop glows */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-[#7177EC]/4 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#461D77]/3 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-[#3FAA88]/3 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content Safe Area wrapper */}
      <div className="relative z-10 w-full max-w-[102rem] mx-auto px-6 py-6 md:py-10 flex-grow flex flex-col gap-6 md:gap-10">
        
        {/* TOP STATUS NAVIGATION BAR (Glassmorphism Header) */}
        <header className="w-full bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <NovandinoLogo className="h-16 w-[200px]" variant="small" />
            <div className="hidden sm:block h-8 w-[1px] bg-slate-300/60" />
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 bg-nucleo/10 text-nucleo text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
                SISTEMA INFORMATIZADO M1
              </span>
              <p className="text-[11px] font-medium text-slate-500 tracking-wide">
                SUBGERENCIA LOGÍSTICA LITIO &bull; DESPACHO
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3.5">
            {/* Admin and Jefe Turno actions */}
            <div className="flex items-center gap-2">
              {currentUser?.role === 'admin' && (
                <>
                  {/* Control SLIT button removed as requested */}
                  <button
                    type="button"
                    onClick={() => onSelectView('users')}
                    className="bg-[#461D77]/8 hover:bg-[#461D77]/15 border border-[#461D77]/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-[#461D77] uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <User size={13} strokeWidth={2.5} /> Usuarios
                  </button>
                </>
              )}
              {(currentUser?.role === 'admin' || currentUser?.role === 'jefe_turno') && (
                <button
                  type="button"
                  onClick={() => onSelectView('logs')}
                  className="bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-md"
                >
                  <Activity size={13} strokeWidth={2.5} /> Bitácora
                </button>
              )}
            </div>

            {/* Change Password modal trigger button */}
            <button
              type="button"
              onClick={() => {
                setPassError('');
                setPassSuccess('');
                setShowChangePassword(true);
              }}
              className="bg-[#461D77]/8 hover:bg-[#461D77]/15 border border-[#461D77]/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-[#461D77] uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-md"
            >
              <Key size={13} strokeWidth={2.5} /> Clave
            </button>

            {/* Sign Out Trigger button */}
            <button
              type="button"
              onClick={onLogout}
              className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-rose-600 uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-md"
            >
              Salir
            </button>

            {/* Real-time Clock Widget */}
            <div className="bg-white/80 border border-slate-200/50 rounded-2xl px-5 py-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#7177EC]" />
                <span className="font-mono text-sm font-extrabold text-tecnico tracking-tight">{time || '00:00:00'}</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-[#3FAA88]" />
                <span className="text-[11px] font-bold text-slate-500 capitalize">{dateStr.replace(' de 2026', '') || 'Cargando fecha...'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* HERO SECTION - Welcome and general operational context */}
        <section className="w-full bg-gradient-to-r from-[#1e1b4b] via-[#311042] to-[#110e2e] rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-xl border-t border-white/10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:1.5rem_1.5rem]" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-violeta/15 rounded-full blur-[100px] -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-litio/15 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-4">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight">
                <span className="block">CENTRO DE CONTROL LOGISTICA LITIO</span>
                <span className="text-[#4FD1C5] block mt-1">NOVANDINO</span>
              </h1>
              <p className="text-slate-300 font-medium text-sm md:text-base leading-relaxed">
                Plataforma integral de control técnico para la Subgerencia de Logística de Litio. 
                Seleccione un módulo operativo para registrar despachos, verificar llegada de equipos, 
                ejecutar diálogos de desempeño y exportar los informes oficiales de la jornada.
              </p>
            </div>

            {/* Right Content - Operational Status Panel */}
            <div className="lg:col-span-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-5" />
                  <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                    SISTEMA EN LÍNEA
                  </span>
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  TURNO ACTIVO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-1">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Zonas Operativas</p>
                  <p className="text-xl font-black text-white">4 MÓDULOS</p>
                  <p className="text-[9px] text-[#4FD1C5] font-bold">SdA &bull; PQL &bull; CLB &bull; PANG</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-1">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Control Técnico</p>
                  <p className="text-xl font-black text-white">100% ACTIVO</p>
                  <p className="text-[9px] text-emerald-400 font-bold">Reportes en Tiempo Real</p>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-slate-300 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                <span className="uppercase text-slate-400 font-extrabold">
                  {currentUser?.role === 'admin' 
                    ? 'ADMINISTRADOR' 
                    : currentUser?.role === 'jefe_turno' 
                    ? 'JEFE DE TURNO' 
                    : 'SUPERVISOR'}:
                </span>
                <span className="text-white font-black">{currentUser?.name || 'Analista Activo'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO GRID MODULE SELECTOR */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-12 w-full z-10 relative"
        >
          {!openedLocation ? (
            /* MAIN LEVEL: 4 OPERATIONAL ZONE MODULES */
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-300/40">
                <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#461D77] to-indigo-500 shadow-sm" />
                <div>
                  <h3 className="text-xl font-black text-[#1e1b4b] uppercase tracking-wider leading-none">MÓDULOS OPERATIVOS DE CAMPO</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    SELECCIONE UNA ZONA PARA INGRESAR
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full auto-rows-fr">
                {locationModules.map((loc) => {
                  const IconComponent = loc.icon;
                  const isSdA = loc.id === 'SdA';
                  const isInProcess = !isSdA; // PQL, CLB, PANG are in process
                  const isUnlocked = isSdA || unlockedLocations[loc.id];
                  
                  return (
                    <motion.button
                      key={loc.id}
                      variants={itemVariants}
                      onClick={() => {
                        if (isUnlocked) {
                          setOpenedLocation(loc.id);
                        } else {
                          setLocationPasswordPrompt({
                            id: loc.id,
                            name: `${loc.title} - ${loc.fullName}`,
                          });
                        }
                      }}
                      className={`group relative bg-white/80 hover:bg-white border ${
                        isInProcess && !isUnlocked 
                          ? 'border-amber-400/50 hover:border-amber-500/70' 
                          : 'border-black/[0.04] hover:border-black/[0.08]'
                      } rounded-[2.2rem] ${isInProcess ? 'pt-11 pb-8 px-8' : 'p-8'} shadow-[0_4px_24px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-300 ease-out hover:scale-[1.015] active:scale-[0.985] hover:shadow-[0_20px_50px_rgba(70,29,119,0.05),0_1px_5px_rgba(0,0,0,0.02)] flex flex-col justify-between text-left overflow-hidden cursor-pointer col-span-1 min-h-[18rem] lg:min-h-[19.5rem]`}
                    >
                      {/* IN-PROCESS TOP RIBBON / BANNER */}
                      {isInProcess && (
                        <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] shadow-xs z-20">
                          <Lock size={12} strokeWidth={2.5} className="text-amber-100" />
                          <span>EN PROCESO</span>
                        </div>
                      )}

                      {/* Decorative Apple-style light reflection */}
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-white/20 to-transparent rounded-bl-[6rem] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                      
                      <div className="space-y-4 relative z-10 w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm ${loc.iconBg} group-hover:scale-110 group-hover:rotate-3`}>
                            <IconComponent size={24} strokeWidth={1.5} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isInProcess && !isUnlocked && (
                              <span className="text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center gap-1">
                                <Lock size={10} strokeWidth={2.5} /> PROTEGIDO
                              </span>
                            )}
                            <span className={`text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase ${
                              isSdA ? 'bg-[#461D77]/10 text-[#461D77]' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {loc.badge}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">{loc.subtitle}</p>
                          <h2 className="font-[900] text-slate-800 tracking-tighter transition-colors text-xl flex items-center justify-between">
                            <span>{loc.title}</span>
                            {isInProcess && !isUnlocked && (
                              <Lock size={16} className="text-amber-500/70" />
                            )}
                          </h2>
                          <p className="text-slate-500 text-xs leading-relaxed font-medium line-clamp-3">
                            {loc.description}
                          </p>
                        </div>
                      </div>

                      <div className="w-full pt-4 mt-6 border-t border-black/[0.04] flex items-center justify-between text-[10px] font-black tracking-widest uppercase transition-colors relative z-10">
                        <span className={`${
                          isInProcess && !isUnlocked 
                            ? 'text-amber-700 font-extrabold flex items-center gap-1.5' 
                            : 'text-slate-500 group-hover:text-[#461D77]'
                        } transition-colors`}>
                          {isSdA 
                            ? 'Ingresar a la Zona' 
                            : isUnlocked 
                            ? 'Zona Desbloqueada' 
                            : 'Desbloquear con Clave'}
                        </span>
                        <div className={`w-8 h-8 rounded-full ${
                          isInProcess && !isUnlocked ? 'bg-amber-500 text-white' : loc.iconBg
                        } group-hover:bg-[#461D77] group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm`}>
                          {isInProcess && !isUnlocked ? (
                            <Lock size={14} />
                          ) : (
                            <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* INSIDE OPENED LOCATION MODULE */
            <div className="space-y-6">
              {/* LOCATION HEADER */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-300/40">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#461D77] to-indigo-500 shadow-sm" />
                  <div>
                    <h3 className="text-xl font-black text-[#1e1b4b] uppercase tracking-wider leading-none">
                      MÓDULO {locationModules.find(l => l.id === openedLocation)?.title}
                    </h3>
                    <p className="text-[10px] font-bold text-[#461D77] uppercase tracking-widest mt-1">
                      {locationModules.find(l => l.id === openedLocation)?.id} - {locationModules.find(l => l.id === openedLocation)?.fullName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenedLocation(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white border border-slate-300/80 rounded-2xl text-[10px] font-black text-slate-700 uppercase tracking-wider transition-all duration-200 hover:shadow-md cursor-pointer active:scale-95"
                >
                  <ArrowLeft size={14} /> Volver a Módulos
                </button>
              </div>

              {openedLocation === 'SdA' ? (
                <>
                  {/* TAB SWITCHER: SUPERVISIÓN / JEFE TURNO INSIDE SdA */}
                  {currentUser?.role !== 'supervision' && (
                    <div className="flex items-center justify-center gap-3 bg-white/60 border border-slate-200/80 p-2 rounded-3xl max-w-sm mx-auto shadow-sm my-4 backdrop-blur-md">
                      <button 
                        type="button"
                        onClick={() => setActiveTab('supervision')}
                        className={`flex-1 px-5 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer text-center ${
                          activeTab === 'supervision' 
                            ? 'bg-[#461D77] text-white shadow-sm' 
                            : 'text-slate-600 hover:text-[#461D77] hover:bg-white/50'
                        }`}
                      >
                        Supervisión
                      </button>
                      <button 
                        type="button"
                        onClick={handleJefeTurnoClick}
                        className={`flex-1 px-5 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer text-center ${
                          activeTab === 'jefe_turno' 
                            ? 'bg-[#7177EC] text-white shadow-sm' 
                            : 'text-slate-600 hover:text-[#7177EC] hover:bg-white/50'
                        }`}
                      >
                        Jefe Turno
                      </button>
                    </div>
                  )}

                  {/* CARDS GRID FOR SELECTED TAB INSIDE SdA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full auto-rows-fr">
                    {cardsData.filter(c => c.group === activeTab).map((card, idx) => {
                      const IconComponent = card.icon;
                      const isNovandino = card.id === 'informe-novandino';
                      
                      return (
                        <motion.button
                          key={`${card.id}-${idx}`}
                          variants={itemVariants}
                          onClick={() => onSelectView(card.id)}
                          className={`group relative bg-white/80 hover:bg-white border border-black/[0.04] hover:border-black/[0.08] rounded-[2.2rem] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-300 ease-out hover:scale-[1.015] active:scale-[0.985] hover:shadow-[0_20px_50px_rgba(70,29,119,0.05),0_1px_5px_rgba(0,0,0,0.02)] flex flex-col justify-between text-left overflow-hidden cursor-pointer min-h-[19.5rem] lg:min-h-[21rem] ${
                            isNovandino ? 'md:col-span-2 lg:col-span-2' : 'col-span-1'
                          }`}
                        >
                          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-white/15 to-transparent rounded-bl-[4rem] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                          
                          <div className="flex items-center justify-between w-full relative z-10">
                            <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-[#461D77] transition-colors uppercase">
                              {card.badge}
                            </span>
                            
                            <span className={`text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase ${
                              card.id === 'informe-novandino' || card.id === 'informe-sqm' || card.id === 'llegada'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : card.id === 'ddd'
                                ? 'bg-amber-500/10 text-amber-700'
                                : card.id === 'lce'
                                ? 'bg-cyan-500/10 text-cyan-600'
                                : 'bg-purple-500/10 text-purple-700'
                            }`}>
                              &bull; {card.status}
                            </span>
                          </div>

                          <div className="space-y-4 my-auto relative z-10">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm ${card.iconBg} group-hover:scale-110 group-hover:rotate-3`}>
                              <IconComponent size={24} strokeWidth={1.5} />
                            </div>
                            
                            <div className="space-y-1">
                              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">{card.subtitle}</p>
                              <h2 className={`font-[900] text-slate-800 tracking-tighter transition-colors ${
                                isNovandino ? 'text-2xl lg:text-3xl' : 'text-xl'
                              }`}>
                                {card.title}
                              </h2>
                              <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 font-medium">
                                {card.description}
                              </p>
                            </div>
                          </div>

                          <div className="w-full pt-4 mt-4 border-t border-black/[0.04] flex items-center justify-between text-[10px] font-black tracking-widest uppercase transition-colors relative z-10">
                            <span className="text-slate-500 group-hover:text-[#461D77] transition-colors">ACCEDER AL COMPONENTE</span>
                            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#461D77] group-hover:text-white flex items-center justify-center text-slate-500 transition-all duration-300 shadow-sm">
                              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              ) : openedLocation === 'PQL' ? (
                <div className="space-y-6">
                  {/* PQL CARDS GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full auto-rows-fr">
                    {/* CUMPLIMIENTO M&Q */}
                    <motion.button
                      variants={itemVariants}
                      onClick={() => onSelectView('cumplimiento-mq')}
                      className="group relative bg-white/80 hover:bg-white border border-black/[0.04] hover:border-black/[0.08] rounded-[2.2rem] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-300 ease-out hover:scale-[1.015] active:scale-[0.985] hover:shadow-[0_20px_50px_rgba(70,29,119,0.05),0_1px_5px_rgba(0,0,0,0.02)] flex flex-col justify-between text-left overflow-hidden cursor-pointer min-h-[19.5rem] lg:min-h-[21rem]"
                    >
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-white/15 to-transparent rounded-bl-[4rem] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                      
                      <div className="flex items-center justify-between w-full relative z-10">
                        <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors uppercase">
                          PLANTA QUÍMICA
                        </span>
                        
                        <span className="text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase bg-indigo-500/10 text-indigo-600">
                          &bull; ACTIVO
                        </span>
                      </div>

                      <div className="space-y-4 my-auto relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm bg-indigo-600 text-white group-hover:scale-110 group-hover:rotate-3">
                          <ClipboardList size={24} strokeWidth={1.5} />
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Desempeño & Productividad</p>
                          <h2 className="font-[900] text-slate-800 tracking-tighter transition-colors text-2xl lg:text-3xl">
                            Cumplimiento M&Q
                          </h2>
                          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 font-medium">
                            Monitoreo de vueltas solicitadas vs reales, toneladas transportadas, días críticos del mes y productividad diaria de la operación.
                          </p>
                        </div>
                      </div>

                      <div className="w-full pt-4 mt-4 border-t border-black/[0.04] flex items-center justify-between text-[10px] font-black tracking-widest uppercase transition-colors relative z-10">
                        <span className="text-slate-500 group-hover:text-indigo-600 transition-colors">ACCEDER AL COMPONENTE</span>
                        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-slate-500 transition-all duration-300 shadow-sm">
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.button>

                    {/* CUMPLIMIENTO JORQUERA */}
                    <motion.button
                      variants={itemVariants}
                      onClick={() => onSelectView('cumplimiento-jorquera')}
                      className="group relative bg-white/80 hover:bg-white border border-black/[0.04] hover:border-black/[0.08] rounded-[2.2rem] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-300 ease-out hover:scale-[1.015] active:scale-[0.985] hover:shadow-[0_20px_50px_rgba(70,29,119,0.05),0_1px_5px_rgba(0,0,0,0.02)] flex flex-col justify-between text-left overflow-hidden cursor-pointer min-h-[19.5rem] lg:min-h-[21rem]"
                    >
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-white/15 to-transparent rounded-bl-[4rem] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                      
                      <div className="flex items-center justify-between w-full relative z-10">
                        <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors uppercase">
                          PLANTA QUÍMICA
                        </span>
                        
                        <span className="text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase bg-indigo-500/10 text-indigo-600">
                          &bull; ACTIVO
                        </span>
                      </div>

                      <div className="space-y-4 my-auto relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm bg-indigo-600 text-white group-hover:scale-110 group-hover:rotate-3">
                          <ClipboardList size={24} strokeWidth={1.5} />
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Desempeño & Productividad</p>
                          <h2 className="font-[900] text-slate-800 tracking-tighter transition-colors text-2xl lg:text-3xl">
                            Cumplimiento Jorquera
                          </h2>
                          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 font-medium">
                            Monitoreo de vueltas solicitadas vs reales, toneladas transportadas, días críticos del mes y productividad diaria de la operación Jorquera.
                          </p>
                        </div>
                      </div>

                      <div className="w-full pt-4 mt-4 border-t border-black/[0.04] flex items-center justify-between text-[10px] font-black tracking-widest uppercase transition-colors relative z-10">
                        <span className="text-slate-500 group-hover:text-indigo-600 transition-colors">ACCEDER AL COMPONENTE</span>
                        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-slate-500 transition-all duration-300 shadow-sm">
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.div
                  variants={itemVariants}
                  className="w-full bg-white/80 border-2 border-dashed border-slate-300/80 rounded-[2.5rem] p-12 lg:p-16 text-center shadow-sm flex flex-col items-center justify-center space-y-5"
                >
                  <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shadow-inner">
                    <Layers size={38} strokeWidth={1.25} />
                  </div>
                  
                  <div className="max-w-md space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200/60">
                      MÓDULO EN BLANCO
                    </span>
                    <h3 className="text-2xl font-black text-tecnico uppercase tracking-tight">
                      {locationModules.find(l => l.id === openedLocation)?.title} - {locationModules.find(l => l.id === openedLocation)?.fullName}
                    </h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                      Este módulo se encuentra actualmente en blanco y disponible para la incorporación de nuevos dashboards, informes o herramientas operativas.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setOpenedLocation(null)}
                      className="px-6 py-3 bg-nucleo text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-md hover:bg-black transition-all active:scale-95"
                    >
                      Volver a Módulos
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* FOOTER BAR */}
      <footer className="relative z-10 py-8 bg-white/40 border-t border-slate-200/55 text-center mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em]">
            NOVANDINO &bull; SUBGERENCIA LOGÍSTICA LITIO &bull; DESPACHO LITIO
          </p>
          <p className="text-[10px] text-slate-400 font-bold tracking-widest">
            PWA creada y diseñada por Cristian Tapia Espinoza
          </p>
        </div>
      </footer>
      {/* PASSWORD PROTECTION FOR IN-PROCESS MODULES (PQL, CLB, PANG) */}
      {locationPasswordPrompt && (
        <PasswordPrompt
          correctPassword="MIRAME"
          moduleName={locationPasswordPrompt.name}
          onSuccess={() => {
            const targetId = locationPasswordPrompt.id;
            setUnlockedLocations(prev => ({ ...prev, [targetId]: true }));
            setLocationPasswordPrompt(null);
            setOpenedLocation(targetId);
          }}
          onCancel={() => setLocationPasswordPrompt(null)}
        />
      )}

      {/* PASSWORD PROTECTION FOR JEFE TURNO TAB */}
      {showPasswordPrompt && (
        <PasswordPrompt
          correctPassword="MIRAME"
          moduleName="Módulo Jefe Turno"
          onSuccess={() => {
            onUnlockJefeTurno();
            setShowPasswordPrompt(false);
            setActiveTab('jefe_turno');
          }}
          onCancel={() => setShowPasswordPrompt(false)}
        />
      )}

      {/* CUSTOM CHANGE PASSWORD MODAL */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blur backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[#1e1b4b]/60 backdrop-blur-sm"
            onClick={() => !passSaving && setShowChangePassword(false)}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white w-full max-w-md rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header branding lock top */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[1.2rem] bg-[#461D77]/10 flex items-center justify-center text-[#461D77]">
                  <Lock size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-[8px] font-black tracking-widest text-[#4e2283] uppercase bg-[#4e2283]/10 px-2 py-0.5 rounded-full">
                    SEGURIDAD DE SESIÓN
                  </span>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Cambiar Contraseña</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                disabled={passSaving}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error or Success banners */}
            {passError && (
              <div className="mb-5 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-3.5 flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle size={15} />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="mb-5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl p-3.5 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle size={15} />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="space-y-1.55">
                <label className="text-[9px] font-black tracking-widest text-[#461D77] uppercase block">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordCurrent}
                    onChange={(e) => setPasswordCurrent(e.target.value)}
                    placeholder="Ingrese su clave actual de acceso"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.55">
                <label className="text-[9px] font-black tracking-widest text-[#461D77] uppercase block">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordNew}
                    onChange={(e) => setPasswordNew(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.55">
                <label className="text-[9px] font-black tracking-widest text-[#461D77] uppercase block">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Re-ingrese la nueva clave"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  disabled={passSaving}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-extrabold text-[10px] tracking-widest py-3 rounded-2xl uppercase transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passSaving}
                  className="flex-1 bg-[#461D77] hover:bg-[#321159] disabled:bg-[#461D77]/50 text-white font-extrabold text-[10px] tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg transition-all uppercase cursor-pointer"
                >
                  {passSaving ? 'Guardando...' : 'Guardar Clave'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;

