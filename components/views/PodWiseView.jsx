"use client";

import {
  EmptyState,
  ShareablePanel,
  formatMetricValue,
} from "./shared.jsx";

// ─── Private components ───────────────────────────────────────────────────────

const POD_TIER_GREEN_MIN = 35;
const POD_TIER_AMBER_MIN = 20;

function getPodTierColor(conversionRate) {
  if (conversionRate >= POD_TIER_GREEN_MIN) return "#2d5a3d";
  if (conversionRate >= POD_TIER_AMBER_MIN) return "#c2703e";
  return "#9f2e2e";
}

function PodFunnelBar({ label, value, maxValue, color }) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0;
  return (
    <div className="pod-funnel-row">
      <span className="pod-funnel-label">{label}</span>
      <div className="pod-funnel-track">
        <div className="pod-funnel-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="pod-funnel-count">{value}</span>
    </div>
  );
}

// ─── PodTasksBarChart and PodTasksContent ────────────────────────────────────

function PodTasksBarChart({ title, subtitle, items, maxValue, accentColor }) {
  if (items.length === 0) {
    return (
      <>
        <div className="pod-section-header">
          <span className="pod-section-title">{title}</span>
          <span className="pod-section-subtitle">{subtitle}</span>
        </div>
        <EmptyState text={`No ${title.toLowerCase()} right now.`} />
      </>
    );
  }

  return (
    <>
      <div className="pod-section-header">
        <span className="pod-section-title">{title}</span>
        <span className="pod-section-subtitle">{subtitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => {
          const isMax = i === 0;
          const barColor = isMax ? accentColor : "#2d5a3d";
          const pct = maxValue > 0 ? Math.max((item.count / maxValue) * 100, 4) : 0;
          return (
            <div key={item.podLead} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 72, fontSize: 13, fontWeight: 500, color: "var(--ink)", textAlign: "right", flexShrink: 0 }}>
                {item.podLead}
              </span>
              <div style={{ flex: 1, height: 28, borderRadius: 6, background: "var(--surface)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: barColor, transition: "width 0.4s ease" }} />
              </div>
              <span style={{ width: 28, fontSize: 14, fontWeight: 700, color: isMax ? accentColor : "var(--ink-secondary)", textAlign: "right", flexShrink: 0 }}>
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function PodTasksContent({ podTasksData, podTasksLoading, onShare, copyingSection }) {
  if (podTasksLoading) {
    return <EmptyState text="Loading POD tasks..." />;
  }

  if (!podTasksData) {
    return <EmptyState text="POD tasks data is not available right now." />;
  }

  const { scriptsPendingByPod, beatsPendingByPod, totalScriptsPending, totalBeatsPending } = podTasksData;
  const maxScripts = Math.max(...scriptsPendingByPod.map((r) => r.count), 1);
  const maxBeats = Math.max(...beatsPendingByPod.map((r) => r.count), 1);

  return (
    <ShareablePanel
      shareLabel="POD Tasks"
      onShare={onShare}
      isSharing={copyingSection === "POD Tasks"}
    >
      <div className="section-stack">
        <div className="pod-summary-grid">
          {[
            { label: "Scripts to review", value: totalScriptsPending },
            { label: "Beats to review", value: totalBeatsPending },
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <div className="metric-label">{card.label}</div>
              <div className="metric-value">{card.value}</div>
            </div>
          ))}
        </div>

        <PodTasksBarChart
          title="Scripts pending approval"
          subtitle="Scripts completed by writer, awaiting POD lead review"
          items={scriptsPendingByPod}
          maxValue={maxScripts}
          accentColor="#c2703e"
        />

        <PodTasksBarChart
          title="Beats pending approval"
          subtitle="Beats from current week in review pending or iterate status"
          items={beatsPendingByPod}
          maxValue={maxBeats}
          accentColor="#c2703e"
        />
      </div>
    </ShareablePanel>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function PodWiseContent({ competitionPodRows, competitionLoading, onShare, copyingSection }) {
  if (competitionLoading) {
    return <EmptyState text="Loading POD Wise dashboard..." />;
  }

  const competitionRows = Array.isArray(competitionPodRows) ? competitionPodRows : [];
  if (competitionRows.length === 0) {
    return <EmptyState text="POD Wise data is not available right now." />;
  }

  const sorted = [...competitionRows]
    .map((row) => {
      const beats = row.lifetimeBeats || 0;
      const scripts = row.lifetimeScripts || 0;
      const successful = row.hitRateNumerator || 0;
      const conversion = scripts > 0 ? Math.round((successful / scripts) * 100) : 0;
      return { ...row, beats, scripts, successful, conversion };
    })
    .sort((a, b) => b.conversion - a.conversion || b.successful - a.successful);

  const totalBeats = sorted.reduce((s, r) => s + r.beats, 0);
  const totalScripts = sorted.reduce((s, r) => s + r.scripts, 0);
  const totalSuccessful = sorted.reduce((s, r) => s + r.successful, 0);
  const avgConversion = totalScripts > 0 ? Math.round((totalSuccessful / totalScripts) * 100) : 0;

  const maxBeats = Math.max(...sorted.map((r) => r.beats), 1);
  const maxScripts = Math.max(...sorted.map((r) => r.scripts), 1);
  const maxSuccessful = Math.max(...sorted.map((r) => r.successful), 1);

  return (
    <ShareablePanel
      shareLabel="POD Wise leaderboard"
      onShare={onShare}
      isSharing={copyingSection === "POD Wise leaderboard"}
    >
      <div className="section-stack">
        <div className="pod-summary-grid">
          {[
            { label: "Total beats", value: totalBeats },
            { label: "Total scripts", value: totalScripts },
            { label: "Successful", value: totalSuccessful },
            { label: "Avg conversion", value: `${avgConversion}%` },
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <div className="metric-label">{card.label}</div>
              <div className="metric-value">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="pod-section-header">
          <span className="pod-section-title">POD performance</span>
          <span className="pod-section-subtitle">Ranked by successful scripts as % of total attempted scripts</span>
        </div>

        <div className="pod-cards-stack">
          {sorted.map((pod, i) => {
            const rank = i + 1;
            const tierColor = getPodTierColor(pod.conversion);
            return (
              <div key={pod.podLeadName} className="pod-rank-card" style={{ borderLeftColor: tierColor }}>
                <div className="pod-rank-col">
                  <div className="pod-rank-number" style={{ color: tierColor }}>{rank}</div>
                  <div className="pod-rank-label">RANK</div>
                </div>
                <div className="pod-info-col">
                  <div className="pod-lead-name">{pod.podLeadName}</div>
                  <div className="pod-conversion" style={{ color: tierColor }}>{pod.conversion}%</div>
                  <div className="pod-rate-label">SCRIPT HIT RATE</div>
                </div>
                <div className="pod-bars-col">
                  <PodFunnelBar label="Beats" value={pod.beats} maxValue={maxBeats} color="#2d5a3d" />
                  <PodFunnelBar label="Scripts" value={pod.scripts} maxValue={maxScripts} color="#c2703e" />
                  <PodFunnelBar label="Success" value={pod.successful} maxValue={maxSuccessful} color="#2d5a3d" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="pod-legend">
          {[
            { color: "#2d5a3d", label: "Beats written" },
            { color: "#c2703e", label: "Scripts produced" },
            { color: "#2d5a3d", label: "Successful scripts" },
          ].map((item) => (
            <div key={item.label} className="pod-legend-item">
              <span className="pod-legend-swatch" style={{ background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </ShareablePanel>
  );
}
