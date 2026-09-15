import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

export default function MapSearch() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async (searchQuery: string) => {
    setIsSearching(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      // Bounding box para Lanus aprox: -58.4519,-34.7505,-58.3284,-34.6537
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&bbox=-58.4519,-34.7505,-58.3284,-34.6537&country=ar&language=es&types=address,poi,neighborhood`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.features) {
        setResults(data.features);
        setShowResults(true);
      }
    } catch (err) {
      console.error("Error searching Mapbox:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: any) => {
    const [lng, lat] = result.center;
    map.flyTo([lat, lng], 16);
    
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }
    
    const popupContent = `
      <div style="font-family: 'Inter', sans-serif; padding: 4px;">
        <strong style="color: #1e3a8a; font-size: 13px;">${result.text}</strong>
        <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">${result.place_name}</p>
      </div>
    `;

    markerRef.current = L.marker([lat, lng]).addTo(map)
      .bindPopup(popupContent)
      .openPopup();
      
    setShowResults(false);
    setQuery(result.text);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="map-search-box hide-on-print"
      style={{ 
        position: 'absolute', 
        top: '12px', 
        left: '52px', 
        zIndex: 1000,
        pointerEvents: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ position: 'relative', width: '310px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: 'white', 
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15), 0 2px 4px rgba(15, 23, 42, 0.05)',
          padding: '4px 10px',
          border: '1px solid #e2e8f0',
          transition: 'all 0.2s',
        }}>
          {isSearching ? (
            <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6', flexShrink: 0 }} />
          ) : (
            <Search size={16} style={{ color: '#64748b', flexShrink: 0 }} />
          )}
          <input 
            type="text" 
            placeholder="Buscar dirección en Lanús..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowResults(true); }}
            style={{ 
              border: 'none', 
              outline: 'none', 
              width: '100%', 
              padding: '6px 8px',
              fontSize: '13px',
              color: '#1e293b'
            }}
          />
          {query && (
            <button 
              onClick={clearSearch} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                borderRadius: '50%',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '6px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            maxHeight: '260px',
            overflowY: 'auto',
            zIndex: 1001
          }}>
            {results.map((r, idx) => (
              <div 
                key={idx} 
                onClick={() => handleSelectResult(r)}
                style={{ 
                  padding: '10px 12px', 
                  borderBottom: idx < results.length - 1 ? '1px solid #f1f5f9' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  backgroundColor: '#fff',
                  transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <MapPin size={15} color="#3b82f6" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{r.text}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.3 }}>{r.place_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
