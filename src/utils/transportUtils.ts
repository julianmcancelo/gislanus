/**
 * Utilidades de Transporte y Cartografía Municipal · Lanús Gobierno
 * Dirección General de Movilidad y Transporte · Subsecretaría de Planificación Urbana
 */

export function normalizeLineNumber(input?: string | null): string {
  if (!input) return '';
  const clean = input.trim();
  if (!clean) return '';
  const match = clean.match(/(\d{1,4}[A-Za-z]?)/);
  if (match) return match[1];
  return clean.replace(/^(l[ií]nea|line)\s*/i, '').trim();
}

export function getOfficialLineColor(lineNumber?: string | null): string {
  const num = normalizeLineNumber(lineNumber);
  const colorMap: Record<string, string> = {
    '9': '#2563EB',
    '10': '#DC2626',
    '15': '#059669',
    '20': '#D97706',
    '28': '#7C3AED',
    '31': '#0284C7',
    '32': '#EA580C',
    '33': '#0891B2',
    '37': '#4F46E5',
    '45': '#16A34A',
    '51': '#0D9488',
    '54': '#D97706',
    '70': '#9333EA',
    '74': '#E11D48',
    '75': '#0D9488',
    '79': '#2563EB',
    '85': '#CA8A04',
    '100': '#E11D48',
    '119': '#0284C7',
    '128': '#4338CA',
    '154': '#B45309',
    '158': '#059669',
    '160': '#DC2626',
    '164': '#7C3AED',
    '177': '#0891B2',
    '178': '#16A34A',
    '179': '#EA580C',
    '188': '#2563EB',
    '239': '#D97706',
    '247': '#E11D48',
    '263': '#4F46E5',
    '266': '#059669',
    '271': '#0284C7',
    '277': '#7C3AED',
    '283': '#CA8A04',
    '293': '#DC2626',
    '295': '#0891B2',
    '299': '#EA580C',
    '318': '#16A34A',
    '323': '#2563EB',
    '338': '#7C3AED',
    '373': '#E11D48',
    '405': '#0D9488',
    '406': '#059669',
    '436': '#D97706',
    '520': '#1D4ED8',
    '521': '#0D9488',
    '522': '#059669',
    '523': '#4F46E5',
    '524': '#D97706',
    '526': '#7C3AED',
    '527': '#EA580C',
  };

  if (colorMap[num]) return colorMap[num];

  let hash = 0;
  for (let i = 0; i < num.length; i++) {
    hash = (hash << 5) - hash + num.charCodeAt(i);
    hash |= 0;
  }
  const hues = [
    '#1D4ED8', '#0D9488', '#059669', '#4F46E5',
    '#D97706', '#7C3AED', '#EA580C', '#2563EB',
    '#DC2626', '#0891B2'
  ];
  return hues[Math.abs(hash) % hues.length];
}

export function calculateHaversineKm(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 1; i < coords.length; i++) {
    const lat1 = (coords[i - 1][0] * Math.PI) / 180;
    const lon1 = (coords[i - 1][1] * Math.PI) / 180;
    const lat2 = (coords[i][0] * Math.PI) / 180;
    const lon2 = (coords[i][1] * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalMeters += 6371000 * c;
  }
  return totalMeters / 1000;
}
