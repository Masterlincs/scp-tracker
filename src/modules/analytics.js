// Analytics computations for SCP Tracker
// New focus: type split (SCP vs Tale) and tag-based statistics

import { FEATURES } from '../config.js';

// Simple memoization based on lengths and max timestamp
let _memo = { key: null, result: null };

function buildKey(readSCPs) {
  const entries = Object.values(readSCPs || {});
  let maxTs = 0;
  for (const e of entries) {
    if (e && e.timestamp && e.read) maxTs = Math.max(maxTs, e.timestamp);
  }
  return `${entries.length}|${maxTs}`;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const da = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun - 6 Sat
  const diff = (day + 6) % 7; // make Monday the start of week
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupByDay(entries) {
  const byDay = new Map();
  for (const e of entries) {
    if (!e.read) continue;
    const d = new Date(e.timestamp);
    const key = fmtDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  return byDay;
}

function computeStreak(byDay) {
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  while (true) {
    const key = fmtDate(cursor);
    const count = byDay.get(key) || 0;
    if (count > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function computeCalendar(byDay, weeks = 12) {
  // Build weeks x 7 grid ending on current week
  const today = new Date();
  const start = startOfWeek(new Date(today));
  const grid = [];
  const labels = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - w * 7);
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const key = fmtDate(date);
      week.push({ date: key, count: byDay.get(key) || 0 });
    }
    grid.push(week);
    labels.push(fmtDate(weekStart));
  }
  // Find max for normalization
  let max = 0;
  grid.forEach(week => week.forEach(d => { if (d.count > max) max = d.count; }));
  return { grid, labels, max };
}

// Aggregate tag counts from read entries
function aggregateTagCounts(entries) {
  const counts = new Map();
  for (const e of entries) {
    if (!e || !e.read) continue;
    const tags = Array.isArray(e.tags) ? e.tags : [];
    // Deduplicate normalized tags per entry to avoid overcounting
    const uniq = new Set();
    for (const t of tags) {
      const k = (typeof t === 'string' ? t.trim().toLowerCase() : '');
      if (!k) continue;
      uniq.add(k);
    }
    for (const k of uniq) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const arr = Array.from(counts.entries()).map(([tag, count]) => ({ tag, count }));
  arr.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return { counts: arr, totalUniqueTags: arr.length };
}

// Legacy-safe placeholder to avoid popup breakage until UI updated
function placeholderTimeOfDay() { return new Array(24).fill(0); }

// Legacy-safe weekly placeholder
function placeholderWeekly() { return { count: 0, goal: 0, percent: 0 }; }

export function computeAnalytics(readSCPsObj) {
  if (!FEATURES.ENABLE_ANALYTICS) return null;
  const entries = Object.values(readSCPsObj || {});
  const key = buildKey(readSCPsObj || {});
  if (_memo.key === key) return _memo.result;

  // Filter read entries
  const readEntries = entries.filter(e => e && e.read);

  // Type counts
  let scp = 0, tale = 0, unknown = 0;
  let lastReadTs = 0;
  for (const e of readEntries) {
    if (e.timestamp) lastReadTs = Math.max(lastReadTs, e.timestamp);
    const t = (e.type || '').toLowerCase();
    if (t === 'scp') scp += 1;
    else if (t === 'tale') tale += 1;
    else unknown += 1;
  }
  const known = scp + tale;
  const scpPercent = known ? Math.round((scp / known) * 100) : 0;
  const talePercent = known ? Math.round((tale / known) * 100) : 0;

  const tagStats = aggregateTagCounts(readEntries);

  // Legacy-safe placeholders so existing UI doesn't break before we update it
  const byDay = groupByDay(readEntries);
  const streak = 0; // legacy feature removed
  const calendar = { grid: [], labels: [], max: 0 }; // legacy feature removed
  const series = {}; // legacy feature removed
  const hours = placeholderTimeOfDay(); // legacy feature removed
  const weekly = placeholderWeekly(); // legacy feature removed

  const result = {
    typeSplit: { scp, tale, unknown, total: readEntries.length, scpPercent, talePercent },
    tagStats,
    lastReadTs,
    // legacy fields
    streak,
    calendar,
    series,
    hours,
    weekly,
  };
  _memo = { key, result };
  return result;
}

export default {
  computeAnalytics,
};
