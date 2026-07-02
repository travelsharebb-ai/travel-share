import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: '🌍' },
  { id: 'events', label: 'Events', icon: '🎯' },
  { id: 'trips', label: 'Trips', icon: '✈️' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'nearby', label: 'Nearby', icon: '📍' }
];

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
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const normalMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geolocationError, setGeolocationError] = useState('');
  const [mapError, setMapError] = useState('');
  const mapLoadedRef = useRef(false);
  const locatingTimerRef = useRef(null);

  const createUserMarker = ({ lat, lng, accuracy, source }) => {
    if (lat == null || lng == null || !mapRef.current) return;
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
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 20 }).setHTML(
          `<strong>You are here</strong><br/>Accuracy: about ${Math.round(accuracy || 0)} meters`
        )
      )
      .addTo(mapRef.current);

    const markerEl = userMarkerRef.current.getElement();
    markerEl.style.zIndex = '999999';
    markerEl.style.pointerEvents = 'auto';
    console.log('USER_MARKER_ELEMENT_CONNECTED', markerEl.isConnected);
    console.log('USER_MARKER_ELEMENT_RECT', markerEl.getBoundingClientRect());
    console.log('USER_MARKER_COUNT', document.querySelectorAll('.user-location-dot').length);

    if (mapRef.current) {
      try {
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 17,
          essential: true
        });
      } catch (flyError) {
        console.error('Error centering map on user marker:', flyError);
      }
    }
    console.log('USER_LOCATION_MARKER_ADDED', { lat, lng, accuracy, source });
  };

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
            eventId: eventCount > 0 ? null : null,
            tripId: tripCount > 0 ? null : null,
            hasPhoto: photoCount > 0,
            raw: item
          };
        });

        setLocations(normalizedLocations);
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

  // Define filteredLocations early, before any effects that use it
  const filteredLocations = locations.filter((location) => {
    const searchValue = searchText.trim().toLowerCase();
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
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [-95.7129, 37.0902], // Default center (USA center)
          zoom: 3
        });

        map.on('load', () => {
          mapLoadedRef.current = true;
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
        } catch (e) {
          console.error('Error cleaning up map:', e);
        }
      }
    };
  }, []);

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
      console.log('USER_LOCATION_MARKER_ADDED_FROM_EFFECT', {
        lat: userLocation.lat,
        lng: userLocation.lng,
        accuracy: userLocation.accuracy
      });
    };

    if (!map.loaded()) {
      const handleLoad = () => {
        createMarker();
        map.off('load', handleLoad);
      };
      console.log('USER_MARKER_WAITING_FOR_MAP');
      map.on('load', handleLoad);
      return () => {
        map.off('load', handleLoad);
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

  // Update markers when filtered locations or map changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    normalMarkersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch (e) {
        console.error('Error removing marker:', e);
      }
    });
    normalMarkersRef.current = [];

    // Add new markers for filtered locations
    filteredLocations.forEach((location) => {
      if (location.lat == null || location.lng == null) return;

      try {
        const el = document.createElement('div');
        el.className = 'mapbox-marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.backgroundColor = '#4f46e5';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontSize = '16px';
        el.style.fontWeight = 'bold';
        el.style.cursor = 'pointer';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        
        // Icon based on type
        if (location.type === 'event') {
          el.innerHTML = '🎯';
          el.style.backgroundColor = '#f59e0b';
        } else if (location.type === 'trip') {
          el.innerHTML = '✈️';
          el.style.backgroundColor = '#06b6d4';
        } else if (location.type === 'photo') {
          el.innerHTML = '📸';
          el.style.backgroundColor = '#8b5cf6';
        } else {
          el.innerHTML = '📍';
        }

        const preview = location.raw?.preview || null;
        const previewImage = preview?.imageUrl ? `<div style="margin-bottom:8px;"><img src="${preview.imageUrl}" alt="preview" style="width:180px;height:100px;object-fit:cover;border-radius:6px;display:block;"/></div>` : '';
        const previewTitle = preview?.title || location.title || 'Community post';
        const previewUser = preview?.userDisplayName ? `<small style="color:#444;">by ${preview.userDisplayName}</small>` : `<small style="color:#444;">Community post</small>`;
        const previewTime = preview?.createdAt ? `<div style="color:#666;font-size:12px;margin-top:6px;">${new Date(preview.createdAt).toLocaleString()}</div>` : `<div style="color:#666;font-size:12px;margin-top:6px;">Recently shared</div>`;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding: 8px; font-size: 14px; max-width:220px;">
            ${previewImage}
            <strong>${escapeHtml(previewTitle)}</strong><br/>
            <small>${escapeHtml(location.description || 'No address')}</small><br/>
            ${previewUser}
            ${previewTime}
          </div>`
        );

        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lng, location.lat])
          .setPopup(popup)
          .addTo(mapRef.current);

        normalMarkersRef.current.push(marker);
      } catch (markerError) {
        console.error('Error adding marker:', markerError);
      }
    });
  }, [filteredLocations]);

  const handleCenterOnMe = () => {
    console.log('CENTER_ON_ME_CLICKED');
    console.log('REQUESTING_GEOLOCATION');
    setIsLocating(true);
    setGeolocationError('');
    if (!navigator.geolocation) {
      clearTimeout(locatingTimerRef.current);
      setGeolocationError('Geolocation is not supported by your browser.');
      setIsLocating(false);
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
        console.log('GEOLOCATION_SUCCESS', { latitude, longitude, accuracy });
        const nextLocation = {
          lat: latitude,
          lng: longitude,
          ...(accuracy != null ? { accuracy } : {})
        };
        setUserLocation(nextLocation);
        console.log('CENTER_ON_ME_LOCATION_SET', nextLocation);
        setGeolocationError('');
        setIsLocating(false);
        // Automatically switch to Nearby filter when location is obtained
        setActiveFilter('nearby');
        
        if (mapRef.current && mapRef.current.loaded()) {
          createUserMarker({ ...nextLocation, source: 'geolocation' });
        } else if (mapRef.current) {
          console.log('USER_MARKER_WAITING_FOR_MAP');
        }
      },
      (error) => {
        clearTimeout(locatingTimerRef.current);
        console.log('GEOLOCATION_ERROR', error);
        setIsLocating(false);
        let errorMsg = 'Unable to retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. Please enable location access in Chrome and macOS settings.';
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

  return (
    <div className="page-shell min-h-screen pb-8">
      <div className="mb-8">
        <div className="hero-copy-panel">
          <p className="text-primary font-semibold uppercase tracking-wide mb-2">Map page loaded</p>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">Explore Locations</h1>
          <p className="text-slatebody mb-6">Discover events, trips, and photos from around the world</p>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Search locations..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="field w-full"
            />
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
                ref={containerRef}
                style={{
                  position: 'relative',
                  minHeight: '420px',
                  height: '420px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  zIndex: 1
                }}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-4">
            <button onClick={handleCenterOnMe} className="btn-primary w-full">📍 Center on Me</button>
            <button onClick={handleDiscoverEvents} className="btn-indigo w-full">🎯 Discover Events</button>
            <button onClick={handleScanQR} className="btn-ghost w-full">📱 Scan QR</button>

            {isLocating && (
              <div className="card p-4 text-center">
                <p className="text-slatebody text-sm">Finding your location…</p>
              </div>
            )}

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
                  <p className="text-slatebody">No locations match this filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
