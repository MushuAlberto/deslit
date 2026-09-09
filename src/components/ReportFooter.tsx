
import React from 'react';

const ReportFooter: React.FC = () => {
  return (
    <div className="mt-auto pt-6 border-t border-calido flex justify-between items-end w-full">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[9px] text-violeta/40 font-bold uppercase tracking-[0.2em] leading-none">Subgerencia Logística Litio</p>
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-1">
        <p className="text-[9px] text-violeta/20 font-black uppercase tracking-widest">Documento Interno - Confidencial</p>
        <div className="h-1.5 w-32 bg-calido rounded-full overflow-hidden flex">
          <div className="h-full bg-ionizado w-1/2"></div>
          <div className="h-full bg-nucleo w-1/2"></div>
        </div>
        <p className="text-[9px] text-slate-400 font-bold tracking-tight uppercase mt-0.5 whitespace-nowrap">
          PWA creada y diseñada por Cristian Tapia Espinoza
        </p>
      </div>
    </div>
  );
};

export default ReportFooter;
