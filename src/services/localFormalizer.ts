
/**
 * Motor de formalización avanzada para SQM Litio.
 * Implementa el Protocolo de Redacción para Justificaciones Técnicas con control de redundancia.
 */

// Mapeos técnicos de alta prioridad (Frases largas primero para evitar residuos)
const TECHNICAL_MAPPINGS: Record<string, string> = {
    // Casos de redundancia geográfica/pesaje
    "romanas de pesaje": "unidades de pesaje",
    "romana de pesaje": "unidad de pesaje",
    "romanas": "unidades de pesaje",
    "romana": "zona de pesaje",
    "pesaje de pesaje": "pesaje",

    // Tiempos y Desviaciones
    "se demoró mucho": "ejecución con desfase respecto al cronograma",
    "demoró mucho": "desviación en tiempos de ciclo",
    "tardó": "presentó latencia operativa",
    "no llegamos a la meta": "impactando el cumplimiento del programa diario",
    "no se cumplió": "desviación respecto al objetivo",
    "sobre el limite": "excedente sobre el parámetro operativo",
    "tiempo de estadia": "tiempo de permanencia",

    // Operación y Causa Raíz
    "detencion de carga": "interrupción del ciclo de carguío",
    "parada de carga": "cese temporal de alimentación",
    "mucha fila": "congestión en zona operativa",
    "taco": "saturación de flujo",
    "atochamiento": "saturación de flujo operativo",
    "chofer": "operador de transporte",
    "no encontraba los papeles": "retraso administrativo en validación documental",
    "problema de papeles": "incidencia en gestión documental",
    "cambio de turno": "transición de dotación en etapa de relevo",
    "ingreso a turno": "transición de dotación en etapa de relevo",
    "equipo malo": "activo fuera de servicio por desviación técnica",
    "equipos": "unidades de transporte",
    "llegada masiva": "concurrencia simultánea de activos",
    "está malo": "condición de inoperatividad",
    "problemas de sistema": "incidencias técnicas en plataforma",
    "lluvia": "evento meteorológico",
    "viaje": "ciclo de transporte",
    "camion": "unidad de carga",
    "parado": "inoperatividad técnica",
    "falta gente": "déficit de dotación operativa",

    // Acrónimos SQM
    "slit": "Salmuera de Litio",
    "lsi (s)": "Sulfato de litio",
    "tpo sda": "Tiempo Salar de Atacama",
    "cf": "Cargador Frontal",
    "cs": "Coya Sur",
};

// Conectores causales para rotación (evitar repetición de "debido a")
const CAUSAL_CONNECTORS = [
    "originado por",
    "derivado de",
    "consecuencia de",
    "motivado por",
    "asociado a"
];

// Palabras que ya implican causalidad para evitar duplicación
const PREEXISTING_CAUSAL_VERBS = ["causado", "causada", "debido", "motivado", "generado", "producido"];

const SUBJECTIVE_FILLERS = [
    "creo que", "me parece que", "tuvimos mala suerte", "la verdad",
    "bueno", "un poco", "mas o menos", "como que", "o sea", "pasa que",
    "sucede que", "el tema es que", "basicamente"
];

/**
 * Formaliza el texto evitando redundancias de conectores y términos técnicos.
 */
export const formalizeLocally = (text: string, productName?: string): string => {
    if (!text || text.length < 2) return text;

    let formalized = text.toLowerCase();

    // 1. Limpieza de subjetividad
    SUBJECTIVE_FILLERS.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        formalized = formalized.replace(regex, '');
    });

    // 2. Mitigación de redundancia de producto
    if (productName) {
        const productRegex = new RegExp(`\\b${productName.toLowerCase()}\\b`, 'gi');
        formalized = formalized.replace(productRegex, 'producto');
    }

    // 3. Aplicación de mapeos técnicos (Ordenados por longitud descendente)
    const sortedKeys = Object.keys(TECHNICAL_MAPPINGS).sort((a, b) => b.length - a.length);
    sortedKeys.forEach(colloquial => {
        const technical = TECHNICAL_MAPPINGS[colloquial];
        const regex = new RegExp(colloquial, 'gi');
        formalized = formalized.replace(regex, technical);
    });

    // 4. Transformación inteligente de conectores
    let connectorIndex = 0;
    formalized = formalized.replace(/\bpor\b/gi, (match, offset) => {
        // Obtener la palabra anterior
        const wordsBefore = formalized.substring(0, offset).trim().split(' ');
        const lastWord = wordsBefore[wordsBefore.length - 1];

        // Si la palabra anterior ya es un verbo causal, no añadir conector nuevo, solo mantener el flujo
        if (PREEXISTING_CAUSAL_VERBS.includes(lastWord)) {
            return "a"; // "causado por" -> "causado a" (se ajustará en limpieza) o simplemente dejar el match si es necesario
        }

        if (offset === 0 || formalized.substring(0, offset).trim().length === 0) return "debido a";

        const connector = CAUSAL_CONNECTORS[connectorIndex % CAUSAL_CONNECTORS.length];
        connectorIndex++;
        return connector;
    });

    // 5. Ajustes de sintaxis y conectores lógicos
    formalized = formalized
        .replace(/\bporque\b/gi, 'derivado de')
        .replace(/\bpor eso\b/gi, 'consecuentemente')
        .replace(/\by el\b/gi, 'sumado al')
        .replace(/\by la\b/gi, 'sumado a la')
        .replace(/\bcon otros\b/gi, 'por concurrencia de');

    // 6. Limpieza de puntuación y espacios
    formalized = formalized
        .replace(/\s+/g, ' ')
        .replace(/ ,/g, ',')
        .replace(/ \./g, '.')
        .trim();

    if (formalized.length === 0) return text;

    // 7. Estructura Final (Capitalización y Prefijos)
    let finalResult = formalized.charAt(0).toUpperCase() + formalized.slice(1);

    const technicalStarts = /^(Excedente|Desviación|Incidencia|Déficit|Saturación|Incremento|Debido|Durante|Derivado|Tiempos|Se)/i;

    if (!finalResult.match(technicalStarts)) {
        const prefixes = ["Se registra ", "Se identifica ", "Se constata "];
        const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        finalResult = randomPrefix + finalResult.charAt(0).toLowerCase() + finalResult.slice(1);
    }

    // 8. Limpieza profunda de redundancias (Post-procesamiento)
    finalResult = finalResult
        // Corregir duplicados de conectores
        .replace(/(causado|motivado|generado)\s+(originado por|derivado de|debido a)/gi, '$1 por')
        .replace(/debido a\s+debido a/gi, 'debido a')
        // Corregir residuos de plurales en zona de pesaje
        .replace(/zona de pesaje\(romana\)s/gi, 'unidades de pesaje')
        .replace(/zona de pesaje\s+de pesaje/gi, 'zona de pesaje')
        .replace(/unidades de pesaje\s+de pesaje/gi, 'unidades de pesaje')
        // Asegurar puntos
        .trim();

    if (!finalResult.endsWith('.')) {
        finalResult += ".";
    }

    return finalResult;
};
