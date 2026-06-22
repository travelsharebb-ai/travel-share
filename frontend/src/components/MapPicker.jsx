import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

export default function MapPicker({ mapRef, initial = { latitude: 13.0975, longitude: -59.6167 }, onChange }) {
  useEffect(() => {
    const map = mapRef && mapRef.current ? mapRef.current : null;
    if (!map) return;

    let marker = null;

    function createMarker(lng, lat) {
      if (marker) marker.remove();
      const el = document.createElement('div');
      el.className = 'mapbox-marker';
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '50%';
      el.style.background = '#0077ff';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const pos = { latitude: lngLat.lat, longitude: lngLat.lng };
        if (onChange) onChange(pos);
      });
    }

    function handleClick(e) {
      const lngLat = e.lngLat || (e.lng && { lng: e.lng, lat: e.lat });
      if (!lngLat) return;
      createMarker(lngLat.lng, lngLat.lat);
      if (onChange) onChange({ latitude: lngLat.lat, longitude: lngLat.lng });
    }

    // initial marker
    createMarker(initial.longitude, initial.latitude);

    map.on('click', handleClick);

    return () => {
      try { map.off('click', handleClick); } catch (e) {}
      try { if (marker) marker.remove(); } catch (e) {}
    };
  }, [mapRef, initial.latitude, initial.longitude, onChange]);

  return null;
}
