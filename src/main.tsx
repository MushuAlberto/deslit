import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Precise OKLCH & OKLAB to sRGB conversion functions to prevent html2canvas from crashing 
// while preserving exact intended design colors (preventing them from rendering as transparent / blank)
function oklchToRgb(L: number, C: number, H: number, alpha: number = 1): string {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l_lin = l_ * l_ * l_;
  const m_lin = m_ * m_ * m_;
  const s_lin = s_ * s_ * s_;

  let r_lin = 4.0767416621 * l_lin - 3.3077115913 * m_lin + 0.2309699292 * s_lin;
  let g_lin = -1.2684380046 * l_lin + 2.6097574011 * m_lin - 0.3413193965 * s_lin;
  let b_lin = -0.0041960863 * l_lin - 0.7034186147 * m_lin + 1.7076147010 * s_lin;

  const gamma = (val: number): number => {
    if (val <= 0.0031308) {
      return 12.92 * val;
    }
    return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
  };

  const rChan = Math.min(255, Math.max(0, Math.round(gamma(r_lin) * 255)));
  const gChan = Math.min(255, Math.max(0, Math.round(gamma(g_lin) * 255)));
  const bChan = Math.min(255, Math.max(0, Math.round(gamma(b_lin) * 255)));

  return `rgba(${rChan}, ${gChan}, ${bChan}, ${alpha})`;
}

function oklabToRgb(L: number, a: number, b: number, alpha: number = 1): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l_lin = l_ * l_ * l_;
  const m_lin = m_ * m_ * m_;
  const s_lin = s_ * s_ * s_;

  let r_lin = 4.0767416621 * l_lin - 3.3077115913 * m_lin + 0.2309699292 * s_lin;
  let g_lin = -1.2684380046 * l_lin + 2.6097574011 * m_lin - 0.3413193965 * s_lin;
  let b_lin = -0.0041960863 * l_lin - 0.7034186147 * m_lin + 1.7076147010 * s_lin;

  const gamma = (val: number): number => {
    if (val <= 0.0031308) {
      return 12.92 * val;
    }
    return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
  };

  const rChan = Math.min(255, Math.max(0, Math.round(gamma(r_lin) * 255)));
  const gChan = Math.min(255, Math.max(0, Math.round(gamma(g_lin) * 255)));
  const bChan = Math.min(255, Math.max(0, Math.round(gamma(b_lin) * 255)));

  return `rgba(${rChan}, ${gChan}, ${bChan}, ${alpha})`;
}

function parseAndConvertOklchOklab(str: string): string {
  const cleaned = str.replace(/\s+/g, ' ').trim().toLowerCase();
  
  // Try matching oklch(L C H [ / A]) or oklch(L, C, H, A)
  const oklchMatch = cleaned.match(/oklch\(\s*([0-9.%eE-]+)\s+([0-9.%eE-]+)\s+([0-9.%eE-]+)(?:\s*\/\s*([0-9.%eE-]+))?\s*\)/i) ||
                     cleaned.match(/oklch\(\s*([0-9.%eE-]+),\s*([0-9.%eE-]+),\s*([0-9.%eE-]+)(?:\s*,\s*([0-9.%eE-]+))?\s*\)/i);
  
  if (oklchMatch) {
    let l_val = oklchMatch[1];
    let c_val = oklchMatch[2];
    let h_val = oklchMatch[3];
    let a_val = oklchMatch[4];
    
    let L = l_val.endsWith('%') ? parseFloat(l_val) / 100 : parseFloat(l_val);
    let C = parseFloat(c_val);
    let H = parseFloat(h_val);
    let alpha = 1;
    if (a_val) {
      alpha = a_val.endsWith('%') ? parseFloat(a_val) / 100 : parseFloat(a_val);
    }
    return oklchToRgb(L, C, H, alpha);
  }

  // Try matching oklab(L a b [ / A]) or oklab(L, a, b, A)
  const oklabMatch = cleaned.match(/oklab\(\s*([0-9.%eE-]+)\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)(?:\s*\/\s*([0-9.%eE-]+))?\s*\)/i) ||
                     cleaned.match(/oklab\(\s*([0-9.%eE-]+),\s*([0-9.eE+-]+),\s*([0-9.eE+-]+)(?:\s*,\s*([0-9.%eE-]+))?\s*\)/i);
                     
  if (oklabMatch) {
    let l_val = oklabMatch[1];
    let a_val = oklabMatch[2];
    let b_val = oklabMatch[3];
    let alp_val = oklabMatch[4];
    
    let L = l_val.endsWith('%') ? parseFloat(l_val) / 100 : parseFloat(l_val);
    let a = parseFloat(a_val);
    let b = parseFloat(b_val);
    let alpha = 1;
    if (alp_val) {
      alpha = alp_val.endsWith('%') ? parseFloat(alp_val) / 100 : parseFloat(alp_val);
    }
    return oklabToRgb(L, a, b, alpha);
  }
  
  return 'rgba(120, 120, 120, 1)'; // Neutral gray fallback
}

// Patch window.getComputedStyle globally to prevent html2canvas from crashing 
// on modern Tailwind CSS v4 color functions like oklab() or oklch()
try {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (element, pseudoElt) {
    const style = originalGetComputedStyle(element, pseudoElt);
    
    const cleanValue = (val: any): any => {
      if (typeof val === 'string') {
        let changed = false;
        let newVal = val;
        
        // Remove color interpolation methods like "in oklab" or "in oklch" in gradients
        if (newVal.includes('in oklab')) {
          newVal = newVal.replace(/in oklab,\s*/gi, '');
          changed = true;
        }
        if (newVal.includes('in oklch')) {
          newVal = newVal.replace(/in oklch,\s*/gi, '');
          changed = true;
        }
        
        // Convert oklab() and oklch() color codes with accurate RGB fallback values
        if (newVal.includes('oklab(') || newVal.includes('oklch(')) {
          newVal = newVal.replace(/oklab\((?:[^()]+|\([^()]*\))*\)/gi, (m) => parseAndConvertOklchOklab(m));
          newVal = newVal.replace(/oklch\((?:[^()]+|\([^()]*\))*\)/gi, (m) => parseAndConvertOklchOklab(m));
          changed = true;
        }
        
        if (changed) {
          return newVal;
        }
      }
      return val;
    };

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (propertyName: string) {
            return cleanValue(target.getPropertyValue(propertyName));
          };
        }
        
        const val = Reflect.get(target, prop);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return cleanValue(val);
      }
    }) as any;
  };
} catch (e) {
  console.warn("Failed to apply html2canvas oklab fallback patch:", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
