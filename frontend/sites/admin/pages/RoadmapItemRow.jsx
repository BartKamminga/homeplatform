import { useState } from "react";
import { s, STATUS_LABEL, STATUS_COLOR, PRIORITY_LABEL, PRIORITY_STYLE, METER_COLOR } from "./roadmapConstants.js";

function deployBadge(item, deployStatus) {
  if (!item.version || !deployStatus) return null;
  const ver = deployStatus.versions?.find(v => v.version === item.version);
  if (!ver) return null;
  const prodCommit  = deployStatus.current?.short;
  const onProd = prodCommit && ver.short && prodCommit === ver.short;
  return { commit: ver.short, onProd };
}

export default function RoadmapItemRow({ item, deployStatus, onStatusCycle, onEdit, onDelete }) {
  const [hovering, setHovering] = useState(false);

  return (
    <div style={s.card}>
      <div style={s.cardBody}>
        <div style={s.cardRow}>
          <div
            style={{
              ...s.statusDot(item.status),
              boxShadow: hovering ? `0 0 0 3px ${STATUS_COLOR[item.status]}33` : "none",
            }}
            title={`Status: ${STATUS_LABEL[item.status]} — klik om te wisselen`}
            onClick={() => onStatusCycle(item)}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                #{item.id}
              </span>
              <span style={s.title}>{item.title}</span>
              <span style={s.badge(PRIORITY_STYLE[item.priority] || {})}>
                {PRIORITY_LABEL[item.priority] || item.priority}
              </span>
              <span style={s.badge({ background: "var(--color-surface-2)", color: "var(--color-text-muted)" })}>
                {item.site}
              </span>
              <span style={{ fontSize: "11px", color: STATUS_COLOR[item.status], fontWeight: 500 }}>
                {STATUS_LABEL[item.status]}
              </span>
              {item.impact && (
                <span style={s.badge({ background: METER_COLOR[item.impact] + "22", color: METER_COLOR[item.impact] })}>
                  ↑ {item.impact}
                </span>
              )}
              {item.risk && (
                <span style={s.badge({ background: METER_COLOR[item.risk] + "22", color: METER_COLOR[item.risk] })}>
                  ⚠ {item.risk}
                </span>
              )}
              {item.scope && (
                <span style={s.badge({ background: "var(--color-surface-2)", color: "var(--color-text-muted)" })}>
                  {item.scope}
                </span>
              )}
              {item.version && (
                <span style={s.badge({ background: "var(--color-success-light)", color: "var(--color-success)", fontFamily: "var(--font-mono)" })}>
                  {item.version}
                </span>
              )}
              {(() => {
                const db = deployBadge(item, deployStatus);
                if (!db) return null;
                return (
                  <span title={`commit ${db.commit}`} style={s.badge({ background: db.onProd ? "#22c55e22" : "#3b82f622", color: db.onProd ? "#22c55e" : "#3b82f6", fontFamily: "var(--font-mono)" })}>
                    {db.onProd ? "✓ prod" : "✓ acc"} {db.commit}
                  </span>
                );
              })()}
            </div>
            {item.description && (
              <div style={s.desc}>{item.description}</div>
            )}
            {item.images && (() => {
              try {
                const imgs = JSON.parse(item.images);
                if (!imgs.length) return null;
                return (
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "5px" }}>
                    {imgs.map((url, i) => (
                      <img key={i} src={url} alt="" onClick={e => { e.stopPropagation(); window.open(url, "_blank"); }}
                        style={{ width: 56, height: 42, objectFit: "cover", borderRadius: "4px",
                          border: "1px solid var(--color-border)", cursor: "pointer" }} />
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
          <div style={s.actions}>
            <button style={s.iconBtn} onClick={() => onEdit(item)} title="Bewerken">✎</button>
            <button style={s.dangerBtn} onClick={() => onDelete(item)} title="Verwijderen">✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
