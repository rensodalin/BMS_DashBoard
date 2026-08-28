import React, { useState, useEffect, useMemo } from 'react';
import type { SensorPoint, FilterCategory } from './types/bms';
import { fetchSensorPoints, deleteSensorPoint, supabase } from './lib/supabase';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LeftBuildingPanel } from './components/LeftBuildingPanel';
import { StatsOverview, isEquipmentRunning } from './components/StatsOverview';
import { PointsGrid, formatPointReading } from './components/PointsGrid';
import { PointsTable } from './components/PointsTable';
import { AddPointModal } from './components/AddPointModal';
import { PointTrendModal } from './components/PointTrendModal';
import { WeatherTrendModal } from './components/WeatherTrendModal';
import { EquipmentHealthWorkspace } from './components/EquipmentHealthWorkspace';
import { BillingWorkspace } from './components/billing';
import { Search, LayoutGrid, ListFilter, AlertTriangle, Zap, Thermometer, SlidersHorizontal } from 'lucide-react';
import { exportToCsv } from './lib/exportCsv';

export const App: React.FC = () => {
  const [points, setPoints] = useState<SensorPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Filtering & View Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [workspaceTab, setWorkspaceTab] = useState<'SUMMARY' | 'POINTS' | 'EQUIPMENT'>('SUMMARY');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<SensorPoint | null>(null);
  const [isWeatherTrendOpen, setIsWeatherTrendOpen] = useState<boolean>(false);

  // Load initial data & set up Supabase Realtime Subscription
  useEffect(() => {
    loadPoints(true);

    // Supabase Realtime WebSocket Listener on sensor_points table
    const channel = supabase
      .channel('realtime_sensor_points')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_points' },
        (payload) => {
          // 1. DELETE event
          if (payload.eventType === 'DELETE') {
            const oldName = (payload.old as any)?.point_name;
            if (oldName) {
              setPoints((prev) => prev.filter((p) => p.point_name !== oldName));
            }
          }
          // 2. UPDATE / INSERT event
          else if (payload.new && (payload.new as any).point_name) {
            const updatedPt = payload.new as SensorPoint;
            setPoints((prev) => {
              const idx = prev.findIndex((p) => p.point_name === updatedPt.point_name);
              if (idx !== -1) {
                const updatedList = [...prev];
                updatedList[idx] = { ...updatedList[idx], ...updatedPt };
                return updatedList;
              }
              return [...prev, updatedPt];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPoints = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    const data = await fetchSensorPoints();
    setPoints(data);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  // Delete sensor point handler
  const handleDeletePoint = async (pointName: string) => {
    if (!window.confirm(`Are you sure you want to delete point "${pointName}"?`)) {
      return;
    }

    // Optimistically update UI
    setPoints((prev) => prev.filter((p) => p.point_name !== pointName));

    const ok = await deleteSensorPoint(pointName);
    if (!ok) {
      alert(`Failed to delete "${pointName}" from database. Check Supabase connection.`);
      loadPoints(false); // Rollback if error
    }
  };

  // Export all monitored points to CSV for Excel
  const handleExportAll = () => {
    if (points.length === 0) return;

    const headers = [
      'Device Name',
      'Point Name',
      'Live Value',
      'Formatted Status',
      'Alarm Threshold',
      'Is Alarm State',
      'Last Sync Timestamp',
    ];

    const rows = points.map((pt) => {
      const reading = formatPointReading(pt);
      const valStr = reading.isTemp
        ? `${pt.current_value.toFixed(1)} °C`
        : pt.display_value || pt.current_value;

      return [
        pt.device_name || 'Niagara Controller',
        pt.point_name,
        valStr,
        reading.displayText,
        pt.alert_threshold ? `>= ${pt.alert_threshold}°C` : 'N/A',
        reading.isAlarm ? 'CRITICAL ALARM' : 'NORMAL',
        pt.updated_at ? new Date(pt.updated_at).toLocaleString() : 'N/A',
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCsv(`BMS_Points_Report_${dateStr}.csv`, headers, rows);
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
      const reading = formatPointReading(pt);
      const nameLower = pt.point_name.toLowerCase();

      if (activeFilter === 'ALARMS') return reading.isAlarm;
      if (activeFilter === 'RUNNING') return isEquipmentRunning(pt);
      if (activeFilter === 'TEMPERATURES') return reading.isTemp;
      if (activeFilter === 'ENUMS') return nameLower.includes('status') || nameLower.includes('alarm') || nameLower.includes('fault');

      return true;
    });
  }, [points, searchQuery, activeFilter]);

  const activeAlarmsCount = useMemo(() => {
    return points.filter((pt) => formatPointReading(pt).isAlarm).length;
  }, [points]);

  // Dynamically lookup live point object for trend modal
  const liveTrendPoint = useMemo(() => {
    if (!selectedTrendPoint) return null;
    return points.find((p) => p.point_name === selectedTrendPoint.point_name) || selectedTrendPoint;
  }, [points, selectedTrendPoint]);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex font-sans">
      
      {/* Honeywell Style Left Vertical Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Workspace Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Honeywell Top Navigation Header */}
        <Header
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onRefresh={() => loadPoints(true)}
          onExportAll={handleExportAll}
          isRefreshing={isRefreshing}
        />

        {/* Workspace Body Grid */}
        <main className="p-6 flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto w-full">
          
          {/* Left Column: Building Photo, Healthy Score, Alarm Feed */}
          <LeftBuildingPanel points={points} />

          {/* Right Main Content Workspace */}
          <div className="flex-1 min-w-0 flex flex-col">
            
            {activeTab !== 'billing' && (
              <>
                {/* Honeywell Top Metrics Row + Phnom Penh Weather Monitor */}
                <StatsOverview
                  points={points}
                  onOpenWeatherTrend={() => setIsWeatherTrendOpen(true)}
                />

                {/* Honeywell Workspace Tabs & Type Filters Bar */}
                <div className="bms-panel rounded-xl mb-6 border border-[#1e2638] bg-[#131924]">
                  
                  {/* Top Level Section Tabs */}
                  <div className="px-5 pt-3 flex items-center justify-between border-b border-[#1e2638] overflow-x-auto">
                    
                    <div className="flex items-center gap-6">
                      {(['SUMMARY', 'POINTS', 'EQUIPMENT'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setWorkspaceTab(tab)}
                          className={`pb-3 text-xs font-bold tracking-wider transition cursor-pointer relative ${
                            workspaceTab === tab || (activeTab === 'equipment' && tab === 'EQUIPMENT') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {tab}
                          {(workspaceTab === tab || (activeTab === 'equipment' && tab === 'EQUIPMENT')) && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t"></span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Grid vs Table View Switcher */}
                    {workspaceTab !== 'EQUIPMENT' && activeTab !== 'equipment' && (
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0c1018] border border-[#1e2638] mb-2">
                        <button
                          onClick={() => setViewMode('TABLE')}
                          className={`p-1.5 rounded text-xs transition cursor-pointer ${
                            viewMode === 'TABLE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Table View"
                        >
                          <ListFilter className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('GRID')}
                          className={`p-1.5 rounded text-xs transition cursor-pointer ${
                            viewMode === 'GRID' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Grid View"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                  </div>

                  {/* Sub-Filters: Type Selector Pills & Search Input */}
                  {workspaceTab !== 'EQUIPMENT' && activeTab !== 'equipment' && (
                    <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      
                      {/* Type Filter Pills */}
                      <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                        <span className="text-[11px] font-mono text-slate-500 mr-1 flex items-center gap-1">
                          <SlidersHorizontal className="w-3 h-3" /> TYPE:
                        </span>

                        <button
                          onClick={() => setActiveFilter('ALL')}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                            activeFilter === 'ALL'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-[#0c1018] text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          ALL TYPES ({points.length})
                        </button>

                        <button
                          onClick={() => setActiveFilter('TEMPERATURES')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                            activeFilter === 'TEMPERATURES'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-[#0c1018] text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                          }`}
                        >
                          <Thermometer className="w-3 h-3" /> TEMPS
                        </button>

                        <button
                          onClick={() => setActiveFilter('RUNNING')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                            activeFilter === 'RUNNING'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-[#0c1018] text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                          }`}
                        >
                          <Zap className="w-3 h-3" /> RUNNING
                        </button>

                        <button
                          onClick={() => setActiveFilter('ALARMS')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                            activeFilter === 'ALARMS'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-[#0c1018] text-slate-400 hover:text-red-400 hover:bg-slate-800'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" /> ALARMS ({activeAlarmsCount})
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="relative w-full md:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search points..."
                          className="w-full pl-8 pr-[#0c1018] py-1 rounded-md bms-input text-xs font-normal placeholder:text-slate-500 bg-[#0c1018] border-[#1e2638]"
                        />
                      </div>

                    </div>
                  )}

                </div>
              </>
            )}

            {/* Points Data Workspace vs Drag & Drop Equipment Workspace vs Billing Workspace */}
            {isLoading ? (
              <div className="bms-panel p-16 rounded-xl text-center text-slate-400 border border-[#1e2638] bg-[#131924]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs text-slate-300 font-medium">Connecting to Supabase Realtime...</p>
              </div>
            ) : activeTab === 'billing' ? (
              <BillingWorkspace points={points} />
            ) : workspaceTab === 'EQUIPMENT' || activeTab === 'equipment' ? (
              <EquipmentHealthWorkspace points={points} />
            ) : viewMode === 'TABLE' ? (
              <PointsTable
                points={filteredPoints}
                onSelectPointTrend={(pt) => setSelectedTrendPoint(pt)}
                onDeletePoint={handleDeletePoint}
              />
            ) : (
              <PointsGrid
                points={filteredPoints}
                onSelectPointTrend={(pt) => setSelectedTrendPoint(pt)}
                onDeletePoint={handleDeletePoint}
              />
            )}

          </div>

        </main>

      </div>

      {/* Modals */}
      <AddPointModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => loadPoints(false)}
      />

      <PointTrendModal
        point={liveTrendPoint}
        onClose={() => setSelectedTrendPoint(null)}
      />

      <WeatherTrendModal
        isOpen={isWeatherTrendOpen}
        onClose={() => setIsWeatherTrendOpen(false)}
      />

    </div>
  );
};

export default App;
