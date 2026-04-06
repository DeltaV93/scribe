"use client";

import { useState, useEffect } from "react";

const workflows = [
  {
    said: `"We need to update the reentry policy based on what the state sent over"`,
    speaker: "Director Martinez",
    done: "Notion doc updated",
    detail: "Reentry Policy v3.2 — revised §4, team notified",
    type: "doc" as const,
    time: "2:04 PM",
  },
  {
    said: `"James secured stable housing as of March 1st, let's update his file"`,
    speaker: "Case Manager Obi",
    done: "Case note written",
    detail: "James Walker — housing status: stable",
    type: "note" as const,
    time: "2:06 PM",
  },
  {
    said: `"That onboarding bug is a P1, let's get it into the sprint"`,
    speaker: "PM Sarah",
    done: "Linear ticket created",
    detail: "PX-912 · P1 · Sprint 14 · Assigned: Dev Team",
    type: "ticket" as const,
    time: "2:09 PM",
  },
  {
    said: `"Patient reports fifteen degrees improvement in right shoulder mobility"`,
    speaker: "Dr. Okafor",
    done: "SOAP note + billing codes",
    detail: "97110, 97140 flagged — note generated",
    type: "medical" as const,
    time: "2:13 PM",
  },
  {
    said: `"Can you send me the updated intake form with what we just discussed?"`,
    speaker: "Intake Coord.",
    done: "Form auto-filled",
    detail: "Intake form pre-populated from call data",
    type: "form" as const,
    time: "2:15 PM",
  },
  {
    said: `"Let's reconvene Thursday at two to review the grant numbers"`,
    speaker: "Director Martinez",
    done: "Calendar invite sent",
    detail: "Thu 2:00 PM — Grant Review — 4 attendees",
    type: "calendar" as const,
    time: "2:18 PM",
  },
];

type WorkflowType = "doc" | "note" | "ticket" | "medical" | "form" | "calendar";

const typeIcons: Record<WorkflowType, string> = {
  doc: "📄",
  note: "📝",
  ticket: "🎯",
  medical: "🏥",
  form: "📋",
  calendar: "📅",
};

const typeColors: Record<WorkflowType, string> = {
  doc: "var(--ink-blue)",
  note: "var(--ink-green)",
  ticket: "var(--ink-amber)",
  medical: "var(--ink-red)",
  form: "var(--ink-blue)",
  calendar: "var(--ink-green)",
};

export function ProductDemo() {
  const [activeStep, setActiveStep] = useState(-1);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), 800);
    return () => clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= workflows.length - 1) return -1;
        return prev + 1;
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [started]);

  const completedCount = activeStep + 1;
  const isListening = activeStep >= 0 && activeStep < workflows.length;

  return (
    <>
      <style jsx>{`
        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(179, 71, 71, 0.3);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(179, 71, 71, 0.08);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes typingDots {
          0%,
          60%,
          100% {
            opacity: 0.2;
          }
          30% {
            opacity: 1;
          }
        }

        .demo-container {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--border-light);
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.06),
            0 1px 3px rgba(0, 0, 0, 0.04);
          background: var(--paper);
        }

        .browser-chrome {
          padding: 10px 16px;
          background: var(--paper-warm);
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .browser-dots {
          display: flex;
          gap: 6px;
        }

        .browser-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--border);
        }

        .browser-url {
          flex: 1;
          background: var(--paper);
          border-radius: 6px;
          padding: 5px 14px;
          font-size: 12px;
          color: var(--ink-faint);
          text-align: center;
          border: 1px solid var(--border-light);
        }

        .app-layout {
          display: flex;
          min-height: 520px;
        }

        .app-sidebar {
          width: 220px;
          background: var(--paper-warm);
          border-right: 1px solid var(--border-light);
          padding: 20px 0;
          flex-shrink: 0;
        }

        .sidebar-brand {
          padding: 0 18px 18px;
          border-bottom: 1px solid var(--border-light);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sidebar-brand-name {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--ink);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 18px;
          font-size: 13px;
          cursor: pointer;
          border-right: 2px solid transparent;
          color: var(--ink-muted);
        }

        .nav-item.active {
          font-weight: 600;
          color: var(--ink-blue);
          background: var(--ink-blue-wash);
          border-right-color: var(--ink-blue);
        }

        .nav-item-icon {
          font-size: 14px;
        }

        .recent-sessions {
          margin-top: 24px;
          padding: 14px 18px 0;
          border-top: 1px solid var(--border-light);
        }

        .recent-sessions-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 10px;
        }

        .recent-session {
          padding: 7px 0;
          font-size: 12px;
          color: var(--ink-muted);
          border-bottom: 1px solid var(--paper-dim);
        }

        .recent-session:last-child {
          border-bottom: none;
        }

        .recent-session-name {
          font-weight: 500;
          color: var(--ink-soft);
          margin-bottom: 1px;
        }

        .recent-session-time {
          font-size: 11px;
          color: var(--ink-faint);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .top-bar {
          padding: 14px 24px;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--paper);
        }

        .session-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .session-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.recording {
          background: var(--ink-red);
          animation: pulseGlow 2s ease infinite;
        }

        .status-dot.idle {
          background: var(--ink-faint);
        }

        .session-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink);
        }

        .status-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .status-badge.recording {
          color: var(--ink-red);
          background: rgba(179, 71, 71, 0.06);
        }

        .status-badge.waiting {
          color: var(--ink-faint);
          background: var(--paper-warm);
        }

        .top-bar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .workflows-counter {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .workflows-label {
          font-size: 11px;
          color: var(--ink-faint);
        }

        .workflows-count {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-blue);
          background: var(--ink-blue-wash);
          padding: 2px 8px;
          border-radius: 4px;
          min-width: 24px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .settings-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--paper-warm);
          display: grid;
          place-items: center;
          font-size: 12px;
          cursor: pointer;
        }

        .split-view {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .panel-left {
          border-right: 1px solid var(--border-light);
          padding: 20px;
          overflow-y: auto;
          background: var(--paper-warm);
        }

        .panel-right {
          padding: 20px;
          overflow-y: auto;
          background: var(--paper);
        }

        .panel-header {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .conv-item {
          margin-bottom: 16px;
          padding: 14px 16px;
          background: var(--paper);
          border: 1px solid var(--border-light);
          border-radius: 10px;
          animation: slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .conv-item.current {
          background: var(--ink-blue-ghost);
          border-color: var(--ink-blue-wash);
        }

        .conv-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .conv-item-speaker {
          font-size: 11px;
          font-weight: 600;
          color: var(--ink-blue);
        }

        .conv-item-time {
          font-size: 10px;
          color: var(--ink-faint);
        }

        .conv-item-text {
          font-family: var(--serif);
          font-style: italic;
          font-size: 14px;
          color: var(--ink-soft);
          line-height: 1.55;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          color: var(--ink-faint);
          font-size: 12px;
          animation: fadeIn 0.3s ease forwards;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--ink-muted);
        }

        .typing-dot:nth-child(1) {
          animation: typingDots 1.2s 0s infinite;
        }
        .typing-dot:nth-child(2) {
          animation: typingDots 1.2s 0.2s infinite;
        }
        .typing-dot:nth-child(3) {
          animation: typingDots 1.2s 0.4s infinite;
        }

        .wf-item {
          margin-bottom: 12px;
          padding: 14px 16px;
          background: var(--paper-warm);
          border: 1px solid var(--border-light);
          border-radius: 10px;
          animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.5s;
          animation-fill-mode: backwards;
        }

        .wf-item-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .wf-item-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          font-size: 14px;
        }

        .wf-item-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
        }

        .wf-item-badge {
          margin-left: auto;
          font-size: 10px;
          font-weight: 600;
          color: var(--ink-green);
          background: rgba(63, 111, 90, 0.08);
          padding: 3px 8px;
          border-radius: 4px;
        }

        .wf-item-detail {
          font-size: 12px;
          color: var(--ink-muted);
          line-height: 1.4;
          margin-left: 38px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--ink-faint);
          font-size: 13px;
        }

        .empty-state-icon {
          font-size: 28px;
          margin-bottom: 8px;
          opacity: 0.4;
        }

        .bottom-bar {
          padding: 10px 24px;
          border-top: 1px solid var(--border-light);
          background: var(--paper-warm);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bottom-bar-left {
          font-size: 11px;
          color: var(--ink-faint);
        }

        .bottom-bar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .compliance-badge {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .compliance-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--ink-green);
        }

        .compliance-text {
          font-size: 10px;
          color: var(--ink-muted);
        }

        .version-text {
          font-size: 10px;
          color: var(--ink-faint);
        }

        /* Mobile responsive */
        @media (max-width: 900px) {
          .app-sidebar {
            display: none;
          }

          .split-view {
            grid-template-columns: 1fr;
          }

          .panel-left {
            border-right: none;
            border-bottom: 1px solid var(--border-light);
            max-height: 260px;
          }
        }

        @media (max-width: 520px) {
          .top-bar {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .top-bar-right {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>

      <div className="demo-container">
        {/* Browser chrome */}
        <div className="browser-chrome">
          <div className="browser-dots">
            <div className="browser-dot" />
            <div className="browser-dot" />
            <div className="browser-dot" />
          </div>
          <div className="browser-url">app.inkra.io/sessions/live</div>
        </div>

        {/* App layout */}
        <div className="app-layout">
          {/* Sidebar */}
          <div className="app-sidebar">
            <div className="sidebar-brand">
              <svg viewBox="0 0 280 60" width="32" height="8">
                <path
                  d="M 12,32 C 18,32 24,31 32,29 C 40,27 46,24 52,20 C 56,17 58,15 62,13 C 66,11 70,12 74,17 C 78,22 80,30 84,36 C 88,42 90,45 94,46 C 98,47 100,42 104,35 C 108,28 110,19 114,13 C 118,7 122,6 126,11 C 130,16 132,26 136,34 C 140,42 142,47 146,48 C 150,49 152,44 156,37 C 160,30 162,22 166,17 C 170,12 174,12 178,16 C 182,20 184,28 188,34 C 192,40 196,43 202,43 C 208,43 214,42 222,41 C 232,40 244,40 260,40"
                  fill="none"
                  stroke="var(--ink-blue)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="sidebar-brand-name">Inkra</span>
            </div>

            {[
              { icon: "🏠", label: "Dashboard", active: false },
              { icon: "🎙", label: "Sessions", active: true },
              { icon: "📋", label: "Workflows", active: false },
              { icon: "👥", label: "Clients", active: false },
              { icon: "📊", label: "Reports", active: false },
            ].map((item, i) => (
              <div
                key={i}
                className={`nav-item ${item.active ? "active" : ""}`}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}

            <div className="recent-sessions">
              <div className="recent-sessions-label">Recent Sessions</div>
              {[
                { name: "Team Standup", time: "Yesterday" },
                { name: "Client Intake — Walker", time: "Mar 7" },
                { name: "Grant Review Q1", time: "Mar 5" },
              ].map((s, i) => (
                <div key={i} className="recent-session">
                  <div className="recent-session-name">{s.name}</div>
                  <div className="recent-session-time">{s.time}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="main-content">
            {/* Top bar */}
            <div className="top-bar">
              <div className="session-info">
                <div className="session-status">
                  <div
                    className={`status-dot ${isListening ? "recording" : "idle"}`}
                  />
                  <span className="session-title">
                    Reentry Program — Weekly Sync
                  </span>
                </div>
                <span
                  className={`status-badge ${isListening ? "recording" : "waiting"}`}
                >
                  {isListening ? "● Recording" : "Waiting..."}
                </span>
              </div>

              <div className="top-bar-right">
                <div className="workflows-counter">
                  <span className="workflows-label">Workflows completed</span>
                  <span className="workflows-count">
                    {Math.max(0, completedCount)}
                  </span>
                </div>
                <div className="settings-btn">⚙️</div>
              </div>
            </div>

            {/* Split view */}
            <div className="split-view">
              {/* Left: Conversation */}
              <div className="panel-left">
                <div className="panel-header">
                  <span>🎙</span> Live Transcript
                </div>

                {workflows.map((wf, i) => {
                  const visible = i <= activeStep;
                  const isCurrent = i === activeStep;
                  if (!visible) return null;
                  return (
                    <div
                      key={i}
                      className={`conv-item ${isCurrent ? "current" : ""}`}
                    >
                      <div className="conv-item-header">
                        <span className="conv-item-speaker">{wf.speaker}</span>
                        <span className="conv-item-time">{wf.time}</span>
                      </div>
                      <div className="conv-item-text">{wf.said}</div>
                    </div>
                  );
                })}

                {isListening && (
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                    <span>listening</span>
                  </div>
                )}
              </div>

              {/* Right: Completed workflows */}
              <div className="panel-right">
                <div className="panel-header">
                  <span>✅</span> Completed Workflows
                </div>

                {workflows.map((wf, i) => {
                  const visible = i <= activeStep;
                  if (!visible) return null;
                  return (
                    <div key={i} className="wf-item">
                      <div className="wf-item-header">
                        <div
                          className="wf-item-icon"
                          style={{
                            background: `color-mix(in srgb, ${typeColors[wf.type]} 10%, transparent)`,
                          }}
                        >
                          {typeIcons[wf.type]}
                        </div>
                        <div className="wf-item-title">{wf.done}</div>
                        <div className="wf-item-badge">Done</div>
                      </div>
                      <div className="wf-item-detail">{wf.detail}</div>
                    </div>
                  );
                })}

                {completedCount === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">⏳</div>
                    Waiting for conversation...
                  </div>
                )}
              </div>
            </div>

            {/* Bottom status bar */}
            <div className="bottom-bar">
              <div className="bottom-bar-left">
                {isListening
                  ? `${completedCount} of ${workflows.length} workflows detected`
                  : "Session idle"}
              </div>
              <div className="bottom-bar-right">
                <div className="compliance-badge">
                  <div className="compliance-dot" />
                  <span className="compliance-text">HIPAA</span>
                </div>
                <div className="compliance-badge">
                  <div className="compliance-dot" />
                  <span className="compliance-text">Encrypted</span>
                </div>
                <span className="version-text">Inkra v1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
