"use client";

import { EmptyState, ShareablePanel, formatDateTimeLabel, formatNumber } from "./shared.jsx";

function toneClassFromLag(laggingCount) {
  const value = Number(laggingCount || 0);
  if (value >= 5) return "tone-danger";
  if (value >= 2) return "tone-warning";
  return "tone-positive";
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
  const dayRows = Array.isArray(planner2Data?.dayRows) ? planner2Data.dayRows : [];

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
            <div className="panel-title">Planner2 · Upcoming Week Plan</div>
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
