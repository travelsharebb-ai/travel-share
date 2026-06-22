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

export default function MapView() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const containerRef = useRef(null);
  const mapRef = useRef(null); // will hold the raw mapbox-gl Map
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const onResult = useCallback((lngLat) => {
    setView((v) => ({ ...v, latitude: lngLat.latitude, longitude: lngLat.longitude }));
    if (mapRef.current && mapRef.current.easeTo) {
      mapRef.current.easeTo({ center: [lngLat.longitude, lngLat.latitude], duration: 500 });
    }
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
    if (mapRef.current) return; // already created
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN missing');
      return;
    }
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/streets-v11', center: [view.longitude, view.latitude], zoom: view.zoom });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.on('load', () => {
      // add cluster-enabled source
      if (!map.getSource('locations')) {
        map.addSource('locations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 50 });

        map.addLayer({
          id: 'clusters', type: 'circle', source: 'locations', filter: ['has', 'point_count'], paint: {
            'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 30, '#f28cb1'],
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25]
          }
        });

        map.addLayer({
          id: 'cluster-count', type: 'symbol', source: 'locations', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count}', 'text-size': 12 }
        });

        map.addLayer({
          id: 'unclustered-point', type: 'circle', source: 'locations', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#11b4da', 'circle-radius': 8, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
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
    const geojson = { type: 'FeatureCollection', features: locations.filter(l => l.latitude && l.longitude).map(l => ({ type: 'Feature', properties: { id: l.id, name: l.name }, geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] } })) };
    // setData is available on GeoJSONSource
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

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <LocationSearchInput onSelect={onResult} />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <MapPicker mapRef={mapRef} initial={view} onChange={(c) => setView(c)} />
      <PhotoMapModal open={photoModalOpen} onClose={() => setPhotoModalOpen(false)} location={selectedLocation} photos={selectedLocation?.photos || []} />
    </div>
  );
}
