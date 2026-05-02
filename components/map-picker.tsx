"use client";

import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

type MapPoint = { lat: number; lng: number };

type MapPickerProps = {
  center: MapPoint;
  zoom: number;
  marker: MapPoint | null;
  onPick: (lat: number, lng: number) => void;
};

const defaultIcon = new L.Icon({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url
  ).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const MapViewUpdater = ({ center, zoom }: { center: MapPoint; zoom: number }) => {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom, map]);

  return null;
};

const MapClickHandler = ({ onPick }: { onPick: MapPickerProps["onPick"] }) => {
  useMapEvents({
    click: (event: L.LeafletMouseEvent) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const MapPicker = ({ center, zoom, marker, onPick }: MapPickerProps) => {
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
      <MapViewUpdater center={center} zoom={zoom} />
      <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />
      {marker ? (
        <Marker position={[marker.lat, marker.lng]} icon={defaultIcon} />
      ) : null}
      <MapClickHandler onPick={onPick} />
    </MapContainer>
  );
};

export default MapPicker;
