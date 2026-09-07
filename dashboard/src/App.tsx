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
import { Search, LayoutGrid, ListFilter, Bell, ChevronLeft, ChevronRight, Zap, Thermometer, X, Plus } from 'lucide-react';
import { exportToCsv } from './lib/exportCsv';

export type WorkspaceTab = 'SUMMARY' | 'SPACES' | 'EQUIPMENT' | 'DEVICES' | 'POINTS';

export function isBillingPoint(pt: SensorPoint): boolean {
  const name = pt.point_name.toLowerCase();
  const dev = (pt.device_name || '').toLowerCase();
  const display = (pt.display_value || '').toLowerCase();
  return (
    name.includes('consumption') ||
    name.includes('tenant') ||
    name.includes('billing') ||
    name.includes('kwh') ||
    name.includes('kw-hr') ||
    name.includes('meter') ||
    name.includes('energy_meter') ||
    name.includes('apple') ||
    name.includes('banana') ||
    name.includes('orange') ||
    name.includes('kiwi') ||
    name.includes('strawberry') ||
    name.includes('durain') ||
    name.includes('cherry') ||
    name.includes('peach') ||
    name.includes('mango') ||
    name.includes('melon') ||
    dev.includes('billing') ||
    dev.includes('tenant') ||
    dev.includes('meter') ||
    display.includes('kwh') ||
    display.includes('kw-hr')
  );
}

export const App: React.FC = () => {
  const [points, setPoints] = useState<SensorPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Filtering & View Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('SUMMARY');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isBillingAddModalOpen, setIsBillingAddModalOpen] = useState<boolean>(false);
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<SensorPoint | null>(null);
  const [isWeatherTrendOpen, setIsWeatherTrendOpen] = useState<boolean>(false);

  // Load initial data & set up Supabase Realtime Subscription
  useEffect(() => {
    loadPoints(true);

    const channel = supabase
      .channel('realtime_sensor_points')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_points' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldName = (payload.old as any)?.point_name;
            if (oldName) {
              setPoints((prev) => prev.filter((p) => p.point_name !== oldName));
            }
          } else {
            loadPoints(false);
          }
        }
      )
      .subscribe();

    // 1-second continuous live polling interval to ensure 100% realtime sync matching Niagara & Supabase
    const liveInterval = setInterval(() => {
      loadPoints(false);
    }, 1000);

    return () => {
      clearInterval(liveInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPoints = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setIsLoading(true);
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

    setPoints((prev) => prev.filter((p) => p.point_name !== pointName));

    const ok = await deleteSensorPoint(pointName);
    if (!ok) {
      alert(`Failed to delete "${pointName}" from database. Check Supabase connection.`);
      loadPoints(false);
    }
  };

  // Export all monitored points to CSV for Excel
  const handleExportAll = () => {
    if (dashboardPoints.length === 0) return;

    const headers = [
      'Device Name',
      'Point Name',
      'Live Value',
      'Formatted Status',
      'Alarm Threshold',
      'Is Alarm State',
      'Last Sync Timestamp',
    ];

    const rows = dashboardPoints.map((pt) => {
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

  // Separate operational building points from billing energy meter points in FIXED, STABLE order
  const dashboardPoints = useMemo(() => {
    return points
      .filter((pt) => !isBillingPoint(pt))
      .sort((a, b) => a.point_name.localeCompare(b.point_name));
  }, [points]);

  // Filtered Points logic for dashboard table (stably ordered)
  const filteredPoints = useMemo(() => {
    return dashboardPoints.filter((pt) => {
      const search = searchQuery.toLowerCase().trim();
      const matchSearch =
        !search ||
        pt.point_name.toLowerCase().includes(search) ||
        (pt.device_name && pt.device_name.toLowerCase().includes(search));

      if (!matchSearch) return false;

      const reading = formatPointReading(pt);
      const nameLower = pt.point_name.toLowerCase();

      if (activeFilter === 'ALARMS') return reading.isAlarm;
      if (activeFilter === 'RUNNING') return isEquipmentRunning(pt);
      if (activeFilter === 'TEMPERATURES') return reading.isTemp;
      if (activeFilter === 'ENUMS') return nameLower.includes('status') || nameLower.includes('alarm') || nameLower.includes('fault');

      return true;
    });
  }, [dashboardPoints, searchQuery, activeFilter]);


  const activeAlarmsCount = useMemo(() => {
    return dashboardPoints.filter((pt) => formatPointReading(pt).isAlarm).length;
  }, [dashboardPoints]);

  const runningCount = useMemo(() => {
    return dashboardPoints.filter((pt) => isEquipmentRunning(pt)).length;
  }, [dashboardPoints]);

  const tempsCount = useMemo(() => {
    return dashboardPoints.filter((pt) => formatPointReading(pt).isTemp).length;
  }, [dashboardPoints]);

  const liveTrendPoint = useMemo(() => {
    if (!selectedTrendPoint) return null;
    return dashboardPoints.find((p) => p.point_name === selectedTrendPoint.point_name) || selectedTrendPoint;
  }, [dashboardPoints, selectedTrendPoint]);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#17181c', color: '#ffffff' }}>
      
      {/* ── Leftmost Vertical Navigation Rail ── */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ── Main Workspace Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header & Breadcrumb Bar */}
        <Header
          activeTab={activeTab}
          onOpenAddModal={() => {
            if (activeTab === 'billing') {
              setIsBillingAddModalOpen(true);
            } else {
              setIsAddModalOpen(true);
            }
          }}
          onRefresh={() => loadPoints(true)}
          onExportAll={handleExportAll}
          isRefreshing={isRefreshing}
        />

        {/* Main Body Grid */}
        <main className="p-4 flex flex-col lg:flex-row gap-3 max-w-[1680px] w-full mx-auto">
          
          {/* Left Column: Building Photo, Healthy Score, Alarm Metrics (Hidden in Equipment Health & Billing views) */}
          {activeTab !== 'equipment' && workspaceTab !== 'EQUIPMENT' && activeTab !== 'billing' && (
            <LeftBuildingPanel points={dashboardPoints} />
          )}

          {/* Right Main Content Workspace */}
          <div className="flex-1 min-w-0 flex flex-col">
            
            {activeTab !== 'billing' && (
              <>
                {/* Top Metrics Row: Displayed on main dashboard, hidden on Equipment Health */}
                {activeTab !== 'equipment' && workspaceTab !== 'EQUIPMENT' && (
                  <StatsOverview
                    points={dashboardPoints}
                    onOpenWeatherTrend={() => setIsWeatherTrendOpen(true)}
                  />
                )}

                {/* ── Honeywell Workspace Tabs & Type Filter Bar ── */}
                <div className="hw-panel mb-3 overflow-hidden select-none">
                  
                  {/* Row 1: Workspace Tabs (Left) + Filter Pills (Right) */}
                  <div
                    className="px-3 flex flex-wrap items-center justify-between gap-3 overflow-x-auto"
                    style={{ borderBottom: '1px solid #282a32', minHeight: '40px' }}
                  >
                    {/* Left Tabs: SUMMARY / SPACES / EQUIPMENT / DEVICES / POINTS */}
                    <div className="flex items-center gap-6">
                      {(['SUMMARY', 'SPACES', 'EQUIPMENT', 'DEVICES', 'POINTS'] as const).map((tab) => {
                        const isActive =
                          (workspaceTab === tab && activeTab !== 'equipment') ||
                          (activeTab === 'equipment' && tab === 'EQUIPMENT') ||
                          (activeTab === 'points' && tab === 'POINTS');

                        return (
                          <button
                            key={tab}
                            onClick={() => {
                              setWorkspaceTab(tab);
                              if (tab === 'EQUIPMENT') setActiveTab('equipment');
                              else if (activeTab === 'equipment') setActiveTab('dashboard');
                            }}
                            className={`hw-tab-btn ${isActive ? 'active' : ''}`}
                          >
                            {tab}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Filter Pills & Chevron Navigation */}
                    {workspaceTab !== 'EQUIPMENT' && activeTab !== 'equipment' && (
                      <div className="flex items-center gap-1.5 py-1">
                        <button
                          className="p-1 text-slate-500 hover:text-white transition cursor-pointer"
                          title="Previous"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setActiveFilter('ALL')}
                          className={`hw-filter-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
                        >
                          ALL TYPES ({dashboardPoints.length})
                        </button>

                        <button
                          onClick={() => setActiveFilter('TEMPERATURES')}
                          className={`hw-filter-pill flex items-center gap-1 ${activeFilter === 'TEMPERATURES' ? 'active' : ''}`}
                        >
                          <Thermometer className="w-3 h-3 text-cyan-400" />
                          <span>TEMPS ({tempsCount})</span>
                        </button>

                        <button
                          onClick={() => setActiveFilter('RUNNING')}
                          className={`hw-filter-pill flex items-center gap-1 ${activeFilter === 'RUNNING' ? 'active' : ''}`}
                        >
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span>RUNNING ({runningCount})</span>
                        </button>

                        <button
                          onClick={() => setActiveFilter('ALARMS')}
                          className={`hw-filter-pill flex items-center gap-1 ${activeFilter === 'ALARMS' ? 'active' : ''}`}
                        >
                          {activeAlarmsCount > 0 ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 hw-pulse" />
                          ) : (
                            <Bell className="w-3 h-3 text-slate-500" />
                          )}
                          <span style={{ color: activeAlarmsCount > 0 ? '#ef4444' : undefined }}>
                            ALARMS ({activeAlarmsCount})
                          </span>
                        </button>

                        <button
                          className="p-1 text-slate-500 hover:text-white transition cursor-pointer flex items-center gap-0.5 text-[11px] font-semibold uppercase text-slate-400"
                          title="More filters"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>6 more</span>
                        </button>

                        {/* View Switcher Table / Grid */}
                        <div
                          className="flex items-center p-0.5 rounded ml-2"
                          style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
                        >
                          <button
                            onClick={() => setViewMode('TABLE')}
                            className="p-1 rounded transition cursor-pointer"
                            style={{
                              backgroundColor: viewMode === 'TABLE' ? '#00a4e4' : 'transparent',
                              color: viewMode === 'TABLE' ? '#ffffff' : '#6b7280',
                            }}
                            title="Table View"
                          >
                            <ListFilter className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setViewMode('GRID')}
                            className="p-1 rounded transition cursor-pointer"
                            style={{
                              backgroundColor: viewMode === 'GRID' ? '#00a4e4' : 'transparent',
                              color: viewMode === 'GRID' ? '#ffffff' : '#6b7280',
                            }}
                            title="Grid View"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status Count Strip + Search & Quick Add */}
                  {workspaceTab !== 'EQUIPMENT' && activeTab !== 'equipment' && (
                    <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-4">
                      
                      {/* Left Summary Metric Counters */}
                      <div className="flex items-center gap-6">
                        {/* ALL Count */}
                        <div className="flex flex-col items-start leading-none">
                          <span className="font-bold font-mono text-white text-base">
                            {filteredPoints.length}
                          </span>
                          <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                            ALL
                          </span>
                        </div>

                        {/* RUNNING Count */}
                        <div className="flex items-center gap-1.5 leading-none">
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <div className="flex flex-col items-start">
                            <span className="font-bold font-mono text-cyan-400 text-base">
                              {runningCount}
                            </span>
                            <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                              RUNNING
                            </span>
                          </div>
                        </div>

                        {/* ACTIVE HIGH ALARMS Count */}
                        <div className="flex items-center gap-1.5 leading-none">
                          <Bell className={`w-3.5 h-3.5 ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
                          <div className="flex flex-col items-start">
                            <span className={`font-bold font-mono text-base ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                              {activeAlarmsCount}
                            </span>
                            <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                              ACTIVE HIGH ALARMS
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Search Input & Quick Add Point Button */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer"
                          style={{
                            backgroundColor: '#17252d',
                            border: '1px solid #234354',
                            color: '#00a4e4',
                          }}
                          title="Add new BMS sensor point / oBIX URL"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Point</span>
                        </button>

                        <div className="hw-search-box">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search sensor points..."
                            spellCheck={false}
                          />
                          {searchQuery ? (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="p-1 mr-1 text-slate-500 hover:text-white transition cursor-pointer"
                              title="Clear search"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-600 border border-[#2d3038] px-1 py-0.2 rounded mr-1.5 select-none pointer-events-none">
                              /
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </>
            )}

            {/* Workspace Body: Points Table / Grid / Equipment Health / Billing */}
            {isLoading ? (
              <div className="hw-panel p-16 text-center">
                <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-mono">Synchronizing Realtime Telemetry...</p>
              </div>
            ) : activeTab === 'billing' ? (
              <BillingWorkspace
                points={points}
                isAddInvoiceOpen={isBillingAddModalOpen}
                onCloseAddInvoice={() => setIsBillingAddModalOpen(false)}
              />
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
