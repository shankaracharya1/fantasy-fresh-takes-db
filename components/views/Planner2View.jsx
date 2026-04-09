"use client";

import { EmptyState, ShareablePanel, formatDateLabel, formatDateTimeLabel, formatNumber } from "./shared.jsx";

function toneClassFromLag(laggingCount) {
  const value = Number(laggingCount || 0);
  if (value >= 5) return "tone-danger";
  if (value >= 2) return "tone-warning";
  return "tone-positive";
}

function formatPlanner2DayLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function Planner2Content({
  planner2Data,
  planner2Loading,
  planner2Error,
  onShare,
  copyingSection,
}) {
  const totals = planner2Data?.totals || {};
  const ownerRows = Array.isArray(planner2Data?.ownerRows) ? planner2Data.ownerRows : [];
  const plannerRows = Array.isArray(planner2Data?.plannerRows) ? planner2Data.plannerRows : [];
  const dateColumns = Array.isArray(planner2Data?.dateColumns) ? planner2Data.dateColumns : [];
  const dayRows = Array.isArray(planner2Data?.dayRows) ? planner2Data.dayRows : [];
  const maxCommittedInAnyCell = Math.max(
    1,
    ...plannerRows.flatMap((row) =>
      dateColumns.map((date) => Number(row?.dayMap?.[date]?.committedTaskCount || 0))
    )
  );

  if (planner2Loading && !planner2Data) {
    return <EmptyState text="Loading Planner2..." />;
  }

  if (planner2Error && !planner2Data) {
    return <div className="warning-note">{planner2Error}</div>;
  }

  if (!planner2Data) {
    return <EmptyState text="Planner2 data is not available right now." />;
  }

  return (
    <div className="section-stack">
      {planner2Error ? <div className="warning-note">{planner2Error}</div> : null}

      <ShareablePanel
        shareLabel={`Planner2 ${planner2Data?.weekLabel || ""}`.trim()}
        onShare={onShare}
        isSharing={copyingSection === `Planner2 ${planner2Data?.weekLabel || ""}`.trim()}
      >
        <div className="panel-head">
          <div>
            <div className="panel-title">Planner2 · Planning Board</div>
            <div className="panel-statline">
              <span>{planner2Data?.weekLabel || "-"}</span>
              {planner2Data?.lastUpdatedAt ? (
                <span>Last updated: {formatDateTimeLabel(planner2Data.lastUpdatedAt)}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="metrics-grid" style={{ marginBottom: 12 }}>
          <div className="metric-card">
            <div className="metric-label">Committed tasks</div>
            <div className="metric-value">{formatNumber(totals.committedTaskCount || 0)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Completed markers</div>
            <div className="metric-value">{formatNumber(totals.completedTaskCount || 0)}</div>
          </div>
          <div className={`metric-card ${toneClassFromLag(totals.laggingTaskCount)}`}>
            <div className="metric-label">Lagging</div>
            <div className="metric-value">{formatNumber(totals.laggingTaskCount || 0)}</div>
          </div>
        </div>

        <div className="table-wrap">
          {plannerRows.length > 0 ? (
            <table className="ops-table overview-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220, position: "sticky", left: 0, background: "var(--surface)" }}>POD / Owner</th>
                  {dateColumns.map((date) => (
                    <th key={date} style={{ minWidth: 148 }}>
                      {formatPlanner2DayLabel(date)}
                    </th>
                  ))}
                  <th>Committed</th>
                  <th>Completed</th>
                  <th>Lagging</th>
                </tr>
              </thead>
              <tbody>
                {plannerRows.map((row) => (
                  <tr key={`${row.podLeadName}-${row.ownerName}`} className={Number(row.laggingTaskCount || 0) > 0 ? "is-below-target" : ""}>
                    <td style={{ position: "sticky", left: 0, background: "var(--bg)" }}>
                      <div style={{ fontWeight: 700 }}>{row.ownerName || "-"}</div>
                      <div style={{ fontSize: 12, color: "var(--subtle)" }}>{row.podLeadName || "-"}</div>
                    </td>
                    {dateColumns.map((date) => {
                      const cell = row.dayMap?.[date] || {};
                      const committed = Number(cell.committedTaskCount || 0);
                      const completed = Math.min(committed, Number(cell.completedTaskCount || 0));
                      const lagging = Math.min(Math.max(committed - completed, 0), Number(cell.laggingTaskCount || 0));
                      const pending = Math.max(committed - completed - lagging, 0);
                      const donePct = committed > 0 ? (completed / committed) * 100 : 0;
                      const pendingPct = committed > 0 ? (pending / committed) * 100 : 0;
                      const laggingPct = committed > 0 ? (lagging / committed) * 100 : 0;
                      const alpha = committed > 0 ? Math.min(1, 0.35 + committed / maxCommittedInAnyCell) : 0.18;

                      return (
                        <td key={`${row.ownerName}-${date}`}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div
                              style={{
                                display: "flex",
                                width: "100%",
                                height: 12,
                                borderRadius: 999,
                                overflow: "hidden",
                                background: "rgba(0,0,0,0.08)",
                              }}
                              title={
                                committed > 0
                                  ? `Committed ${committed} | Completed ${completed} | Pending ${pending} | Lagging ${lagging}`
                                  : "No tasks planned"
                              }
                            >
                              {donePct > 0 ? <span style={{ width: `${donePct}%`, background: `rgba(46, 125, 50, ${alpha})` }} /> : null}
                              {pendingPct > 0 ? <span style={{ width: `${pendingPct}%`, background: `rgba(194, 112, 62, ${alpha})` }} /> : null}
                              {laggingPct > 0 ? <span style={{ width: `${laggingPct}%`, background: `rgba(159, 46, 46, ${alpha})` }} /> : null}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--subtle)" }}>
                              {committed > 0
                                ? `T:${formatNumber(committed)} C:${formatNumber(completed)} L:${formatNumber(lagging)}`
                                : "T:0"}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td>{formatNumber(row.committedTaskCount || 0)}</td>
                    <td>{formatNumber(row.completedTaskCount || 0)}</td>
                    <td>{formatNumber(row.laggingTaskCount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState text="No planning rows found for this date range." />
          )}
        </div>

        <div className="table-wrap">
          <table className="ops-table overview-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>POD lead</th>
                <th>Committed</th>
                <th>Completed</th>
                <th>Lagging</th>
                <th>Active days</th>
              </tr>
            </thead>
            <tbody>
              {ownerRows.length > 0 ? (
                ownerRows.map((row) => (
                  <tr key={`${row.podLeadName}-${row.ownerName}`} className={Number(row.laggingTaskCount || 0) > 0 ? "is-below-target" : ""}>
                    <td>{row.ownerName || "-"}</td>
                    <td>{row.podLeadName || "-"}</td>
                    <td>{formatNumber(row.committedTaskCount || 0)}</td>
                    <td>{formatNumber(row.completedTaskCount || 0)}</td>
                    <td>{formatNumber(row.laggingTaskCount || 0)}</td>
                    <td>{formatNumber(row.activeDays || 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    No planning rows found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ShareablePanel>

      <ShareablePanel
        shareLabel="Planner2 daily plan"
        onShare={onShare}
        isSharing={copyingSection === "Planner2 daily plan"}
      >
        <div className="panel-title">Daily plan grid (from committed planner sheet)</div>
        <div className="panel-statline">Use this to share in leads channel and track daily execution.</div>
        <div className="table-wrap">
          <table className="ops-table overview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Owners with planned items</th>
                <th>Total committed</th>
                <th>Total completed markers</th>
                <th>Total lagging</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.length > 0 ? (
                dayRows.map((row) => {
                  const totalsForDay = (Array.isArray(row.items) ? row.items : []).reduce(
                    (acc, item) => {
                      acc.committed += Number(item.committedTaskCount || 0);
                      acc.completed += Number(item.completedTaskCount || 0);
                      acc.lagging += Number(item.laggingTaskCount || 0);
                      return acc;
                    },
                    { committed: 0, completed: 0, lagging: 0 }
                  );
                  return (
                    <tr key={row.date} className={totalsForDay.lagging > 0 ? "is-below-target" : ""}>
                      <td>{row.date || "-"}</td>
                      <td>{formatNumber((row.items || []).length)}</td>
                      <td>{formatNumber(totalsForDay.committed)}</td>
                      <td>{formatNumber(totalsForDay.completed)}</td>
                      <td>{formatNumber(totalsForDay.lagging)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    No daily plan rows found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ShareablePanel>
    </div>
  );
}
