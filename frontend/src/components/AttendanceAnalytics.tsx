import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { Calendar, TrendingUp, BarChart3, Award, AlertTriangle, Sparkles } from 'lucide-react';
import { AttendanceRecord, SubjectSummary, TARGET_ATTENDANCE } from '../lib/types';
import {
  calculateDayOfWeekAnalytics,
  calculateMonthlyAnalytics,
  calculateAttendanceInsights,
} from '../lib/analytics';
import { getSubjectAbbreviation } from '../lib/subjectUtils';

interface Props {
  records: AttendanceRecord[];
  subjects: SubjectSummary[];
}

type TabType = 'subjects' | 'weekdays' | 'monthly';

export default function AttendanceAnalytics({ records, subjects }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('subjects');

  const dayStats = calculateDayOfWeekAnalytics(records);
  const monthStats = calculateMonthlyAnalytics(records);
  const insights = calculateAttendanceInsights(records, subjects);

  // Subject comparison data sorted descending by percentage
  const subjectChartData = [...subjects]
    .filter(s => s.percentage !== null)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
    .map(s => {
      // Abbreviate subject names for clean, normalized graph representation
      const abbr = getSubjectAbbreviation(s.course_name);

      return {
        name: abbr,
        fullName: s.course_name,
        percentage: Number((s.percentage ?? 0).toFixed(1)),
        present: s.present,
        absent: s.absent,
        total: s.counted,
      };
    });

  const getBarColor = (pct: number) => {
    if (pct >= TARGET_ATTENDANCE) return '#10b981'; // emerald-500
    if (pct >= 75) return '#06b6d4'; // cyan-500
    if (pct >= 60) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="glass-panel p-6 sm:p-8 animate-fade-in stagger-3">
      {/* Header and Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="text-slate-700" size={22} />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Attendance Analytics</h2>
          </div>
          <p className="text-sm text-slate-500">
            Visual trends, weekday patterns, and subject-level performance
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1 self-start sm:self-auto border border-slate-200/50">
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'subjects'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={14} />
            Subjects
          </button>
          <button
            onClick={() => setActiveTab('weekdays')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'weekdays'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={14} />
            Day of Week
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp size={14} />
            Monthly Trend
          </button>
        </div>
      </div>

      {/* Quick Insights Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {insights.bestDay && (
          <div className="bg-emerald-50/70 border border-emerald-100/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-medium mb-1">
              <Award size={14} className="text-emerald-600" />
              <span>Best Day</span>
            </div>
            <div className="text-base font-bold text-emerald-950 truncate">{insights.bestDay.day}</div>
            <span className="text-xs text-emerald-700 font-semibold">{insights.bestDay.percentage}% attended</span>
          </div>
        )}

        {insights.toughestDay && (
          <div className="bg-amber-50/70 border border-amber-100/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-medium mb-1">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>Most Missed Day</span>
            </div>
            <div className="text-base font-bold text-amber-950 truncate">{insights.toughestDay.day}</div>
            <span className="text-xs text-amber-700 font-semibold">{insights.toughestDay.missed} lectures missed</span>
          </div>
        )}

        {insights.highestSubject && (
          <div className="bg-blue-50/70 border border-blue-100/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-blue-800 text-xs font-medium mb-1">
              <Sparkles size={14} className="text-blue-600" />
              <span>Top Subject</span>
            </div>
            <div className="text-base font-bold text-blue-950 truncate" title={insights.highestSubject.name}>
              {insights.highestSubject.name}
            </div>
            <span className="text-xs text-blue-700 font-semibold">{insights.highestSubject.percentage}%</span>
          </div>
        )}

        {insights.lowestSubject && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-medium mb-1">
              <AlertTriangle size={14} className="text-slate-500" />
              <span>Needs Focus</span>
            </div>
            <div className="text-base font-bold text-slate-900 truncate" title={insights.lowestSubject.name}>
              {insights.lowestSubject.name}
            </div>
            <span className="text-xs text-slate-600 font-semibold">{insights.lowestSubject.percentage}%</span>
          </div>
        )}
      </div>

      {/* Chart Section */}
      <div className="h-[340px] w-full pt-2">
        {activeTab === 'subjects' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectChartData}
                  margin={{ top: 15, right: 15, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                    interval={0}
                    height={40}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    unit="%"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-3.5 rounded-2xl shadow-2xl max-w-xs border border-slate-700 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-extrabold text-[11px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md tracking-wide">
                                {item.name}
                              </span>
                              <p className="font-bold text-xs leading-snug text-slate-100">{item.fullName}</p>
                            </div>
                            <div className="flex items-center justify-between gap-4 mb-1.5 pt-1.5 border-t border-slate-800">
                              <span className="text-slate-400">Attendance:</span>
                              <span className="font-extrabold text-emerald-400 text-sm">{item.percentage}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-300">
                              <span className="text-slate-400">Lectures:</span>
                              <span>{item.present} attended / {item.total} total</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={TARGET_ATTENDANCE}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: 'Target 80%', position: 'insideTopRight', fill: '#10b981', fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={75}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: 'Min 75%', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 11 }}
                  />
                  <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                    {subjectChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subject Abbreviations Legend Strip */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-bold text-slate-700 mr-1">Abbreviations:</span>
              {subjectChartData.map(item => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 bg-slate-100/90 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/70"
                  title={item.fullName}
                >
                  <strong className="font-bold text-slate-900">{item.name}:</strong>
                  <span className="truncate max-w-[120px] sm:max-w-none">{item.fullName}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'weekdays' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dayStats}
              margin={{ top: 15, right: 15, left: -20, bottom: 15 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="dayShort" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700">
                        <p className="font-semibold text-sm mb-1">{item.day}</p>
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="text-slate-400">Attendance:</span>
                          <span className="font-bold text-emerald-400">{item.percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300">
                          <span>Present: {item.present}</span>
                          <span>Absent: {item.absent}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={TARGET_ATTENDANCE}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: '80%', position: 'insideTopRight', fill: '#10b981', fontSize: 11 }}
              />
              <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                {dayStats.map((entry, index) => (
                  <Cell key={`day-cell-${index}`} fill={getBarColor(entry.percentage)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'monthly' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthStats}
              margin={{ top: 15, right: 15, left: -20, bottom: 15 }}
            >
              <defs>
                <linearGradient id="monthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                domain={[Math.max(0, Math.min(...monthStats.map(m => m.percentage)) - 10), 100]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700">
                        <p className="font-semibold text-sm mb-1">{item.monthLabel}</p>
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="text-slate-400">Attendance:</span>
                          <span className="font-bold text-sky-400">{item.percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300">
                          <span>{item.present} attended</span>
                          <span>{item.totalCounted} conducted</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={TARGET_ATTENDANCE}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: 'Target 80%', position: 'insideTopRight', fill: '#10b981', fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="percentage"
                stroke="#0ea5e9"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#monthGradient)"
                dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#0284c7' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
