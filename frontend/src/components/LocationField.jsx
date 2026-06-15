import React from "react";

export default function LocationField({
  value,
  onChange,
  latitude,
  longitude,
  onLatChange,
  onLngChange,
  placeholder = "Location"
}) {
  const coordsPresent = latitude && longitude;
  const mapsQuery = coordsPresent ? `${latitude},${longitude}` : value;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || "")}`;
  const earthHref = `https://earth.google.com/web/search/${encodeURIComponent(mapsQuery || "")}`;

  return (
    <div>
      <input className="field" placeholder={placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      <div className="mt-2 grid gap-2 sm:flex sm:items-center">
        <div className="flex gap-2 items-center">
          <input className="field w-36" placeholder="Lat" value={latitude || ""} onChange={(e) => onLatChange && onLatChange(e.target.value)} />
          <input className="field w-36" placeholder="Lng" value={longitude || ""} onChange={(e) => onLngChange && onLngChange(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={mapsHref}>Open in Google Maps</a>
          <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={earthHref}>Open in Google Earth</a>
        </div>
      </div>
    </div>
  );
}
