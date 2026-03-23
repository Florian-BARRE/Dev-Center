// ====== Code Summary ======
// Dashboard — Home page. Stats strip + 2-column grid: project cards (60%) + activity feed (40%).

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import theme from '../../theme';
import { listProjects } from '../../api/projects';
import { getActivityLog } from '../../api/monitoring';
import { getTelegramModel } from '../../api/settings';
import ActivityFeed from '../../components/ActivityFeed';
import { ProjectCard } from './ProjectCard';
import type { Project, ActivityEntry, TelegramModelResponse } from '../../api/types';

const REFRESH_INTERVAL = 15_000;

const CONTENT_STYLE: React.CSSProperties = {
  maxWidth: theme.maxWidth,
  margin: '0 auto',
  padding: `${theme.spacing['2xl']} ${theme.spacing.xl}`,
};

/**
 * Home page — shows a stats strip, a project card grid (60%), and a recent
 * activity feed (40%). Data refreshes every 15 seconds.
 */
export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [telegramModels, setTelegramModels] = useState<Record<string, TelegramModelResponse>>({});
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const load = useCallback(async () => {
    try {
      // 1. Fetch projects + activity in parallel
      const [projs, acts] = await Promise.all([listProjects(), getActivityLog(20)]);
      setProjects(projs);
      setActivity(acts);

      // 2. Fetch telegram model for each project (N+1 — acceptable for small N)
      const models: Record<string, TelegramModelResponse> = {};
      await Promise.all(
        projs.map(async (p) => {
          try {
            models[p.groupId] = await getTelegramModel(p.groupId);
          } catch { /* ignore — project may not have a model set */ }
        })
      );
      setTelegramModels(models);
      setLastUpdated(new Date());
    } catch (err) {
      // Log fetch errors; UI retains previous data and continues polling
      console.error('[Dashboard] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial load
    load();

    // 2. Set up polling interval
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  // Derived stats
  const activeCount = projects.filter((p) => p.bridge !== null).length;
  const idleCount = projects.length - activeCount;

  if (loading) {
    return (
      <div style={CONTENT_STYLE}>
        <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={CONTENT_STYLE}>
      {/* Stats strip */}
      <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing['2xl'] }}>
        <StatChip dot="active" count={activeCount} label="active sessions" />
        <StatChip dot="idle" count={idleCount} label="idle projects" />
        <StatChip count={projects.length} label="total projects" />
      </div>

      {/* Main grid: 60% projects / 40% activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: theme.spacing.xl, alignItems: 'start' }}>
        {/* Left column: project cards */}
        <div>
          <SectionHeader title="PROJECTS">
            <Link
              to="/projects/new"
              style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.xs, textDecoration: 'none' }}
            >
              + New
            </Link>
          </SectionHeader>
          {projects.length === 0 ? (
            <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, padding: `${theme.spacing.xl} 0` }}>
              No projects yet — <Link to="/projects/new" style={{ color: theme.colors.text }}>create the first one →</Link>
            </div>
          ) : (
            projects.map((p) => (
              <ProjectCard key={p.groupId} project={p} telegramModel={telegramModels[p.groupId]} />
            ))
          )}
        </div>

        {/* Right column: recent activity */}
        <div>
          <SectionHeader
            title="RECENT ACTIVITY"
            right={
              <span style={{ color: theme.colors.muted, fontSize: theme.fontSize.xs, fontFamily: theme.font.mono }}>
                {lastUpdated.toLocaleTimeString()}
              </span>
            }
          />
          <ActivityFeed entries={activity} maxHeight="calc(100vh - 200px)" />
        </div>
      </div>
    </div>
  );
}

// ── StatChip ──────────────────────────────────────────────────────────────────

interface StatChipProps {
  dot?: 'active' | 'idle';
  count: number;
  label: string;
}

/**
 * Small stat pill rendered in the stats strip at the top of the Dashboard.
 */
function StatChip({ dot, count, label }: StatChipProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md, padding: '6px 12px',
      fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.textSecondary,
    }}>
      {dot === 'active' && <span style={{ color: theme.colors.active }}>●</span>}
      {dot === 'idle' && <span style={{ color: theme.colors.muted }}>○</span>}
      <strong style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{count}</strong>
      {label}
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
}

/**
 * Thin section header with optional right-aligned content and optional child nodes.
 */
function SectionHeader({ title, children, right }: SectionHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: theme.spacing.md, paddingBottom: theme.spacing.sm,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <span style={{
        fontFamily: theme.font.sans, fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.medium, color: theme.colors.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {title}
      </span>
      <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
        {children}
        {right}
      </div>
    </div>
  );
}

export default Dashboard;
