import { useLanguage } from "../lib/i18n";
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export default function PhotoMapModal({ open, onClose, location, photos = [] }) {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!open || !location || !containerRef.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    // create map if not exists
    if (!mapRef.current) {
      const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/streets-v11', center: [location.longitude, location.latitude], zoom: 13 });
      mapRef.current = map;
      return () => { try { map.remove(); } catch (e) {} };
    }
    // if map exists, fly to location
    try { mapRef.current.easeTo({ center: [location.longitude, location.latitude], duration: 300 }); } catch (e) {}
  }, [open, location]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90%', height: '80%', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{location?.name || 'Location'}</strong>
          <button onClick={onClose}>{t("common.close")}</button>
        </div>
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ width: 320, overflow: 'auto', borderLeft: '1px solid #eee' }}>
            {photos.map((p) => (
              <div key={p.id} style={{ padding: 8 }}>
                <img src={p.fileUrl} alt="photo" style={{ width: '100%', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
