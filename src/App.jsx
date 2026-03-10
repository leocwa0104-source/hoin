import React, { useCallback, useEffect, useState } from 'react';
import AreaList from './components/AreaList';
import MapPicker from './components/MapPicker';
import ChatWindow from './components/ChatWindow';
import Auth from './components/Auth';
import { api } from './api';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // auth, list, map, chat
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) { void e; }
    finally {
      setUser(null);
      setAreas([]);
      setSelectedArea(null);
      setView('auth');
    }
  }, []);

  const fetchAreas = useCallback(async () => {
    try {
      const res = await api.get(`/areas`);
      setAreas(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const res = await api.get('/me');
        if (!mounted) return;
        setUser(res.data);
        setView('list');
        await fetchAreas();
      } catch {
        if (!mounted) return;
        setView('auth');
      }
    };
    restore();
    return () => { mounted = false; };
  }, [fetchAreas]);

  const handleAreaCreated = async (geometry) => {
    const name = prompt("Name this zone (e.g., 'Home', 'Office'):");
    if (!name) return; // If cancelled, user stays on map

    try {
      await api.post(`/areas`, { name, geometry });
      // Refresh list
      await fetchAreas();
      setView('list');
    } catch (err) {
      console.error(err);
      alert("Failed to create area");
    }
  };

  // Render Logic
  if (view === 'auth') {
    return (
      <Auth
        onAuthed={async (u) => {
          setUser(u);
          setView('list');
          await fetchAreas();
        }}
      />
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col md:flex-row bg-white font-sans text-gray-900">
      {/* Main Content Area */}
      <div className={`flex-1 h-full relative ${view === 'map' ? 'hidden' : 'block'}`}>
        {view === 'list' && (
          <AreaList 
            areas={areas} 
            onSelectArea={(area) => {
              setSelectedArea(area);
              setView('chat');
            }}
            onAddNew={() => setView('map')}
            onLogout={handleLogout}
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
            onLogout={handleLogout}
          />
        )}
      </div>

      {/* Map Overlay for creation */}
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
             {/* Map takes full height, header overlays it */}
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

export default App;
