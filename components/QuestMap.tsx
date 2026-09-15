'use client';

import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type StyleSpecification,
} from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QuestCard, REGION_LABEL, type Locale } from '@/components/QuestCard';
import type { QuestRegion, QuestSummary } from '@/lib/types';
import { PALETTE, REGIONS, REGION_PIN } from '@/lib/ui/regions';


/**
 * The map.
 *
 * Raster OSM tiles, no API key. They are desaturated in the style itself
 * (raster-saturation / raster-opacity over a paper background) rather than with
 * a CSS filter, so the basemap recedes to the warm ground the design asks for
 * instead of shouting in full colour under the pins.
 *
 * Tiles come straight from tile.openstreetmap.org, which is fine for a
 * prototype but is NOT an acceptable production source — the OSM Foundation's
 * tile usage policy rules out apps of any real volume. Swapping it is a change
 * to MAP_STYLE and nothing else.
 */

const LEBANON_BOUNDS: [number, number, number, number] = [35.0, 33.0, 36.7, 34.75];
/** The filters are docked above the map, so this is just breathing room. */
const FIT_PADDING = { top: 32, bottom: 32, left: 32, right: 32 };

const MAP_STYLE: StyleSpecification = {
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
    // Paper shows through the tiles below, warming the whole basemap.
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

const COPY = {
  en: {
    region: 'Region',
    difficulty: 'Difficulty',
    all: 'All',
    showInactive: 'Show inactive quests',
    devOnly: 'Dev only',
    empty: 'No quests match these filters.',
    emptyInactive: 'All ten seeded quests are inactive. Turn on “Show inactive quests”.',
    close: 'Close',
    count: (n: number) => `${n} quest${n === 1 ? '' : 's'}`,
  },
  ar: {
    region: 'المنطقة',
    difficulty: 'الصعوبة',
    all: 'الكل',
    showInactive: 'إظهار المهام غير المفعّلة',
    devOnly: 'للتطوير فقط',
    empty: 'لا توجد مهام مطابقة.',
    emptyInactive: 'جميع المهام العشر غير مفعّلة. فعّل «إظهار المهام غير المفعّلة».',
    close: 'إغلاق',
    count: (n: number) => `${n} مهمة`,
  },
} as const;

export interface QuestMapProps {
  quests: QuestSummary[];
  locale: Locale;
  /** The inactive toggle is rendered only when this is true. */
  allowInactiveToggle: boolean;
  /** Whether the server already included inactive quests in `quests`. */
  inactiveIncluded: boolean;
}

export function QuestMap({
  quests,
  locale,
  allowInactiveToggle,
  inactiveIncluded,
}: QuestMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);

  const [region, setRegion] = useState<QuestRegion | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  // The slug is the state; the quest itself is derived from the visible set.
  // That way a filter (or the inactive toggle) that hides the open quest closes
  // the sheet on its own, with no effect writing state back.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const copy = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const visible = useMemo(
    () =>
      quests.filter((quest) => {
        if (!showInactive && quest.isActive === false) return false;
        if (region && quest.region !== region) return false;
        if (difficulty && Math.round(quest.difficulty) !== difficulty) return false;
        return quest.lat != null && quest.lng != null;
      }),
    [quests, region, difficulty, showInactive],
  );

  const selected = useMemo(
    () => visible.find((quest) => quest.slug === selectedSlug) ?? null,
    [visible, selectedSlug],
  );

  // Create the map once.
  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: MAP_STYLE,
      center: [35.87, 33.87],
      zoom: 7.4,
      // Generous: a tight maxBounds clamps the padded fitBounds below, which
      // leaves the northern pins stranded under the filter panel.
      maxBounds: [
        [LEBANON_BOUNDS[0] - 4, LEBANON_BOUNDS[1] - 4],
        [LEBANON_BOUNDS[2] + 4, LEBANON_BOUNDS[3] + 4],
      ],
      minZoom: 5,
      attributionControl: { compact: true },
    });
    // Done here rather than through the constructor's `bounds` /
    // `fitBoundsOptions`, which MapLibre 6 does not apply.
    instance.fitBounds(
      [
        [LEBANON_BOUNDS[0], LEBANON_BOUNDS[1]],
        [LEBANON_BOUNDS[2], LEBANON_BOUNDS[3]],
      ],
      { padding: FIT_PADDING, duration: 0 },
    );

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  const openQuest = useCallback((quest: QuestSummary) => {
    setSelectedSlug(quest.slug);
    map.current?.easeTo({
      center: [quest.lng!, quest.lat!],
      // Leave room for the sheet without hiding the pin behind it.
      offset: [0, -110],
      duration: 500,
    });
  }, []);

  // Re-draw markers whenever the visible set or the selection changes.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    for (const marker of markers.current) marker.remove();
    markers.current = [];

    for (const quest of visible) {
      const style = REGION_PIN[quest.region];
      const isSelected = selected?.slug === quest.slug;

      // MapLibre owns the marker element's `transform` (it writes the
      // translate that positions the pin), so the 45deg rotation has to live on
      // an inner element or it is silently overwritten and the diamond renders
      // as a square.
      const element = document.createElement('button');
      element.type = 'button';
      element.setAttribute(
        'aria-label',
        `${locale === 'ar' ? quest.titleAr : quest.titleEn} — ${REGION_LABEL[locale][quest.region]}`,
      );
      const size = isSelected ? 18 : 13;
      const colour = isSelected ? PALETTE.accent : PALETTE[style.color];
      element.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        'padding:0',
        'border:0',
        'background:transparent',
        'cursor:pointer',
        'display:block',
      ].join(';');

      const diamond = document.createElement('span');
      diamond.style.cssText = [
        'display:block',
        'width:100%',
        'height:100%',
        // A rotated square: no border radius, and it echoes the cement-tile
        // geometry the whole design references.
        'transform:rotate(45deg)',
        'border-radius:0',
        `background:${style.fill === 'solid' || isSelected ? colour : PALETTE.base}`,
        `border:2px solid ${colour}`,
        quest.isActive === false && !isSelected ? 'opacity:0.55' : '',
      ]
        .filter(Boolean)
        .join(';');
      element.appendChild(diamond);

      element.addEventListener('click', (event) => {
        event.stopPropagation();
        openQuest(quest);
      });

      const marker = new Marker({ element })
        .setLngLat([quest.lng!, quest.lat!])
        .addTo(instance);
      markers.current.push(marker);
    }
  }, [visible, selected, locale, openQuest]);

  return (
    <div dir={dir} lang={locale} className="flex h-dvh w-full flex-col overflow-hidden bg-base">
      {/*
        Docked, not floating. An overlay panel hides whatever pins sit beneath
        it and then swallows their clicks — with the filters in normal flow the
        map container IS the visible map, so every rendered pin is reachable.
      */}
      <header className="shrink-0 border-b border-sand bg-base px-3 py-3 sm:px-4">
        <div className="mx-auto max-w-[900px]">
          <ChipRow
            label={copy.region}
            allLabel={copy.all}
            active={region}
            onSelect={(value) => setRegion(value as QuestRegion | null)}
            options={REGIONS.map((value) => ({
              value,
              label: REGION_LABEL[locale][value],
            }))}
          />
          <hr className="my-2.5 border-0 border-t border-sand" />
          <ChipRow
            label={copy.difficulty}
            allLabel={copy.all}
            active={difficulty}
            onSelect={(value) => setDifficulty(value as number | null)}
            options={[1, 2, 3, 4, 5].map((value) => ({
              value,
              label: String(value),
              tabular: true,
            }))}
          />

          {allowInactiveToggle && (
            <>
              <hr className="my-2.5 border-0 border-t border-sand" />
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  className="h-[14px] w-[14px] cursor-pointer accent-[#0F4C3A]"
                />
                <span className="font-body text-[12px] text-ink">{copy.showInactive}</span>
                <span className="font-body text-[10px] uppercase tracking-[0.14em] text-sea">
                  {copy.devOnly}
                </span>
              </label>
            </>
          )}

          <p className="font-body mt-2.5 text-[11px] uppercase tracking-[0.14em] text-sea">
            {copy.count(visible.length)}
          </p>
        </div>
      </header>

      <div className="relative flex-1">
        {/*
          Sized with h-full rather than `absolute inset-0`: maplibre-gl.css sets
          .maplibregl-map { position: relative } and is bundled after Tailwind,
          so it wins the cascade, `inset-0` stops applying and the container
          collapses to zero height.
        */}
        <div ref={container} className="h-full w-full" data-testid="map-canvas" />

      {visible.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 px-6">
          <p className="font-body mx-auto max-w-[36ch] border border-sand bg-base px-4 py-3 text-center text-[13px] leading-[1.6] text-ink">
            {!inactiveIncluded || showInactive ? copy.empty : copy.emptyInactive}
          </p>
        </div>
      )}

        {selected && (
          <BottomSheet locale={locale} closeLabel={copy.close} onClose={() => setSelectedSlug(null)}>
            <QuestCard quest={selected} locale={locale} compact />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

function ChipRow<T extends string | number>({
  label,
  allLabel,
  options,
  active,
  onSelect,
}: {
  label: string;
  allLabel: string;
  options: { value: T; label: string; tabular?: boolean }[];
  active: T | null;
  onSelect: (value: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* sea, not sand: sand on base is 1.41:1 and unreadable as text. */}
      <span className="font-body me-1 text-[10px] uppercase tracking-[0.16em] text-sea">
        {label}
      </span>
      <Chip label={allLabel} selected={active === null} onClick={() => onSelect(null)} />
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          tabular={option.tabular}
          selected={active === option.value}
          onClick={() => onSelect(active === option.value ? null : option.value)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  selected,
  tabular,
  onClick,
}: {
  label: string;
  selected: boolean;
  tabular?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`font-body rounded-[2px] border px-2.5 py-1 text-[12px] leading-none transition-colors ${
        tabular ? 'tabular-nums' : ''
      } ${
        selected
          ? 'border-primary bg-primary text-base'
          : 'border-sand bg-base text-ink hover:border-ink'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Bottom sheet. Paper, a 1px sand rule along the top, no shadow and no blur —
 * it reads as a sheet laid over the map, not a floating glass panel.
 */
function BottomSheet({
  locale,
  closeLabel,
  onClose,
  children,
}: {
  locale: Locale;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      lang={locale}
      className="absolute inset-x-0 bottom-0 z-20 border-t border-sand bg-base"
    >
      <div className="mx-auto max-w-[560px] px-4 pb-5 pt-3">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-body rounded-[2px] border border-sand px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-ink hover:border-ink"
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default QuestMap;
