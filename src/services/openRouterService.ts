/**
 * Servicio simplificado para integración exclusiva con OpenRouter AI.
 * Utiliza el modelo NVIDIA Nemotron (free) para redacción ejecutiva y técnica.
 */

const getEnvVar = (key: string): string => {
    try {
        return (import.meta as any).env?.[key] || "";
    } catch {
        return "";
    }
};

// Clave de API (Se obtiene exclusivamente de variables de entorno por seguridad)
const API_KEY = getEnvVar("VITE_OPENROUTER_API_KEY");
// Permite cambiar el modelo desde Vercel usando VITE_OPENROUTER_MODEL. 
// Si no se configura, usa el modelo Gemma 4 31B por defecto.
const MODEL_ID = getEnvVar("VITE_OPENROUTER_MODEL") || "google/gemma-4-31b-it:free";

export const refineJustificationWithAI = async (text: string, product: string, stats?: any): Promise<string> => {
    if (!API_KEY) {
        console.error("DEBUG: Falta VITE_OPENROUTER_API_KEY en las variables de entorno");
        throw new Error("ERROR_CONFIG_API: La API Key no está configurada en Vercel.");
    }

    console.log(`DEBUG: Iniciando formalización con modelo: ${MODEL_ID}`);
    
    // Construcción del contexto estadístico para la IA
    const statsContext = stats ? `
ESTADÍSTICAS OPERATIVAS:
- Producto: ${product}
- Cumplimiento: ${stats.compliance?.toFixed(1)}%
- Tonelaje: ${stats.tonReal?.toLocaleString()} Real vs ${stats.tonProg?.toLocaleString()} Programado
- Desv. Tiempos: ${stats.avgFaenaReal > stats.avgFaenaMeta ? 'Retraso detectado' : 'Sin cambios significativos'}
`.trim() : "";

    const isGeneration = !text || text.trim().length === 0;

    const prompt = `
Actúa como un Especialista Senior en Supply Chain y Logística de SQM Litio. 
Tu misión es redactar una justificación profesional, BREVE y EJECUTIVA (Máximo 2 oraciones).

${isGeneration ? `
INSTRUCCIÓN: No hay observación manual. Redacta una breve justificación técnica basada en:
${statsContext}
Utiliza terminología logística profesional (congestión logística, demoras operativas, transición de turnos, incidencias mecánicas).
` : `
INSTRUCCIÓN: Refina y profesionaliza esta observación: "${text}"
Contexto técnico para tu referencia (NO lo repitas en el texto): ${statsContext}
`}

REGLAS CRÍTICAS:
- Entrega SOLO el texto de la justificación.
- NO repitas valores numéricos (toneladas exactas, porcentajes de cumplimiento o minutos) que ya están en las estadísticas.
- NO añadas conclusiones extra, interpretaciones o juicios de valor (ej: "falta de coordinación", "ineficiencia", "causa raíz") que no estén explícitamente en la observación original.
- Limítate a profesionalizar el lenguaje de los hechos entregados por el usuario sin agregar narrativa adicional.
- Mantén un tono ejecutivo de alto nivel y máxima brevedad.
- Siempre usa la abreviatura "ton." en minúscula para toneladas (si llegas a mencionarlas).
- NO menciones ningún destino, locación externa, ni el nombre del cliente en el reporte.
`.trim();

    const modelsToTry = Array.from(new Set([
        MODEL_ID,
        "google/gemma-4-26b-a4b-it:free",
        "openrouter/free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    ]));

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            console.log(`[OpenRouter Client] Calling model: ${currentModel}`);
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": typeof window !== 'undefined' ? window.location.origin : 'https://sqm-litio.vercel.app',
                    "X-Title": "SQM Logistics Dashboard",
                },
                body: JSON.stringify({
                    "model": currentModel,
                    "messages": [
                        { "role": "system", "content": "Eres un redactor técnico experto en logística minera." },
                        { "role": "user", "content": prompt }
                    ],
                    "temperature": 0.5,
                    "max_tokens": 100
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.log(`[OpenRouter Recovery] Model ${currentModel} returned status ${response.status}. Attempting next...`);
                
                if (response.status === 429) lastError = new Error("Servidor saturado, reintenta en 10 seg.");
                else if (response.status === 401) lastError = new Error("Clave de API no válida o expirada.");
                else if (response.status === 402) lastError = new Error("Créditos insuficientes en OpenRouter.");
                else if (response.status >= 500) lastError = new Error("Error del proveedor, intenta en un momento.");
                else lastError = new Error(errorData.error?.message || `Error ${response.status}: Servicio no disponible.`);
                
                continue;
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content?.trim();
            
            if (!result) {
                lastError = new Error("Respuesta de IA vacía");
                continue;
            }

            console.log(`[OpenRouter Client] Success with model: ${currentModel}`);
            return result.replace(/^["']|["']$/g, '');
        } catch (error: any) {
            console.log(`[OpenRouter Recovery] Problem calling ${currentModel}. Attempting next...`);
            lastError = error;
        }
    }

    throw lastError || new Error("Todos los intentos con OpenRouter fallaron.");
};
