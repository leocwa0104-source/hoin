import React from 'react';
import { MapPin, MessageCircle, LogOut } from 'lucide-react';

const AreaList = ({ areas, onSelectArea, onAddNew, onLogout }) => {
  return (
    <div className="flex flex-col h-full bg-gray-50 p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Zones</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="bg-white hover:bg-gray-50 text-gray-800 px-3 py-2 rounded-lg shadow-sm border transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <LogOut size={16} />
            <span>退出</span>
          </button>
          <button 
            onClick={onAddNew}
            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <MapPin size={16} />
            <span>New Zone</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <MapPin size={48} className="mb-4 opacity-20" />
            <p>No zones subscribed yet.</p>
            <p className="text-sm mt-2">Create a zone to start listening.</p>
          </div>
        ) : (
          areas.map(area => (
            <div 
              key={area.id}
              onClick={() => onSelectArea(area)}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                    {area.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Created {new Date(area.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-gray-50 group-hover:bg-blue-50 text-gray-400 group-hover:text-blue-600 p-2 rounded-full transition-colors">
                  <MessageCircle size={20} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AreaList;
