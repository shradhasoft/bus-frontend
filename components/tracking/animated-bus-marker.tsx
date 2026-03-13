"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// ─── types ───────────────────────────────────────────────────────────

type LatLng = {
  lat: number;
  lng: number;
};

type AnimatedBusMarkerProps = {
  position: LatLng;
  heading?: number | null;
  label?: string;
};

// ─── constants ───────────────────────────────────────────────────────

/** Duration (ms) for the glide animation between GPS updates. */
const ANIMATION_DURATION_MS = 2000;

// ─── SVG bus icon with rotation support ──────────────────────────────

const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/><path d="M7 18h10"/><path d="M18 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/><circle cx="7" cy="18" r="0"/><circle cx="17" cy="18" r="0"/></svg>`;

const buildBusIconHtml = (heading: number) => `
  <div class="animated-bus-root" style="position:relative;width:48px;height:48px;">
    <div class="animated-bus-pulse" style="
      position:absolute;inset:0;border-radius:50%;
      background:rgba(99,102,241,.25);
      animation:animBusPulse 2s ease-out infinite;
    "></div>
    <div class="animated-bus-body" style="
      position:absolute;inset:6px;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border-radius:50%;
      border:3px solid #fff;box-shadow:0 2px 12px rgba(79,70,229,.5);
      transform:rotate(${heading}deg);transition:transform 0.8s ease-out;
    ">${BUS_SVG}</div>
  </div>
  <style>
    @keyframes animBusPulse {
      0%   { transform:scale(1);   opacity:.7; }
      100% { transform:scale(2.2); opacity:0;  }
    }
  </style>
`;

// ─── geo helpers ─────────────────────────────────────────────────────

/** Calculate bearing (degrees 0-360) from point A to point B. */
const calculateBearing = (from: LatLng, to: LatLng): number => {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

/** Linear interpolation between two values. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Easing: ease-out cubic. */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// ─── component ───────────────────────────────────────────────────────

const AnimatedBusMarker = ({
  position,
  heading,
  label,
}: AnimatedBusMarkerProps) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevPositionRef = useRef<LatLng | null>(null);
  const currentHeadingRef = useRef<number>(0);
  const iconRef = useRef<L.DivIcon | null>(null);

  // Create marker on mount, remove on unmount
  useEffect(() => {
    const icon = new L.DivIcon({
      className: "",
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24],
      html: buildBusIconHtml(0),
    });
    iconRef.current = icon;

    const marker = L.marker([position.lat, position.lng], { icon });
    if (label) {
      marker.bindPopup(`<span style="font-weight:600;font-size:13px;">${label}</span>`);
    }
    marker.addTo(map);
    markerRef.current = marker;
    prevPositionRef.current = { lat: position.lat, lng: position.lng };

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Animate to new position when it changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = prevPositionRef.current ?? position;
    const to = position;

    // Determine heading: prefer explicit, fall back to calculated bearing
    let targetHeading = currentHeadingRef.current;
    if (heading != null && Number.isFinite(heading)) {
      targetHeading = heading;
    } else {
      const distSq =
        (to.lat - from.lat) ** 2 + (to.lng - from.lng) ** 2;
      // Only compute bearing if movement is meaningful (avoid jitter on stationary)
      if (distSq > 1e-10) {
        targetHeading = calculateBearing(from, to);
      }
    }

    // Update the icon's rotation
    currentHeadingRef.current = targetHeading;
    const el = (marker as unknown as { _icon?: HTMLElement })._icon;
    if (el) {
      const body = el.querySelector<HTMLElement>(".animated-bus-body");
      if (body) {
        body.style.transform = `rotate(${targetHeading}deg)`;
      }
    }

    // Cancel any in-progress animation
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Skip animation if this is the first position or positions are identical
    const distSq = (to.lat - from.lat) ** 2 + (to.lng - from.lng) ** 2;
    if (distSq < 1e-14) {
      marker.setLatLng([to.lat, to.lng]);
      prevPositionRef.current = to;
      return;
    }

    // Animate using requestAnimationFrame
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / ANIMATION_DURATION_MS);
      const t = easeOutCubic(rawT);

      const lat = lerp(from.lat, to.lat, t);
      const lng = lerp(from.lng, to.lng, t);
      marker.setLatLng([lat, lng]);

      if (rawT < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        prevPositionRef.current = to;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng, heading]);

  // Update popup content if label changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !label) return;
    marker.setPopupContent(
      `<span style="font-weight:600;font-size:13px;">${label}</span>`,
    );
  }, [label]);

  return null; // Imperative marker — no React DOM output
};

export default AnimatedBusMarker;
