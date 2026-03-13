"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import AnimatedBusMarker from "@/components/tracking/animated-bus-marker";

type LatLng = {
  lat: number;
  lng: number;
};

export type MapMarker = {
  position: LatLng;
  type?: "bus" | "boarding" | "dropping" | "stop" | "default";
  label?: string;
  pulse?: boolean;
  heading?: number | null;
};

type LiveMapProps = {
  center: LatLng;
  marker?: LatLng | null;
  route?: LatLng[];
  zoom?: number;
  /** Multi-marker mode: renders typed markers with custom icons */
  markers?: MapMarker[];
  /** Auto-fit bounds to show entire route + markers */
  fitBounds?: boolean;
  /** Route line color override */
  routeColor?: string;
};

const defaultIcon = new L.Icon({
  iconUrl: new URL(
    "leaflet/dist/images/marker-icon.png",
    import.meta.url,
  ).toString(),
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url,
  ).toString(),
  shadowUrl: new URL(
    "leaflet/dist/images/marker-shadow.png",
    import.meta.url,
  ).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const makeSvgIcon = (color: string, glyph: string, size = 36) =>
  new L.DivIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
      background:${color};color:#fff;border-radius:50%;border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:${size * 0.44}px;font-weight:700;line-height:1;">
      ${glyph}
    </div>`,
  });

const boardingIcon = makeSvgIcon("#10b981", "▲", 32);
const droppingIcon = makeSvgIcon("#ef4444", "▼", 32);

const MARKER_ICONS: Record<string, L.DivIcon | L.Icon> = {
  boarding: boardingIcon,
  dropping: droppingIcon,
  default: defaultIcon,
};

const MapSync = ({ center, zoom }: { center: LatLng; zoom: number }) => {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom, map]);

  return null;
};

const FitBoundsControl = ({
  route,
  markers,
}: {
  route: LatLng[];
  markers: MapMarker[];
}) => {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    for (const pt of route) {
      if (Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
        points.push([pt.lat, pt.lng]);
      }
    }
    for (const m of markers) {
      if (Number.isFinite(m.position.lat) && Number.isFinite(m.position.lng)) {
        points.push([m.position.lat, m.position.lng]);
      }
    }
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [route, markers, map]);

  return null;
};

const LiveMap = ({
  center,
  marker,
  route = [],
  zoom = 12,
  markers = [],
  fitBounds = false,
  routeColor = "#ef4444",
}: LiveMapProps) => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const tileConfig = useMemo(() => {
    if (!token) {
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      };
    }

    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${token}`,
      attribution:
        '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }, [token]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      {fitBounds && (route.length >= 2 || markers.length >= 2) ? (
        <FitBoundsControl route={route} markers={markers} />
      ) : (
        <MapSync center={center} zoom={zoom} />
      )}
      <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />

      {/* Route polyline */}
      {route.length > 1 ? (
        <Polyline
          positions={route.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: routeColor, weight: 4, opacity: 0.8 }}
        />
      ) : null}

      {/* Multi-marker mode */}
      {markers.map((m, idx) => {
        const mType = m.type || "default";

        if (mType === "bus") {
          return (
            <AnimatedBusMarker
              key={`bus-${idx}`}
              position={m.position}
              heading={m.heading}
              label={m.label}
            />
          );
        }

        if (mType === "stop") {
          return (
            <CircleMarker
              key={`stop-${idx}`}
              center={[m.position.lat, m.position.lng]}
              radius={6}
              pathOptions={{
                color: "#6366f1",
                fillColor: "#818cf8",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              {m.label ? (
                <Popup>
                  <span className="text-sm font-medium">{m.label}</span>
                </Popup>
              ) : null}
            </CircleMarker>
          );
        }

        const icon = MARKER_ICONS[mType] || MARKER_ICONS.default;
        return (
          <Marker
            key={`marker-${idx}`}
            position={[m.position.lat, m.position.lng]}
            icon={icon as L.Icon}
          >
            {m.label ? (
              <Popup>
                <span className="text-sm font-medium">{m.label}</span>
              </Popup>
            ) : null}
          </Marker>
        );
      })}

      {/* Legacy single marker (backward compat) */}
      {marker && markers.length === 0 ? (
        <Marker position={[marker.lat, marker.lng]} icon={defaultIcon} />
      ) : null}
    </MapContainer>
  );
};

export default LiveMap;
