import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X } from 'lucide-react';

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
    
    markerRef.current = L.marker([lat, lng]).addTo(map)
      .bindPopup(result.place_name)
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
    <div ref={containerRef} className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '10px', marginRight: '10px', zIndex: 1000 }}>
      <div style={{ position: 'relative', width: '280px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          padding: '6px 12px',
          border: '2px solid rgba(0,0,0,0.2)'
        }}>
          <Search size={18} color="#666" />
          <input 
            type="text" 
            placeholder="Buscar calle en Lanús..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowResults(true); }}
            style={{ 
              border: 'none', 
              outline: 'none', 
              width: '100%', 
              padding: '8px',
              fontSize: '14px'
            }}
          />
          {query && (
            <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={16} color="#999" />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '5px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1001
          }}>
            {results.map((r, idx) => (
              <div 
                key={idx} 
                onClick={() => handleSelectResult(r)}
                style={{ 
                  padding: '10px 12px', 
                  borderBottom: idx < results.length - 1 ? '1px solid #eee' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  backgroundColor: '#fff'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <MapPin size={16} color="#29B6F6" style={{ marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{r.text}</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{r.place_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
