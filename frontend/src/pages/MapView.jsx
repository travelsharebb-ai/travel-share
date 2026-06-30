import React, { useState, useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import MapPicker from '../components/MapPicker';
import PhotoMapModal from '../components/PhotoMapModal';
import LocationSearchInput from '../components/LocationSearchInput';

const DEFAULT_VIEW = {
  latitude: 13.0975,
  longitude: -59.6167,
  zoom: 11
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: '🌍' },
  { id: 'events', label: 'Events', icon: '🎯' },
  { id: 'trips', label: 'Trips', icon: '✈️' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'nearby', label: 'Nearby', icon: '📍' }
];

export default function MapView() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [hasMapToken, setHasMapToken] = useState(false);

  const onResult = useCallback((lngLat) => {
    setView((v) => ({ ...v, latitude: lngLat.latitude, longitude: lngLat.longitude }));
    if (mapRef.current && mapRef.current.easeTo) {
      mapRef.current.easeTo({ center: [lngLat.longitude, lngLat.latitude], duration: 500 });
    }
  }, []);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    setHasMapToken(!!token);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/locations');
        if (!res.ok) return;
        const body = await res.json();
        if (!mounted) return;
        setLocations(body.locations || []);
      } catch (e) {
        console.warn('Failed to load locations', e);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN missing');
      return;
    }
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [view.longitude, view.latitude],
      zoom: view.zoom
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.on('load', () => {
      if (!map.getSource('locations')) {
        map.addSource('locations', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: 50
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'locations',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 30, '#f28cb1'],
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25]
          }
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'locations',
          filter: ['has', 'point_count'],
          layout: { 'text-field': '{point_count}', 'text-size': 12 }
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'locations',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#11b4da',
            'circle-radius': 8,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
          }
        });
      }
    });

    return () => {
      try { map.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, [containerRef]);

  // update geojson source when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true) || !map.getSource) return;
    const source = map.getSource('locations');
    if (!source) return;
    const geojson = {
      type: 'FeatureCollection',
      features: locations
        .filter(l => l.latitude && l.longitude)
        .map(l => ({
          type: 'Feature',
          properties: { id: l.id, name: l.name },
          geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] }
        }))
    };
    try { source.setData(geojson); } catch (e) { /* ignore */ }
  }, [locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = async (e) => {
      try {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters', 'unclustered-point'] });
        if (!features || !features.length) return;
        const feature = features[0];
        if (feature.properties && feature.properties.cluster) {
          const clusterId = feature.properties.cluster_id;
          const src = map.getSource('locations');
          if (src && typeof src.getClusterExpansionZoom === 'function') {
            src.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 300 });
            });
          }
          return;
        }
        const props = feature.properties || {};
        const coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : null;
        if (coords) {
          const [lng, lat] = coords;
          const candidate = locations.find(l => Number(l.latitude) === Number(lat) && Number(l.longitude) === Number(lng));
          if (candidate) {
            try {
              const res = await fetch(`/api/locations/${candidate.id}`);
              if (res.ok) {
                const body = await res.json();
                setSelectedLocation(Object.assign({}, body.location, { photos: body.photos || [] }));
                return;
              }
            } catch (e) { /* ignore */ }
          }
          const loc = candidate || { name: props.name || 'Location', address: '', latitude: lat, longitude: lng };
          setSelectedLocation(loc);
        }
      } catch (err) {
        console.warn('Map click handling failed', err);
      }
    };

    map.on('click', handleClick);
    return () => { try { map.off('click', handleClick); } catch (e) {} };
  }, [locations]);

  // show popup for selectedLocation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let popup = null;
    if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
      const el = document.createElement('div');
      el.style.minWidth = '200px';
      el.innerHTML = `<div><strong>${selectedLocation.name || 'Location'}</strong><div style="font-size:12px">${selectedLocation.address || ''}</div></div>`;
      popup = new mapboxgl.Popup({ offset: 15 })
        .setLngLat([selectedLocation.longitude, selectedLocation.latitude])
        .setDOMContent(el)
        .addTo(map);
    }
    return () => { try { if (popup) popup.remove(); } catch (e) {} };
  }, [selectedLocation]);

  const filteredLocations = locations.filter(l => {
    const matchesSearch = !searchText || l.name?.toLowerCase().includes(searchText.toLowerCase());
    return matchesSearch;
  });

  const handleCenterOnMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setView({ latitude, longitude, zoom: 13 });
        if (mapRef.current) {
          mapRef.current.easeTo({ center: [longitude, latitude], zoom: 13, duration: 500 });
        }
      });
    }
  };

  return (
    <div className="page-shell min-h-screen pb-8">
      {/* Header Hero Panel */}
      <div className="mb-8">
        <div className="hero-copy-panel">
          <h1 className="font-serif text-3xl font-bold text-white mb-2">Explore Locations</h1>
          <p className="text-slatebody mb-6">Discover events, trips, and photos from around the world</p>
          
          {/* Search Field */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search locations..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="field w-full"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                  activeFilter === filter.id
                    ? 'btn-primary'
                    : 'btn-ghost'
                }`}
              >
                <span className="mr-1">{filter.icon}</span>
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Panel */}
        <div className="lg:col-span-2">
          <div className="card p-4 min-h-96 relative overflow-hidden">
            {hasMapToken ? (
              <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '500px' }} />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg">
                <div className="text-center">
                  <div className="text-4xl mb-3">🗺️</div>
                  <h3 className="text-xl font-bold text-white mb-2">Map Not Available</h3>
                  <p className="text-slatebody text-sm mb-4 max-w-xs">
                    Please configure VITE_MAPBOX_TOKEN to enable location mapping
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-slatebody">
                    <div className="flex items-center gap-1">
                      <span>🔍</span> Search
                    </div>
                    <div className="flex items-center gap-1">
                      <span>🎯</span> Filter
                    </div>
                    <div className="flex items-center gap-1">
                      <span>📸</span> Photos
                    </div>
                    <div className="flex items-center gap-1">
                      <span>✈️</span> Trips
                    </div>
                  </div>
                </div>
              </div>
            )}
            <LocationSearchInput onSelect={onResult} />
            <MapPicker mapRef={mapRef} initial={view} onChange={(c) => setView(c)} />
          </div>
        </div>

        {/* Sidebar: Location Cards */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            {/* CTA Buttons */}
            <button
              onClick={handleCenterOnMe}
              className="btn-primary w-full"
            >
              📍 Center on Me
            </button>
            <button className="btn-indigo w-full">
              🎯 Discover Events
            </button>
            <button className="btn-ghost w-full">
              📱 Scan QR
            </button>

            {/* Location Cards */}
            <div className="mt-6">
              <h3 className="font-serif text-lg font-bold text-white mb-3">
                {activeFilter === 'all' ? 'Nearby Locations' : `${FILTER_OPTIONS.find(f => f.id === activeFilter)?.label} Locations`}
              </h3>
              {filteredLocations.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredLocations.slice(0, 5).map((location) => (
                    <div key={location.id} className="card p-3 cursor-pointer hover:bg-slate-700 transition">
                      <h4 className="font-semibold text-white text-sm mb-1">{location.name}</h4>
                      <p className="text-xs text-slatebody mb-2">{location.address || 'No address'}</p>
                      <div className="flex gap-1">
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          📍 {Math.round(Math.random() * 100)}m
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card p-6 text-center">
                  <p className="text-slatebody text-sm">
                    No locations found. {searchText && 'Try adjusting your search.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      <PhotoMapModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        location={selectedLocation}
        photos={selectedLocation?.photos || []}
      />
    </div>
  );
}
