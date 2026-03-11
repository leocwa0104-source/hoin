import React, { useEffect, useMemo, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { X } from 'lucide-react';

const normalizeGeometry = (geometry) => {
  if (!geometry) return null;
  if (typeof geometry === 'string') {
    try {
      return JSON.parse(geometry);
    } catch {
      return null;
    }
  }
  return geometry;
};

const AreaPreviewModal = ({ open, onClose, geometry }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);

  const amapKey = import.meta.env.VITE_AMAP_KEY;
  const amapSecurityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;

  const normalized = useMemo(() => normalizeGeometry(geometry), [geometry]);
  const [status, setStatus] = useState(amapKey ? 'idle' : 'missing_key');
  const [pathCount, setPathCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (!amapKey) return;

    let destroyed = false;
    let AMap = null;

    const init = async () => {
      try {
        setStatus('loading');
        if (amapSecurityJsCode) {
          window._AMapSecurityConfig = { securityJsCode: amapSecurityJsCode };
        }
        AMap = await AMapLoader.load({
          key: amapKey,
          version: '2.0',
        });
        if (destroyed) return;
        if (!containerRef.current) return;

        const center = (() => {
          const outer = normalized?.coordinates?.[0];
          if (!Array.isArray(outer) || outer.length === 0) return undefined;
          const first = outer[0];
          const lng = Number(first?.[0]);
          const lat = Number(first?.[1]);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
          return [lng, lat];
        })();

        const map = new AMap.Map(containerRef.current, {
          viewMode: '2D',
          zoom: 13,
          center,
        });
        mapRef.current = map;
        map.resize?.();

        if (normalized?.type === 'Polygon' && Array.isArray(normalized.coordinates) && normalized.coordinates.length > 0) {
          const outer = normalized.coordinates[0] || [];
          const path = outer
            .map((p) => ({ lng: Number(p[0]), lat: Number(p[1]) }))
            .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
          setPathCount(path.length);

          if (path.length >= 3) {
            const polygon = new AMap.Polygon({
              path,
              strokeColor: '#111827',
              strokeWeight: 2,
              fillColor: '#111827',
              fillOpacity: 0.18,
            });
            polygon.setMap(map);
            polygonRef.current = polygon;
            map.setFitView([polygon], true, [32, 32, 32, 32], 16);
          } else {
            setStatus('no_polygon');
            return;
          }
        }

        setStatus('ready');
      } catch (e) {
        void e;
        setStatus('error');
      }
    };

    requestAnimationFrame(() => {
      init();
    });

    return () => {
      destroyed = true;
      try {
        polygonRef.current?.setMap?.(null);
        polygonRef.current = null;
      } catch (e) { void e; }
      try {
        mapRef.current?.destroy?.();
        mapRef.current = null;
      } catch (e) { void e; }
    };
  }, [open, amapKey, amapSecurityJsCode, normalized]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="关闭"
      />
      <div className="absolute inset-0 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl h-[80vh] min-h-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-gray-900">查看区域</div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
              aria-label="关闭"
              title="关闭"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 relative">
            <div ref={containerRef} className="absolute inset-0" />
            {status === 'missing_key' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-sm text-gray-700 font-medium">缺少 VITE_AMAP_KEY</div>
              </div>
            )}
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-sm text-gray-700 font-medium">地图加载中...</div>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-sm text-gray-700 font-medium">地图加载失败</div>
              </div>
            )}
            {status === 'no_polygon' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-sm text-gray-700 font-medium">区域数据无效（点数：{pathCount}）</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaPreviewModal;
