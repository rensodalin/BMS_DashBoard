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
import { Search, LayoutGrid, ListFilter, Thermometer, X, Layers, Zap, Bell, Plus } from 'lucide-react';
import { exportToCsv } from './lib/exportCsv';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { AdminSettingsPage } from './components/auth/AdminSettingsPage';
import { detectFloorFromPoint, getAvailableFloors } from './lib/floorUtils';

export type WorkspaceTab = 'SUMMARY' | 'EQUIPMENT' | 'POINTS';

export function isBillingPoint(pt: SensorPoint): boolean {
  const name = pt.point_name.toLowerCase();
  const dev = (pt.device_name || '').toLowerCase();
  const display = (pt.display_value || '').toLowerCase();
  const url = (pt.obix_url || '').toLowerCase();
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
    name.includes('grape') ||
    name.includes('papaya') ||
    name.includes('pineapple') ||
    name.includes('coconut') ||
    name.includes('avocado') ||
    name.includes('dragonfruit') ||
    name.includes('lucky') ||
    name.includes('coffee') ||
    name.includes('ramen') ||
    name.includes('kfc') ||
    name.includes('pasta') ||
    name.includes('zendo') ||
    name.includes('ten11') ||
    name.includes('pandora') ||
    name.includes('g2000') ||
    name.includes('asic') ||
    name.includes('brown') ||
    name.includes('koi') ||
    name.includes('starbucks') ||
    name.includes('stabucks') ||
    name.includes('bingo') ||
    name.includes('bean') ||
    dev.includes('billing') ||
    dev.includes('tenant') ||
    dev.includes('meter') ||
    url.includes('billing') ||
    url.includes('meter') ||
    display.includes('kwh') ||
    display.includes('kw-hr')
  );
}

const DashboardContent: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [points, setPoints] = useState<SensorPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Independent floor filter state for Dashboard equipment
  const [dashboardFloor, setDashboardFloor] = useState<string>('ALL');

  // Independent floor filter state for Tenant Billing
  const [billingFloor, setBillingFloor] = useState<string>('ALL');

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
  const [liveWeather, setLiveWeather] = useState<{ temp: number; humidity: number; apparentTemp?: number }>({
    temp: 32.3,
    humidity: 62,
    apparentTemp: 37.1,
  });

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

  // Guard: Restrict Billing and Settings to Admin only
  useEffect(() => {
    if (!isAdmin && (activeTab === 'billing' || activeTab === 'settings')) {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

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

  // Dynamic list of floors detected across all station points
  const availableFloors = useMemo(() => {
    return getAvailableFloors(points);
  }, [points]);

  // Current active site name for display
  const activeFacilityName = useMemo(() => {
    return user?.siteName || user?.assignedTenant?.trim() || 'Station HQ';
  }, [user?.siteName, user?.assignedTenant]);

  // Filter points according to selected building floor scope for Dashboard
  const scopedPoints = useMemo(() => {
    if (dashboardFloor === 'ALL') {
      return points;
    }
    return points.filter((pt) => detectFloorFromPoint(pt) === dashboardFloor);
  }, [points, dashboardFloor]);

  // Separate operational building points from billing energy meter points in FIXED, STABLE order
  const dashboardPoints = useMemo(() => {
    return scopedPoints
      .filter((pt) => !isBillingPoint(pt))
      .sort((a, b) => a.point_name.localeCompare(b.point_name));
  }, [scopedPoints]);

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
    <div className="min-h-screen flex bg-[#f3f5f9] text-slate-800">

      {/* ── MetricPro Clean Navigation Sidebar ── */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} alarmCount={activeAlarmsCount} />

      {/* ── Main Workspace Area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Header & Search Bar */}
        <Header
          activeTab={activeTab}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenAddInvoice={() => setIsBillingAddModalOpen(true)}
          onRefresh={() => loadPoints(true)}
          onExportAll={handleExportAll}
          isRefreshing={isRefreshing}
          availableFloors={availableFloors}
          selectedFloor={activeTab === 'billing' ? billingFloor : dashboardFloor}
          onSelectFloor={(fl) => {
            if (activeTab === 'billing') {
              setBillingFloor(fl);
            } else {
              setDashboardFloor(fl);
            }
          }}
        />

        {/* Main Body Grid */}
        <main className="p-5 lg:p-7 flex flex-col lg:flex-row gap-5 max-w-[1680px] w-full mx-auto">

          {/* Left Column: Building Photo, Healthy Score, Alarm Metrics (Hidden in Equipment Health, Billing, and Settings views) */}
          {activeTab !== 'equipment' && workspaceTab !== 'EQUIPMENT' && activeTab !== 'billing' && activeTab !== 'settings' && (
            <LeftBuildingPanel
              points={dashboardPoints}
              facilityName={activeFacilityName}
              selectedFloor={dashboardFloor}
            />
          )}

          {/* Right Main Content Workspace */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* MetricPro Welcome Greeting Banner */}
            {activeTab !== 'billing' && activeTab !== 'settings' && (
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Welcome Back {user?.name ? user.name.split(' ')[0] : 'Administrator'}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Here's your live Intersys Niagara telemetry & building health overview
                </p>
              </div>
            )}

            {activeTab !== 'billing' && activeTab !== 'settings' && (
              <>
                {/* Top Metrics Row: Displayed on main dashboard, hidden on Equipment Health */}
                {activeTab !== 'equipment' && workspaceTab !== 'EQUIPMENT' && (
                  <StatsOverview
                    points={dashboardPoints}
                    onOpenWeatherTrend={() => setIsWeatherTrendOpen(true)}
                    weather={liveWeather}
                    onUpdateWeather={setLiveWeather}
                  />
                )}

                {/* ── Intersys Workspace Tabs & Type Filter Bar ── */}
                <div className="bg-white border border-slate-100 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] mb-5 select-none">

                  {/* Row 1: Workspace Tabs (Left) + Filter Pills (Right) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    {/* Left Tabs: Summary / Equipment / Points */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['SUMMARY', 'EQUIPMENT', 'POINTS'] as const).map((tab) => {
                        const isActive =
                          (workspaceTab === tab && activeTab !== 'equipment') ||
                          (activeTab === 'equipment' && tab === 'EQUIPMENT') ||
                          (activeTab === 'points' && tab === 'POINTS');

                        const labelMap: Record<string, string> = {
                          SUMMARY: 'Summary',
                          EQUIPMENT: 'Equipment',
                          POINTS: 'Points',
                        };

                        return (
                          <button
                            key={tab}
                            onClick={() => {
                              setWorkspaceTab(tab);
                              if (tab === 'EQUIPMENT') setActiveTab('equipment');
                              else if (activeTab === 'equipment') setActiveTab('dashboard');
                            }}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#001F3F] text-white shadow-sm font-semibold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            {labelMap[tab] || tab}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Filter Pills & View Switcher */}
                    {workspaceTab !== 'EQUIPMENT' && activeTab !== 'equipment' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setActiveFilter('ALL')}
                          className={`px-3 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                            activeFilter === 'ALL'
                              ? 'bg-[#001F3F] border-[#001F3F] text-white shadow-xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          All Types ({dashboardPoints.length})
                        </button>

                        <button
                          onClick={() => setActiveFilter('TEMPERATURES')}
                          className={`px-3 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                            activeFilter === 'TEMPERATURES'
                              ? 'bg-[#001F3F] border-[#001F3F] text-white shadow-xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Thermometer className="w-3.5 h-3.5 text-[#001F3F]" />
                          <span>Temps ({tempsCount})</span>
                        </button>

                        <button
                          onClick={() => setActiveFilter('RUNNING')}
                          className={`px-3 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                            activeFilter === 'RUNNING'
                              ? 'bg-[#001F3F] border-[#001F3F] text-white shadow-xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>Running ({runningCount})</span>
                        </button>

                        <button
                          onClick={() => setActiveFilter('ALARMS')}
                          className={`px-3 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeFilter === 'ALARMS'
                              ? 'bg-[#FF3523] border-[#FF3523] text-white shadow-xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          {activeAlarmsCount > 0 ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3523]" />
                          ) : (
                            <Bell className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span className={activeAlarmsCount > 0 && activeFilter !== 'ALARMS' ? 'text-[#FF3523] font-semibold' : undefined}>
                            Alarms ({activeAlarmsCount})
                          </span>
                        </button>

                        {/* View Switcher Table / Grid */}
                        <div className="flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200 ml-2">
                          <button
                            onClick={() => setViewMode('TABLE')}
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Table View"
                          >
                            <ListFilter className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setViewMode('GRID')}
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Grid View"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status Count Strip + Search */}
                  {workspaceTab !== 'EQUIPMENT' && activeTab !== 'equipment' && (
                    <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
                      {/* Left Summary Metric Counters */}
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-start leading-none">
                          <span className="font-bold font-mono text-slate-900 text-base">
                            {filteredPoints.length}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-1">
                            Total Monitored
                          </span>
                        </div>

                        <div className="flex items-center gap-2 leading-none">
                          <span className="w-2 h-2 rounded-full bg-[#001F3F]" />
                          <div className="flex flex-col items-start">
                            <span className="font-bold font-mono text-slate-900 text-base">
                              {runningCount}
                            </span>
                            <span className="text-[11px] text-slate-500 mt-1">
                              Operational
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 leading-none">
                          <span className={`w-2 h-2 rounded-full ${activeAlarmsCount > 0 ? 'bg-[#FF3523]' : 'bg-slate-300'}`} />
                          <div className="flex flex-col items-start">
                            <span className={`font-bold font-mono text-base ${activeAlarmsCount > 0 ? 'text-[#FF3523]' : 'text-slate-900'}`}>
                              {activeAlarmsCount}
                            </span>
                            <span className="text-[11px] text-slate-500 mt-1">
                              Active Alarms
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Search Input */}
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Filter sensor points..."
                          spellCheck={false}
                          className="w-56 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-md pl-8 pr-7 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="p-1 absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Workspace Body: Points Table / Grid / Equipment Health / Billing / Settings */}
            {isLoading ? (
              <div className="hw-panel p-16 text-center">
                <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-mono">Synchronizing Realtime Telemetry...</p>
              </div>
            ) : activeTab === 'settings' && isAdmin ? (
              <AdminSettingsPage />
            ) : activeTab === 'billing' && isAdmin ? (
              <BillingWorkspace
                points={points}
                selectedFloor={billingFloor}
                onSelectFloor={(fl) => setBillingFloor(fl)}
                availableFloors={availableFloors}
                isAddInvoiceOpen={isBillingAddModalOpen}
                onCloseAddInvoice={() => setIsBillingAddModalOpen(false)}
                onOpenAddPoint={() => setIsAddModalOpen(true)}
              />
            ) : workspaceTab === 'EQUIPMENT' || activeTab === 'equipment' ? (
              <EquipmentHealthWorkspace points={dashboardPoints} />
            ) : filteredPoints.length === 0 && !searchQuery ? (
              <div className="hw-panel p-12 text-center flex flex-col items-center justify-center gap-3 my-2">
                <div className="w-12 h-12 rounded-xl bg-[#00a4e4]/10 border border-[#00a4e4]/20 flex items-center justify-center text-[#00a4e4]">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  No Sensor Points Configured {dashboardFloor !== 'ALL' ? `for ${dashboardFloor}` : `for ${activeFacilityName}`}
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  {dashboardFloor !== 'ALL'
                    ? `Currently no telemetry points are assigned to ${dashboardFloor}. Click "Add Point" to configure or discover oBIX points for this floor.`
                    : `Currently no telemetry points are configured. Click "Add Point" to scan or configure station points.`}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Point {dashboardFloor !== 'ALL' ? `to ${dashboardFloor}` : ''}</span>
                  </button>
                )}
              </div>
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
        defaultFloor={
          activeTab === 'billing'
            ? (billingFloor !== 'ALL' ? billingFloor : 'Floor 1')
            : (dashboardFloor !== 'ALL' ? dashboardFloor : 'Floor 1')
        }
      />

      <PointTrendModal
        point={liveTrendPoint}
        onClose={() => setSelectedTrendPoint(null)}
      />

      <WeatherTrendModal
        isOpen={isWeatherTrendOpen}
        onClose={() => setIsWeatherTrendOpen(false)}
        currentWeather={liveWeather}
        onUpdateWeather={setLiveWeather}
      />

    </div>
  );
};

const AppMain: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0b0e] text-slate-400 font-mono select-none">
        <div className="w-8 h-8 border-2 border-[#00a4e4] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-300">Initializing BMS Security Console...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <DashboardContent />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppMain />
    </AuthProvider>
  );
};

export default App;
