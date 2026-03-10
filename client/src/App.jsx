import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AreaList from './components/AreaList';
import MapPicker from './components/MapPicker';
import ChatWindow from './components/ChatWindow';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); // login, list, map, chat
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [username, setUsername] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username) return;
    try {
      const res = await axios.post(`${API_URL}/users`, { name: username });
      setUser(res.data);
      setView('list');
      fetchAreas(res.data.id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAreas = async (userId) => {
    try {
      const res = await axios.get(`${API_URL}/areas/${userId}`);
      setAreas(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAreaCreated = async (geometry) => {
    const name = prompt("Name this zone (e.g., 'Home', 'Office'):");
    if (!name) return; // If cancelled, user stays on map

    try {
      await axios.post(`${API_URL}/areas`, {
        userId: user.id,
        name,
        geometry
      });
      // Refresh list
      await fetchAreas(user.id);
      setView('list');
    } catch (err) {
      console.error(err);
      alert("Failed to create area");
    }
  };

  // Render Logic
  if (view === 'login') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">GeoChat</h1>
            <p className="text-gray-500 text-sm">Define your world. Listen in.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Nickname</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-black focus:bg-white outline-none transition-all font-medium"
              />
            </div>
            <button 
              type="submit" 
              disabled={!username}
              className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
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
              Use the pentagon tool ⬠ to draw an area
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
