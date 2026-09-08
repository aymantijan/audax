/**
 * AnalyticsView — Programme analytics dashboard.
 * Organizes all 8 visualization types into a tabbed interface.
 */
import { useState } from 'react';
import { BarChart3, Target, Activity, Calendar, TrendingUp, GitCompare, BarChart, Network } from 'lucide-react';

import RadarOverview from './visualizations/RadarOverview';
import GanttTimeline from './visualizations/GanttTimeline';
import HeatmapCalendar from './visualizations/HeatmapCalendar';
import EvolutionChart from './visualizations/EvolutionChart';
import CorrelationNetwork from './visualizations/CorrelationNetwork';
import CorrelationScatter from './visualizations/CorrelationScatter';
import ComparisonChart from './visualizations/ComparisonChart';
import DistributionChart from './visualizations/DistributionChart';
import SpiralTimeline from './visualizations/SpiralTimeline';

const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: Target, components: ['radar', 'heatmap', 'gantt'] },
  { key: 'evolution', label: 'Évolution', icon: TrendingUp, components: ['evolution', 'spiral'] },
  { key: 'correlations', label: 'Corrélations', icon: Network, components: ['network', 'scatter'] },
  { key: 'analysis', label: 'Analyses', icon: BarChart, components: ['comparison', 'distribution'] },
];

export default function AnalyticsView() {
  const [activeTab, setActiveTab] = useState('overview');

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-surface border border-line rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-mute hover:text-ink hover:bg-card'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {currentTab.components.includes('radar') && <RadarOverview />}
        {currentTab.components.includes('heatmap') && <HeatmapCalendar />}
        {currentTab.components.includes('gantt') && <GanttTimeline />}
        {currentTab.components.includes('evolution') && <EvolutionChart />}
        {currentTab.components.includes('spiral') && <SpiralTimeline />}
        {currentTab.components.includes('network') && <CorrelationNetwork />}
        {currentTab.components.includes('scatter') && <CorrelationScatter />}
        {currentTab.components.includes('comparison') && <ComparisonChart />}
        {currentTab.components.includes('distribution') && <DistributionChart />}
      </div>
    </div>
  );
}
