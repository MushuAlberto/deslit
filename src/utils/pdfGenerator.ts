import { jsPDF } from 'jspdf';

// Helper to format decimal hours to HH:MM
function formatDecimalToHHMM(decimalValue: number): string {
  if (isNaN(decimalValue) || decimalValue === null) return "00:00";
  const absoluteHours = Math.floor(Math.abs(decimalValue));
  const minutes = Math.round((Math.abs(decimalValue) - absoluteHours) * 60);
  const formattedHours = absoluteHours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");
  return `${decimalValue < 0 ? "-" : ""}${formattedHours}:${formattedMinutes}`;
}

export interface PDFReportData {
  title: string;          // e.g. "NOVANDINO" or "SQM N.Y."
  data: Array<{
    name: string;
    Ton_Prog: number;
    Ton_Real: number;
    faenaMetaHours: number;
    faenaRealHours: number;
  }>;
  range: {
    start: string;
    end: string;
  };
  analysis: string | null;
}

export function generateShiftReportPDF(report: PDFReportData) {
  // Initialize A4 document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageHeight = 297;
  const pageWidth = 210;
  const leftMargin = 15;
  const rightMargin = 15;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 180mm
  
  let currentY = 15;

  const drawHeader = (pageNum: number, totalPagesPlaceholder: string) => {
    // Top banner color
    doc.setFillColor(70, 29, 119); // SQM Nucleo purple (#461D77)
    doc.rect(leftMargin, 15, contentWidth, 24, 'F');

    // Header branding text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text("SQM LITIO - SISTEMA DE GESTIÓN LOGÍSTICA", leftMargin + 6, 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 225);
    doc.text(`REPORTE DE CAMBIO DE TURNO: ${report.title.toUpperCase()}`, leftMargin + 6, 31);

    // Decorative line
    doc.setDrawColor(79, 209, 197); // SQM Litio teal (#4FD1C5)
    doc.setLineWidth(1);
    doc.line(leftMargin, 39, leftMargin + contentWidth, 39);
  };

  const drawFooter = (pageNum: number) => {
    // Decorative line above footer
    doc.setDrawColor(230, 230, 235);
    doc.setLineWidth(0.5);
    doc.line(leftMargin, pageHeight - 18, leftMargin + contentWidth, pageHeight - 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 150);
    
    // Left footer text
    doc.text("CONFIDENCIAL - SQM LITIO", leftMargin, pageHeight - 12);
    
    // Right footer text (Page numbers)
    const pageStr = `Página ${pageNum}`;
    doc.text(pageStr, pageWidth - rightMargin - doc.getTextWidth(pageStr), pageHeight - 12);
  };

  const addPageIfNeeded = (requiredHeight: number) => {
    if (currentY + requiredHeight > pageHeight - 22) {
      drawFooter(doc.getNumberOfPages());
      doc.addPage();
      currentY = 46; // leave room below header
      drawHeader(doc.getNumberOfPages(), "");
    }
  };

  // --- PAGE 1 INIT ---
  drawHeader(1, "");
  currentY = 48;

  // Metadata Panel
  doc.setFillColor(250, 245, 230); // SQM Calido (#FAF5E6)
  doc.rect(leftMargin, currentY, contentWidth, 20, 'F');
  doc.setDrawColor(220, 210, 190);
  doc.setLineWidth(0.3);
  doc.rect(leftMargin, currentY, contentWidth, 20, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(70, 29, 119);
  doc.text(`INFORMACIÓN DE CONTROL OPERATIVO`, leftMargin + 6, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 65);
  doc.text(`Período Consultado: ${report.range.start || 'Historial Completo'} hasta ${report.range.end || 'Historial Completo'}`, leftMargin + 6, currentY + 12);
  
  const formattedToday = new Date().toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generado el: ${formattedToday}`, leftMargin + 6, currentY + 16);

  currentY += 26;

  // Metrics summary cards
  const totalProg = report.data.reduce((acc, d) => acc + d.Ton_Prog, 0);
  const totalReal = report.data.reduce((acc, d) => acc + d.Ton_Real, 0);
  const complPct = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;

  doc.setFillColor(245, 245, 250);
  doc.rect(leftMargin, currentY, 56, 15, 'F');
  doc.rect(leftMargin, currentY, 56, 15, 'S');
  doc.setTextColor(100, 100, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text("TOTAL PROGRAMADO", leftMargin + 4, currentY + 4);
  doc.setTextColor(70, 29, 119);
  doc.setFontSize(11);
  doc.text(`${Math.round(totalProg).toLocaleString()} Ton`, leftMargin + 4, currentY + 11);

  doc.setFillColor(245, 245, 250);
  doc.rect(leftMargin + 62, currentY, 56, 15, 'F');
  doc.rect(leftMargin + 62, currentY, 56, 15, 'S');
  doc.setTextColor(100, 100, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text("TOTAL REAL CARGADO", leftMargin + 62 + 4, currentY + 4);
  doc.setTextColor(113, 119, 236); // Violeta (#7177EC)
  doc.setFontSize(11);
  doc.text(`${Math.round(totalReal).toLocaleString()} Ton`, leftMargin + 62 + 4, currentY + 11);

  doc.setFillColor(245, 245, 250);
  doc.rect(leftMargin + 124, currentY, 56, 15, 'F');
  doc.rect(leftMargin + 124, currentY, 56, 15, 'S');
  doc.setTextColor(100, 100, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text("CUMPLIMIENTO NETO", leftMargin + 124 + 4, currentY + 4);
  doc.setTextColor(197, 158, 77); // Mineral (#C59E4D)
  doc.setFontSize(11);
  doc.text(`${complPct.toFixed(1)}%`, leftMargin + 124 + 4, currentY + 11);

  currentY += 23;

  // Render Table Header
  addPageIfNeeded(20);
  doc.setFillColor(240, 240, 245);
  doc.rect(leftMargin, currentY, contentWidth, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(70, 29, 119);
  doc.text("PRODUCTO", leftMargin + 4, currentY + 5.5);
  doc.text("PROG. TON", leftMargin + 52, currentY + 5.5);
  doc.text("REAL TON", leftMargin + 84, currentY + 5.5);
  doc.text("CUMPL %", leftMargin + 116, currentY + 5.5);
  doc.text("META HRS", leftMargin + 142, currentY + 5.5);
  doc.text("REAL HRS", leftMargin + 164, currentY + 5.5);

  currentY += 8;

  // Render Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 55);

  report.data.forEach((item, index) => {
    addPageIfNeeded(8);
    
    // Zebra background
    if (index % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(leftMargin, currentY, contentWidth, 7, 'F');
    }

    const rowPct = item.Ton_Prog > 0 ? (item.Ton_Real / item.Ton_Prog) * 100 : 0;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 45);
    doc.text(item.name, leftMargin + 4, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 90);
    doc.text(Math.round(item.Ton_Prog).toLocaleString(), leftMargin + 52, currentY + 5);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 29, 119);
    doc.text(Math.round(item.Ton_Real).toLocaleString(), leftMargin + 84, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 90);
    doc.text(`${rowPct.toFixed(1)}%`, leftMargin + 116, currentY + 5);
    doc.text(formatDecimalToHHMM(item.faenaMetaHours), leftMargin + 142, currentY + 5);

    doc.setTextColor(197, 158, 77); // Mineral
    doc.text(formatDecimalToHHMM(item.faenaRealHours), leftMargin + 164, currentY + 5);

    currentY += 7;
  });

  // Totals Row
  addPageIfNeeded(8);
  doc.setFillColor(235, 235, 240);
  doc.rect(leftMargin, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 29, 119);
  doc.text("TOTAL GENERAL", leftMargin + 4, currentY + 5);
  doc.text(Math.round(totalProg).toLocaleString(), leftMargin + 52, currentY + 5);
  doc.text(Math.round(totalReal).toLocaleString(), leftMargin + 84, currentY + 5);
  doc.text(`${complPct.toFixed(1)}%`, leftMargin + 116, currentY + 5);
  
  // Averages for hours
  const avgMeta = report.data.length > 0 ? report.data.reduce((acc, d) => acc + d.faenaMetaHours, 0) / report.data.length : 0;
  const avgReal = report.data.length > 0 ? report.data.reduce((acc, d) => acc + d.faenaRealHours, 0) / report.data.length : 0;
  doc.setTextColor(80, 80, 90);
  doc.text(formatDecimalToHHMM(avgMeta), leftMargin + 142, currentY + 5);
  doc.setTextColor(197, 158, 77);
  doc.text(formatDecimalToHHMM(avgReal), leftMargin + 164, currentY + 5);

  currentY += 15;

  // --- SECTION: ANALYSIS REPORT ---
  addPageIfNeeded(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(70, 29, 119);
  doc.text("RESUMEN Y ANÁLISIS OPERATIVO (IA)", leftMargin, currentY);
  
  doc.setDrawColor(70, 29, 119);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, currentY + 2, leftMargin + contentWidth, currentY + 2);

  currentY += 8;

  if (report.analysis) {
    // Process markdown report line by line cleanly
    const lines = report.analysis.split('\n');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 55);

    lines.forEach(line => {
      let cleanLine = line.trim();
      if (!cleanLine) {
        currentY += 4;
        return;
      }

      let isHeader = false;
      let isListItem = false;
      let isBold = false;

      // Handle Markdown headers
      if (cleanLine.startsWith('###')) {
        isHeader = true;
        cleanLine = cleanLine.replace(/^###\s*/, '').replace(/\*\*/g, '');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(70, 29, 119);
        currentY += 4;
      } else if (cleanLine.startsWith('##')) {
        isHeader = true;
        cleanLine = cleanLine.replace(/^##\s*/, '').replace(/\*\*/g, '');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(70, 29, 119);
        currentY += 5;
      } else if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        isListItem = true;
        cleanLine = "• " + cleanLine.substring(1).trim();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 55);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 55);
      }

      // Quick bold matching inside text line (e.g. **Bold Text**)
      // We'll split the text and render, or just strip standard ** for simplicity
      // and do a wrapped text box
      const strippedLine = cleanLine.replace(/\*\*/g, '');

      const splitParagraph = doc.splitTextToSize(strippedLine, isListItem ? contentWidth - 6 : contentWidth);
      
      splitParagraph.forEach((textSegment: string) => {
        addPageIfNeeded(6);
        const drawX = isListItem ? leftMargin + 6 : leftMargin;
        doc.text(textSegment, drawX, currentY + 4);
        currentY += 4.5;
      });
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    doc.text("No se ha compilado un análisis con inteligencia artificial para esta sección en la sesión actual.", leftMargin, currentY + 4);
    doc.text("Para incluirlo en este informe descargable, primero haga clic en 'Generar Reporte' en el módulo.", leftMargin, currentY + 9);
    currentY += 15;
  }

  // Draw final footer on the last page
  drawFooter(doc.getNumberOfPages());

  // Save the PDF
  const dateStr = new Date().toISOString().split('T')[0];
  const outputFileName = `Reporte_Cambio_Turno_${report.title.replace(/\s+/g, '_')}_${dateStr}.pdf`;
  doc.save(outputFileName);

  // Record download activity log in Firestore
  try {
    const savedUser = localStorage.getItem('sqm_current_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      import('../services/firebase').then(({ logActivity }) => {
        logActivity(
          parsedUser,
          'Descargó PDF',
          `Exportó y descargó el Reporte de Cambio de Turno PDF para el módulo ${report.title} (${outputFileName}).`
        );
      });
    }
  } catch (err) {
    console.error('Error logging PDF export:', err);
  }
}
