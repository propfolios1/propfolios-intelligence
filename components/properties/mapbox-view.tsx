"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import * as React from "react";
import MapGL, { Layer, Source, type MapRef } from "react-map-gl/mapbox";
import type { MapPoint } from "./property-map";
import { palette } from "@/lib/design/tokens";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function brandify(map: MapboxMap) {
  const style = map.getStyle();
  for (const layer of style?.layers ?? []) {
    try {
      if (layer.id.includes("water") && layer.type === "fill") map.setPaintProperty(layer.id, "fill-color", palette.navy900);
      else if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", palette.canvas);
      else if ((layer.id.includes("land") || layer.id.includes("park")) && layer.type === "fill") map.setPaintProperty(layer.id, "fill-color", palette.ink100);
      else if (layer.id.includes("road") && layer.type === "line") map.setPaintProperty(layer.id, "line-color", palette.ink200);
      else if (layer.type === "symbol") map.setPaintProperty(layer.id, "text-color", palette.ink500);
    } catch {
      /* some layers reject paint overrides */
    }
  }
}

export default function MapboxView({ points, focusId }: { points: MapPoint[]; focusId?: string }) {
  const ref = React.useRef<MapRef>(null);
  const focus = points.find((p) => p.id === focusId);
  const data = React.useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points.map((p) => ({ type: "Feature" as const, properties: { id: p.id, name: p.name }, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] } })),
    }),
    [points],
  );
  return (
    <MapGL
      ref={ref}
      mapboxAccessToken={TOKEN}
      initialViewState={focus ? { longitude: focus.lng, latitude: focus.lat, zoom: 12 } : { longitude: 64, latitude: 22, zoom: 3.4 }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      onLoad={(e) => brandify(e.target)}
      interactiveLayerIds={["clusters"]}
      onClick={(e) => {
        if (e.features?.length) {
          ref.current?.easeTo({ center: e.lngLat, zoom: (ref.current.getZoom() ?? 4) + 2, duration: 400 });
        }
      }}
    >
      <Source id="props" type="geojson" data={data} cluster clusterRadius={44} clusterMaxZoom={13}>
        <Layer
          id="clusters"
          type="circle"
          filter={["has", "point_count"]}
          paint={{ "circle-color": palette.gold500, "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 12, 24], "circle-stroke-width": 2, "circle-stroke-color": palette.canvas }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{ "text-field": ["get", "point_count_abbreviated"], "text-size": 11, "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"] }}
          paint={{ "text-color": palette.canvas }}
        />
        <Layer
          id="points"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{ "circle-color": palette.gold500, "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": palette.canvas }}
        />
      </Source>
    </MapGL>
  );
}

