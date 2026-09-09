
import React from 'react';
// Fixed: Changed import to local ./types to correctly resolve the DataRow interface available in the components folder
import type { DataRow } from './types';

interface StatsGridProps {
  data: DataRow[];
}

const StatsGrid: React.FC<StatsGridProps> = ({ data }) => {
  if (data.length === 0) return null;

  const numericCols = Object.keys(data[0]).filter(key => 
    typeof data[0][key] === 'number' || (!isNaN(Number(data[0][key])) && data[0][key] !== '')
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {numericCols.slice(0, 6).map(col => {
        const values = data.map(d => Number(d[col])).filter(v => !isNaN(v));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        return (
          <div key={col} className="bg-white/80 backdrop-blur-md p-6 rounded-[1.8rem] border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_30px_rgba(70,29,119,0.04)] transition-all duration-300">
            <h4 className="text-[10px] font-black text-[#461D77] uppercase tracking-widest mb-4 truncate" title={col}>{col}</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50/50 p-2 rounded-xl border border-black/[0.01]">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Promedio</p>
                <p className="font-extrabold text-[#461D77] text-sm mt-0.5">{avg.toLocaleString(undefined, {maximumFractionDigits: 1})}</p>
              </div>
              <div className="bg-slate-50/50 p-2 rounded-xl border border-black/[0.01]">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Máx</p>
                <p className="font-extrabold text-[#3FAA88] text-sm mt-0.5">{max.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50/50 p-2 rounded-xl border border-black/[0.01]">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Mín</p>
                <p className="font-extrabold text-[#C59E4D] text-sm mt-0.5">{min.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
