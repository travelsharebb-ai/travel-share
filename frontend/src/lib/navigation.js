const TOURIST_NAV_ITEMS = [
  { id: "dashboard", path: "/dashboard" },
  { id: "tourist", path: "/tourist" },
  { id: "trips", path: "/trips" },
  { id: "map", path: "/map" },
  { id: "events", path: "/events" },
  { id: "qrSpaces", path: "/qr-spaces" },
  { id: "scan", path: "/scan" },
  { id: "myUploads", path: "/my-uploads" },
  { id: "approvals", path: "/approvals" },
  { id: "sharedAlbums", path: "/shared-albums" },
  { id: "store", path: "/store" },
  { id: "settings", path: "/settings" }
];

export function navigationItemsForRole(role) {
  const items = [...TOURIST_NAV_ITEMS];
  if (["admin", "platform_admin"].includes(role)) {
    items.push({ id: "admin", path: "/admin" });
  }
  return items;
}

export function isGuestRole(user) {
  return user?.role === "guest";
}
