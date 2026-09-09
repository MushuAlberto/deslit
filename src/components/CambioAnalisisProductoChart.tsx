import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';

const COLORS = {
  progTon: '#461D77', // Púrpura
  realTon: '#3FAA88', // Verde
  metaHrs: '#171717', // Negro
  realHrs: '#C59E4D'  // Dorado/Ocre
};

// Función para convertir horas decimales (1.5) a formato HH:MM (1:30)
const formatDecimalToHHMM = (decimalHours: number): string => {
  if (isNaN(decimalHours) || decimalHours <= 0) return "0:00";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

// Función para dar formato a la desviación decimal de horas con signo (+/-)
const formatDeviationHours = (deviation: number): { text: string; colorClass: string; isNegative: boolean } => {
  if (Math.abs(deviation) < 0.01) {
    return { text: "0:00", colorClass: "text-slate-500 bg-slate-100", isNegative: false };
  }
  const isNegative = deviation < 0;
  const absDev = Math.abs(deviation);
  const hours = Math.floor(absDev);
  const minutes = Math.round((absDev - hours) * 60);
  const formattedTime = `${hours}:${String(minutes).padStart(2, '0')}`;
  
  if (isNegative) {
    return {
      text: `-${formattedTime}`,
      colorClass: "text-emerald-700 bg-emerald-50 border border-emerald-200/50",
      isNegative: true
    };
  } else {
    return {
      text: `+${formattedTime}`,
      colorClass: "text-rose-700 bg-rose-50 border border-rose-200/50",
      isNegative: false
    };
  }
};

// Función para dar formato legible a la fecha YYYY-MM-DD -> DD-MM-YYYY
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

interface RawChartData {
  name: string;
  producto: string;
  dateKey: string;
  Ton_Prog: number;
  Ton_Real: number;
  faenaMetaHours: number;
  faenaRealHours: number;
  destino?: string;
}

interface Props {
  allData: RawChartData[];
  range: { start: string; end: string };
  visibleProducts: string[];
}

interface ProductCardProps {
  productName: string;
  data: Array<RawChartData & { formattedDate: string }>;
}

const ProductIndividualCard: React.FC<ProductCardProps> = ({ productName, data }) => {
  const tableRows = useMemo(() => {
    return data.map((item, idx) => {
      const compliance = item.Ton_Prog > 0 ? (item.Ton_Real / item.Ton_Prog) * 100 : 0;
      const hourDeviation = item.faenaRealHours - item.faenaMetaHours;
      const deviationObj = formatDeviationHours(hourDeviation);

      return {
        id: `${productName}-${item.dateKey}-${idx}`,
        dateKey: item.dateKey,
        formattedDate: item.formattedDate,
        tonProg: item.Ton_Prog,
        tonReal: item.Ton_Real,
        compliance,
        metaHrs: item.faenaMetaHours,
        realHrs: item.faenaRealHours,
        deviationObj,
        destino: item.destino || 'N/A'
      };
    });
  }, [data, productName]);

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-violeta/15 shadow-sm space-y-8">
      {/* Encabezado del Producto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-violeta tracking-tight">
            {productName}
          </h3>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Análisis de Desempeño y Flujo Operativo Diario
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            {data.length} {data.length === 1 ? 'Día Registrado' : 'Días Registrados'}
          </span>
        </div>
      </div>

      {/* Gráfico del Producto */}
      <div className="w-full">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
          Tendencia Gráfica (Dual-Axis Tons vs Horas Coincidentes)
        </h4>
        <div style={{ width: '100%', height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              
              <XAxis 
                dataKey="formattedDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} 
                interval={0} 
                angle={-30} 
                textAnchor="end" 
                height={50} 
              />

              {/* Eje Izquierdo: Tonelaje */}
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: '#94a3b8' }} 
                label={{ value: 'Tons', angle: -90, position: 'insideLeft', style: { fontSize: '8px', fontWeight: '900', fill: '#94a3b8' } }}
              />

              {/* Eje Derecho: Horas */}
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: '#C59E4D' }} 
                tickFormatter={(v) => formatDecimalToHHMM(Number(v))}
                label={{ value: 'Horas', angle: 90, position: 'insideRight', style: { fontSize: '8px', fontWeight: '900', fill: '#C59E4D' } }}
              />

              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                formatter={(val: any, name: any) => [
                  String(name).toLowerCase().includes('hrs') ? formatDecimalToHHMM(Number(val)) : Math.round(Number(val)).toLocaleString(),
                  name
                ]}
              />

              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '10px', fontWeight: '900' }} iconType="circle" />

              {/* Barras de Tonelaje */}
              <Bar yAxisId="left" dataKey="Ton_Prog" fill={COLORS.progTon} name="Prog. Ton" barSize={12} radius={[2, 2, 0, 0]}>
                 <LabelList dataKey="Ton_Prog" position="top" style={{ fontSize: '8px', fontWeight: '900', fill: COLORS.progTon }} formatter={(v: any) => Math.round(v)} />
              </Bar>
              
              <Bar yAxisId="left" dataKey="Ton_Real" fill={COLORS.realTon} name="Real Ton" barSize={12} radius={[2, 2, 0, 0]}>
                 <LabelList dataKey="Ton_Real" position="top" style={{ fontSize: '8px', fontWeight: '900', fill: COLORS.realTon }} formatter={(v: any) => Math.round(v)} />
              </Bar>

              {/* Líneas de Tiempo */}
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="faenaMetaHours" 
                stroke={COLORS.metaHrs} 
                name="Meta Hrs" 
                strokeWidth={2} 
                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              >
                <LabelList dataKey="faenaMetaHours" position="top" style={{ fontSize: '8px', fontWeight: '800', fill: COLORS.metaHrs }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={10} />
              </Line>

              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="faenaRealHours" 
                stroke={COLORS.realHrs} 
                name="Real Hrs" 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
              >
                <LabelList dataKey="faenaRealHours" position="top" style={{ fontSize: '8px', fontWeight: '900', fill: COLORS.realHrs }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={10} />
              </Line>

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla detallada del Producto */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Tabla de Datos y Desviación Diaria
        </h4>
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">AG: Destino</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Prog. Ton</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Real Ton</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Cumplimiento</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Meta Hrs</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Real Hrs</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Desviación (HH:MM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
              {tableRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">{row.formattedDate}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{row.destino}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{Math.round(row.tonProg).toLocaleString()} t</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-950">{Math.round(row.tonReal).toLocaleString()} t</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                      row.compliance >= 100 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : row.compliance >= 90 
                        ? 'bg-amber-50 text-amber-700' 
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {row.compliance.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-600">{formatDecimalToHHMM(row.metaHrs)}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-900 font-bold">{formatDecimalToHHMM(row.realHrs)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-mono font-black border ${row.deviationObj.colorClass}`}>
                      {row.deviationObj.text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CambioAnalisisProductoChart: React.FC<Props> = ({ allData, range, visibleProducts }) => {
  // Ordenar productos alfabéticamente
  const sortedProducts = useMemo(() => {
    return [...visibleProducts].sort();
  }, [visibleProducts]);

  // Agrupar y filtrar datos para cada uno de los productos que están activos
  const datasetByProduct = useMemo(() => {
    const map: Record<string, Array<RawChartData & { formattedDate: string }>> = {};
    
    sortedProducts.forEach(prodName => {
      const filtered = allData
        .filter(item => {
          const matchesProduct = item.producto === prodName;
          const inRange = (!range.start || !range.end) || (item.dateKey >= range.start && item.dateKey <= range.end);
          return matchesProduct && inRange;
        })
        .map(item => ({
          ...item,
          formattedDate: formatDate(item.dateKey)
        }))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        
      if (filtered.length > 0) {
        map[prodName] = filtered;
      }
    });
    
    return map;
  }, [allData, sortedProducts, range]);

  if (sortedProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between border-b border-violeta/10 pb-4">
        <div>
          <h2 className="text-xl font-black text-violeta tracking-tight">
            Análisis Desglosado por Producto
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Visualización individual de tendencias de producción y tiempos de operación por cada producto activo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {sortedProducts.map(productName => {
          const productData = datasetByProduct[productName];
          if (!productData || productData.length === 0) {
            return (
              <div key={productName} className="bg-white p-6 rounded-[2.5rem] border border-violeta/10 shadow-sm flex flex-col items-center justify-center min-h-[150px] text-slate-400 italic text-xs">
                <div>No hay registros diarios filtrados para <span className="font-bold text-violeta">{productName}</span> en el rango actual.</div>
              </div>
            );
          }
          return (
            <ProductIndividualCard 
              key={productName} 
              productName={productName} 
              data={productData} 
            />
          );
        })}
      </div>
    </div>
  );
};

export default CambioAnalisisProductoChart;
