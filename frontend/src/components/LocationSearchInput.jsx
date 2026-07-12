import React from 'react';
import { useLanguage } from '../lib/i18n';

export default function LocationSearchInput({ onSelect }) {
  const { language, t } = useLanguage();

  React.useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN is undefined');
      return;
    }
    let geocoder;
    (async () => {
      try {
        const Geocoder = (await import('@mapbox/mapbox-gl-geocoder')).default;
        geocoder = new Geocoder({
          accessToken: token,
          marker: false,
          types: 'place,locality,address',
          language,
          placeholder: t("map.searchPlaceholder")
        });
        geocoder.on('result', (e) => {
          const c = (e.result && e.result.center) || [];
          if (c.length >= 2) {
            const [lng, lat] = c;
            const placeName = e.result.text || null;
            const address = e.result.place_name || null;
            if (onSelect) onSelect({ latitude: lat, longitude: lng, placeName, address });
          }
        });
        geocoder.addTo('#mapbox-geocoder');
      } catch (err) {
        console.warn('Failed to load mapbox geocoder', err);
      }
    })();

    return () => {
      try { if (geocoder) { geocoder.clear(); geocoder.off && geocoder.off(); } } catch (e) {}
    };
  }, [language, onSelect, t]);

  return (
    <div id="mapbox-geocoder" style={{ position: 'absolute', left: 12, top: 12, zIndex: 20, width: 320 }} />
  );
}
