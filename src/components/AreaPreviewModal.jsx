import React, { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { X } from 'lucide-react';

const AreaPreviewModal = ({ geometry, onClose }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const [error, setError] = useState('');

  const amapKey = import.meta.env.VITE_AMAP_KEY;
  const amapSecurityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;

  useEffect(() => {
    let destroyed = false;
    let AMap = null;
    const run = async () => {
      try {
        if (!amapKey) {
          setError('缺少 VITE_AMAP_KEY');
          return;
        }
        if (amapSecurityJsCode) {
          window._AMapSecurityConfig = { securityJsCode: amapSecurityJsCode };
        }
        AMap = await AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: [],
        });
        if (destroyed || !containerRef.current) return;

        const map = new AMap.Map(containerRef.current, {
          viewMode: '2D',
          zoom: 12,
        });
        mapRef.current = map;

        const geom = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
        const ring = (geom?.coordinates?.[0] || []).map((p) => new AMap.LngLat(Number(p[0]), Number(p[1])));
        if (ring.length >= 3) {
          const poly = new AMap.Polygon({
            path: ring,
            strokeColor: '#111827',
            strokeWeight: 2,
            fillColor: '#111827',
            fillOpacity: 0.18,
          });
          polygonRef.current = poly;
          map.add(poly);
          map.setFitView([poly]);
        } else {
          setError('区域数据无效');
        }
      } catch {
        setError('地图加载失败');
      }
    };
    run();
    return () => {
      destroyed = true;
      try {
        polygonRef.current?.setMap(null);
        polygonRef.current = null;
      } catch (e) { void e; }
      try {
        mapRef.current?.destroy?.();
        mapRef.current = null;
      } catch (e) { void e; }
    };
  }, [amapKey, amapSecurityJsCode, geometry]);

  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-6 md:inset-10 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-gray-800 text-sm">区域预览</div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AreaPreviewModal;
