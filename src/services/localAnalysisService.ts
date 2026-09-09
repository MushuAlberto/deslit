import { formatDecimalToHHMM } from '../components/CambioAnalisisComparativoChart';

interface AnalysisData {
  name: string;
  producto: string;
  Ton_Prog: number;
  Ton_Real: number;
  faenaMetaHours: number;
  faenaRealHours: number;
}

interface ExtractedJustification {
  fechaKey: string;       // Formato YYYY-MM-DD para filtrado
  fechaFormateada: string; // Formato DD/MM/YYYY para visualización
  producto: string;       // Nombre del producto normalizado en mayúsculas
  justificacion: string;  // El texto de la justificación
}

/**
 * Extrae de forma robusta las justificaciones de cualquier estructura de complianceData recibida,
 * incluyendo archivos JSON planos de respaldo (con claves sqm_justification_...) y registros estructurados.
 */
function extractJustifications(complianceData: any[]): ExtractedJustification[] {
  const list: ExtractedJustification[] = [];

  const addRecord = (dateRaw: string, productRaw: string, text: string) => {
    if (!text || !text.trim()) return;
    const cleanProduct = String(productRaw || '').trim().toUpperCase();
    
    // Normalizar fecha a YYYY-MM-DD y obtener versión formateada DD/MM/YYYY
    let fechaKey = String(dateRaw || '').trim();
    let fechaFormateada = fechaKey;

    if (fechaKey.includes('/') || (fechaKey.includes('-') && fechaKey.split('-')[0].length !== 4)) {
      const parts = fechaKey.split(/[/-]/);
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        fechaKey = `${y}-${m}-${d}`;
        fechaFormateada = `${d}/${m}/${y}`;
      }
    } else if (fechaKey.includes('-') && fechaKey.split('-')[0].length === 4) {
      const [y, m, d] = fechaKey.split('-');
      fechaFormateada = `${d}/${m}/${y}`;
    }

    list.push({
      fechaKey,
      fechaFormateada,
      producto: cleanProduct,
      justificacion: text.trim()
    });
  };

  const processItem = (item: any) => {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach(subItem => processItem(subItem));
      return;
    }

    if (typeof item !== 'object') return;

    // Detectar si es un objeto plano de respaldo que contiene claves sqm_
    let isBackup = false;
    for (const key of Object.keys(item)) {
      if (key.startsWith('sqm_')) {
        isBackup = true;
        break;
      }
    }

    if (isBackup) {
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string' && value.trim()) {
          // Coincidir con la estructura: sqm_justification_YYYY-MM-DD_PRODUCTNAME
          const match = key.match(/^sqm_justification_([0-9]{4}-[0-9]{2}-[0-9]{2})_(.+)$/);
          if (match) {
            const date = match[1];
            const product = match[2];
            addRecord(date, product, value);
          }
        }
      }
    } else {
      // Objeto estructurado de reporte o de incidencias
      const fecha = item.date || item.Fecha || item.fecha || "N/A";
      const producto = item.title || item.Producto || item.producto || "N/A";
      const justificacion = item.justificacion_desempeño || item["JUSTIFICACIÓN DE DESEMPEÑO"] || item.justificacion || item.comentarios || "";
      if (justificacion && justificacion.trim() !== "N/A" && justificacion.trim() !== "") {
        addRecord(fecha, producto, justificacion);
      }
    }
  };

  complianceData.forEach(item => {
    processItem(item);
  });

  // Eliminar duplicados exactos
  const seen = new Set<string>();
  const uniqueList: ExtractedJustification[] = [];
  for (const item of list) {
    const key = `${item.fechaKey}_${item.producto}_${item.justificacion}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueList.push(item);
    }
  }

  return uniqueList;
}

export async function analyzeProductData(
  title: string,
  data: AnalysisData[],
  onChunk: (text: string) => void,
  complianceData?: any[],
  range?: { start: string; end: string },
  model: 'gemini' | 'glm' = 'gemini'
): Promise<string> {
  if (!data || data.length === 0) {
    const emptyMsg = "No hay datos de producción disponibles para generar el análisis.";
    onChunk(emptyMsg);
    return emptyMsg;
  }

  // Compile unique active products
  const activeProducts = new Set(data.map(d => d.name.toUpperCase().trim()));

  // Extraer y filtrar justificaciones por rango de fecha y productos activos
  const cleanComplianceData = extractJustifications(complianceData || [])
    .filter(item => {
      // Filtrar por producto activo
      if (!activeProducts.has(item.producto)) return false;

      // Filtrar por rango de fecha si está definido
      if (range && range.start && range.end) {
        if (item.fechaKey && item.fechaKey !== "N/A") {
          return item.fechaKey >= range.start && item.fechaKey <= range.end;
        }
      }
      return true;
    })
    .map(item => ({
      fecha: item.fechaFormateada,
      producto: item.producto,
      justificacion: item.justificacion
    }))
    .slice(0, 10); // Permitir hasta 10 registros relevantes para enriquecer el análisis

  // Intenta utilizar la API de IA Gemini del Servidor Principal
  try {
    const response = await fetch("/api/analyze-shift", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        data,
        complianceData: cleanComplianceData, // Enviar los datos pre-procesados y limpios a Gemini
        model
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.analysis) {
        onChunk(result.analysis);
        return result.analysis;
      }
    } else {
      console.warn("La API del servidor falló o no devolvió resultados válidos. Activando análisis local determinista.");
    }
  } catch (error) {
    console.error("No se pudo conectar con el servicio de análisis de IA. Usando motor local de respaldo:", error);
  }

  // Simular retraso corto de procesamiento para mantener el dinamismo visual de la UI
  await new Promise((resolve) => setTimeout(resolve, 600));

  // 1. Cálculos
  const totalProg = data.reduce((acc, item) => acc + (item.Ton_Prog || 0), 0);
  const totalReal = data.reduce((acc, item) => acc + (item.Ton_Real || 0), 0);
  const pctCumplimiento = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;

  // Mejor producto (Ratio real vs programado)
  let bestProduct = data[0];
  let bestRatio = -1;
  // Producto con mayor desviación de tiempo
  let worstTimeDeviationDesc = "";
  let highestDeviation = -9999;
  let worstProduct: AnalysisData | null = null;

  for (const item of data) {
    const ratio = item.Ton_Prog > 0 ? item.Ton_Real / item.Ton_Prog : 1;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestProduct = item;
    }

    const dev = item.faenaRealHours - item.faenaMetaHours;
    if (dev > highestDeviation) {
      highestDeviation = dev;
      worstProduct = item;
    }
  }

  // Formatear horas locally
  const formatHHMM = (dec: number) => {
    if (isNaN(dec) || dec < 0) return "00:00";
    const hours = Math.floor(dec);
    const mins = Math.round((dec - hours) * 60);
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  // Construir texto markdown
  let text = `### Resumen Ejecutivo - ${title}\n\n`;
  text += `Durante el periodo seleccionado de la faena **${title}**, se planificó un total de **${Math.round(totalProg).toLocaleString()} Ton** de carga, alcanzando una ejecución de carga real de **${Math.round(totalReal).toLocaleString()} Ton** (que representa un **${pctCumplimiento.toFixed(1)}% de cumplimiento**).\n\n`;

  // Comentar sobre progreso / desviaciones
  if (pctCumplimiento >= 100) {
    text += `La operación superó la meta definida con un excelente flujo de carguío y tránsito libre en boleterías y pesajes.\n\n`;
  } else if (pctCumplimiento >= 90) {
    text += `Se registra un ritmo constante dentro de los límites aceptables de la tolerancia operativa ordinaria, alcanzando un progreso cercano al óptimo.\n\n`;
  } else {
    text += `Se evidencia una desviación operativa con un cumplimiento inferior a la meta programada. Se recomienda revisar tiempos de demora no identificados y cuellos de botella.\n\n`;
  }

  // 3. Sección de justificaciones
  text += `### Análisis de Justificaciones de Desempeño\n\n`;
  if (cleanComplianceData.length > 0) {
    text += `Se identificaron reportes y justificaciones registradas por supervisores para este periodo:\n\n`;
    cleanComplianceData.forEach(item => {
      text += `- **${item.fecha} - ${item.producto}**: "${item.justificacion}"\n`;
    });
    text += `\n`;
  } else {
    text += `No se encontraron justificaciones o retrasos anómalos declarados formalmente para los productos analizados en este intervalo. Por lo tanto, el flujo de tolvas y equipos en tránsito operó bajo condiciones estándar.\n\n`;
  }

  // 4. Rendimiento por productos
  text += `### Rendimiento General por Productos\n\n`;
  text += `- **Mejor rendimiento relativo**: **${bestProduct.name}** con un **${(bestRatio * 100).toFixed(1)}%** respecto a su programa (${Math.round(bestProduct.Ton_Real).toLocaleString()} Ton logradas).\n`;
  if (worstProduct && highestDeviation > 0.1) {
    text += `- **Mayor desviación de tiempo**: **${worstProduct.name}** con una demora de **+${formatHHMM(highestDeviation)} horas** adicionales respecto a la planificación estimada.\n\n`;
  } else {
    text += `- **Control de tiempos**: Todos los productos operaron en estrecho apego a las metas horarias estipuladas, sin desviaciones significativas en Romana ni esperas prolongadas en carguío.\n\n`;
  }

  // 5. Desglose de tiempos
  text += `### **Desglose Operativo de Tiempos (HH:MM)**\n\n`;
  for (const item of data) {
    const sign = item.faenaRealHours >= item.faenaMetaHours ? "Desvío" : "Ahorro";
    const diff = Math.abs(item.faenaRealHours - item.faenaMetaHours);
    let stateComment = "Operación eficiente y estable.";
    if (item.faenaRealHours > item.faenaMetaHours * 1.15) {
      stateComment = "Demoras críticas detectadas. Posible atochamiento en pesaje o Romana.";
    } else if (item.faenaRealHours > item.faenaMetaHours) {
      stateComment = "Retraso leve en tiempos de tránsito.";
    } else if (item.faenaRealHours < item.faenaMetaHours) {
      stateComment = "Optimización de ciclo de transporte y carguío rápido.";
    }

    text += `- **${item.name.toUpperCase()}**: Meta **${formatHHMM(item.faenaMetaHours)}** | Real **${formatHHMM(item.faenaRealHours)}** (${sign}: **${formatHHMM(diff)}** - *${stateComment}*)\n`;
  }
  text += `\n`;

  onChunk(text);
  return text;
}
