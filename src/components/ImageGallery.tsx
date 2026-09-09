
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Trash2, ChevronLeft, ChevronRight, 
  Image as ImageIcon, X, Home, Plus,
  Maximize2, Minimize2, Play, Pause, Timer,
  Clock, TrendingUp, Target, Users, Scale, ClipboardCheck, Truck, Loader2, RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, logActivity } from '../services/firebase';
import ChartCard from './ChartCard';
import { ProductDetailSection } from './ProductDetailSection';
import { NovandinoLogo } from './BrandLogo';
import { formatDateToCL, formatNumberWithDecimals, formatHoursToTime, separateBischofitaByDest, isProductNovandino, isProductSQM } from '../utils/dataProcessor';

declare const html2canvas: any;

interface GalleryImage {
  id: string;
  url: string;
  name: string;
  date: string;
  createdAt?: string;
}

interface ImageGalleryProps {
  onBack: () => void;
  rawData?: any[];
  selectedDate?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ onBack, rawData = [], selectedDate = '' }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalTime, setIntervalTime] = useState(5); // en segundos
  const [isGeneratingAuto, setIsGeneratingAuto] = useState(false);
  const [sortBy, setSortBy] = useState<'report-order' | 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'type-first'>('report-order');

  // Live Persistence via Firestore
  useEffect(() => {
    const q = query(collection(db, 'gallery_images'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedImages: GalleryImage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedImages.push({
          id: docSnap.id,
          url: data.url,
          name: data.name,
          date: data.date,
          createdAt: data.createdAt
        });
      });
      // Sort images by createdAt descending, fallback to id
      fetchedImages.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
      setImages(fetchedImages);
      setHasLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'gallery_images');
    });

    return () => unsubscribe();
  }, []);

  // Cleanup stale auto-generated images from before the design update (2026-07-07T06:50:00.000Z)
  useEffect(() => {
    if (!hasLoaded || images.length === 0) return;
    const updateThreshold = new Date('2026-07-07T06:50:00.000Z').getTime();
    
    const deleteStale = async () => {
      const path = 'gallery_images';
      for (const img of images) {
        if (img.id.startsWith('auto_')) {
          const createdTime = img.createdAt ? new Date(img.createdAt).getTime() : 0;
          if (createdTime < updateThreshold) {
            console.log(`Deleting stale auto-generated image: ${img.id}`);
            try {
              await deleteDoc(doc(db, path, img.id));
            } catch (err) {
              console.error(`Error deleting stale image ${img.id}:`, err);
            }
          }
        }
      }
    };
    
    deleteStale();
  }, [hasLoaded, images]);

  // Determine all available operational report dates across rawData, Firestore images, and prop
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    
    // 1. From rawData
    if (rawData && rawData.length > 0) {
      rawData.forEach(r => {
        if (r.Fecha && typeof r.Fecha === 'string') {
          datesSet.add(r.Fecha);
        }
      });
    }

    // 2. From Firestore gallery images (extract dates from image IDs or names)
    if (images && images.length > 0) {
      images.forEach(img => {
        const match = img.id.match(/\d{4}-\d{2}-\d{2}/);
        if (match) {
          datesSet.add(match[0]);
        }
      });
    }

    // 3. From prop
    if (selectedDate) {
      datesSet.add(selectedDate);
    }

    return Array.from(datesSet).sort().reverse();
  }, [rawData, images, selectedDate]);

  const [activeDate, setActiveDate] = useState<string>('');

  const effectiveDate = useMemo(() => {
    if (activeDate && availableDates.includes(activeDate)) {
      return activeDate;
    }
    if (availableDates.length > 0) {
      return availableDates[0];
    }
    return selectedDate || '';
  }, [activeDate, availableDates, selectedDate]);

  const separatedRawData = useMemo(() => {
    return separateBischofitaByDest(rawData);
  }, [rawData]);

  // Data calculations for report generation
  const novandinoData = useMemo(() => {
    if (!rawData || !effectiveDate) return [];
    const base = separatedRawData.filter(r => r.Fecha === effectiveDate);
    return base.filter(r => isProductNovandino(r));
  }, [rawData, separatedRawData, effectiveDate]);

  const sqmData = useMemo(() => {
    if (!rawData || !effectiveDate) return [];
    const base = separatedRawData.filter(r => r.Fecha === effectiveDate);
    return base.filter(r => isProductSQM(r));
  }, [rawData, separatedRawData, effectiveDate]);

  const getKPIsForData = useCallback((data: any[]) => {
    if (data.length === 0) return null;
    const totalTonReal = data.reduce((a, b) => a + b.Ton_Real, 0);
    const totalTonProg = data.reduce((a, b) => a + b.Ton_Prog, 0);
    const totalEqReal = data.reduce((a, b) => a + b.Eq_Real, 0);
    const avgReg = data.length > 0 ? data.reduce((acc, d) => acc + (Number(d.Regulacion_Real) || 0), 0) / data.length : 0;
    const validSdaTimes = data.map(d => d.sdaHours).filter(v => v > 0);
    const avgSda = validSdaTimes.length > 0 ? validSdaTimes.reduce((a, b) => a + b, 0) / validSdaTimes.length : 0;
    const validPangTimes = data.map(d => d.pangHours).filter(v => v > 0);
    const avgPang = validPangTimes.length > 0 ? validPangTimes.reduce((a, b) => a + b, 0) / validPangTimes.length : 0;
    const totalHoursInFaena = data.reduce((a, b) => a + b.faenaRealHours, 0);
    const productivity = totalHoursInFaena > 0 ? totalTonReal / totalHoursInFaena : 0;
    const compliance = totalTonProg > 0 ? (totalTonReal / totalTonProg) * 100 : 0;
    const avgLoad = totalEqReal > 0 ? totalTonReal / totalEqReal : 0;
    return [
      { label: "Tiempo Gral. Faena (SdA) (2:00)", value: formatHoursToTime(avgSda), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "Tiempo Gral. Faena (NY) (2:00)", value: formatHoursToTime(avgPang), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "Productividad Diaria", value: `${productivity.toFixed(1)} T/H`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { label: "Carga Real Despachada", value: `${formatNumberWithDecimals(totalTonReal, 2)} Ton`, icon: <Truck className="w-3.5 h-3.5" /> },
      { label: "Cumplimiento Programa", value: `${compliance.toFixed(1)}%`, icon: <Target className="w-3.5 h-3.5" />, status: compliance < 90 ? 'danger' : 'normal' },
      { label: "Intensidad de Flota", value: `${totalEqReal} EQ`, icon: <Users className="w-3.5 h-3.5" /> },
      { label: "Factor de Carga (Eficiencia)", value: `${avgLoad.toFixed(1)} T/EQ`, icon: <Scale className="w-3.5 h-3.5" /> },
      { label: "PROMEDIO DE % DE REGULACIÓN", value: `${Math.round(avgReg)}%`, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    ];
  }, []);

  const novandinoKPIs = useMemo(() => getKPIsForData(novandinoData), [novandinoData, getKPIsForData]);
  const sqmKPIs = useMemo(() => getKPIsForData(sqmData), [sqmData, getKPIsForData]);

  const getProductListForData = useCallback((data: any[]) => {
    const products = [...new Set(data.map(r => r.Producto as string))] as string[];
    return products.sort((a: string, b: string) => {
      const priority: Record<string, number> = { 'SLIT': 1, 'LSI (S)': 2 };
      const aPrio = priority[a] || 99;
      const bPrio = priority[b] || 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.localeCompare(b);
    });
  }, []);

  const novandinoProductList = useMemo(() => getProductListForData(novandinoData), [novandinoData, getProductListForData]);
  const sqmProductList = useMemo(() => getProductListForData(sqmData), [sqmData, getProductListForData]);

  const sortedImages = useMemo(() => {
    // Only keep manual uploads and automatic images of the CURRENT effective date
    const list = images.filter(img => {
      if (img.id.startsWith('auto_')) {
        return img.id.includes(effectiveDate);
      }
      return true;
    });

    let sortedList: GalleryImage[] = [];
    if (sortBy === 'report-order') {
      sortedList = list.sort((a, b) => {
        const getPriority = (img: GalleryImage) => {
          // --- NOVANDINO PRIORITIES ---
          if (img.id === `auto_kpi_novandino_${effectiveDate}`) return 1;
          if (img.id === `auto_chart_novandino_${effectiveDate}`) return 2;
          if (img.id.startsWith('auto_prod_novandino_')) {
            const match = img.id.match(new RegExp(`^auto_prod_novandino_(.+?)_${effectiveDate}$`));
            if (match) {
              const prodNameUnderscored = match[1];
              const idx = novandinoProductList.findIndex(p => p.replace(/[\s/]+/g, '_') === prodNameUnderscored);
              if (idx !== -1) {
                return 3 + idx;
              }
            }
            return 3 + novandinoProductList.length;
          }

          // --- SQM NY PRIORITIES ---
          const sqmOffset = 100;
          if (img.id === `auto_kpi_sqm_${effectiveDate}`) return sqmOffset + 1;
          if (img.id === `auto_chart_sqm_${effectiveDate}`) return sqmOffset + 2;
          if (img.id.startsWith('auto_prod_sqm_')) {
            const match = img.id.match(new RegExp(`^auto_prod_sqm_(.+?)_${effectiveDate}$`));
            if (match) {
              const prodNameUnderscored = match[1];
              const idx = sqmProductList.findIndex(p => p.replace(/[\s/]+/g, '_') === prodNameUnderscored);
              if (idx !== -1) {
                return sqmOffset + 3 + idx;
              }
            }
            return sqmOffset + 3 + sqmProductList.length;
          }

          // Legacy auto IDs fallback
          if (img.id === `auto_kpi_${effectiveDate}`) return 500;
          if (img.id === `auto_chart_${effectiveDate}`) return 501;
          if (img.id.startsWith('auto_prod_')) return 502;

          return 1000; // Manual images
        };

        const prioA = getPriority(a);
        const prioB = getPriority(b);

        if (prioA !== prioB) {
          return prioA - prioB;
        }

        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
    } else if (sortBy === 'recent') {
      sortedList = list;
    } else if (sortBy === 'oldest') {
      sortedList = list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
    } else if (sortBy === 'name-asc') {
      sortedList = list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      sortedList = list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'type-first') {
      sortedList = list.sort((a, b) => {
        const isAAuto = a.id.startsWith('auto_');
        const isBAuto = b.id.startsWith('auto_');
        if (isAAuto && !isBAuto) return -1;
        if (!isAAuto && isBAuto) return 1;
        
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
    } else {
      sortedList = list;
    }

    const staticNovandino: GalleryImage = {
      id: 'static_novandino',
      url: '/sda/home.png',
      name: 'Home',
      date: 'General'
    };

    // Deduplicate the baseList first (user uploaded / auto-generated images)
    const baseList = [staticNovandino, ...sortedList];
    const seenUrls = new Set<string>();
    const uniqueBaseList: GalleryImage[] = [];

    for (const item of baseList) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        uniqueBaseList.push(item);
      }
    }

    const sdaImagesList = [
      { name: 'Salar de Atacama 1', filename: '1.png' },
      { name: 'Salar de Atacama 2', filename: '2.png' },
      { name: 'Salar de Atacama 3', filename: '3.png' },
      { name: 'Salar de Atacama 4', filename: '4.png' },
      { name: 'Salar de Atacama 5', filename: '5.png' },
      { name: 'Salar de Atacama 6', filename: '6.png' },
      { name: 'Salar de Atacama 7', filename: '7.png' },
      { name: 'Salar de Atacama 8', filename: '8.png' }
    ];

    const weavedList: GalleryImage[] = [];
    for (let i = 0; i < uniqueBaseList.length; i++) {
      weavedList.push(uniqueBaseList[i]);
      if (i < uniqueBaseList.length - 1) {
        const sdaIndex = i % sdaImagesList.length;
        const sdaImgObj = sdaImagesList[sdaIndex];
        
        weavedList.push({
          id: `sda_weaved_${i}_${sdaImgObj.filename}`,
          url: `/sda/${sdaImgObj.filename}`,
          name: sdaImgObj.name,
          date: 'General'
        });
      }
    }

    return weavedList;
  }, [images, sortBy, novandinoProductList, sqmProductList, effectiveDate]);

  // Automatic report image generation effect
  useEffect(() => {
    if (!hasLoaded || !rawData || rawData.length === 0 || !effectiveDate) return;

    const runAutomaticCapture = async () => {
      // Novandino IDs
      const novKpiId = `auto_kpi_novandino_${effectiveDate}`;
      const novChartId = `auto_chart_novandino_${effectiveDate}`;
      const novProdIds = novandinoProductList.map(p => `auto_prod_novandino_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);

      // SQM NY IDs
      const sqmKpiId = `auto_kpi_sqm_${effectiveDate}`;
      const sqmChartId = `auto_chart_sqm_${effectiveDate}`;
      const sqmProdIds = sqmProductList.map(p => `auto_prod_sqm_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);

      const hasNovKpis = images.some(img => img.id === novKpiId);
      const hasNovChart = images.some(img => img.id === novChartId);
      const hasNovProducts = novProdIds.every(id => images.some(img => img.id === id));

      const hasSqmKpis = images.some(img => img.id === sqmKpiId);
      const hasSqmChart = images.some(img => img.id === sqmChartId);
      const hasSqmProducts = sqmProdIds.every(id => images.some(img => img.id === id));

      // Check if all needed captures exist
      const allExist = (novandinoData.length === 0 || (hasNovKpis && hasNovChart && hasNovProducts)) &&
                       (sqmData.length === 0 || (hasSqmKpis && hasSqmChart && hasSqmProducts));

      if (allExist) {
        return; // Already exists, don't regenerate
      }

      setIsGeneratingAuto(true);
      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      const generatedList: GalleryImage[] = [];

      try {
        // Temporarily add 'is-exporting' so that 'pdf-only-block' is rendered and inputs are hidden
        document.body.classList.add('is-exporting');
        // Let layout styles apply
        await new Promise(resolve => setTimeout(resolve, 100));

        // --- 1. CAPTURE NOVANDINO REPORT ---
        if (novandinoData.length > 0) {
          // KPIs
          if (!hasNovKpis) {
            const kpiEl = document.getElementById('capture-kpis-novandino');
            if (kpiEl) {
              const canvas = await html2canvas(kpiEl, { scale: 1.5, useCORS: true });
              generatedList.push({
                id: novKpiId,
                url: canvas.toDataURL('image/jpeg', 0.9),
                name: `NOVANDINO - INFORME OPERATIVO - CUMPLIMIENTO GLOBAL (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate)
              });
            }
          }

          // Composed Chart
          if (!hasNovChart) {
            const chartEl = document.getElementById('capture-chart-novandino');
            if (chartEl) {
              const canvas = await html2canvas(chartEl, { scale: 1.5, useCORS: true });
              generatedList.push({
                id: novChartId,
                url: canvas.toDataURL('image/jpeg', 0.9),
                name: `NOVANDINO - ANÁLISIS COMPARATIVO (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate)
              });
            }
          }

          // Product details
          for (let i = 0; i < novandinoProductList.length; i++) {
            const prod = novandinoProductList[i];
            const prodId = novProdIds[i];
            const hasProd = images.some(img => img.id === prodId);
            if (!hasProd) {
              const prodEl = document.getElementById(`capture-product-novandino-${i}`);
              if (prodEl) {
                const canvas = await html2canvas(prodEl, { scale: 1.5, useCORS: true });
                generatedList.push({
                  id: prodId,
                  url: canvas.toDataURL('image/jpeg', 0.9),
                  name: `NOVANDINO - AUDITORÍA DE DESEMPEÑO - ${prod} (${formatDateToCL(effectiveDate)})`,
                  date: formatDateToCL(effectiveDate)
                });
              }
            }
          }
        }

        // --- 2. CAPTURE SQM NY REPORT ---
        if (sqmData.length > 0) {
          // KPIs
          if (!hasSqmKpis) {
            const kpiEl = document.getElementById('capture-kpis-sqm');
            if (kpiEl) {
              const canvas = await html2canvas(kpiEl, { scale: 1.5, useCORS: true });
              generatedList.push({
                id: sqmKpiId,
                url: canvas.toDataURL('image/jpeg', 0.9),
                name: `SQM NY - INFORME OPERATIVO - CUMPLIMIENTO GLOBAL (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate)
              });
            }
          }

          // Composed Chart
          if (!hasSqmChart) {
            const chartEl = document.getElementById('capture-chart-sqm');
            if (chartEl) {
              const canvas = await html2canvas(chartEl, { scale: 1.5, useCORS: true });
              generatedList.push({
                id: sqmChartId,
                url: canvas.toDataURL('image/jpeg', 0.9),
                name: `SQM NY - ANÁLISIS COMPARATIVO (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate)
              });
            }
          }

          // Product details
          for (let i = 0; i < sqmProductList.length; i++) {
            const prod = sqmProductList[i];
            const prodId = sqmProdIds[i];
            const hasProd = images.some(img => img.id === prodId);
            if (!hasProd) {
              const prodEl = document.getElementById(`capture-product-sqm-${i}`);
              if (prodEl) {
                const canvas = await html2canvas(prodEl, { scale: 1.5, useCORS: true });
                generatedList.push({
                  id: prodId,
                  url: canvas.toDataURL('image/jpeg', 0.9),
                  name: `SQM NY - AUDITORÍA DE DESEMPEÑO - ${prod} (${formatDateToCL(effectiveDate)})`,
                  date: formatDateToCL(effectiveDate)
                });
              }
            }
          }
        }

        if (generatedList.length > 0) {
          // Upload each generated image to Firestore
          for (const newImg of generatedList) {
            try {
              const path = 'gallery_images';
              const cleanId = newImg.id.replace(/\//g, '_');
              const docRef = doc(db, path, cleanId);
              await setDoc(docRef, {
                url: newImg.url,
                name: newImg.name,
                date: newImg.date,
                createdAt: new Date().toISOString()
              });
            } catch (innerErr) {
              console.error("Error saving automatic report image to Firestore:", innerErr);
            }
          }
        }
      } catch (err) {
        console.error("Error generating automatic report images:", err);
      } finally {
        document.body.classList.remove('is-exporting');
        setIsGeneratingAuto(false);
      }
    };

    runAutomaticCapture();
  }, [rawData, effectiveDate, novandinoProductList, sqmProductList, novandinoData.length, sqmData.length, hasLoaded, images]);

  const handleRegenerateAutoImages = async () => {
    if (isGeneratingAuto || !effectiveDate) return;
    
    setIsGeneratingAuto(true);
    
    try {
      const novKpiId = `auto_kpi_novandino_${effectiveDate}`;
      const novChartId = `auto_chart_novandino_${effectiveDate}`;
      const novProdIds = novandinoProductList.map(p => `auto_prod_novandino_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);

      const sqmKpiId = `auto_kpi_sqm_${effectiveDate}`;
      const sqmChartId = `auto_chart_sqm_${effectiveDate}`;
      const sqmProdIds = sqmProductList.map(p => `auto_prod_sqm_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);
      
      const idsToDelete = [
        novKpiId, novChartId, ...novProdIds,
        sqmKpiId, sqmChartId, ...sqmProdIds,
        `auto_kpi_${effectiveDate}`, `auto_chart_${effectiveDate}` // Legacy IDs too
      ];
      
      const path = 'gallery_images';
      for (const id of idsToDelete) {
        if (images.some(img => img.id === id)) {
          await deleteDoc(doc(db, path, id));
        }
      }
      
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        await logActivity(
          parsedUser,
          'Regeneró Reportes',
          `Solicitó regenerar las capturas automáticas para la jornada ${formatDateToCL(effectiveDate)}.`
        );
      }
    } catch (err) {
      console.error("Error deleting auto images for regeneration:", err);
      setIsGeneratingAuto(false);
    }
  };

  // Autoplay Effect
  useEffect(() => {
    let interval: any;
    if (autoPlay && sortedImages.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
      }, intervalTime * 1000);
    }
    return () => clearInterval(interval);
  }, [autoPlay, sortedImages.length, intervalTime]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageId = Math.random().toString(36).substr(2, 9);
        const name = file.name;
        const date = new Date().toLocaleDateString();
        const url = e.target?.result as string;

        try {
          // Upload to Firestore
          const path = 'gallery_images';
          const docRef = doc(db, path, imageId);
          await setDoc(docRef, {
            url,
            name,
            date,
            createdAt: new Date().toISOString()
          });

          // Record Image upload activity log in Firestore
          const savedUser = localStorage.getItem('sqm_current_user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            await logActivity(
              parsedUser,
              'Subió Evidencia',
              `Cargó una nueva imagen de terreno (${name}) a la Galería Operativa.`
            );
          }
        } catch (err) {
          console.error('Error saving image upload:', err);
          handleFirestoreError(err, OperationType.WRITE, `gallery_images/${imageId}`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteImage = async (id: string) => {
    if (id === 'static_novandino' || id.startsWith('sda_random_')) return;
    const imgToDelete = sortedImages.find(img => img.id === id);
    try {
      // Delete from Firestore
      const path = 'gallery_images';
      await deleteDoc(doc(db, path, id));

      if (currentIndex >= sortedImages.length - 1) {
        setCurrentIndex(Math.max(0, sortedImages.length - 2));
      }

      // Record Image deletion activity log in Firestore
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        await logActivity(
          parsedUser,
          'Eliminó Evidencia',
          `Eliminó la imagen (${imgToDelete?.name || 'sin_nombre'}) de la Galería Operativa.`
        );
      }
    } catch (err) {
      console.error('Error deleting image:', err);
      handleFirestoreError(err, OperationType.DELETE, `gallery_images/${id}`);
    }
  };

  const nextSlide = useCallback(() => {
    if (sortedImages.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
  }, [sortedImages.length]);

  const prevSlide = useCallback(() => {
    if (sortedImages.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length);
  }, [sortedImages.length]);

  const openFullScreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (sortedImages.length > 0) {
      setIsFullScreen(true);
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).mozRequestFullScreen) {
          await (docEl as any).mozRequestFullScreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).msRequestFullscreen) {
          await (docEl as any).msRequestFullscreen();
        }
      } catch (err) {
        console.error("Error requesting native fullscreen:", err);
      }
    }
  };

  const closeFullScreen = async () => {
    setIsFullScreen(false);
    setAutoPlay(false);
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error exiting native fullscreen:", err);
    }
  };

  const handleToggleAutoPlay = async () => {
    const nextAutoPlay = !autoPlay;
    setAutoPlay(nextAutoPlay);
    if (nextAutoPlay) {
      await openFullScreen();
    } else {
      await closeFullScreen();
    }
  };

  // Sync React state with browser's native fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        setAutoPlay(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          closeFullScreen();
        } else {
          onBack();
        }
      }
      
      if (sortedImages.length === 0) return;
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedImages.length, nextSlide, prevSlide, isFullScreen, onBack]);

  return (
    <div className="min-h-screen bg-calido flex flex-col font-sans text-tecnico relative">
      {/* Header */}
      <header className="bg-white border-b border-violeta/10 p-6 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-violeta hover:text-nucleo font-black text-[10px] uppercase tracking-widest transition-colors group"
          >
            <Home size={14} className="group-hover:-translate-x-1 transition-transform" /> Menú
          </button>
          <div className="h-8 w-px bg-violeta/10" />
          <div className="flex flex-col">
            <h1 className="text-2xl font-[950] text-nucleo tracking-tighter uppercase leading-none">Galería Operativa</h1>
            <p className="text-[10px] font-bold text-violeta/60 uppercase tracking-[0.3em] mt-1">Registro Visual de Faena</p>
          </div>
          {isGeneratingAuto ? (
            <div className="flex items-center gap-2 bg-ionizado/10 px-4 py-2 rounded-full border border-ionizado/20 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-ionizado" />
              <span className="text-[9px] font-black text-ionizado uppercase tracking-wider">Sincronizando reportes automáticos...</span>
            </div>
          ) : (
            rawData.length > 0 && effectiveDate && (
              <button
                onClick={handleRegenerateAutoImages}
                className="flex items-center gap-1.5 bg-violeta/5 hover:bg-violeta/10 border border-violeta/15 hover:border-violeta/30 text-violeta font-black text-[9px] uppercase tracking-wider px-3 py-2 rounded-xl transition-all cursor-pointer"
                title="Regenera todas las capturas automáticas para incluir las últimas modificaciones o justificaciones de desempeño."
              >
                <RefreshCw size={12} className="text-violeta" />
                Actualizar Reportes
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Date Selector */}
          {availableDates.length > 0 && (
            <div className="bg-calido/50 rounded-2xl p-1.5 flex items-center gap-1.5 border border-violeta/10 px-3">
              <span className="text-[9px] font-black uppercase text-violeta/50 tracking-wider">Jornada:</span>
              <select
                value={effectiveDate}
                onChange={(e) => {
                  setActiveDate(e.target.value);
                  setCurrentIndex(0);
                }}
                className="bg-transparent text-[10px] font-black text-violeta uppercase outline-none cursor-pointer border-none p-0 focus:ring-0 font-mono"
              >
                {availableDates.map((d, i) => (
                  <option key={d} value={d}>
                    {formatDateToCL(d)}{i === 0 ? ' (Última)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sorting Option */}
          {sortedImages.length > 0 && (
            <div className="bg-calido/50 rounded-2xl p-1.5 flex items-center gap-1.5 border border-violeta/5 px-3">
              <span className="text-[9px] font-black uppercase text-violeta/50 tracking-wider">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentIndex(0); // Reset to first image in sorted list
                }}
                className="bg-transparent text-[10px] font-black text-violeta uppercase outline-none cursor-pointer border-none p-0 focus:ring-0"
              >
                <option value="report-order">Orden del Informe</option>
                <option value="recent">Recientes primero</option>
                <option value="oldest">Antiguas primero</option>
                <option value="name-asc">Nombre (A-Z)</option>
                <option value="name-desc">Nombre (Z-A)</option>
                <option value="type-first">Reportes primero</option>
              </select>
            </div>
          )}

          {/* Autoplay Controls */}
          {sortedImages.length > 0 && (
            <div className="bg-calido/50 rounded-2xl p-1 flex items-center gap-1 border border-violeta/5">
              <button 
                onClick={handleToggleAutoPlay}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${autoPlay ? 'bg-ionizado text-white shadow-lg' : 'bg-white text-violeta hover:bg-white'}`}
              >
                {autoPlay ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                {autoPlay ? 'Reproduciendo' : 'Autoplay'}
              </button>
              
              <div className="flex items-center gap-2 px-3">
                <Timer size={12} className="text-violeta/40" />
                <select 
                  value={intervalTime} 
                  onChange={(e) => setIntervalTime(Number(e.target.value))}
                  className="bg-transparent text-[10px] font-black text-violeta uppercase outline-none cursor-pointer"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={40}>40s</option>
                  <option value={45}>45s</option>
                </select>
              </div>
            </div>
          )}

          <label className="bg-nucleo text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-nucleo/90 transition-all cursor-pointer shadow-lg shadow-nucleo/10 active:scale-95">
            <Plus size={14} strokeWidth={3} /> Subir Imágenes
            <input 
              type="file" 
              className="hidden" 
              multiple 
              accept="image/*" 
              onChange={(e) => handleFileUpload(e.target.files)} 
            />
          </label>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-12">
        {sortedImages.length === 0 ? (
          <div 
            className={`
              w-full h-[60vh] border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center space-y-6 transition-all duration-500
              ${dragActive ? 'border-ionizado bg-ionizado/5' : 'border-violeta/10 bg-white/50'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFileUpload(e.dataTransfer.files);
            }}
          >
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-violeta/20 shadow-sm border border-violeta/5">
              <ImageIcon size={48} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-nucleo uppercase tracking-tight">No hay imágenes</h2>
              <p className="text-violeta/60 font-medium mt-1">Arrastra tus archivos aquí o usa el botón de subida.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Carousel */}
            <section className="relative group">
              <div className="aspect-[21/9] w-full bg-tecnico rounded-[3rem] overflow-hidden shadow-2xl relative carousel-container">
                {sortedImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`
                      absolute inset-0 transition-all duration-700 ease-in-out flex items-center justify-center
                      ${idx === currentIndex ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-110 pointer-events-none z-0'}
                    `}
                  >
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-full h-full object-cover"
                    />
                    

                  </div>
                ))}

                {/* Single Stable Fullscreen Button */}
                <div className="absolute bottom-12 right-12 z-40">
                  <button 
                    onClick={openFullScreen}
                    className="w-16 h-16 bg-white/20 backdrop-blur-2xl rounded-2xl flex items-center justify-center text-white hover:bg-white hover:text-nucleo transition-all border border-white/30 cursor-pointer shadow-[0_0_40px_rgba(0,0,0,0.3)] group/btn"
                    title="Pantalla Completa"
                  >
                    <Maximize2 size={28} className="group-hover/btn:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Controls */}
                <div className="absolute inset-y-0 left-0 w-32 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button 
                    onClick={prevSlide}
                    className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-nucleo transition-all border border-white/20"
                  >
                    <ChevronLeft size={32} />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button 
                    onClick={nextSlide}
                    className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-nucleo transition-all border border-white/20"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>

                {/* Indicators */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {sortedImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 transition-all duration-500 rounded-full ${idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Grid View / Management */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-ionizado rounded-full" />
                  <h2 className="text-xl font-black text-nucleo uppercase tracking-tight">Biblioteca de Medios</h2>
                </div>
                <p className="text-[10px] font-black text-violeta/40 uppercase tracking-widest">{sortedImages.length} Archivos</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {sortedImages.map((img, idx) => (
                  <div 
                    key={img.id}
                    className={`
                      group relative aspect-square rounded-3xl overflow-hidden border-2 transition-all duration-300 cursor-pointer
                      ${idx === currentIndex ? 'border-ionizado ring-4 ring-ionizado/10' : 'border-transparent hover:border-violeta/20'}
                    `}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    {img.id !== 'static_novandino' && !img.id.startsWith('sda_random_') && (
                      <div className="absolute inset-0 bg-nucleo/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                          className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Fullscreen Overlay */}
      {isFullScreen && sortedImages[currentIndex] && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-300">
          {/* Background image blurred to fill space beautifully (ambient glow) */}
          <div 
            className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-30 select-none pointer-events-none" 
            style={{ backgroundImage: `url(${sortedImages[currentIndex].url})` }}
          />

          {/* Floating Top Header Control */}
          <div className="absolute top-6 left-6 right-6 flex justify-end items-start z-50 pointer-events-none">
            {/* Floating Control buttons */}
            <div className="flex items-center gap-3 pointer-events-auto">
              <button 
                onClick={() => setAutoPlay(!autoPlay)}
                className={`w-14 h-14 backdrop-blur-md rounded-full flex items-center justify-center transition-all border border-white/15 shadow-2xl cursor-pointer hover:scale-105 active:scale-95 ${autoPlay ? 'bg-ionizado text-white border-ionizado' : 'bg-black/40 text-white hover:bg-white hover:text-black'}`}
                title={autoPlay ? "Pausar Reproducción" : "Iniciar Reproducción"}
              >
                {autoPlay ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>

              <button 
                onClick={closeFullScreen}
                className="w-14 h-14 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/15 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
                title="Cerrar Pantalla Completa"
              >
                <X size={26} />
              </button>
            </div>
          </div>
          
          {/* Main Full-Size Image Container */}
          <div className="w-full h-full flex items-center justify-center relative p-0 select-none">
            {/* Prev Trigger */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50">
              <button 
                onClick={prevSlide} 
                className="w-16 h-16 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
                title="Imagen Anterior"
              >
                <ChevronLeft size={36} />
              </button>
            </div>

            {/* Image (Fills absolute maximum space with object-contain) */}
            <img 
              src={sortedImages[currentIndex].url} 
              alt={sortedImages[currentIndex].name} 
              className="w-full h-full max-w-full max-h-full object-contain shadow-2xl z-10 select-none animate-in fade-in zoom-in-95 duration-300" 
            />

            {/* Next Trigger */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50">
              <button 
                onClick={nextSlide} 
                className="w-16 h-16 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
                title="Siguiente Imagen"
              >
                <ChevronRight size={36} />
              </button>
            </div>
          </div>

          {/* Bottom Slides Counter and Help Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-none">
            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
              {currentIndex + 1} / {sortedImages.length}
            </span>
          </div>
        </div>
      )}
      {/* Hidden Offscreen Capture Area */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '-9999px', 
          left: '-9999px', 
          width: '1000px', 
          background: '#ffffff',
          pointerEvents: 'none'
        }}
      >
        {/* ========================================================================= */}
        {/* ======================= NOVANDINO CAPTURE NODES ========================= */}
        {/* ========================================================================= */}
        {novandinoData.length > 0 && (
          <>
            {/* 1. KPIs Executive Cover - NOVANDINO */}
            <div id="capture-kpis-novandino" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-8 border-b-2 border-slate-200">
                <div className="flex flex-col items-start gap-4">
                  <NovandinoLogo className="h-28 w-[400px] max-w-full" variant="print" />
                  <div>
                    <h1 className="text-4xl font-[900] text-nucleo tracking-tighter leading-none mb-1 uppercase">INFORME OPERATIVO NOVANDINO</h1>
                    <p className="text-violeta font-bold text-[9px] tracking-[0.4em] uppercase">Subgerencia Logística Litio - Despacho Litio</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-violeta font-bold text-[9px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
                  <p className="text-2xl font-[900] text-ionizado tracking-tighter whitespace-nowrap">{formatDateToCL(effectiveDate)}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-[2rem] p-8 border-2 border-ionizado/10 border-l-[12px] border-l-ionizado space-y-6 shadow-sm mt-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-ionizado">
                    <span className="font-black uppercase tracking-[0.3em] text-[9px]">KPIs OPERATIVOS</span>
                  </div>
                  <h2 className="text-3xl font-[900] text-nucleo tracking-tighter uppercase">Cumplimiento Global Novandino</h2>
                </div>
                <div className="grid grid-cols-4 gap-3 pt-4">
                  {novandinoKPIs?.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-calido flex flex-col gap-1 shadow-sm border-b-4 border-b-levanda">
                      <div className="flex items-center gap-1.5 text-black">
                        {kpi.icon}
                        <span className="text-[9px] font-black text-black uppercase tracking-widest">{kpi.label}</span>
                      </div>
                      <span className={`text-xl font-[900] ${kpi.status === 'danger' ? 'text-rose-600' : 'text-black'} tracking-tighter`}>
                        {kpi.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Composed Chart - NOVANDINO */}
            <div id="capture-chart-novandino" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-ionizado uppercase tracking-[0.3em]">Análisis Gráfico Novandino</p>
                  <h2 className="text-3xl font-[950] text-nucleo uppercase tracking-tight">Comparación de Despacho</h2>
                </div>
                <p className="text-xs font-black text-violeta uppercase tracking-widest">{formatDateToCL(effectiveDate)}</p>
              </div>
              <div className="pt-6">
                <ChartCard 
                  type="composed" 
                  xAxis="Producto" 
                  yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} 
                  title="Análisis Comparativo Novandino" 
                  data={novandinoData} 
                />
              </div>
            </div>

            {/* 3. Products Details - NOVANDINO */}
            {novandinoProductList.map((prod, idx) => (
              <div key={`nov-${effectiveDate}-${prod}`} id={`capture-product-novandino-${idx}`} style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
                <ProductDetailSection 
                  product={prod} 
                  data={novandinoData.filter(d => d.Producto === prod)} 
                  allData={separatedRawData}
                  date={effectiveDate || ''} 
                  index={idx + 1} 
                  total={novandinoProductList.length} 
                />
              </div>
            ))}
          </>
        )}

        {/* ========================================================================= */}
        {/* ========================= SQM NY CAPTURE NODES ========================== */}
        {/* ========================================================================= */}
        {sqmData.length > 0 && (
          <>
            {/* 1. KPIs Executive Cover - SQM NY */}
            <div id="capture-kpis-sqm" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-8 border-b-2 border-slate-200">
                <div className="flex flex-col items-start gap-4">
                  <NovandinoLogo className="h-28 w-[400px] max-w-full" variant="print" />
                  <div>
                    <h1 className="text-4xl font-[900] text-nucleo tracking-tighter leading-none mb-1 uppercase">INFORME OPERATIVO SQM NY</h1>
                    <p className="text-violeta font-bold text-[9px] tracking-[0.4em] uppercase">Subgerencia Logística Litio</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-violeta font-bold text-[9px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
                  <p className="text-2xl font-[900] text-ionizado tracking-tighter whitespace-nowrap">{formatDateToCL(effectiveDate)}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-[2rem] p-8 border-2 border-ionizado/10 border-l-[12px] border-l-ionizado space-y-6 shadow-sm mt-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-ionizado">
                    <span className="font-black uppercase tracking-[0.3em] text-[9px]">KPIs OPERATIVOS</span>
                  </div>
                  <h2 className="text-3xl font-[900] text-nucleo tracking-tighter uppercase">Cumplimiento Global SQM NY</h2>
                </div>
                <div className="grid grid-cols-4 gap-3 pt-4">
                  {sqmKPIs?.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-calido flex flex-col gap-1 shadow-sm border-b-4 border-b-levanda">
                      <div className="flex items-center gap-1.5 text-black">
                        {kpi.icon}
                        <span className="text-[9px] font-black text-black uppercase tracking-widest">{kpi.label}</span>
                      </div>
                      <span className={`text-xl font-[900] ${kpi.status === 'danger' ? 'text-rose-600' : 'text-black'} tracking-tighter`}>
                        {kpi.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Composed Chart - SQM NY */}
            <div id="capture-chart-sqm" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-ionizado uppercase tracking-[0.3em]">Análisis Gráfico SQM NY</p>
                  <h2 className="text-3xl font-[950] text-nucleo uppercase tracking-tight">Comparación de Despacho</h2>
                </div>
                <p className="text-xs font-black text-violeta uppercase tracking-widest">{formatDateToCL(effectiveDate)}</p>
              </div>
              <div className="pt-6">
                <ChartCard 
                  type="composed" 
                  xAxis="Producto" 
                  yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} 
                  title="Análisis Comparativo SQM NY" 
                  data={sqmData} 
                />
              </div>
            </div>

            {/* 3. Products Details - SQM NY */}
            {sqmProductList.map((prod, idx) => (
              <div key={`sqm-${effectiveDate}-${prod}`} id={`capture-product-sqm-${idx}`} style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
                <ProductDetailSection 
                  product={prod} 
                  data={sqmData.filter(d => d.Producto === prod)} 
                  allData={separatedRawData}
                  date={effectiveDate || ''} 
                  index={idx + 1} 
                  total={sqmProductList.length} 
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
