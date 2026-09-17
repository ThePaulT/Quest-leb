'use client';

import { Map as MapLibreMap, Marker, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { PALETTE } from '@/lib/ui/regions';

/**
 * A small map showing the quest pin and its geofence at its REAL radius.
 *
 * The circle is an SVG overlay, not a MapLibre GeoJSON layer. Two reasons:
 *
 *   1. MapLibre parses GeoJSON in a web worker, and that worker does not come
 *      up under our bundler — a geojson source never reaches "loaded", so the
 *      circle never painted. Verified: the layers existed, the camera was
 *      right, and queryRenderedFeatures returned nothing.
 *   2. This inset is deliberately non-interactive, so the scale is fixed and
 *      known. That makes the circle's size in pixels exact arithmetic rather
 *      than something that has to track a live camera.
 *
 * The radius is still honest: the zoom is CHOSEN so the circle fills a set
 * fraction of the frame, then the circle is drawn at the pixel size that radius
 * actually subtends. 180m at the Sidon islet and 1500m across the Qadisha
 * valley therefore render at the same on-screen size but at very different
 * zooms — the scale bar moves, not the circle, which is what makes the two
 * comparable at a glance.
 *
 * An SVG <circle> rather than a CSS rounded box: the design rules cap
 * border-radius at 4px, and a geofence is a real circle, not a rounded panel.
 */
export interface GeofenceInsetProps {
  lat: number;
  lng: number;
  radiusM: number;
  label: string;
}

/** Ground resolution of Web Mercator, metres per pixel. */
function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** The zoom at which `radiusM` subtends exactly `pixels`. */
export function zoomForRadius(lat: number, radiusM: number, pixels: number): number {
  const scale = (pixels * 156543.03392 * Math.cos((lat * Math.PI) / 180)) / radiusM;
  return Math.log2(scale);
}

/** How much of the frame's half-height the circle should occupy. */
const FILL_FRACTION = 0.72;

export function GeofenceInset({ lat, lng, radiusM, label }: GeofenceInsetProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [radiusPx, setRadiusPx] = useState<number | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    const node = container.current;
    const halfShortEdge = Math.min(node.clientWidth, node.clientHeight) / 2;
    const targetPx = Math.max(24, halfShortEdge * FILL_FRACTION);
    // Clamp: a 1500m circle at street zoom is useless, and a 180m one at
    // country zoom is invisible.
    const zoom = Math.min(17, Math.max(9, zoomForRadius(lat, radiusM, targetPx)));

    const style: StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          maxzoom: 18,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        { id: 'paper', type: 'background', paint: { 'background-color': PALETTE.base } },
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          paint: {
            'raster-saturation': -0.85,
            'raster-contrast': -0.12,
            'raster-brightness-min': 0.12,
            'raster-opacity': 0.62,
          },
        },
      ],
    };

    const instance = new MapLibreMap({
      container: node,
      style,
      center: [lng, lat],
      zoom,
      attributionControl: { compact: true },
      interactive: false,
    });
    map.current = instance;

    // Derive the on-screen radius from the zoom the map actually settled on,
    // so the circle matches the basemap even if MapLibre clamps the zoom.
    setRadiusPx(radiusM / metresPerPixel(lat, instance.getZoom()));

    // The quest pin: the same rotated square as the main map, so the two read
    // as one system.
    const element = document.createElement('div');
    element.style.cssText = 'width:11px;height:11px;display:block';
    const diamond = document.createElement('span');
    diamond.style.cssText = [
      'display:block',
      'width:100%',
      'height:100%',
      'transform:rotate(45deg)',
      'border-radius:0',
      `background:${PALETTE.accent}`,
      `border:2px solid ${PALETTE.accent}`,
    ].join(';');
    element.appendChild(diamond);
    new Marker({ element }).setLngLat([lng, lat]).addTo(instance);

    return () => {
      instance.remove();
      map.current = null;
    };
  }, [lat, lng, radiusM]);

  return (
    <div className="relative h-[240px] w-full border border-sand bg-base">
      <div ref={container} className="h-full w-full" />

      {radiusPx !== null && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          role="img"
          aria-label={label}
        >
          <circle
            cx="50%"
            cy="50%"
            r={radiusPx}
            fill={PALETTE.primary}
            fillOpacity="0.14"
            stroke={PALETTE.primary}
            strokeWidth="1.5"
          />
        </svg>
      )}
    </div>
  );
}

export default GeofenceInset;
