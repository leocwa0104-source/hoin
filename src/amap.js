import AMapLoader from '@amap/amap-jsapi-loader';

const getConfig = () => {
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
  return { key, securityJsCode };
};

export const loadAMap = async ({ plugins } = {}) => {
  if (window.__geochatAmapPromise) return window.__geochatAmapPromise;
  const { key, securityJsCode } = getConfig();
  if (!key) throw new Error('missing_amap_key');

  if (securityJsCode) {
    window._AMapSecurityConfig = { securityJsCode };
  }

  window.__geochatAmapPromise = AMapLoader.load({
    key,
    version: '2.0',
    plugins: Array.isArray(plugins) ? plugins : [],
  });

  return window.__geochatAmapPromise;
};

export const getAmapPosition = async () => {
  const AMap = await loadAMap({ plugins: ['AMap.Geolocation'] });
  const geo = new AMap.Geolocation({
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 5000,
    convert: true,
  });

  return new Promise((resolve, reject) => {
    geo.getCurrentPosition((status, result) => {
      if (status !== 'complete') {
        reject(result);
        return;
      }
      const p = result?.position;
      const lng = typeof p?.getLng === 'function' ? p.getLng() : p?.lng;
      const lat = typeof p?.getLat === 'function' ? p.getLat() : p?.lat;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        reject(new Error('invalid_position'));
        return;
      }
      resolve({ lng, lat });
    });
  });
};

