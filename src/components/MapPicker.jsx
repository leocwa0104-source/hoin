import React, { useEffect, useMemo, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

const MapPicker = ({ onAreaCreated }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mouseToolRef = useRef(null);
  const polygonRef = useRef(null);

  const amapKey = import.meta.env.VITE_AMAP_KEY;
  const [status, setStatus] = useState(amapKey ? 'loading' : 'missing_key');

  const center = useMemo(() => [116.4074, 39.9042], []);

  useEffect(() => {
    if (!amapKey) {
      return;
    }

    let destroyed = false;
    let AMap = null;

    const init = async () => {
      try {
        AMap = await AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: ['AMap.MouseTool', 'AMap.Geolocation'],
        });
        if (destroyed) return;
        if (!containerRef.current) return;

        const map = new AMap.Map(containerRef.current, {
          viewMode: '2D',
          zoom: 13,
          center,
        });
        mapRef.current = map;

        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 8000,
          buttonPosition: 'RB',
          zoomToAccuracy: true,
        });
        map.addControl(geolocation);
        geolocation.getCurrentPosition();

        const mouseTool = new AMap.MouseTool(map);
        mouseToolRef.current = mouseTool;

        mouseTool.on('draw', (e) => {
          const polygon = e.obj;
          polygonRef.current = polygon;
          mouseTool.close(true);

          const path = polygon.getPath() || [];
          const ring = path.map((p) => [p.lng, p.lat]);
          if (ring.length >= 3) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
            onAreaCreated({ type: 'Polygon', coordinates: [ring] });
          }
        });

        mouseTool.polygon({
          strokeColor: '#111827',
          strokeWeight: 2,
          fillColor: '#111827',
          fillOpacity: 0.18,
        });

        setStatus('ready');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };

    init();

    return () => {
      destroyed = true;
      try {
        mouseToolRef.current?.close(true);
        mouseToolRef.current = null;
      } catch (err) { void err; }
      try {
        polygonRef.current?.setMap(null);
        polygonRef.current = null;
      } catch (err) { void err; }
      try {
        mapRef.current?.destroy?.();
        mapRef.current = null;
      } catch (err) { void err; }
    };
  }, [amapKey, center, onAreaCreated]);

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'missing_key' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-sm text-gray-700 font-medium">
            缺少 VITE_AMAP_KEY
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-sm text-gray-700 font-medium">
            地图加载失败
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPicker;
