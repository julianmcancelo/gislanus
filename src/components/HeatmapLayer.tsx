import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface HeatmapLayerProps {
  points: HeatPoint[];
  radius?: number;
  maxIntensity?: number;
  opacity?: number;
}

export default function HeatmapLayer({
  points,
  radius = 25,
  maxIntensity = 5,
  opacity = 0.8
}: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    // Crear el elemento canvas
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = String(opacity);
    canvas.style.mixBlendMode = 'multiply'; // Permite mezclar el calor mejor con el mapa de fondo

    // Añadir el canvas al pane de overlays del mapa
    const pane = map.getPane('overlayPane');
    if (pane) {
      pane.appendChild(canvas);
    }

    // Canvas auxiliar para la textura del gradiente radial de un solo punto
    const circleCanvas = document.createElement('canvas');
    circleCanvas.width = radius * 2;
    circleCanvas.height = radius * 2;
    const circleCtx = circleCanvas.getContext('2d');
    if (circleCtx) {
      const grad = circleCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); // Negro opaco en el centro
      grad.addColorStop(1, 'rgba(0,0,0,0)'); // Transparente en el borde
      circleCtx.fillStyle = grad;
      circleCtx.fillRect(0, 0, radius * 2, radius * 2);
    }

    // Rampa de color para colorear el canvas en base a su nivel de gris acumulado (alpha)
    const rampCanvas = document.createElement('canvas');
    rampCanvas.width = 1;
    rampCanvas.height = 256;
    const rampCtx = rampCanvas.getContext('2d');
    if (rampCtx) {
      const grad = rampCtx.createLinearGradient(0, 0, 0, 256);
      // Paleta: Transparente -> Azul suave -> Verde -> Amarillo -> Naranja -> Rojo intenso
      grad.addColorStop(0.0, 'rgba(0, 0, 255, 0)');
      grad.addColorStop(0.15, 'rgba(0, 100, 255, 0.2)');
      grad.addColorStop(0.4, 'rgba(0, 255, 100, 0.5)');
      grad.addColorStop(0.65, 'rgba(255, 255, 0, 0.7)');
      grad.addColorStop(0.85, 'rgba(255, 120, 0, 0.85)');
      grad.addColorStop(1.0, 'rgba(239, 68, 68, 1.0)');
      rampCtx.fillStyle = grad;
      rampCtx.fillRect(0, 0, 1, 256);
    }
    const rampData = rampCtx ? rampCtx.getImageData(0, 0, 1, 256).data : null;

    const draw = () => {
      if (!map || !canvas) return;

      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size.x, size.y);

      // Proyectar puntos a coordenadas de pantalla (píxeles)
      const pixelCoords = points.map(p => {
        const pointLatLng = L.latLng(p.lat, p.lng);
        const containerPoint = map.latLngToContainerPoint(pointLatLng);
        return {
          x: containerPoint.x,
          y: containerPoint.y,
          intensity: p.intensity
        };
      });

      // Dibujar sombras grises acumuladas (el canal Alpha de este dibujo mide la densidad)
      for (const p of pixelCoords) {
        // La opacidad de cada círculo depende de la intensidad del punto y la escala del mapa
        const drawOpacity = Math.min(1.0, (p.intensity / maxIntensity));
        ctx.globalAlpha = drawOpacity;
        ctx.drawImage(circleCanvas, p.x - radius, p.y - radius);
      }

      // Colorear el canvas gris usando la rampa de color en base al canal de opacidad
      if (rampData) {
        const imgData = ctx.getImageData(0, 0, size.x, size.y);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const alphaValue = data[i + 3]; // La opacidad acumulada (0-255)
          if (alphaValue > 0) {
            const offset = alphaValue * 4;
            data[i] = rampData[offset];         // R
            data[i + 1] = rampData[offset + 1]; // G
            data[i + 2] = rampData[offset + 2]; // B
            // Ajustar opacidad de salida de la rampa multiplicada por el alpha del pixel
            data[i + 3] = rampData[offset + 3] * 210 / 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    };

    const updateCanvasPos = () => {
      // Alinear el canvas con el contenedor de la capa Leaflet para evitar desfases en arrastre
      const origin = map.getPixelOrigin();
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
      draw();
    };

    // Escuchar eventos de Leaflet para redibujar
    map.on('viewreset moveend resize', draw);
    map.on('move', updateCanvasPos);

    // Dibujado inicial
    updateCanvasPos();

    return () => {
      map.off('viewreset moveend resize', draw);
      map.off('move', updateCanvasPos);
      canvas.remove();
    };
  }, [map, points, radius, maxIntensity, opacity]);

  return null;
}
