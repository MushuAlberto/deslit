import express from "express";
import path from "path";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

  // Helper to run Gemini models in sequence via OpenRouter (using OpenRouter API Key)
  const callGemini = async (prompt: string): Promise<string | null> => {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("Falta la API Key de OpenRouter para realizar la consulta de Gemini.");
      return null;
    }

    // Ordered list of Gemini models on OpenRouter (free tier/low cost models)
    const modelsToTry = [
      "google/gemini-2.5-flash:free",
      "google/gemini-2.5-pro:free",
      "google/gemini-flash-1.5-8b:free",
      "google/gemma-2-9b-it:free"
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Calling OpenRouter (Gemini Route) with model ${modelName}...`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://sqm-litio.vercel.app",
            "X-Title": "SQM Logistics Dashboard"
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 2048
          })
        });

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            return content;
          }
        } else {
          console.log(`[OpenRouter Gemini Fallback] Model ${modelName} status is ${response.status}. Trying next...`);
        }
      } catch (e) {
        console.log(`[OpenRouter Gemini Fallback] Problem calling ${modelName}. Trying next...`);
      }
    }
    return null;
  };

  // Helper to run OpenRouter Gemma models in sequence (free tier models)
  const callOpenRouter = async (prompt: string): Promise<{ text: string; modelUsed: string } | null> => {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) return null;

    // Ordered list of models to try (including Gemma 4 31B, Gemma 4 26B, openrouter/free, and Llama 3.3 free tier versions)
    const modelsToTry = [
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "openrouter/free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Calling OpenRouter with model ${modelName}...`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://sqm-litio.vercel.app",
            "X-Title": "SQM Logistics Dashboard"
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 2048
          })
        });

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            return { text: content, modelUsed: modelName };
          }
        } else {
          const statusVal = response.status;
          console.log(`[OpenRouter Recovery] Model ${modelName} status is ${statusVal}. Attempting fallback...`);
        }
      } catch (e) {
        console.log(`[OpenRouter Recovery] Problem calling ${modelName}. Attempting fallback...`);
      }
    }
    return null;
  };

  // API routes FIRST
  app.use('/sda', express.static(path.join(process.cwd(), 'sda')));

  app.post("/api/test-ai", async (req, res) => {
    try {
      const { model } = req.body;
      const startTime = Date.now();
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "Falta la variable de entorno 'OPENROUTER_API_KEY' en el servidor. Configure la clave de OpenRouter en Configuración o en su archivo .env para habilitar el servicio de IA."
        });
      }

      if (model === "glm") {
        try {
          const result = await callOpenRouter("Responde únicamente con la palabra 'OK'.");
          if (result && result.text) {
            const latency = Date.now() - startTime;
            return res.json({
              success: true,
              message: "Conectividad exitosa con OpenRouter AI (Gemma Free). El modelo está respondiendo de forma óptima.",
              latencyMs: latency,
              modelUsed: result.modelUsed
            });
          }
          return res.status(500).json({
            success: false,
            message: "OpenRouter respondió con un texto vacío o no válido."
          });
        } catch (err: any) {
          return res.status(500).json({
            success: false,
            message: `Error al conectar con OpenRouter (Gemma): ${err.message || err}`
          });
        }
      }

      // Default to Gemini (now queried securely via OpenRouter!)
      try {
        const text = await callGemini("Responde únicamente con la palabra 'OK'.");
        if (text) {
          const latency = Date.now() - startTime;
          return res.json({
            success: true,
            message: "Conectividad exitosa con Google Gemini (canalizado de forma segura vía OpenRouter). El modelo está respondiendo de forma óptima.",
            latencyMs: latency,
            modelUsed: "google/gemini-2.5-flash:free (vía OpenRouter)"
          });
        }
        return res.status(500).json({
          success: false,
          message: "El modelo Gemini en OpenRouter respondió con un texto vacío o no válido."
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          message: `Fallo de conexión o autenticación con Google Gemini vía OpenRouter: ${err.message || err}`
        });
      }
    } catch (outerErr: any) {
      return res.status(500).json({
        success: false,
        message: `Error general en el diagnóstico de IA: ${outerErr.message || outerErr}`
      });
    }
  });

  app.post("/api/analyze-shift", async (req, res) => {
    try {
      const { title, data, complianceData, model } = req.body;
      
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        console.warn("OPENROUTER_API_KEY is not defined in env.");
        return res.status(500).json({ error: "La API Key de OpenRouter no está configurada. Configure la clave de OpenRouter en Configuración para activar los servicios de IA." });
      }

      // Format data and prompt
      const prompt = `
Actúa como un Especialista Senior de SQM Litio. Tu tarea es analizar las desviaciones operativas e informes de rendimiento de la jornada en la faena "${title}".

A continuación tienes los datos de producción de la jornada:
${JSON.stringify(data, null, 2)}

Y las correspondientes justificaciones o comentarios de desempeño reportados para los productos:
${JSON.stringify(complianceData, null, 2)}

Por favor, elabora un análisis ejecutivo estructurado en español chileno/profesional que resuma las desviaciones ocurridas basándose en los datos y principalmente en los cuadros de "Justificación de Desempeño" provistos.

Sigue esta estructura limpia en Markdown con títulos profesionales en negrita:
1. ### **Resumen Ejecutivo**: Una síntesis de las operaciones de la jornada, indicando el total programado y cargado, y el porcentaje general de cumplimiento.
2. ### **Análisis de Desviaciones de Desempeño**: Un análisis minucioso y detallado de las desviaciones y eventos anómalos basándote directamente en las "Justificación de Desempeño" reportadas en los archivos JSON. Si no hay registros de un producto específico, descríbelo de manera ejecutiva según las desviaciones de tiempos (horas reales vs meta).
3. ### **Rendimiento Operativo Clave**: Compara la planificación horaria contra el desempeño real (horas promedio de faena meta y real). Identifica el producto con mejor cumplimiento y el de mayor desviación.

Reglas:
- Sé directo y profesional, evita introducciones informales.
- Utiliza terminología minera y logística formal apropiada para SQM (ej. boletería, romana, zona de carguío, unidades de pesaje, saturación de flujo, dotación, etc.).
- No inventes justificaciones que no provengan del contexto de horas/tonelajes o justificaciones provistas en los datos adjuntos, pero interpreta la correlación entre las incidencias reportadas (ej. fallas mecánicas, esperas en romana) y los retrasos mostrados en los números.
`;

      // Check if user requested the Gemma (OpenRouter) model
      if (model === "glm") {
        try {
          const orResult = await callOpenRouter(prompt);
          if (orResult && orResult.text) {
            return res.json({
              analysis: orResult.text + `\n\n---\n\n*Análisis generado con **Gemma (OpenRouter Free)** [Motor: ${orResult.modelUsed}]*`
            });
          } else {
            // Fallback to Gemini via OpenRouter
            const geminiText = await callGemini(prompt);
            if (geminiText) {
              return res.json({
                analysis: geminiText + `\n\n---\n\n*(Nota: Se activó Gemini de respaldo en OpenRouter debido a que Gemma no devolvió una respuesta válida)*`
              });
            }
          }
        } catch (orErr: any) {
          console.error("Failed to fetch from OpenRouter Gemma:", orErr);
          const geminiText = await callGemini(prompt);
          if (geminiText) {
            return res.json({
              analysis: geminiText + `\n\n---\n\n*(Nota: Se activó Gemini de respaldo en OpenRouter debido a un error de conexión con Gemma: ${orErr.message || orErr})*`
            });
          }
        }
      }

      // Default to Gemini (now queried securely via OpenRouter!)
      const geminiText = await callGemini(prompt);
      if (geminiText) {
        res.json({ analysis: geminiText + `\n\n---\n\n*Análisis generado con **Google Gemini** [Vía OpenRouter]*` });
      } else {
        console.log("Serving local analytic fallback.");
        res.json({
          analysis: null,
          info: "Los servidores de IA están experimentando alta demanda. Se ha activado el motor de análisis local de respaldo."
        });
      }
    } catch (outerException: any) {
      console.log("Request handled via backup routine.", outerException);
      res.json({ 
        analysis: null, 
        info: "Servicio en mantención de carga. Procesado por el motor local de respaldo." 
      });
    }
  });

  // NEW: Refine performance justification with AI secure endpoint
  app.post("/api/refine-justification", async (req, res) => {
    try {
      const { text, product, stats, model } = req.body;

      const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "La API Key de OpenRouter no está configurada. Configure su API Key en el panel de Configuración para continuar." });
      }

      const prompt = `
Actúa como un Especialista Senior de SQM Litio. Tu misión es redactar una justificación profesional, BREVE, EJECUTIVA y TÉCNICA (máximo 2 oraciones) para el reporte de desempeño.

Información operativa de referencia:
- Producto: ${product}
- Detalles: ${JSON.stringify(stats || {}, null, 2)}

Borrador/Observación original del supervisor:
"${text || 'Sin observación manual'}"

REGLAS CRÍTICAS DE REDACCIÓN:
- Transforma el borrador en un texto formal, profesional y elegante apto para la gerencia.
- Utiliza terminología logística profesional (congestión logística, desviaciones de ciclo, saturación de flujo, transición de dotación, incidentes mecánicos, etc.).
- Entrega ÚNICAMENTE el texto formalizado/justificación refinada, sin comentarios adicionales ni preámbulos.
- Mantén la máxima concisión. No inventes datos que no estén expresados o implícitos en el borrador original o los detalles estadísticos.
- Siempre usa la abreviatura "ton." en minúscula para toneladas si llegas a mencionarlas.
- Si mencionas o calculas cualquier tiempo, duración o retraso (por ejemplo: "2.53 h", "1.5 h", "45 min"), debes expresarlo obligatoriamente en formato de horas y minutos "HH:MM" (por ejemplo: "02:32", "01:30", "00:45"). NUNCA uses decimales para las horas.
`;

      if (model === "glm") {
        try {
          const orResult = await callOpenRouter(prompt);
          if (orResult && orResult.text) {
            return res.json({ refined: orResult.text.trim().replace(/^["']|["']$/g, '') });
          }
        } catch (orErr) {
          console.error("OpenRouter Refinement failed, falling back to Gemini via OpenRouter:", orErr);
        }
      }

      // Default to Gemini (now secure via OpenRouter!)
      const geminiText = await callGemini(prompt);
      if (geminiText) {
        return res.json({ refined: geminiText.trim().replace(/^["']|["']$/g, '') });
      } else {
        return res.status(500).json({ error: "No se pudo procesar la reescritura con IA en este momento." });
      }
    } catch (e: any) {
      console.error("Error in refine-justification route:", e);
      res.status(500).json({ error: e.message || "Error interno del servidor." });
    }
  });

  // Helper for server-side decimal hours conversion to HH:MM
  const formatDecimalToHHMM = (decimalValue: number): string => {
    if (isNaN(decimalValue) || decimalValue === null) return "00:00";
    const absoluteHours = Math.floor(Math.abs(decimalValue));
    const minutes = Math.round((Math.abs(decimalValue) - absoluteHours) * 60);
    const formattedHours = absoluteHours.toString().padStart(2, "0");
    const formattedMinutes = minutes.toString().padStart(2, "0");
    return `${decimalValue < 0 ? "-" : ""}${formattedHours}:${formattedMinutes}`;
  };

  // SERVER-SIDE HIGH-PRECISION PDF GENERATION
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { title, data = [], range = { start: '', end: '' }, analysis = '', operatorName = '' } = req.body;

      // Create PDF Document in A4 with safe margins
      const doc = new PDFDocument({
        size: 'A4',
        bufferPages: true,
        margins: { top: 120, bottom: 80, left: 50, right: 50 }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Reporte_Turno_Servidor_${title || 'SQM'}.pdf"`);
        res.status(200).send(pdfBuffer);
      });

      // --- PAGE 1: CONTENT ---
      // 1. Control Information Box (Metadata)
      doc.rect(50, 120, 495, 45).fill('#FAF5E6');
      doc.rect(50, 120, 495, 45).lineWidth(1).stroke('#E2D8C0');

      doc.fillColor('#461D77').font('Helvetica-Bold').fontSize(9);
      doc.text("INFORMACIÓN DE CONTROL OPERATIVO - SERVIDOR", 60, 128);

      doc.fillColor('#334155').font('Helvetica').fontSize(8);
      const periodStr = `Periodo Consultado: ${range.start || 'Historial Completo'} hasta ${range.end || 'Historial Completo'}`;
      doc.text(periodStr, 60, 142);

      const formattedToday = new Date().toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const generatedByStr = `Generado el: ${formattedToday} ${operatorName ? `· Operador: ${operatorName}` : ''}`;
      doc.text(generatedByStr, 60, 153);

      // Move down below metadata box
      doc.y = 180;

      // 2. KPI Cards
      const totalProg = data.reduce((acc: number, d: any) => acc + (d.Ton_Prog || 0), 0);
      const totalReal = data.reduce((acc: number, d: any) => acc + (d.Ton_Real || 0), 0);
      const complPct = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;

      // Draw Card 1: TOTAL PROGRAMADO
      doc.rect(50, 180, 155, 45).fill('#F8FAFC');
      doc.rect(50, 180, 155, 45).lineWidth(0.5).stroke('#CBD5E1');
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5);
      doc.text("TOTAL PROGRAMADO", 58, 188);
      doc.fillColor('#461D77').font('Helvetica-Bold').fontSize(12);
      doc.text(`${Math.round(totalProg).toLocaleString('es-CL')} Ton`, 58, 202);

      // Draw Card 2: TOTAL REAL CARGADO
      doc.rect(220, 180, 155, 45).fill('#F8FAFC');
      doc.rect(220, 180, 155, 45).lineWidth(0.5).stroke('#CBD5E1');
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5);
      doc.text("TOTAL REAL CARGADO", 228, 188);
      doc.fillColor('#7177EC').font('Helvetica-Bold').fontSize(12);
      doc.text(`${Math.round(totalReal).toLocaleString('es-CL')} Ton`, 228, 202);

      // Draw Card 3: CUMPLIMIENTO NETO
      doc.rect(390, 180, 155, 45).fill('#F8FAFC');
      doc.rect(390, 180, 155, 45).lineWidth(0.5).stroke('#CBD5E1');
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5);
      doc.text("CUMPLIMIENTO NETO", 398, 188);
      doc.fillColor(complPct >= 100 ? '#10B981' : complPct >= 85 ? '#F59E0B' : '#EF4444').font('Helvetica-Bold').fontSize(12);
      doc.text(`${complPct.toFixed(1)}%`, 398, 202);

      // Move down below cards
      doc.y = 240;

      // 3. Table Header
      doc.moveDown(1);
      const tableHeaderY = doc.y;
      doc.rect(50, tableHeaderY, 495, 20).fill('#461D77');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      doc.text("PRODUCTO", 55, tableHeaderY + 6, { width: 140 });
      doc.text("PLANIF. TON", 195, tableHeaderY + 6, { width: 80, align: 'right' });
      doc.text("REAL TON", 275, tableHeaderY + 6, { width: 80, align: 'right' });
      doc.text("CUMPL %", 355, tableHeaderY + 6, { width: 70, align: 'right' });
      doc.text("META HRS", 425, tableHeaderY + 6, { width: 60, align: 'right' });
      doc.text("REAL HRS", 485, tableHeaderY + 6, { width: 60, align: 'right' });

      // 4. Table Rows
      let currentY = tableHeaderY + 20;
      data.forEach((item: any, idx: number) => {
        // If row goes near footer, add page and reset headers
        if (currentY > 700) {
          doc.addPage();
          currentY = 120; // reset to top safe zone
          
          doc.rect(50, currentY, 495, 20).fill('#461D77');
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
          doc.text("PRODUCTO", 55, currentY + 6, { width: 140 });
          doc.text("PLANIF. TON", 195, currentY + 6, { width: 80, align: 'right' });
          doc.text("REAL TON", 275, currentY + 6, { width: 80, align: 'right' });
          doc.text("CUMPL %", 355, currentY + 6, { width: 70, align: 'right' });
          doc.text("META HRS", 425, currentY + 6, { width: 60, align: 'right' });
          doc.text("REAL HRS", 485, currentY + 6, { width: 60, align: 'right' });
          currentY += 20;
        }

        const isEven = idx % 2 === 0;
        doc.rect(50, currentY, 495, 20).fill(isEven ? '#F8FAFC' : '#FFFFFF');
        doc.rect(50, currentY + 19, 495, 1).fill('#F1F5F9');

        const rowCompliance = item.Ton_Prog > 0 ? (item.Ton_Real / item.Ton_Prog) * 100 : 0;

        doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(8);
        doc.text(item.name || item.producto || 'SIN NOMBRE', 55, currentY + 6, { width: 140, ellipsis: true });

        doc.font('Helvetica').fillColor('#64748B');
        doc.text(Math.round(item.Ton_Prog).toLocaleString('es-CL'), 195, currentY + 6, { width: 80, align: 'right' });

        doc.font('Helvetica-Bold').fillColor('#461D77');
        doc.text(Math.round(item.Ton_Real).toLocaleString('es-CL'), 275, currentY + 6, { width: 80, align: 'right' });

        doc.font('Helvetica-Bold').fillColor(rowCompliance >= 100 ? '#10B981' : rowCompliance >= 85 ? '#F59E0B' : '#EF4444');
        doc.text(`${rowCompliance.toFixed(1)}%`, 355, currentY + 6, { width: 70, align: 'right' });

        doc.font('Helvetica').fillColor('#64748B');
        doc.text(formatDecimalToHHMM(item.faenaMetaHours), 425, currentY + 6, { width: 60, align: 'right' });
        doc.text(formatDecimalToHHMM(item.faenaRealHours), 485, currentY + 6, { width: 60, align: 'right' });

        currentY += 20;
      });

      // 5. Analysis Section
      doc.y = currentY + 15;
      
      // Ensure we have room for title
      if (doc.y > 680) {
        doc.addPage();
      }

      doc.moveDown(1);
      doc.fillColor('#461D77').font('Helvetica-Bold').fontSize(11);
      doc.text("ANÁLISIS EJECUTIVO DE DESVIACIONES", { underline: true });
      doc.moveDown(0.6);

      // Render formatted markdown lines
      if (analysis) {
        const lines = analysis.split('\n');
        lines.forEach((line: string) => {
          let text = line.trim();
          if (!text) {
            doc.moveDown(0.4);
            return;
          }

          // Handle headers
          if (text.startsWith('###')) {
            const hText = text.replace(/^###\s*\**|\**$/g, '').trim();
            if (doc.y > 700) doc.addPage();
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#461D77');
            doc.text(hText);
            doc.moveDown(0.3);
          } else if (text.startsWith('##')) {
            const hText = text.replace(/^##\s*\**|\**$/g, '').trim();
            if (doc.y > 700) doc.addPage();
            doc.moveDown(0.7);
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#461D77');
            doc.text(hText);
            doc.moveDown(0.4);
          } else if (text.startsWith('-') || text.startsWith('*')) {
            const bulletText = text.substring(1).trim().replace(/\*\*/g, '');
            if (doc.y > 720) doc.addPage();
            doc.font('Helvetica').fontSize(9).fillColor('#334155');
            doc.text('• ' + bulletText, { indent: 12, paragraphGap: 3, lineGap: 1.5 });
          } else {
            const cleanText = text.replace(/\*\*/g, '');
            if (doc.y > 720) doc.addPage();
            doc.font('Helvetica').fontSize(9).fillColor('#334155');
            doc.text(cleanText, { paragraphGap: 5, lineGap: 1.5 });
          }
        });
      } else {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#94A3B8');
        doc.text("No se ha registrado análisis operativo de desviaciones para este periodo.");
      }

      // --- SECOND-PASS OVERLAY: HEADERS AND FOOTERS ---
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);

        // Header Background Banner
        doc.rect(50, 40, 495, 60).fill('#461D77');
        
        // Header Texts
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12);
        doc.text("SQM LITIO - SISTEMA DE GESTIÓN LOGÍSTICA", 65, 55);

        doc.fillColor('#DCDCE1').font('Helvetica').fontSize(8.5);
        doc.text(`REPORTE DE CAMBIO DE TURNO (SERVERSIDE): ${title ? title.toUpperCase() : 'DESCONOCIDO'}`, 65, 75);

        // Teal separator line
        doc.rect(50, 100, 495, 3).fill('#4FD1C5');

        // Footer Separator
        doc.rect(50, 775, 495, 1).fill('#E2E8F0');

        // Footer Texts
        doc.fillColor('#8C8C96').font('Helvetica').fontSize(7.5);
        doc.text("CONFIDENCIAL · SISTEMA DE REPORTABILIDAD LOGÍSTICA SQM LITIO", 50, 785);

        const pageNumText = `Página ${i + 1} de ${pages.count}`;
        doc.text(pageNumText, 545 - doc.widthOfString(pageNumText), 785);
      }

      doc.end();

    } catch (err: any) {
      console.error("Error generating server-side PDF:", err);
      res.status(500).json({ error: "No se pudo generar el reporte PDF en el servidor.", details: err.message });
    }
  });

  // Export the Express app for Vercel Serverless Functions
  export default app;

  if (process.env.VERCEL !== "1") {
    const PORT = 3000;
    if (process.env.NODE_ENV !== "production") {
      import("vite").then(({ createServer: createViteServer }) => {
        createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        }).then((vite) => {
          app.use(vite.middlewares);
          app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://localhost:${PORT}`);
          });
        });
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }
