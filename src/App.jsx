import React, { useCallback, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import AreaList from './components/AreaList';
import MapPicker from './components/MapPicker';
import ChatWindow from './components/ChatWindow';
import Auth from './components/Auth';
import { api } from './api';

const storageKey = 'geochat_user';

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredUser = (u) => {
  localStorage.setItem(storageKey, JSON.stringify(u));
};

const clearStoredUser = () => {
  localStorage.removeItem(storageKey);
};

function LoginPage({ onAuthed }) {
  const navigate = useNavigate();
  return (
    <Auth
      onAuthed={(u) => {
        onAuthed(u);
        navigate('/');
      }}
    />
  );
}

function HomePage({ user, onUserInvalid, onLogout }) {
  const [view, setView] = useState('list'); // list, map, chat
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [status, setStatus] = useState(() => (user ? 'idle' : 'unauthorized')); // idle, loading, unauthorized
  const lastLoadedUserIdRef = useRef(null);
  const loadingRef = useRef(false);

  const fetchAreas = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await api.get('/areas');
      setAreas(res.data);
      setStatus('idle');
    } catch (err) {
      if (err?.response?.status === 401) {
        onUserInvalid();
        setAreas([]);
        setStatus('unauthorized');
        return;
      }
      setStatus('idle');
    }
  }, [onUserInvalid]);

  if (user && lastLoadedUserIdRef.current !== user.id && !loadingRef.current) {
    loadingRef.current = true;
    Promise.resolve().then(async () => {
      try {
        await fetchAreas();
      } finally {
        lastLoadedUserIdRef.current = user.id;
        loadingRef.current = false;
      }
    });
  }

  const handleAreaCreated = async (geometry) => {
    const name = prompt("Name this zone (e.g., 'Home', 'Office'):");
    if (!name) return;

    try {
      await api.post('/areas', { name, geometry });
      await fetchAreas();
      setView('list');
    } catch (e) { void e; }
  };

  if (!user) {
    return (
      <div className="h-screen w-full bg-white font-sans text-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-3xl font-bold tracking-tight">GeoChat</div>
          <div className="mt-2 text-sm text-gray-600">主页保持不变，登录/注册在单独页面。</div>
          <div className="mt-6 flex items-center gap-3">
            <Link
              to="/login"
              className="bg-black text-white px-4 py-2 rounded-lg shadow-sm transition-colors text-sm font-medium"
            >
              去登录/注册
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col md:flex-row bg-white font-sans text-gray-900">
      <div className={`flex-1 h-full relative ${view === 'map' ? 'hidden' : 'block'}`}>
        {view === 'list' && (
          <AreaList
            areas={areas}
            onSelectArea={(area) => {
              setSelectedArea(area);
              setView('chat');
            }}
            onAddNew={() => setView('map')}
            onLogout={onLogout}
            status={status}
          />
        )}

        {view === 'chat' && selectedArea && (
          <ChatWindow
            user={user}
            area={selectedArea}
            onBack={() => {
              setSelectedArea(null);
              setView('list');
            }}
            onLogout={onLogout}
          />
        )}
      </div>

      {view === 'map' && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="p-4 bg-white/80 backdrop-blur-md border-b flex justify-between items-center absolute top-0 left-0 right-0 z-[1000]">
            <h2 className="font-bold text-lg">Draw Zone</h2>
            <button
              onClick={() => setView('list')}
              className="bg-white px-3 py-1.5 rounded-lg shadow-sm border text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          <div className="flex-1 relative pt-0">
            <MapPicker onAreaCreated={handleAreaCreated} />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl text-sm font-medium z-[1000] pointer-events-none">
              点击地图开始绘制，多点连线，双击结束
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    return readStoredUser();
  });

  const saveUser = useCallback((u) => {
    setUser(u);
    try {
      writeStoredUser(u);
    } catch (e) { void e; }
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    try {
      clearStoredUser();
    } catch (e) { void e; }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) { void e; }
    clearUser();
  }, [clearUser]);

  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage user={user} onUserInvalid={clearUser} onLogout={handleLogout} />}
      />
      <Route path="/login" element={<LoginPage onAuthed={saveUser} />} />
    </Routes>
  );
}

export default App;
