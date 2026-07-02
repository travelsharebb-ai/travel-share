import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, currentUser } from '../lib/api.js';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: '🌍' },
  { id: 'events', label: 'Events', icon: '🎯' },
  { id: 'trips', label: 'Trips', icon: '✈️' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'nearby', label: 'Nearby', icon: '📍' }
];

// Barbados bounding box for preferring local results
const BARBADOS_BOUNDS = {
  minLat: 13.04,
  maxLat: 13.33,
  minLng: -59.65,
  maxLng: -59.43
};

// Mapbox style definitions
const MAP_STYLES = {
  streets: {
    id: 'streets',
    label: 'Streets',
    url: 'mapbox://styles/mapbox/streets-v12',
    icon: '🗺️'
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    icon: '🛰️'
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    url: 'mapbox://styles/mapbox/outdoors-v12',
    icon: '🏔️'
  },
  navigation: {
    id: 'navigation',
    label: 'Navigation',
    url: 'mapbox://styles/mapbox/navigation-day-v1',
    icon: '🧭'
  }
};

const DEFAULT_MAP_STYLE = 'streets';
const STORAGE_KEY_MAP_STYLE = 'travelshare_map_style';

// Traffic layer is available via Mapbox but deferred for Phase 3C.5
// Future implementation could add: map.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' })
// And layers for traffic visualization when needed.

export default function MapView() {

  // Utility: escape user-provided strings used in popup HTML
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPreviewTime(d) {
    if (!d) return 'Recently shared';
    try {
      return d.toLocaleString();
    } catch (e) {
      return 'Recently shared';
    }
  }

  // Derive country from location coordinates and address
  function deriveCountry(lat, lng, address) {
    if (!lat || !lng) return null;
    
    // Check if coordinates are in Barbados bounds
    if (
      lat >= BARBADOS_BOUNDS.minLat &&
      lat <= BARBADOS_BOUNDS.maxLat &&
      lng >= BARBADOS_BOUNDS.minLng &&
      lng <= BARBADOS_BOUNDS.maxLng
    ) {
      return 'Barbados';
    }

    // Check if address mentions Barbados
    if (address && address.toLowerCase().includes('barbados')) {
      return 'Barbados';
    }

    return null;
  }

  // Build country and region options from loaded locations
  function updateFilterOptions(locs) {
    const countries = new Set();
    const regions = new Set();

    locs.forEach((loc) => {
      const country = loc.country || deriveCountry(loc.lat, loc.lng, loc.description);
      if (country) {
        countries.add(country);
      }

      if (loc.raw?.uploads && Array.isArray(loc.raw.uploads)) {
        loc.raw.uploads.forEach((upload) => {
          if (upload.region) {
            regions.add(upload.region);
          }
        });
      }
    });

    setCountryOptions(Array.from(countries).sort());
    setRegionOptions(Array.from(regions).sort());
  }

  // Mapbox Geocoding API search with debounce
  function performMapboxSearch(query) {
    if (!query || query.trim().length < 3) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      // No token, fall back to local search only
      setSearchSuggestions([]);
      return;
    }

    const proximity = userLocation ? `${userLocation.longitude},${userLocation.latitude}` : '-59.54,13.19'; // Barbados center as a soft ranking hint only
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&autocomplete=true&proximity=${proximity}&limit=5`;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Geocoding request failed');
        return response.json();
      })
      .then((data) => {
        const suggestions = (data.features || []).map((feature) => ({
          id: feature.id,
          name: feature.place_name,
          center: feature.center,
          bbox: feature.bbox,
          placeType: feature.place_type || []
        }));
        setSearchSuggestions(suggestions);
        setShowSearchSuggestions(suggestions.length > 0);
      })
      .catch((err) => {
        // Geocoding failed, but don't crash - just hide suggestions
        setSearchSuggestions([]);
      });
  }

  // Handle search input with debouncing
  function handleSearchChange(value) {
    setSearchText(value);
    setLocalSearchText(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      performMapboxSearch(value);
    }, 300);
  }

  // Handle selecting a Mapbox search suggestion
  function handleSelectSuggestion(suggestion) {
    setSearchText(suggestion.name);
    setShowSearchSuggestions(false);

      const map = mapRef.current;
      if (!map) return;

      const [lng, lat] = suggestion.center;

    // Remove previous search result marker if it exists
    if (searchResultMarkerRef.current) {
      try {
        searchResultMarkerRef.current.remove();
      } catch (e) {
        console.error('Error removing search result marker:', e);
      }
      searchResultMarkerRef.current = null;
    }

    // Create a temporary search result marker
    const el = document.createElement('div');
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.backgroundImage = 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path><circle cx="12" cy="12" r="2"></circle></svg>)';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.color = '#ef4444';

      const addSearchResultMarker = () => {
        searchResultMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${escapeHtml(suggestion.name)}</strong>`))
          .addTo(map);

        const placeType = Array.isArray(suggestion.placeType) ? suggestion.placeType[0] : suggestion.placeType;
        let zoom = 12;
        if (placeType === 'country') zoom = 5;
        else if (placeType === 'region' || placeType === 'district' || placeType === 'postcode') zoom = 6;
        else if (placeType === 'place' || placeType === 'locality' || placeType === 'neighborhood' || placeType === 'town') zoom = 11;
        else if (placeType === 'address' || placeType === 'poi' || placeType === 'street') zoom = 15;

        if (suggestion.bbox && suggestion.bbox.length === 4) {
          const [minLng, minLat, maxLng, maxLat] = suggestion.bbox;
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
            padding: 80,
            duration: 1000
          });
        } else {
          map.flyTo({
            center: [lng, lat],
            zoom,
            essential: true,
            duration: 1000
          });
        }
      };

      if (map.loaded && !map.loaded()) {
        const handleLoad = () => {
          addSearchResultMarker();
          if (typeof map.off === 'function') {
            try {
              map.off('load', handleLoad);
            } catch {
              // ignore cleanup failures
            }
          }
        };
        map.on('load', handleLoad);
      } else {
        addSearchResultMarker();
      }
    }
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const normalMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const clustersRef = useRef({ added: false, handlers: {} });
  
  const [searchText, setSearchText] = useState('');
  const [localSearchText, setLocalSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geolocationError, setGeolocationError] = useState('');
  const [locationStatusMessage, setLocationStatusMessage] = useState('');
  const [mapError, setMapError] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [countryFilter, setCountryFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [countryOptions, setCountryOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminLocations, setAdminLocations] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [selectedAdminLocationId, setSelectedAdminLocationId] = useState(null);
  const [selectedAdminLocation, setSelectedAdminLocation] = useState(null);
  const [adminMoveMode, setAdminMoveMode] = useState(false);
  const [adminPendingMove, setAdminPendingMove] = useState(null);
  const [adminActionError, setAdminActionError] = useState('');

  const isAdminUser = ["admin", "platform_admin"].includes(currentUser()?.role);

  function normalizeAdminLocation(item) {
    const preview = Array.isArray(item.uploads) && item.uploads.length ? item.uploads[0] : null;
    const eventCount = preview?.eventId ? 1 : 0;
    const tripCount = preview?.tripId ? 1 : 0;
    const photoCount = item._count?.uploads || 0;
    const normalizedType = eventCount ? 'event' : tripCount ? 'trip' : photoCount ? 'photo' : null;
    return {
      id: item.id,
      title: item.name,
      description: item.address,
      type: normalizedType,
      lat: item.latitude,
      lng: item.longitude,
      country: null,
      city: null,
      imageUrl: preview?.fileUrl || null,
      previewTitle: preview?.caption || null,
      previewUser: null,
      previewCreatedAt: preview?.createdAt ? new Date(preview.createdAt) : null,
      hasPhoto: photoCount > 0,
      raw: item,
      featured: item.featured,
      hidden: item.hidden
    };
  }
  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);
  const [showLayerControl, setShowLayerControl] = useState(false);
  const mapLoadedRef = useRef(false);
  const locatingTimerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const searchResultMarkerRef = useRef(null);
  const styleLoadingRef = useRef(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const replayTimerRef = useRef(null);
  const [mapMode, setMapMode] = useState('pins');
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [replayPoints, setReplayPoints] = useState([]);
  const [overlayError, setOverlayError] = useState('');
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [isAddPostMode, setIsAddPostMode] = useState(false);
  const [pendingPostLocation, setPendingPostLocation] = useState(null);
  const [pendingPostAddress, setPendingPostAddress] = useState(null);
  const [pendingLocationPrivacy, setPendingLocationPrivacy] = useState('approximate');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [reverseGeocodeError, setReverseGeocodeError] = useState('');
  const pendingPostMarkerRef = useRef(null);
  const controlsAddedRef = useRef(false);

  const navigate = useNavigate();

  // Load map style from localStorage on mount
  useEffect(() => {
    const savedStyle = localStorage.getItem(STORAGE_KEY_MAP_STYLE);
    if (savedStyle && MAP_STYLES[savedStyle]) {
      setMapStyle(savedStyle);
    }
  }, [mapStyle]);

  const createUserMarker = ({ lat, lng, latitude, longitude, accuracy, source }) => {
    const markerLat = latitude ?? lat;
    const markerLng = longitude ?? lng;
    if (markerLat == null || markerLng == null || !mapRef.current) return;
    if (userMarkerRef.current) {
      try {
        userMarkerRef.current.remove();
      } catch (removeError) {
        console.error('Error removing existing user marker:', removeError);
      }
      userMarkerRef.current = null;
    }

    const dot = document.createElement('div');
    dot.className = 'user-location-dot';
    dot.setAttribute('aria-label', 'Your current location');
    dot.title = 'Your current location';
    dot.innerHTML = '●';
    Object.assign(dot.style, {
      width: '34px',
      height: '34px',
      borderRadius: '9999px',
      background: '#2563eb',
      border: '5px solid #ffffff',
      boxShadow: '0 0 0 10px rgba(37,99,235,0.35), 0 8px 24px rgba(0,0,0,0.6)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: '900',
      position: 'relative',
      zIndex: '999999',
      pointerEvents: 'auto'
    });

    userMarkerRef.current = new mapboxgl.Marker({
      element: dot,
      anchor: 'center',
      offset: [0, 0]
    })
      .setLngLat([markerLng, markerLat])
      .setPopup(
        new mapboxgl.Popup({ offset: 20 }).setHTML(
          `<strong>You are here</strong><br/>Accuracy: about ${Math.round(accuracy || 0)} meters`
        )
      )
      .addTo(mapRef.current);

    const markerEl = userMarkerRef.current.getElement();
    markerEl.style.zIndex = '999999';
    markerEl.style.pointerEvents = 'auto';

    if (mapRef.current) {
      try {
        if (source === 'geolocation' || source === 'saved') {
          mapRef.current.flyTo({
            center: [markerLng, markerLat],
            zoom: 14,
            essential: true
          });
        }
      } catch (flyError) {
        console.error('Error centering map on user marker:', flyError);
      }
    }
  };

  // Add standard Mapbox controls to the map
  function addMapControls(map) {
    try {
      if (controlsAddedRef.current) return;
      // Remove existing controls
      document.querySelectorAll('.mapboxgl-ctrl').forEach((ctrl) => {
        if (ctrl.parentElement) {
          ctrl.parentElement.removeChild(ctrl);
        }
      });

      // Add navigation control
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add scale control
      map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

      // Add fullscreen control
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      controlsAddedRef.current = true;
    } catch (err) {
      console.error('Error adding Mapbox controls:', err);
    }
  }

  function cleanupClusterHandlers(map) {
    if (!isMapUsable(map) || !clustersRef.current.added) return;
    try {
      const { onClusterClick, onUnclusteredClick, onMouseEnter, onMouseLeave } = clustersRef.current.handlers;
      if (onClusterClick) {
        try {
          map.off('click', 'clusters', onClusterClick);
        } catch (err) {
          // ignore cleanup failures
        }
      }
      if (onUnclusteredClick) {
        try {
          map.off('click', 'unclustered-point', onUnclusteredClick);
        } catch (err) {
          // ignore cleanup failures
        }
      }
      if (onMouseEnter) {
        try {
          map.off('mouseenter', 'clusters', onMouseEnter);
        } catch (err) {
          // ignore cleanup failures
        }
      }
      if (onMouseLeave) {
        try {
          map.off('mouseleave', 'clusters', onMouseLeave);
        } catch (err) {
          // ignore cleanup failures
        }
      }
      if (onMouseEnter) {
        try {
          map.off('mouseenter', 'unclustered-point', onMouseEnter);
        } catch (err) {
          // ignore cleanup failures
        }
      }
      if (onMouseLeave) {
        try {
          map.off('mouseleave', 'unclustered-point', onMouseLeave);
        } catch (err) {
          // ignore cleanup failures
        }
      }
    } catch {
      // ignore cleanup failures
    }
    clustersRef.current = { added: false, handlers: {} };
  }

  function isMapUsable(map) {
    return (
      map &&
      typeof map.getStyle === 'function' &&
      typeof map.removeLayer === 'function' &&
      typeof map.removeSource === 'function' &&
      typeof map.off === 'function' &&
      !map._removed
    );
  }

  function getSafeStyle(map) {
    try {
      if (!isMapUsable(map)) return null;
      return map.getStyle?.() || null;
    } catch {
      return null;
    }
  }

  function safeLayerExists(map, layerId) {
    const style = getSafeStyle(map);
    return Boolean(style?.layers?.some((layer) => layer.id === layerId));
  }

  function safeSourceExists(map, sourceId) {
    const style = getSafeStyle(map);
    return Boolean(style?.sources?.[sourceId]);
  }

  function buildHeatmapGeoJSON(points) {
    return {
      type: 'FeatureCollection',
      features: points
        .filter((point) => point.latitude != null && point.longitude != null)
        .map((point, index) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
          properties: {
            id: point.id || index,
            weight: point.weight || point.count || 1
          }
        }))
    };
  }

  function buildReplayTrailGeoJSON(index) {
    return {
      type: 'FeatureCollection',
      features: replayPoints
        .slice(0, index + 1)
        .filter((point) => point.latitude != null && point.longitude != null)
        .map((point, idx) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
          properties: {
            id: point.id || idx
          }
        }))
    };
  }

  function buildReplayCurrentGeoJSON(index) {
    const point = replayPoints[index];
    if (!point || point.latitude == null || point.longitude == null) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
        properties: { id: point.id }
      }]
    };
  }

  function removeHeatmapOverlay(map) {
    if (!isMapUsable(map)) return;
    if (safeLayerExists(map, 'heatmap-layer')) {
      try { map.removeLayer('heatmap-layer'); } catch {}
    }
    if (safeSourceExists(map, 'heatmap-points')) {
      try { map.removeSource('heatmap-points'); } catch {}
    }
  }

  function removeReplayOverlay(map) {
    if (!isMapUsable(map)) return;
    ['replay-trail', 'replay-current'].forEach((layerId) => {
      if (safeLayerExists(map, layerId)) {
        try { map.removeLayer(layerId); } catch {}
      }
    });
    ['replay-trail-source', 'replay-current-source'].forEach((sourceId) => {
      if (safeSourceExists(map, sourceId)) {
        try { map.removeSource(sourceId); } catch {}
      }
    });
  }

  function addHeatmapOverlay(map) {
    if (!isMapUsable(map) || !heatmapPoints.length) return;
    const data = buildHeatmapGeoJSON(heatmapPoints);
    if (safeSourceExists(map, 'heatmap-points')) {
      try { map.getSource('heatmap-points').setData(data); } catch {}
    } else {
      try {
        map.addSource('heatmap-points', { type: 'geojson', data });
      } catch (err) {
        console.error('Failed to add heatmap source:', err);
      }
    }
    if (!safeLayerExists(map, 'heatmap-layer')) {
      try {
        map.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'heatmap-points',
          maxzoom: 15,
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 10, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(59, 130, 246, 0)',
              0.2, 'rgba(59, 130, 246, 0.25)',
              0.4, 'rgba(37, 99, 235, 0.45)',
              0.6, 'rgba(79, 70, 229, 0.6)',
              1, 'rgba(124, 58, 237, 0.8)'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 9, 40],
            'heatmap-opacity': 0.7
          }
        });
      } catch (err) {
        console.error('Failed to add heatmap layer:', err);
      }
    }
  }

  function addReplayOverlay(map) {
    if (!isMapUsable(map) || !replayPoints.length) return;
    const trailData = buildReplayTrailGeoJSON(replayIndex);
    const currentData = buildReplayCurrentGeoJSON(replayIndex);
    if (safeSourceExists(map, 'replay-trail-source')) {
      try { map.getSource('replay-trail-source').setData(trailData); } catch {}
    } else {
      try { map.addSource('replay-trail-source', { type: 'geojson', data: trailData }); } catch (err) { console.error('Failed to add replay trail source:', err); }
    }
    if (safeSourceExists(map, 'replay-current-source')) {
      try { map.getSource('replay-current-source').setData(currentData); } catch {}
    } else {
      try { map.addSource('replay-current-source', { type: 'geojson', data: currentData }); } catch (err) { console.error('Failed to add replay current source:', err); }
    }
    if (!safeLayerExists(map, 'replay-trail')) {
      try {
        map.addLayer({
          id: 'replay-trail',
          type: 'line',
          source: 'replay-trail-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#60a5fa',
            'line-opacity': 0.85,
            'line-width': 4
          }
        });
      } catch (err) {
        console.error('Failed to add replay trail layer:', err);
      }
    }
    if (!safeLayerExists(map, 'replay-current')) {
      try {
        map.addLayer({
          id: 'replay-current',
          type: 'circle',
          source: 'replay-current-source',
          paint: {
            'circle-radius': 10,
            'circle-color': '#38bdf8',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });
      } catch (err) {
        console.error('Failed to add replay current layer:', err);
      }
    }
  }

  function restoreActiveOverlay(map) {
    if (!isMapUsable(map)) return;
    if (mapMode === 'heatmap') {
      addHeatmapOverlay(map);
    } else if (mapMode === 'replay') {
      addReplayOverlay(map);
    }
  }

  function handleMapModeChange(newMode) {
    setMapMode(newMode);
    if (newMode !== 'replay') {
      setReplayPlaying(false);
      setReplayIndex(0);
    }
  }

  async function reverseGeocodeCoordinates(lat, lng) {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      return null;
    }

    setIsReverseGeocoding(true);
    setReverseGeocodeError('');
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${token}&limit=1`
      );
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      const data = await response.json();
      const feature = Array.isArray(data.features) ? data.features[0] : null;
      if (!feature) return null;

      let city = null;
      let region = null;
      let country = null;

      (feature.context || []).forEach((contextItem) => {
        if (!contextItem || !contextItem.id) return;
        if (!city && contextItem.id.startsWith('place')) city = contextItem.text;
        if (!region && contextItem.id.startsWith('region')) region = contextItem.text;
        if (!country && contextItem.id.startsWith('country')) country = contextItem.text;
      });

      if (!city && Array.isArray(feature.place_type) && feature.place_type.includes('place')) {
        city = feature.text;
      }

      return {
        address: feature.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        city,
        region,
        country
      };
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
      setReverseGeocodeError('Unable to resolve address for this location. Showing coordinates only.');
      return null;
    } finally {
      setIsReverseGeocoding(false);
    }
  }

  async function updatePendingPostLocation(lat, lng) {
    if (!mapRef.current) return;
    const nextLocation = { lat, lng };
    setPendingPostLocation(nextLocation);
    setPendingPostAddress(null);

    if (!pendingPostMarkerRef.current) {
      const markerEl = document.createElement('div');
      markerEl.style.width = '30px';
      markerEl.style.height = '30px';
      markerEl.style.borderRadius = '50%';
      markerEl.style.background = '#2563eb';
      markerEl.style.border = '3px solid white';
      markerEl.style.boxShadow = '0 0 0 8px rgba(37, 99, 235, 0.25)';
      markerEl.style.cursor = 'grab';

      const marker = new mapboxgl.Marker({ element: markerEl, draggable: true })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      marker.on('dragend', async () => {
        const position = marker.getLngLat();
        setPendingPostLocation({ lat: position.lat, lng: position.lng });
        const result = await reverseGeocodeCoordinates(position.lat, position.lng);
        setPendingPostAddress(result);
      });

      pendingPostMarkerRef.current = marker;
    } else {
      pendingPostMarkerRef.current.setLngLat([lng, lat]);
    }

    const addressResult = await reverseGeocodeCoordinates(lat, lng);
    setPendingPostAddress(addressResult);
  }

  function clearPendingPostSelection() {
    setIsAddPostMode(false);
    setPendingPostLocation(null);
    setPendingPostAddress(null);
    setPendingLocationPrivacy('approximate');
    setReverseGeocodeError('');
    if (pendingPostMarkerRef.current) {
      try {
        pendingPostMarkerRef.current.remove();
      } catch (e) {
        console.error('Error removing pending post marker:', e);
      }
      pendingPostMarkerRef.current = null;
    }
  }

  // Re-initialize clustering layers and handlers after style change
  function reinitializeClustering(map, data) {
    try {
      if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;

      // Remove old layers if they exist
      ['clusters', 'cluster-count', 'unclustered-point'].forEach((layerId) => {
        if (safeLayerExists(map, layerId)) {
          try {
            map.removeLayer(layerId);
          } catch (e) {
            // ignore
          }
        }
      });

      // Remove old source if it exists
      if (safeSourceExists(map, 'locations')) {
        try {
          map.removeSource('locations');
        } catch (e) {
          // ignore
        }
      }

      // Re-add source
      map.addSource('locations', {
        type: 'geojson',
        data,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      // Re-add layers
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'locations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 50, '#f28cb1'],
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 26, 50, 36],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'locations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: { 'text-color': '#000' }
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'locations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#4f46e5',
          'circle-radius': 12,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Re-attach event handlers
      const onClusterClick = (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        const coordinates = features[0].geometry.coordinates;
        map.getSource('locations').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: coordinates, zoom, duration: 500 });
        });
      };

      const onUnclusteredClick = (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const coords = feature.geometry.coordinates.slice();
        const props = feature.properties || {};

        const previewImage = props.previewImage ? `<div style="margin-bottom:8px;"><img src="${props.previewImage}" alt="preview" style="width:220px;height:120px;object-fit:cover;border-radius:6px;display:block;"/></div>` : '';
        const previewTitle = props.previewTitle || props.title || 'Community post';
        const previewUser = props.previewUser ? `<small style="color:#444;">by ${escapeHtml(props.previewUser)}</small>` : `<small style="color:#444;">Community post</small>`;
        const previewTime = props.previewCreatedAt ? `<div style="color:#666;font-size:12px;margin-top:6px;">${formatPreviewTime(new Date(props.previewCreatedAt))}</div>` : `<div style="color:#666;font-size:12px;margin-top:6px;">Recently shared</div>`;

        const html = `<div style="padding:8px;font-size:14px;max-width:260px;">${previewImage}<strong>${escapeHtml(previewTitle)}</strong><br/><small>${escapeHtml(props.description || 'No address')}</small><br/>${previewUser}${previewTime}</div>`;

        new mapboxgl.Popup({ offset: 25 }).setLngLat(coords).setHTML(html).addTo(map);
      };

      const onMouseEnter = () => map.getCanvas().style.cursor = 'pointer';
      const onMouseLeave = () => map.getCanvas().style.cursor = '';

      map.on('click', 'clusters', onClusterClick);
      map.on('click', 'unclustered-point', onUnclusteredClick);
      map.on('mouseenter', 'clusters', onMouseEnter);
      map.on('mouseleave', 'clusters', onMouseLeave);
      map.on('mouseenter', 'unclustered-point', onMouseEnter);
      map.on('mouseleave', 'unclustered-point', onMouseLeave);

      clustersRef.current = {
        added: true,
        handlers: { onClusterClick, onUnclusteredClick, onMouseEnter, onMouseLeave }
      };
    } catch (err) {
      console.error('Failed to reinitialize clustering after style change:', err);
    }
  }

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';

    async function loadLocations() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBase}/api/locations`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const body = await response.json();
        const rawLocations = Array.isArray(body?.locations) ? body.locations : [];

        const normalizedLocations = rawLocations.map((item) => {
          const eventCount = Number(item?.mapMeta?.eventCount || 0);
          const tripCount = Number(item?.mapMeta?.tripCount || 0);
          const photoCount = Number(item?.mapMeta?.photoCount || 0);

          const normalizedType = eventCount > 0 ? 'event' : tripCount > 0 ? 'trip' : photoCount > 0 ? 'photo' : null;

          const preview = item?.preview || null;
          const imageUrl = preview?.imageUrl || null;
          const previewTitle = preview?.title || null;
          const previewUser = preview?.userDisplayName || null;
          const previewCreatedAt = preview?.createdAt ? new Date(preview.createdAt) : null;

          return {
            id: item?.id ?? null,
            title: item?.name ?? null,
            description: item?.address ?? null,
            type: normalizedType,
            lat: item?.latitude ?? null,
            lng: item?.longitude ?? null,
            country: null,
            city: null,
            imageUrl,
            previewTitle,
            previewUser,
            previewCreatedAt,
            featured: item?.featured || false,
            eventId: eventCount > 0 ? null : null,
            tripId: tripCount > 0 ? null : null,
            hasPhoto: photoCount > 0,
            raw: item
          };
        });

        setLocations(normalizedLocations);
        updateFilterOptions(normalizedLocations);
      } catch (loadError) {
        console.error('Failed to load locations', loadError);
        setError('Unable to load locations right now.');
        setLocations([]);
      } finally {
        setLoading(false);
      }
    }

    loadLocations();
  }, []);

  useEffect(() => {
    if (!isAdminUser || !isAdminView) return;
    async function loadAdminLocations() {
      setAdminLoading(true);
      setAdminError('');
      try {
        const data = await api('/api/admin/map/locations');
        setAdminLocations(Array.isArray(data.locations) ? data.locations.map(normalizeAdminLocation) : []);
      } catch (err) {
        console.error('Failed to load admin map locations', err);
        setAdminError('Unable to load admin map locations.');
        setAdminLocations([]);
      } finally {
        setAdminLoading(false);
      }
    }
    loadAdminLocations();
  }, [isAdminUser, isAdminView]);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';

    async function loadOverlayData() {
      try {
        const results = await Promise.allSettled([
          fetch(`${apiBase}/api/locations/heatmap?limit=500`),
          fetch(`${apiBase}/api/locations/replay?limit=500`)
        ]);

        let hadOverlayError = false;

        if (results[0].status === 'fulfilled' && results[0].value.ok) {
          try {
            const heatmapBody = await results[0].value.json();
            setHeatmapPoints(Array.isArray(heatmapBody.heatmap) ? heatmapBody.heatmap : []);
          } catch (heatmapParseError) {
            console.error('Failed to parse heatmap overlay response:', heatmapParseError);
            setHeatmapPoints([]);
            hadOverlayError = true;
          }
        } else {
          console.error('Failed to load heatmap overlay data:', results[0].status === 'rejected' ? results[0].reason : results[0].value);
          setHeatmapPoints([]);
          hadOverlayError = true;
        }

        if (results[1].status === 'fulfilled' && results[1].value.ok) {
          try {
            const replayBody = await results[1].value.json();
            setReplayPoints(Array.isArray(replayBody.replay) ? replayBody.replay : []);
          } catch (replayParseError) {
            console.error('Failed to parse replay overlay response:', replayParseError);
            setReplayPoints([]);
            hadOverlayError = true;
          }
        } else {
          console.error('Failed to load replay overlay data:', results[1].status === 'rejected' ? results[1].reason : results[1].value);
          setReplayPoints([]);
          hadOverlayError = true;
        }

        setOverlayError(hadOverlayError ? 'Heatmap/replay data is unavailable right now.' : '');
      } catch (err) {
        console.error('Failed to load heatmap/replay data:', err);
        setHeatmapPoints([]);
        setReplayPoints([]);
        setOverlayError('Heatmap/replay data is unavailable right now.');
      }
    }
    loadOverlayData();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapUsable(map) || !map.isStyleLoaded?.()) return;
    if (mapMode === 'heatmap') {
      removeReplayOverlay(map);
      addHeatmapOverlay(map);
    } else if (mapMode === 'replay') {
      removeHeatmapOverlay(map);
      addReplayOverlay(map);
    } else {
      removeHeatmapOverlay(map);
      removeReplayOverlay(map);
    }
  }, [mapMode, heatmapPoints, replayPoints, replayIndex]);

  useEffect(() => {
    if (!replayPlaying || mapMode !== 'replay' || replayPoints.length === 0) {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      return;
    }
    if (replayIndex >= replayPoints.length - 1) {
      setReplayPlaying(false);
      return;
    }
    const intervalMs = 1200 / Math.max(replaySpeed, 1);
    replayTimerRef.current = window.setInterval(() => {
      setReplayIndex((current) => {
        if (current >= replayPoints.length - 1) {
          window.clearInterval(replayTimerRef.current);
          replayTimerRef.current = null;
          return current;
        }
        return current + 1;
      });
    }, intervalMs);
    return () => {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [replayPlaying, replaySpeed, replayPoints.length, mapMode]);

  useEffect(() => {
    if (!selectedAdminLocationId) {
      setSelectedAdminLocation(null);
      return;
    }
    async function loadLocationDetails() {
      setAdminError('');
      try {
        const data = await api(`/api/admin/map/locations/${selectedAdminLocationId}`);
        setSelectedAdminLocation(data.location || null);
      } catch (err) {
        console.error('Failed to load selected admin location', err);
        setAdminError('Unable to load selected location details.');
        setSelectedAdminLocation(null);
      }
    }
    loadLocationDetails();
  }, [selectedAdminLocationId]);

  // Define filteredLocations early, before any effects that use it
  const effectiveLocations = isAdminView ? adminLocations : locations;
  const filteredLocations = effectiveLocations.filter((location) => {
    const searchValue = localSearchText.trim().toLowerCase();
    const searchableText = [
      location.title,
      location.description,
      location.city,
      location.country,
      location.type
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    if (!matchesSearch) return false;

    // Filter by country if selected
    if (countryFilter) {
      const locationCountry = location.country || deriveCountry(location.lat, location.lng, location.description);
      if (locationCountry !== countryFilter) return false;
    }

    // Filter by region if selected
    if (regionFilter && location.raw?.uploads) {
      const hasRegion = location.raw.uploads.some((upload) => upload.region === regionFilter);
      if (!hasRegion) return false;
    }

    if (activeFilter === 'all') return true;
    if (activeFilter === 'events') return location.type === 'event' || Boolean(location.raw?.mapMeta?.eventCount);
    if (activeFilter === 'trips') return location.type === 'trip' || Boolean(location.raw?.mapMeta?.tripCount);
    if (activeFilter === 'photos') return location.hasPhoto || Boolean(location.raw?.mapMeta?.photoCount);
    if (activeFilter === 'nearby') {
      if (!userLocation) {
        return false;
      }

      if (location.lat == null || location.lng == null) {
        return false;
      }

      return true;
    }

    return true;
  });

  const nearbyMessage = activeFilter === 'nearby' && !userLocation
    ? 'Nearby requires location access before results can be shown.'
    : '';

  const accuracyMessage = userLocation?.accuracy
    ? `Location accuracy: about ${Math.round(userLocation.accuracy)} meters`
    : '';

  // Handle map style change
  function handleChangeMapStyle(newStyleId) {
    if (!mapRef.current || styleLoadingRef.current) return;

    const newStyle = MAP_STYLES[newStyleId];
    if (!newStyle) return;

    if (newStyleId === mapStyle) return;

    styleLoadingRef.current = true;
    setStyleLoading(true);
    setMapStyle(newStyleId);
    localStorage.setItem(STORAGE_KEY_MAP_STYLE, newStyleId);
    setShowLayerControl(false);

    const map = mapRef.current;

    // Store current map state before style change
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    cleanupClusterHandlers(map);
    controlsAddedRef.current = false;
    removeHeatmapOverlay(map);
    removeReplayOverlay(map);
    // Set new style with stable reload
    map.setStyle(newStyle.url, { diff: false });

    // Wait for style to load, then reinitialize clustering
    const handleStyleLoad = () => {
      // Build GeoJSON data from current filtered locations
      const features = (filteredLocations || locations)
        .filter((loc) => loc.lat != null && loc.lng != null)
        .map((loc) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
          properties: {
            id: loc.id,
            title: loc.title || '',
            description: loc.description || '',
            type: loc.type || '',
            previewImage: loc.imageUrl || '',
            previewTitle: loc.previewTitle || '',
            previewUser: loc.previewUser || '',
            previewCreatedAt: loc.previewCreatedAt ? loc.previewCreatedAt.toISOString() : ''
          }
        }));

      const data = { type: 'FeatureCollection', features };

      // Reinitialize clustering
      reinitializeClustering(map, data);

      // Restore map position
      try {
        map.setCenter(currentCenter);
        map.setZoom(currentZoom);
        map.setBearing(currentBearing);
        map.setPitch(currentPitch);
      } catch (err) {
        console.error('Error restoring map position after style change:', err);
      }

      // Restore user marker if it exists
      if (userLocation) {
        try {
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
            userMarkerRef.current = null;
          }
        } catch (e) {
          // ignore
        }
        createUserMarker({ ...userLocation, source: 'style-switch' });
      }

      // Re-add standard controls if needed
      addMapControls(map);
      restoreActiveOverlay(map);

        if (map && typeof map.off === 'function') {
          try {
            map.off('style.load', handleStyleLoad);
          } catch {
            // ignore cleanup failures
          }
        }
      styleLoadingRef.current = false;
      setStyleLoading(false);
    };

    map.once('style.load', handleStyleLoad);
  }

  // Initialize Mapbox map
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    
    if (!token) {
      setMapError('Mapbox token required');
      return;
    }

    if (!containerRef.current) return;

    try {
      mapboxgl.accessToken = token;
      
      // Create map if not already created
      if (!mapRef.current) {
        const currentStyle = MAP_STYLES[mapStyle] || MAP_STYLES[DEFAULT_MAP_STYLE];
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: currentStyle.url,
          center: [-95.7129, 37.0902], // Default center (USA center)
          zoom: 3
        });

        map.on('load', () => {
          mapLoadedRef.current = true;
          addMapControls(map);
          if (userLocation) {
            // Marker will be created from userLocation useEffect once map is loaded
          }
        });

        map.on('error', (e) => {
          console.error('Mapbox error:', e);
          setMapError('Map Error: Unable to load map');
        });

        mapRef.current = map;
      }
    } catch (initError) {
      console.error('Mapbox initialization error:', initError);
      setMapError('Map Error: Unable to initialize');
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          mapRef.current = null;
          normalMarkersRef.current = [];
          if (userMarkerRef.current) {
            try {
              userMarkerRef.current.remove();
            } catch (removeError) {
              console.error('Error removing user marker on cleanup:', removeError);
            }
            userMarkerRef.current = null;
          }
            if (pendingPostMarkerRef.current) {
              try {
                pendingPostMarkerRef.current.remove();
              } catch (removeError) {
                console.error('Error removing pending post marker on cleanup:', removeError);
              }
              pendingPostMarkerRef.current = null;
            }
        } catch (e) {
          console.error('Error cleaning up map:', e);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = (e) => {
      if (!isAddPostMode) return;
      if (!e.lngLat) return;
      updatePendingPostLocation(e.lngLat.lat, e.lngLat.lng);
    };

    map.on('click', handleMapClick);
    return () => {
      if (map && typeof map.off === 'function') {
        try {
          map.off('click', handleMapClick);
        } catch {
          // ignore cleanup failures
        }
      }
    };
  }, [isAddPostMode]);

  useEffect(() => {
    if (!mapRef.current || !adminMoveMode || !selectedAdminLocationId) return;
    const map = mapRef.current;
    setAdminActionError('');
    const handleAdminMoveClick = (e) => {
      if (!e.lngLat) return;
      setAdminPendingMove({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setAdminMoveMode(false);
    };
    map.getCanvas().style.cursor = 'crosshair';
    map.once('click', handleAdminMoveClick);
    return () => {
      if (map && typeof map.off === 'function') {
        try {
          map.off('click', handleAdminMoveClick);
        } catch {
          // ignore cleanup failures
        }
      }
      if (map.getCanvas) map.getCanvas().style.cursor = '';
    };
  }, [adminMoveMode, selectedAdminLocationId]);

  useEffect(() => {
    return () => {
      if (locatingTimerRef.current) {
        clearTimeout(locatingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!userLocation) {
      return;
    }

    const createMarker = () => {
      if (!userLocation) return;
      createUserMarker({ ...userLocation, source: 'effect' });
    };

    if (!map.loaded()) {
      const handleLoad = () => {
        createMarker();
        if (map && typeof map.off === 'function') {
          try {
            map.off('load', handleLoad);
          } catch {
            // ignore cleanup failures
          }
        }
      };
      map.on('load', handleLoad);
      return () => {
        if (map && typeof map.off === 'function') {
          try {
            map.off('load', handleLoad);
          } catch {
            // ignore cleanup failures
          }
        }
      };
    }

    if (!userMarkerRef.current) {
      createMarker();
    }
    return () => {
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.remove();
        } catch (removeError) {
          console.error('Error cleaning up user marker:', removeError);
        }
        userMarkerRef.current = null;
      }
    };
  }, [userLocation]);

  // Use a GeoJSON source with Mapbox clustering for filtered locations
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Build GeoJSON from filteredLocations
    const features = filteredLocations
      .filter((loc) => loc.lat != null && loc.lng != null)
      .map((loc) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
        properties: {
          id: loc.id,
          title: loc.title || '',
          description: loc.description || '',
          type: loc.type || '',
          previewImage: loc.imageUrl || '',
          previewTitle: loc.previewTitle || '',
          previewUser: loc.previewUser || '',
          previewCreatedAt: loc.previewCreatedAt ? loc.previewCreatedAt.toISOString() : ''
        }
      }));

    const data = { type: 'FeatureCollection', features };

    const setupClusters = () => {
      try {
        if (!map.isStyleLoaded || !map.isStyleLoaded()) {
          // Style not ready yet
          return;
        }

        // If source exists, just update data
        if (map.getSource && map.getSource('locations')) {
          try {
            map.getSource('locations').setData(data);
          } catch (err) {
            console.error('Failed to set data on locations source', err);
          }
          return;
        }

        // Add clustered GeoJSON source if missing
        if (!map.getSource || !map.addSource) return;
        if (!map.getSource('locations')) {
          map.addSource('locations', { type: 'geojson', data, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
        }

        // Add layers only if they don't already exist
        if (!map.getLayer('clusters')) {
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'locations',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 50, '#f28cb1'],
              'circle-radius': ['step', ['get', 'point_count'], 18, 10, 26, 50, 36],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff'
            }
          });
        }

        if (!map.getLayer('cluster-count')) {
          map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'locations',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': '{point_count_abbreviated}',
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12
            },
            paint: { 'text-color': '#000' }
          });
        }

        if (!map.getLayer('unclustered-point')) {
          map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'locations',
            filter: ['!',['has','point_count']],
            paint: {
              'circle-color': '#4f46e5',
              'circle-radius': 12,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
        }

        // Only attach handlers once
        if (!clustersRef.current.added) {
          const onClusterClick = (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            if (!features.length) return;
            const clusterId = features[0].properties.cluster_id;
            const coordinates = features[0].geometry.coordinates;
            map.getSource('locations').getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              map.easeTo({ center: coordinates, zoom, duration: 500 });
            });
          };

          const onUnclusteredClick = (e) => {
            const feature = e.features && e.features[0];
            if (!feature) return;
            const coords = feature.geometry.coordinates.slice();
            const props = feature.properties || {};

            const previewImage = props.previewImage ? `<div style="margin-bottom:8px;"><img src="${props.previewImage}" alt="preview" style="width:220px;height:120px;object-fit:cover;border-radius:6px;display:block;"/></div>` : '';
            const previewTitle = props.previewTitle || props.title || 'Community post';
            const previewUser = props.previewUser ? `<small style="color:#444;">by ${escapeHtml(props.previewUser)}</small>` : `<small style="color:#444;">Community post</small>`;
            const previewTime = props.previewCreatedAt ? `<div style="color:#666;font-size:12px;margin-top:6px;">${formatPreviewTime(new Date(props.previewCreatedAt))}</div>` : `<div style="color:#666;font-size:12px;margin-top:6px;">Recently shared</div>`;

            const html = `<div style="padding:8px;font-size:14px;max-width:260px;">${previewImage}<strong>${escapeHtml(previewTitle)}</strong><br/><small>${escapeHtml(props.description || 'No address')}</small><br/>${previewUser}${previewTime}</div>`;

            new mapboxgl.Popup({ offset: 25 }).setLngLat(coords).setHTML(html).addTo(map);
          };

          const onMouseEnter = () => map.getCanvas().style.cursor = 'pointer';
          const onMouseLeave = () => map.getCanvas().style.cursor = '';

          map.on('click', 'clusters', onClusterClick);
          map.on('click', 'unclustered-point', onUnclusteredClick);
          map.on('mouseenter', 'clusters', onMouseEnter);
          map.on('mouseleave', 'clusters', onMouseLeave);
          map.on('mouseenter', 'unclustered-point', onMouseEnter);
          map.on('mouseleave', 'unclustered-point', onMouseLeave);

          clustersRef.current = { added: true, handlers: { onClusterClick, onUnclusteredClick, onMouseEnter, onMouseLeave } };
        }

        // Set data in case source was just created
        try {
          if (map.getSource && map.getSource('locations')) {
            map.getSource('locations').setData(data);
          }
        } catch (err) {
          console.error('Failed to set data on locations source after creation', err);
        }
      } catch (err) {
        console.error('Failed to add clustering layers', err);
      }
    };

    // If style loaded, run setup immediately; otherwise wait for load once
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      setupClusters();
    } else {
      map.once('style.load', setupClusters);
    }

    // Cleanup: remove layers and source on unmount
    return () => {
      if (!isMapUsable(map)) {
        clustersRef.current = { added: false, handlers: {} };
        return;
      }

      if (clustersRef.current.added) {
        const { onClusterClick, onUnclusteredClick, onMouseEnter, onMouseLeave } = clustersRef.current.handlers;
        if (onClusterClick) {
          try {
            map.off('click', 'clusters', onClusterClick);
          } catch {}
        }
        if (onUnclusteredClick) {
          try {
            map.off('click', 'unclustered-point', onUnclusteredClick);
          } catch {}
        }
        if (onMouseEnter) {
          try {
            map.off('mouseenter', 'clusters', onMouseEnter);
          } catch {}
        }
        if (onMouseLeave) {
          try {
            map.off('mouseleave', 'clusters', onMouseLeave);
          } catch {}
        }
        if (onMouseEnter) {
          try {
            map.off('mouseenter', 'unclustered-point', onMouseEnter);
          } catch {}
        }
        if (onMouseLeave) {
          try {
            map.off('mouseleave', 'unclustered-point', onMouseLeave);
          } catch {}
        }
      }

      const layerIds = ['clusters', 'cluster-count', 'unclustered-point'];
      for (const layerId of layerIds) {
        try {
          if (safeLayerExists(map, layerId)) {
            map.removeLayer(layerId);
          }
        } catch {
          // ignore cleanup failures
        }
      }

      try {
        if (safeSourceExists(map, 'locations')) {
          map.removeSource('locations');
        }
      } catch {
        // ignore cleanup failures
      }

      clustersRef.current = { added: false, handlers: {} };
    };
  }, [filteredLocations]);

  const handleCenterOnMe = () => {
    const map = mapRef.current;
    if (!map) {
      clearTimeout(locatingTimerRef.current);
      setIsLocating(false);
      setLocationStatusMessage('');
      setGeolocationError('Map is not ready yet.');
      return;
    }

    if (userLocation && userLocation.latitude != null && userLocation.longitude != null) {
      const { latitude, longitude } = userLocation;
      try {
        map.flyTo({
          center: [longitude, latitude],
          zoom: Math.max(map.getZoom?.() || 0, 14),
          essential: true
        });
      } catch (flyError) {
        console.error('Error flying to saved user location:', flyError);
      }
      createUserMarker({ ...userLocation, source: 'saved' });
      setGeolocationError('');
      setLocationStatusMessage('Centered on your location.');
      setIsLocating(false);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const accuracy = position.coords.accuracy;
            const nextLocation = {
              latitude,
              longitude,
              ...(accuracy != null ? { accuracy } : {}),
              source: 'geolocation'
            };
            setUserLocation(nextLocation);
            setGeolocationError('');
            setLocationStatusMessage('Location found');
            createUserMarker(nextLocation);
          },
          (error) => {
            let errorMsg = 'Unable to retrieve your location.';
            if (error.code === error.PERMISSION_DENIED) {
              errorMsg = 'Location permission was denied. Enable location access in your browser.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              errorMsg = 'Location information is currently unavailable.';
            } else if (error.code === error.TIMEOUT) {
              errorMsg = 'The request to get your location timed out. Please try again.';
            }
            setGeolocationError(errorMsg);
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
          }
        );
      }
      return;
    }

    setIsLocating(true);
    setGeolocationError('');
    setLocationStatusMessage('Getting your location...');
    if (!navigator.geolocation) {
      clearTimeout(locatingTimerRef.current);
      setGeolocationError('Location is not available in this browser.');
      setIsLocating(false);
      setLocationStatusMessage('');
      return;
    }

    clearTimeout(locatingTimerRef.current);
    locatingTimerRef.current = window.setTimeout(() => {
      setGeolocationError('Still waiting for browser location permission. Check Chrome location permission.');
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(locatingTimerRef.current);
        const { latitude, longitude } = position.coords;
        const accuracy = position.coords.accuracy;
        const nextLocation = {
          latitude,
          longitude,
          ...(accuracy != null ? { accuracy } : {}),
          source: 'geolocation'
        };
        setUserLocation(nextLocation);
        setGeolocationError('');
        setLocationStatusMessage('Location found');
        setIsLocating(false);
        setActiveFilter('nearby');
        if (map) {
          const addLocationMarker = () => {
            createUserMarker({ ...nextLocation, source: 'geolocation' });
          };

          if (map.loaded && !map.loaded()) {
            const handleLoad = () => {
              addLocationMarker();
              if (typeof map.off === 'function') {
                try {
                  map.off('load', handleLoad);
                } catch {
                  // ignore cleanup failures
                }
              }
            };
            map.on('load', handleLoad);
          } else {
            addLocationMarker();
          }
        }
      },
      (error) => {
        clearTimeout(locatingTimerRef.current);
        setIsLocating(false);
        setLocationStatusMessage('');
        let errorMsg = 'Unable to retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. Enable location access in your browser.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'The request to get your location timed out. Please try again.';
        }
        setGeolocationError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  const handleDiscoverEvents = () => {
    navigate('/discover');
  };

  const handleScanQR = () => {
    navigate('/scan');
  };

  const refreshAdminLocations = async () => {
    if (!isAdminUser) return;
    setAdminError('');
    setAdminLoading(true);
    try {
      const data = await api('/api/admin/map/locations');
      setAdminLocations(Array.isArray(data.locations) ? data.locations.map(normalizeAdminLocation) : []);
    } catch (err) {
      console.error('Failed to refresh admin map locations', err);
      setAdminError('Unable to refresh admin locations.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminUpdateLocation = async (patchData) => {
    if (!selectedAdminLocationId) return;
    setAdminError('');
    try {
      await api(`/api/admin/map/locations/${selectedAdminLocationId}`, {
        method: 'PATCH',
        body: JSON.stringify(patchData)
      });
      await refreshAdminLocations();
      const refreshed = await api(`/api/admin/map/locations/${selectedAdminLocationId}`);
      setSelectedAdminLocation(refreshed.location || null);
    } catch (err) {
      console.error('Admin location update failed', err);
      setAdminError(err.message || 'Location update failed.');
    }
  };

  const handleAdminDeleteLocation = async () => {
    if (!selectedAdminLocationId) return;
    setAdminError('');
    try {
      await api(`/api/admin/map/locations/${selectedAdminLocationId}`, { method: 'DELETE' });
      await refreshAdminLocations();
      setSelectedAdminLocationId(null);
      setSelectedAdminLocation(null);
    } catch (err) {
      console.error('Admin delete failed', err);
      setAdminError(err.message || 'Location hide failed.');
    }
  };

  const handleAdminUploadAction = async (uploadId, action, locationVisibility) => {
    setAdminError('');
    try {
      await api(`/api/admin/map/uploads/${uploadId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({ action, locationVisibility })
      });
      if (selectedAdminLocationId) {
        const refreshed = await api(`/api/admin/map/locations/${selectedAdminLocationId}`);
        setSelectedAdminLocation(refreshed.location || null);
      }
      await refreshAdminLocations();
    } catch (err) {
      console.error('Admin upload moderation action failed', err);
      setAdminError(err.message || 'Upload moderation failed.');
    }
  };

  const handleStartAddPost = () => {
    setIsAddPostMode(true);
    setPendingPostLocation(null);
    setPendingPostAddress(null);
    setPendingLocationPrivacy('approximate');
    setReverseGeocodeError('');
  };

  const handleCancelAddPost = () => {
    clearPendingPostSelection();
  };

  const handleConfirmAddPost = () => {
    if (!pendingPostLocation) return;
    const mapLocation = {
      latitude: pendingPostLocation.lat,
      longitude: pendingPostLocation.lng,
      address: pendingPostAddress?.address || null,
      city: pendingPostAddress?.city || null,
      region: pendingPostAddress?.region || null,
      country: pendingPostAddress?.country || null,
      locationVisibility: pendingLocationPrivacy,
      source: 'map'
    };

    const user = currentUser();
    const tripId = user?.trips?.[0]?.id;
    if (tripId) {
      navigate(`/trips/${tripId}/upload`, { state: { mapLocation } });
    } else {
      navigate('/dashboard', { state: { mapLocation, fromMap: true } });
    }
  };

  return (
    <div className="page-shell min-h-screen pb-8">
      <div className="mb-8">
        <div className="hero-copy-panel">
          <p className="text-primary font-semibold uppercase tracking-wide mb-2">Map page loaded</p>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">Explore Locations</h1>
          <p className="text-slatebody mb-6">Discover events, trips, and photos from around the world</p>

          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search locations or addresses..."
                value={searchText}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                onFocus={() => searchSuggestions.length > 0 && setShowSearchSuggestions(true)}
                className="field w-full"
              />
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 first:rounded-t-lg last:rounded-b-lg"
                    >
                      📍 {suggestion.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setActiveFilter(filter.id);
                  setGeolocationError('');
                }}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                  activeFilter === filter.id ? 'btn-primary' : 'btn-ghost'
                }`}
              >
                <span className="mr-1">{filter.icon}</span>
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Country</label>
              <select
                value={countryFilter}
                onChange={(e) => {
                  setCountryFilter(e.target.value);
                  setRegionFilter('');
                }}
                className="field w-full"
              >
                <option value="">All Countries</option>
                {countryOptions.length > 0 ? (
                  countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))
                ) : (
                  <option disabled>No country data available</option>
                )}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Region</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="field w-full"
              >
                <option value="">All Regions</option>
                {regionOptions.length > 0 ? (
                  regionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))
                ) : (
                  <option disabled>No region data available</option>
                )}
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-400 mb-6">
            Country and region filters apply to loaded Travel Share posts only.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card p-4 min-h-96 relative overflow-hidden">
            {mapError ? (
              <div className="rounded-lg border border-dashed border-slate-500 bg-slate-900/70 p-6 flex min-h-96 flex-col items-center justify-center text-center">
                <div>
                  <div className="text-4xl mb-3">⚠️</div>
                  <h3 className="text-xl font-bold text-white mb-2">{mapError}</h3>
                  <p className="text-slatebody text-sm mb-4">
                    The map is currently unavailable. Locations are still visible in the sidebar.
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  position: 'relative',
                  minHeight: '420px',
                  height: '420px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  zIndex: 1
                }}
              >
                <div
                  ref={containerRef}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                />
                {overlayError && (mapMode === 'heatmap' || mapMode === 'replay') ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      zIndex: 15,
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: '#fff',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      maxWidth: '260px',
                      fontSize: '13px'
                    }}
                  >
                    {overlayError}
                  </div>
                ) : null}
                {!overlayError && mapMode === 'heatmap' && !heatmapPoints.length ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      zIndex: 15,
                      backgroundColor: 'rgba(255, 255, 255, 0.92)',
                      color: '#111827',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      maxWidth: '260px',
                      fontSize: '13px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
                    }}
                  >
                    No heatmap data yet.
                  </div>
                ) : null}
                {!overlayError && mapMode === 'replay' && !replayPoints.length ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      zIndex: 15,
                      backgroundColor: 'rgba(255, 255, 255, 0.92)',
                      color: '#111827',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      maxWidth: '260px',
                      fontSize: '13px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
                    }}
                  >
                    No replay data yet.
                  </div>
                ) : null}
                
                {/* Layer Control Panel */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    zIndex: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    overflow: 'hidden'
                  }}
                >
                  {!showLayerControl ? (
                    <button
                      onClick={() => setShowLayerControl(true)}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '44px',
                        minHeight: '44px',
                        color: '#333'
                      }}
                      title="Map Layers"
                    >
                      🗺️
                    </button>
                  ) : (
                    <div style={{ padding: '8px' }}>
                        <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {['pins', 'heatmap', 'replay'].map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleMapModeChange(mode)}
                              style={{
                                padding: '8px 12px',
                                border: 'none',
                                backgroundColor: mapMode === mode ? '#2563eb' : 'transparent',
                                color: mapMode === mode ? '#ffffff' : '#333',
                                cursor: 'pointer',
                                borderRadius: '9999px',
                                fontSize: '13px',
                                transition: 'background-color 0.2s, color 0.2s'
                              }}
                            >
                              {mode === 'pins' ? 'Pins' : mode === 'heatmap' ? 'Heatmap' : 'Replay'}
                            </button>
                          ))}
                        </div>
                        {mapMode === 'replay' ? (
                          <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setReplayPlaying((current) => !current)}
                              style={{
                                padding: '8px 12px',
                                border: 'none',
                                backgroundColor: '#f3f4f6',
                                cursor: replayPoints.length === 0 ? 'not-allowed' : 'pointer',
                                opacity: replayPoints.length === 0 ? 0.5 : 1,
                                borderRadius: '9999px',
                                fontSize: '13px'
                              }}
                              disabled={replayPoints.length === 0}
                            >
                              {replayPlaying ? 'Pause' : 'Play'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplayPlaying(false);
                                setReplayIndex(0);
                              }}
                              style={{
                                padding: '8px 12px',
                                border: 'none',
                                backgroundColor: '#f3f4f6',
                                cursor: 'pointer',
                                borderRadius: '9999px',
                                fontSize: '13px'
                              }}
                            >
                              Reset
                            </button>
                            <div style={{ fontSize: '12px', color: '#444' }}>
                              Step {Math.min(replayIndex + 1, replayPoints.length)} / {replayPoints.length}
                            </div>
                          </div>
                        ) : null}
                      {Object.values(MAP_STYLES).map((style) => (
                        <button
                          key={style.id}
                          onClick={() => handleChangeMapStyle(style.id)}
                          disabled={styleLoading || mapStyle === style.id}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 16px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: mapStyle === style.id ? '#e5e7eb' : 'transparent',
                            cursor: styleLoading || mapStyle === style.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            color: '#333',
                            fontWeight: mapStyle === style.id ? '600' : 'normal',
                            transition: 'background-color 0.2s',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = mapStyle === style.id ? '#d1d5db' : '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = mapStyle === style.id ? '#e5e7eb' : 'transparent';
                          }}
                        >
                          <span style={{ marginRight: '8px' }}>{style.icon}</span>
                          {style.label}
                        </button>
                      ))}
                      {styleLoading ? (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#444' }}>
                          Switching map view…
                        </div>
                      ) : null}
                      <button
                        onClick={() => setShowLayerControl(false)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '10px 16px',
                          textAlign: 'center',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#666',
                          borderTop: '1px solid #e5e7eb',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        Close
                      </button>
                      {mapMode === 'heatmap' && !heatmapPoints.length ? (
                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#444' }}>
                          No heatmap data yet.
                        </div>
                      ) : null}
                      {mapMode === 'replay' && !replayPoints.length ? (
                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#444' }}>
                          No replay data yet.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-4">
            <button onClick={handleCenterOnMe} className="btn-primary w-full">📍 Center on Me</button>
            <button
              onClick={isAddPostMode ? handleCancelAddPost : handleStartAddPost}
              className="btn-ghost w-full"
            >
              {isAddPostMode ? 'Exit Add Post' : '➕ Add Post'}
            </button>
            <button onClick={handleDiscoverEvents} className="btn-indigo w-full">🎯 Discover Events</button>
            <button onClick={handleScanQR} className="btn-ghost w-full">📱 Scan QR</button>

            {isAdminUser ? (
              <div className="card p-4 bg-slate-950/90 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-primary">Admin Tools</p>
                    <p className="text-xs text-slatebody">Manage map pins and moderation.</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsAdminView(!isAdminView);
                      setSelectedAdminLocationId(null);
                      setSelectedAdminLocation(null);
                      setAdminPendingMove(null);
                      setAdminActionError('');
                    }}
                    className={`px-3 py-2 rounded-full text-xs font-semibold ${isAdminView ? 'bg-primary text-slate-950' : 'bg-slate-700 text-white'}`}
                  >
                    {isAdminView ? 'Active' : 'Activate'}
                  </button>
                </div>
                {isAdminView ? (
                  <div className="space-y-3">
                    {adminError ? <div className="text-sm text-red-400">{adminError}</div> : null}
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">Select pin</label>
                      <select
                        value={selectedAdminLocationId || ''}
                        onChange={(e) => setSelectedAdminLocationId(e.target.value || null)}
                        className="field w-full"
                      >
                        <option value="">Choose a location</option>
                        {adminLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.title || 'Untitled'} {loc.hidden ? '(hidden)' : ''} {loc.featured ? '★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedAdminLocation ? (
                      <div className="space-y-3">
                        <div className="text-sm text-slatebody">
                          <div><strong>Name:</strong> {selectedAdminLocation.name}</div>
                          <div><strong>Address:</strong> {selectedAdminLocation.address || 'None'}</div>
                          <div><strong>Coordinates:</strong> {selectedAdminLocation.latitude?.toFixed(5) ?? 'N/A'}, {selectedAdminLocation.longitude?.toFixed(5) ?? 'N/A'}</div>
                          <div><strong>Status:</strong> {selectedAdminLocation.hidden ? 'Hidden' : 'Visible'}{selectedAdminLocation.featured ? ' · Featured' : ''}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleAdminUpdateLocation({ hidden: !selectedAdminLocation.hidden })}
                            className="btn-ghost w-full"
                          >
                            {selectedAdminLocation.hidden ? 'Unhide pin' : 'Hide pin'}
                          </button>
                          <button
                            onClick={() => handleAdminUpdateLocation({ featured: !selectedAdminLocation.featured })}
                            className="btn-ghost w-full"
                          >
                            {selectedAdminLocation.featured ? 'Unfeature pin' : 'Feature pin'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setAdminMoveMode(true)}
                            disabled={!selectedAdminLocation}
                            className="btn-primary w-full"
                          >
                            Move pin
                          </button>
                          <button
                            onClick={handleAdminDeleteLocation}
                            className="btn-danger w-full"
                          >
                            Hide from map
                          </button>
                        </div>
                        {adminMoveMode ? (
                          <div className="text-sm text-slatebody">
                            Click a new location on the map to move the selected pin.
                            {adminPendingMove ? (
                              <div className="mt-2 text-white">
                                New coordinates: {adminPendingMove.lat.toFixed(5)}, {adminPendingMove.lng.toFixed(5)}
                                <button
                                  onClick={() => handleAdminUpdateLocation({ latitude: adminPendingMove.lat, longitude: adminPendingMove.lng })}
                                  className="btn-ghost w-full mt-2"
                                >
                                  Confirm move
                                </button>
                                <button
                                  onClick={() => setAdminPendingMove(null)}
                                  className="btn-ghost w-full"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedAdminLocation.uploads && selectedAdminLocation.uploads.length > 0 ? (
                          <div className="space-y-2 pt-3 border-t border-slate-700">
                            <div className="text-sm font-semibold text-white">Recent uploads</div>
                            {selectedAdminLocation.uploads.slice(0, 5).map((upload) => (
                              <div key={upload.id} className="rounded-lg border border-slate-700 p-3 bg-slate-900">
                                <div className="text-sm mb-1">{upload.caption || upload.fileType || 'Upload'}</div>
                                <div className="text-xs text-slatebody mb-2">{upload.status} • {upload.locationVisibility}</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleAdminUploadAction(upload.id, 'approve')}
                                    className="btn-ghost w-full"
                                  >Approve</button>
                                  <button
                                    onClick={() => handleAdminUploadAction(upload.id, 'reject')}
                                    className="btn-ghost w-full"
                                  >Reject</button>
                                  <button
                                    onClick={() => handleAdminUploadAction(upload.id, upload.locationVisibility === 'hidden' ? 'unhide' : 'hide')}
                                    className="btn-ghost w-full"
                                  >{upload.locationVisibility === 'hidden' ? 'Unhide' : 'Hide'}</button>
                                  <button
                                    onClick={() => handleAdminUploadAction(upload.id, upload.locationId ? 'feature' : 'unfeature')}
                                    className="btn-ghost w-full"
                                    disabled={!upload.locationId}
                                  >Feature</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {isLocating && (
              <div className="card p-4 text-center">
                <p className="text-slatebody text-sm">Finding your location…</p>
              </div>
            )}

            {!isLocating && locationStatusMessage ? (
              <div className="card p-4 text-center">
                <p className="text-slatebody text-sm">{locationStatusMessage}</p>
              </div>
            ) : null}

            {isAddPostMode ? (
              <div className="card p-4 bg-slate-950/90 border border-slate-800">
                <p className="font-semibold text-white mb-2">Add Post mode active</p>
                <p className="text-slatebody text-sm mb-3">
                  Click or tap the map to choose where to add your post. Drag the marker to adjust the pin.
                </p>
                {pendingPostLocation ? (
                  <div className="space-y-2 text-sm text-slatebody">
                    <div>
                      <strong>Latitude:</strong> {pendingPostLocation.lat.toFixed(5)}
                    </div>
                    <div>
                      <strong>Longitude:</strong> {pendingPostLocation.lng.toFixed(5)}
                    </div>
                    <div>
                      <strong>Address:</strong> {pendingPostAddress?.address || 'Coordinates only'}
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-white">Location privacy</label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3">
                          <input
                            type="radio"
                            name="post-privacy"
                            value="exact"
                            checked={pendingLocationPrivacy === 'exact'}
                            onChange={() => setPendingLocationPrivacy('exact')}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-semibold text-white">Exact Location</div>
                            <div className="text-slatebody text-sm">Shows your selected spot on the map.</div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3">
                          <input
                            type="radio"
                            name="post-privacy"
                            value="approximate"
                            checked={pendingLocationPrivacy === 'approximate'}
                            onChange={() => setPendingLocationPrivacy('approximate')}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-semibold text-white">Approximate Location</div>
                            <div className="text-slatebody text-sm">Shows a nearby general area, not the exact spot.</div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3">
                          <input
                            type="radio"
                            name="post-privacy"
                            value="city"
                            checked={pendingLocationPrivacy === 'city'}
                            onChange={() => setPendingLocationPrivacy('city')}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-semibold text-white">City-Level Only</div>
                            <div className="text-slatebody text-sm">Shows only the city/place area.</div>
                          </div>
                        </label>
                      </div>
                    </div>
                    {reverseGeocodeError ? (
                      <p className="text-xs text-red-400">{reverseGeocodeError}</p>
                    ) : null}
                    <button onClick={handleConfirmAddPost} className="btn-primary w-full mt-2" disabled={!pendingPostLocation || !pendingLocationPrivacy}>
                      Confirm Location
                    </button>
                    <button onClick={handleCancelAddPost} className="btn-ghost w-full">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="text-slatebody text-sm">Tap the map to place a draggable post marker.</div>
                )}
              </div>
            ) : null}

            <div className="space-y-3">
              {accuracyMessage && !geolocationError ? (
                <div className="card p-4 text-center">
                  <p className="text-slatebody text-sm">{accuracyMessage}</p>
                </div>
              ) : null}
              {geolocationError ? (
                <div className="card p-4 text-center">
                  <p className="text-slatebody text-sm">{geolocationError}</p>
                </div>
              ) : loading ? (
                <div className="card p-4 text-center">
                  <p className="text-slatebody">Loading locations…</p>
                </div>
              ) : error ? (
                <div className="card p-4 text-center">
                  <p className="text-slatebody">{error}</p>
                </div>
              ) : nearbyMessage ? (
                <div className="card p-4 text-center">
                  <p className="text-slatebody">{nearbyMessage}</p>
                </div>
              ) : filteredLocations.length > 0 ? (
                filteredLocations.map((location) => (
                  <div key={location.id ?? `${location.title}-${location.type}`} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white">{location.title || 'Untitled location'}</h3>
                          <span className="text-xs uppercase tracking-wide text-primary">
                        {location.type || 'location'}
                      </span>
                          {location.featured ? (
                            <span className="ml-2 text-xs uppercase tracking-wide text-amber-300">
                              ★ Featured
                            </span>
                          ) : null}
                    </div>
                    {location.imageUrl ? (
                      <div className="mb-3">
                        <img src={location.imageUrl} alt={location.previewTitle || location.title || 'preview'} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 8 }} />
                      </div>
                    ) : null}
                    <p className="text-slatebody text-sm">{location.description || 'No description available.'}</p>
                    <div className="mt-3 text-sm text-slatebody">
                      <div>{location.previewTitle || 'Community post'}</div>
                      <div className="text-xs text-muted">
                        {location.previewUser ? `by ${location.previewUser}` : 'Community post'} • {location.previewCreatedAt ? formatPreviewTime(location.previewCreatedAt) : 'Recently shared'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card p-4 text-center">
                  <p className="text-slatebody">No Travel Share posts found here yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
