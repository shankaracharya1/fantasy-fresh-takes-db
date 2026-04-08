"use client";

import { ANALYTICS_LEGEND_FALLBACK, getAnalyticsLegendToneClass } from "./shared.jsx";

export default function DetailsContent({ acdMetricsData, acdMetricsLoading, acdMetricsError, analyticsData }) {
  const trackedTeams = Array.isArray(acdMetricsData?.trackedTeams) ? acdMetricsData.trackedTeams : [];
  const legendItems = Array.isArray(analyticsData?.legend) && analyticsData.legend.length > 0
    ? analyticsData.legend
    : ANALYTICS_LEGEND_FALLBACK;

  return (
    <div className="section-stack">
      <div className="panel-grid two-col">
        <section className="panel-card">
          <div className="panel-title">Teams currently being tracked</div>
          <div className="section-subtitle">
            ACD sync reads from the Live tab only, processes Final image sheet links from column AZ, and reports only
            rows stored as <code>live_tab_sync</code>.
          </div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {acdMetricsLoading ? (
              <div className="details-panel-empty">Loading tracked teams...</div>
            ) : acdMetricsError ? (
              <div className="details-panel-empty">{acdMetricsError}</div>
            ) : trackedTeams.length === 0 ? (
              <div className="details-panel-empty">No tracked team data is available yet.</div>
            ) : (
              <div className="details-team-grid">
                {trackedTeams.map((team) => {
                  const acdNames = Array.isArray(team?.acdNames) ? team.acdNames.filter(Boolean) : [];
                  return (
                    <article key={team.cdName || "unknown-cd"} className="details-team-card">
                      <div className="details-team-name">{team.cdName || "Unknown CD"}</div>
                      {acdNames.length > 0 ? (
                        <div className="details-team-acds">
                          {acdNames.map((acdName) => (
                            <span key={`${team.cdName}-${acdName}`} className="pill pill-neutral">
                              {acdName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="details-panel-empty">No live synced ACDs yet.</div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-title">Analytics legend</div>
          <div className="section-subtitle">Use this to decide which attempts are ready for Full Gen AI, need rework, or should be dropped.</div>
          <div className="details-legend-list">
            {legendItems.map((item) => (
              <div key={item.label} className="details-legend-item">
                <span className={`details-legend-swatch ${getAnalyticsLegendToneClass(item.tone)}`.trim()} />
                <div>
                  <strong>{item.label}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel-card">
        <div className="panel-title">Next step logic</div>
        <div className="section-subtitle">
          Amount spent is a hard gate. Assets with less than $100 spend are classified as Testing / Drop.
          Attempts without a readable CPI are excluded from Analytics entirely.
        </div>
        <div className="details-logic-grid">
          <article className="details-logic-card">
            <div className="details-panel-subtitle">Gen AI</div>
            <ul className="rules-list">
              <li>
                <strong>Gen AI</strong>: Amount spent must be at least $100, CPI must be below $10, and no more than
                two baseline benchmark checks can miss across 3 sec plays, Thruplays / 3s plays, Q1 completion,
                Absolute completion, CTI, and Amount spent.
              </li>
            </ul>
          </article>
          <article className="details-logic-card">
            <div className="details-panel-subtitle">Rework</div>
            <ul className="rules-list">
              <li>
                <strong>P1 Rework</strong>: Amount spent is at least $100, does not qualify for Gen AI, and CTI is 12% or above.
              </li>
              <li>
                <strong>P2 Rework</strong>: Amount spent is at least $100, does not qualify for Gen AI, and CTI is below 12%.
              </li>
            </ul>
          </article>
          <article className="details-logic-card">
            <div className="details-panel-subtitle">Testing / Drop</div>
            <ul className="rules-list">
              <li>
                <strong>Testing / Drop</strong>: Amount spent is below $100. Shown at the bottom of the table.
              </li>
            </ul>
          </article>
        </div>
        <div className="details-panel-copy">
          <strong>Actioned</strong> is a shared saved checkbox for each week and asset code. It requires unlocked edit
          access to change, and actioned rows are hidden by default in Analytics until you choose to show them.
        </div>
      </section>
    </div>
  );
}
