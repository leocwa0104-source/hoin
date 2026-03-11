import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, LogOut } from 'lucide-react';
import { api } from '../api';
import { getAmapPosition } from '../amap';

const pointInRing = (point, ring) => {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (point, polygon) => {
  if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    return false;
  }
  const [outerRing, ...holes] = polygon.coordinates;
  if (!pointInRing(point, outerRing)) return false;
  for (const hole of holes) {
    if (pointInRing(point, hole)) return false;
  }
  return true;
};

const ChatWindow = ({ user, area, onBack, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const lastPositionRef = useRef(null);
  const [locationState, setLocationState] = useState('checking');

  // Polling for messages instead of WebSocket
  useEffect(() => {
    let isMounted = true;
    
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/areas/${area.id}/messages`);
        if (isMounted) {
          setMessages(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      }
    };

    // Initial fetch
    fetchMessages();

    // Poll every 2 seconds
    const interval = setInterval(fetchMessages, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [area.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const geometry = typeof area.geometry === 'string' ? JSON.parse(area.geometry) : area.geometry;

    const update = async () => {
      try {
        const pos = await getAmapPosition();
        if (cancelled) return;
        lastPositionRef.current = pos;
        const inside = pointInPolygon([pos.lng, pos.lat], geometry);
        setLocationState(inside ? 'inside' : 'outside');
      } catch (e) {
        if (cancelled) return;
        lastPositionRef.current = null;
        setLocationState('unavailable');
        void e;
      }
    };

    Promise.resolve().then(() => { if (!cancelled) setLocationState('checking'); });
    Promise.resolve().then(update);
    const interval = setInterval(() => {
      Promise.resolve().then(update);
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [area.id, area.geometry]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (locationState !== 'inside') return;

    let pos = lastPositionRef.current;
    if (!pos) {
      pos = await getAmapPosition();
      lastPositionRef.current = pos;
    }

    const msgData = {
      content: inputText,
      lat: pos.lat,
      lng: pos.lng
    };

    try {
      await api.post(`/messages`, msgData);
      setInputText('');
      // Trigger immediate refresh after sending
      const res = await api.get(`/areas/${area.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3 shadow-sm z-10">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            {area.name}
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-wide">
              Live
            </span>
          </h2>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="退出登录"
            title="退出登录"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = user && msg.senderId === user.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] px-4 py-2.5 shadow-sm text-sm ${
                  isMe 
                    ? 'bg-black text-white rounded-2xl rounded-br-sm' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-sm'
                }`}
              >
                <p>{msg.content}</p>
                <div className={`text-[10px] mt-1 text-right opacity-60`}>
                   {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {locationState === 'inside' ? (
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSend} className="flex gap-2 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Broadcast message..."
              className="flex-1 bg-gray-100 border-0 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            />
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black hover:bg-gray-800 disabled:opacity-30 text-white p-1.5 rounded-lg transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 bg-white border-t border-gray-200 text-sm text-gray-600">
          {locationState === 'checking' && '定位中...'}
          {locationState === 'outside' && '你当前不在该区域内，无法发送消息。'}
          {locationState === 'unavailable' && '无法获取定位，请在浏览器允许高德定位后再试。'}
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
