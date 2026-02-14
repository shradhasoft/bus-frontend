"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

type LatLng = {
  lat: number;
  lng: number;
};

type LiveMapProps = {
  center: LatLng;
  marker?: LatLng | null;
  route?: LatLng[];
  zoom?: number;
};

const markerIcon = new L.Icon({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url,
  ).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const MapSync = ({ center, zoom }: { center: LatLng; zoom: number }) => {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom, map]);

  return null;
};

const LiveMap = ({ center, marker, route = [], zoom = 12 }: LiveMapProps) => {
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
      <MapSync center={center} zoom={zoom} />
      <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />
      {route.length > 1 ? (
        <Polyline
          positions={route.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: "#ef4444", weight: 4, opacity: 0.8 }}
        />
      ) : null}
      {marker ? <Marker position={[marker.lat, marker.lng]} icon={markerIcon} /> : null}
    </MapContainer>
  );
};

export default LiveMap;
