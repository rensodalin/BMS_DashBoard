import React, { useState, useEffect, useMemo } from 'react';
import type { SensorPoint, FilterCategory } from './types/bms';
import { fetchSensorPoints, supabase } from './lib/supabase';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { PointsGrid } from './components/PointsGrid';
import { PointsTable } from './components/PointsTable';
import { AddPointModal } from './components/AddPointModal';
import { PointTrendModal } from './components/PointTrendModal';
import { Search, LayoutGrid, ListFilter, AlertTriangle, Zap, Thermometer } from 'lucide-react';

export const App: React.FC = () => {
  const [points, setPoints] = useState<SensorPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Filtering & View Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<SensorPoint | null>(null);

  // Load initial data & set up Supabase Realtime Subscription
  useEffect(() => {
    loadPoints();

    // Supabase Realtime WebSocket Listener on sensor_points table
    const channel = supabase
      .channel('realtime_sensor_points')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_points' },
        (payload) => {
          console.log('⚡ Realtime WebSocket update received:', payload);
          loadPoints(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPoints = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    const data = await fetchSensorPoints();
    setPoints(data);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  // Filtered Points logic
  const filteredPoints = useMemo(() => {
    return points.filter((pt) => {
      // 1. Search Query Filter
      const search = searchQuery.toLowerCase().trim();
      const matchSearch =
        !search ||
        pt.point_name.toLowerCase().includes(search) ||
        (pt.device_name && pt.device_name.toLowerCase().includes(search));

      if (!matchSearch) return false;

      // 2. Category Tab Filter
      const nameLower = pt.point_name.toLowerCase();
      const isAlarm = pt.is_alarm || pt.current_value >= pt.alert_threshold;

      if (activeFilter === 'ALARMS') return isAlarm;
      if (activeFilter === 'RUNNING') return (nameLower.includes('pump') || nameLower.includes('fan') || nameLower.includes('status')) && pt.current_value > 0;
      if (activeFilter === 'TEMPERATURES') return nameLower.includes('temp') || nameLower.includes('room');
      if (activeFilter === 'ENUMS') return nameLower.includes('status') || nameLower.includes('alarm') || nameLower.includes('fault');

      return true;
    });
  }, [points, searchQuery, activeFilter]);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 pb-16 font-sans">
      
      {/* Header */}
      <Header
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onRefresh={() => loadPoints(true)}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6">
        
        {/* KPI Overview Summary Cards */}
        <StatsOverview points={points} />

        {/* Control Bar & Filters */}
        <div className="bms-panel p-4 rounded-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-[#1f293d]">
          
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by point name or device..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bms-input text-xs font-normal placeholder:text-slate-500"
            />
          </div>

          {/* Filter Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All ({points.length})
            </button>

            <button
              onClick={() => setActiveFilter('ALARMS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeFilter === 'ALARMS'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Alarms
            </button>

            <button
              onClick={() => setActiveFilter('RUNNING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeFilter === 'RUNNING'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Running
            </button>

            <button
              onClick={() => setActiveFilter('TEMPERATURES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeFilter === 'TEMPERATURES'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" /> Temps
            </button>
          </div>

          {/* View Mode Switcher (Grid vs Table) */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0d131f] border border-[#1f293d]">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded text-xs transition cursor-pointer ${
                viewMode === 'GRID' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded text-xs transition cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="bms-panel p-16 rounded-xl text-center text-slate-400 border border-[#1f293d]">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-300 font-medium">Connecting to Supabase Realtime...</p>
          </div>
        ) : viewMode === 'GRID' ? (
          <PointsGrid
            points={filteredPoints}
            onSelectPointTrend={(pt) => setSelectedTrendPoint(pt)}
          />
        ) : (
          <PointsTable
            points={filteredPoints}
            onSelectPointTrend={(pt) => setSelectedTrendPoint(pt)}
          />
        )}

      </main>

      {/* Modals */}
      <AddPointModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => loadPoints(false)}
      />

      <PointTrendModal
        point={selectedTrendPoint}
        onClose={() => setSelectedTrendPoint(null)}
      />

    </div>
  );
};

export default App;
