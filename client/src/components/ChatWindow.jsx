import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ChatWindow = ({ user, area, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Polling for messages instead of WebSocket
  useEffect(() => {
    let isMounted = true;
    
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${SOCKET_URL}/api/areas/${area.id}/messages`);
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Simulate location inside the polygon
    // We pick the first point of the polygon and add slight random jitter
    const firstRing = area.geometry.coordinates[0];
    const firstPoint = firstRing[0]; // [lng, lat]
    
    const jitter = () => (Math.random() - 0.5) * 0.001; 
    const lng = firstPoint[0] + jitter();
    const lat = firstPoint[1] + jitter();

    const msgData = {
      senderId: user.id,
      content: inputText,
      lat,
      lng
    };

    try {
      await axios.post(`${SOCKET_URL}/api/messages`, msgData);
      setInputText('');
      // Trigger immediate refresh after sending
      const res = await axios.get(`${SOCKET_URL}/api/areas/${area.id}/messages`);
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
        <div>
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            {area.name}
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-wide">
              Live
            </span>
          </h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === user.id;
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
    </div>
  );
};

export default ChatWindow;
