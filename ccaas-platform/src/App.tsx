import React, { useState, useEffect } from 'react';
import { Users, Clock, Activity, PhoneCall, PhoneOff } from 'lucide-react';

// Types & Interfaces for CCaaS Architecture
interface CallMetrics {
  activeCalls: number;
  callsInQueue: number;
  avgHandleTime: string;
  abandonRate: string;
}

interface Agent {
  id: string;
  name: string;
  status: 'Available' | 'On Call' | 'Offline' | 'Wrap Up';
  department: string;
}

export default function App() {
  // Core State Management
  const [metrics, setMetrics] = useState<CallMetrics>({
    activeCalls: 24,
    callsInQueue: 5,
    avgHandleTime: '04:20',
    abandonRate: '2.4%'
  });

  const [agents] = useState<Agent[]>([
    { id: '1', name: 'Sarah Connor', status: 'On Call', department: 'Support' },
    { id: '2', name: 'John Smith', status: 'Available', department: 'Sales' },
    { id: '3', name: 'Emily Chen', status: 'Wrap Up', department: 'Support' },
    { id: '4', name: 'Michael Doe', status: 'Offline', department: 'Billing' },
  ]);

  // Real-time event simulation (Socket/WebRTC stub)
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        activeCalls: Math.max(0, prev.activeCalls + Math.floor(Math.random() * 3) - 1),
        callsInQueue: Math.max(0, prev.callsInQueue + Math.floor(Math.random() * 3) - 1),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: Agent['status']) => {
    switch(status) {
      case 'Available': return 'bg-green-100 text-green-800';
      case 'On Call': return 'bg-blue-100 text-blue-800';
      case 'Wrap Up': return 'bg-yellow-100 text-yellow-800';
      case 'Offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-indigo-600 mr-2" />
              <span className="font-bold text-xl text-gray-900">Worktual CCaaS</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                System Status: <span className="text-green-500 font-medium">Operational</span>
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Panel */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Live Operations Dashboard</h1>
          <p className="text-gray-500">Real-time contact center metrics and agent operational status.</p>
        </div>

        {/* Metrics Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard 
            title="Active Calls" 
            value={metrics.activeCalls.toString()} 
            icon={<PhoneCall className="h-6 w-6 text-blue-500" />} 
          />
          <MetricCard 
            title="Calls in Queue" 
            value={metrics.callsInQueue.toString()} 
            icon={<Users className="h-6 w-6 text-indigo-500" />} 
            trend="+2 from last hour" 
            trendUp={true} 
          />
          <MetricCard 
            title="Avg Handle Time" 
            value={metrics.avgHandleTime} 
            icon={<Clock className="h-6 w-6 text-green-500" />} 
          />
          <MetricCard 
            title="Abandon Rate" 
            value={metrics.abandonRate} 
            icon={<PhoneOff className="h-6 w-6 text-red-500" />} 
            trend="-0.5%" 
            trendUp={false} 
          />
        </div>

        {/* Agent Tracking Roster */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Active Agent Roster</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-700 font-medium">{agent.name.charAt(0)}</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendUp 
}: { 
  title: string, 
  value: string, 
  icon: React.ReactNode, 
  trend?: string, 
  trendUp?: boolean 
}) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">{value}</div>
              {trend && (
                <div className={`ml-2 flex items-baseline text-sm font-semibold ${trendUp ? 'text-red-600' : 'text-green-600'}`}>
                  {trend}
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}