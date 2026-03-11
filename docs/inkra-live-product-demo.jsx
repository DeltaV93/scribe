import { useState, useEffect } from "react";

const workflows = [
  { said: `"We need to update the reentry policy based on what the state sent over"`, speaker: "Director Martinez", done: "Notion doc updated", detail: "Reentry Policy v3.2 — revised §4, team notified", type: "doc", time: "2:04 PM" },
  { said: `"James secured stable housing as of March 1st, let's update his file"`, speaker: "Case Manager Obi", done: "Case note written", detail: "James Walker — housing status: stable", type: "note", time: "2:06 PM" },
  { said: `"That onboarding bug is a P1, let's get it into the sprint"`, speaker: "PM Sarah", done: "Linear ticket created", detail: "PX-912 · P1 · Sprint 14 · Assigned: Dev Team", type: "ticket", time: "2:09 PM" },
  { said: `"Patient reports fifteen degrees improvement in right shoulder mobility"`, speaker: "Dr. Okafor", done: "SOAP note + billing codes", detail: "97110, 97140 flagged — note generated", type: "medical", time: "2:13 PM" },
  { said: `"Can you send me the updated intake form with what we just discussed?"`, speaker: "Intake Coord.", done: "Form auto-filled", detail: "Intake form pre-populated from call data", type: "form", time: "2:15 PM" },
  { said: `"Let's reconvene Thursday at two to review the grant numbers"`, speaker: "Director Martinez", done: "Calendar invite sent", detail: "Thu 2:00 PM — Grant Review — 4 attendees", type: "calendar", time: "2:18 PM" },
];

const typeIcons = {
  doc: "📄", note: "📝", ticket: "🎯", medical: "🏥", form: "📋", calendar: "📅",
};

const typeColors = {
  doc: "#1B2A4A", note: "#3F6F5A", ticket: "#B26A00", medical: "#B34747", form: "#1B2A4A", calendar: "#3F6F5A",
};

export default function InkraProductDemo() {
  const [activeStep, setActiveStep] = useState(-1);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), 800);
    return () => clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      setActiveStep(prev => {
        if (prev >= workflows.length - 1) return -1;
        return prev + 1;
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [started]);

  const completedCount = activeStep + 1;
  const isListening = activeStep >= 0 && activeStep < workflows.length;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: "#FAFAF8", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Newsreader:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(179,71,71,0.3); }
          50% { box-shadow: 0 0 0 4px rgba(179,71,71,0.08); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes typingDots {
          0%, 60%, 100% { opacity: 0.2; }
          30% { opacity: 1; }
        }
        .wf-item-enter {
          animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .conv-item-enter {
          animation: slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .fade-enter {
          animation: fadeIn 0.3s ease forwards;
        }
        .typing-dot {
          display: inline-block;
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #6B6B6B;
          margin: 0 2px;
        }
        .typing-dot:nth-child(1) { animation: typingDots 1.2s 0s infinite; }
        .typing-dot:nth-child(2) { animation: typingDots 1.2s 0.2s infinite; }
        .typing-dot:nth-child(3) { animation: typingDots 1.2s 0.4s infinite; }
      `}</style>

      {/* Page nav */}
      <nav style={{
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(218,218,215,0.5)",
        background: "rgba(250,250,248,0.9)",
        backdropFilter: "blur(16px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.04em" }}>Inkra</span>
        <div style={{
          fontSize: 14, fontWeight: 600, padding: "10px 20px",
          background: "#1B2A4A", color: "#fff", borderRadius: 8, cursor: "pointer",
        }}>Join the Pilot</div>
      </nav>

      {/* Section */}
      <section style={{ padding: "80px 32px 100px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#6B6B6B", marginBottom: 16,
          }}>How it works</div>
          <h2 style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: "clamp(32px, 3.5vw, 44px)",
            fontWeight: 400, lineHeight: 1.15, color: "#111",
            marginBottom: 12,
          }}>
            Your words become <em style={{ color: "#1B2A4A", fontStyle: "italic" }}>completed work.</em>
          </h2>
          <p style={{ fontSize: 16, color: "#6B6B6B", marginBottom: 48, maxWidth: 480, lineHeight: 1.6 }}>
            Watch a live session. Left side: the conversation. Right side: what Inkra completes automatically.
          </p>

          {/* ═══ APP MOCKUP ═══ */}
          <div style={{
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid #E8E8E5",
            boxShadow: "0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            background: "#fff",
          }}>
            {/* Browser chrome */}
            <div style={{
              padding: "10px 16px",
              background: "#F5F4F0",
              borderBottom: "1px solid #E8E8E5",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DADAD7" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DADAD7" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DADAD7" }} />
              </div>
              <div style={{
                flex: 1, background: "#fff", borderRadius: 6,
                padding: "5px 14px", fontSize: 12, color: "#A1A1A1",
                textAlign: "center", border: "1px solid #E8E8E5",
              }}>
                app.inkra.io/sessions/live
              </div>
            </div>

            {/* App layout */}
            <div style={{ display: "flex", minHeight: 520 }}>
              {/* Sidebar */}
              <div style={{
                width: 220,
                background: "#FAFAF8",
                borderRight: "1px solid #E8E8E5",
                padding: "20px 0",
                flexShrink: 0,
              }}>
                {/* Sidebar brand */}
                <div style={{
                  padding: "0 18px 18px",
                  borderBottom: "1px solid #E8E8E5",
                  marginBottom: 12,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <svg viewBox="0 0 280 60" width="32" height="8">
                    <path d="M 12,32 C 18,32 24,31 32,29 C 40,27 46,24 52,20 C 56,17 58,15 62,13 C 66,11 70,12 74,17 C 78,22 80,30 84,36 C 88,42 90,45 94,46 C 98,47 100,42 104,35 C 108,28 110,19 114,13 C 118,7 122,6 126,11 C 130,16 132,26 136,34 C 140,42 142,47 146,48 C 150,49 152,44 156,37 C 160,30 162,22 166,17 C 170,12 174,12 178,16 C 182,20 184,28 188,34 C 192,40 196,43 202,43 C 208,43 214,42 222,41 C 232,40 244,40 260,40" fill="none" stroke="#1B2A4A" strokeWidth="3.5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.03em", color: "#111" }}>Inkra</span>
                </div>

                {/* Nav items */}
                {[
                  { icon: "🏠", label: "Dashboard", active: false },
                  { icon: "🎙", label: "Sessions", active: true },
                  { icon: "📋", label: "Workflows", active: false },
                  { icon: "👥", label: "Clients", active: false },
                  { icon: "📊", label: "Reports", active: false },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: item.active ? 600 : 400,
                    color: item.active ? "#1B2A4A" : "#6B6B6B",
                    background: item.active ? "rgba(27,42,74,0.06)" : "transparent",
                    borderRight: item.active ? "2px solid #1B2A4A" : "2px solid transparent",
                    cursor: "pointer",
                  }}>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    {item.label}
                  </div>
                ))}

                {/* Recent sessions */}
                <div style={{
                  marginTop: 24, padding: "14px 18px 0",
                  borderTop: "1px solid #E8E8E5",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                    textTransform: "uppercase", color: "#A1A1A1", marginBottom: 10,
                  }}>Recent Sessions</div>
                  {[
                    { name: "Team Standup", time: "Yesterday" },
                    { name: "Client Intake — Walker", time: "Mar 7" },
                    { name: "Grant Review Q1", time: "Mar 5" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      padding: "7px 0",
                      fontSize: 12, color: "#6B6B6B",
                      borderBottom: i < 2 ? "1px solid #F0F0ED" : "none",
                    }}>
                      <div style={{ fontWeight: 500, color: "#3A3A3A", marginBottom: 1 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#A1A1A1" }}>{s.time}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main content */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Top bar */}
                <div style={{
                  padding: "14px 24px",
                  borderBottom: "1px solid #E8E8E5",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      {isListening && (
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "#B34747",
                          animation: "pulseGlow 2s ease infinite",
                        }} />
                      )}
                      {!isListening && activeStep === -1 && (
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "#A1A1A1",
                        }} />
                      )}
                      <span style={{
                        fontSize: 14, fontWeight: 700, color: "#111",
                      }}>
                        Reentry Program — Weekly Sync
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      color: isListening ? "#B34747" : "#A1A1A1",
                      padding: "3px 8px",
                      background: isListening ? "rgba(179,71,71,0.06)" : "#F5F4F0",
                      borderRadius: 4,
                    }}>
                      {isListening ? "● Recording" : "Waiting..."}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#A1A1A1" }}>Workflows completed</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: "#1B2A4A",
                        background: "rgba(27,42,74,0.06)",
                        padding: "2px 8px", borderRadius: 4,
                        minWidth: 24, textAlign: "center",
                        transition: "all 0.3s ease",
                      }}>{Math.max(0, completedCount)}</span>
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: "#F5F4F0", display: "grid", placeItems: "center",
                      fontSize: 12, cursor: "pointer",
                    }}>⚙️</div>
                  </div>
                </div>

                {/* Split view */}
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {/* Left: Conversation */}
                  <div style={{
                    borderRight: "1px solid #E8E8E5",
                    padding: "20px",
                    overflowY: "auto",
                    background: "#FAFAF8",
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: "#A1A1A1", marginBottom: 16,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span>🎙</span> Live Transcript
                    </div>

                    {workflows.map((wf, i) => {
                      const visible = i <= activeStep;
                      const isCurrent = i === activeStep;
                      if (!visible) return null;
                      return (
                        <div key={i} className="conv-item-enter" style={{
                          marginBottom: 16,
                          padding: "14px 16px",
                          background: isCurrent ? "rgba(27,42,74,0.04)" : "#fff",
                          border: `1px solid ${isCurrent ? "rgba(27,42,74,0.1)" : "#E8E8E5"}`,
                          borderRadius: 10,
                          transition: "background 0.3s ease, border-color 0.3s ease",
                        }}>
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            marginBottom: 6,
                          }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: "#1B2A4A",
                            }}>{wf.speaker}</span>
                            <span style={{ fontSize: 10, color: "#A1A1A1" }}>{wf.time}</span>
                          </div>
                          <div style={{
                            fontFamily: "'Newsreader', Georgia, serif",
                            fontStyle: "italic",
                            fontSize: 14, color: "#3A3A3A",
                            lineHeight: 1.55,
                          }}>{wf.said}</div>
                        </div>
                      );
                    })}

                    {/* Typing indicator */}
                    {isListening && (
                      <div className="fade-enter" style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 16px",
                        color: "#A1A1A1", fontSize: 12,
                      }}>
                        <div>
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                        <span>listening</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Completed workflows */}
                  <div style={{
                    padding: "20px",
                    overflowY: "auto",
                    background: "#fff",
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: "#A1A1A1", marginBottom: 16,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span>✅</span> Completed Workflows
                    </div>

                    {workflows.map((wf, i) => {
                      const visible = i <= activeStep;
                      if (!visible) return null;
                      return (
                        <div key={i} className="wf-item-enter" style={{
                          marginBottom: 12,
                          padding: "14px 16px",
                          background: "#FAFAF8",
                          border: "1px solid #E8E8E5",
                          borderRadius: 10,
                          animationDelay: "0.5s",
                          animationFillMode: "backwards",
                        }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            marginBottom: 6,
                          }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 7,
                              background: `${typeColors[wf.type]}10`,
                              display: "grid", placeItems: "center",
                              fontSize: 14,
                            }}>
                              {typeIcons[wf.type]}
                            </div>
                            <div>
                              <div style={{
                                fontSize: 13, fontWeight: 700, color: "#111",
                              }}>{wf.done}</div>
                            </div>
                            <div style={{
                              marginLeft: "auto",
                              fontSize: 10, fontWeight: 600,
                              color: "#3F6F5A",
                              background: "rgba(63,111,90,0.08)",
                              padding: "3px 8px",
                              borderRadius: 4,
                            }}>Done</div>
                          </div>
                          <div style={{
                            fontSize: 12, color: "#6B6B6B",
                            lineHeight: 1.4,
                            marginLeft: 38,
                          }}>{wf.detail}</div>
                        </div>
                      );
                    })}

                    {completedCount === 0 && (
                      <div style={{
                        textAlign: "center", padding: "60px 20px",
                        color: "#A1A1A1", fontSize: 13,
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>⏳</div>
                        Waiting for conversation...
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom status bar */}
                <div style={{
                  padding: "10px 24px",
                  borderTop: "1px solid #E8E8E5",
                  background: "#FAFAF8",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 11, color: "#A1A1A1" }}>
                      {isListening ? `${completedCount} of ${workflows.length} workflows detected` : "Session idle"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3F6F5A" }} />
                      <span style={{ fontSize: 10, color: "#6B6B6B" }}>HIPAA</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3F6F5A" }} />
                      <span style={{ fontSize: 10, color: "#6B6B6B" }}>Encrypted</span>
                    </div>
                    <span style={{ fontSize: 10, color: "#A1A1A1" }}>Inkra v1.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Continuation */}
      <div style={{
        padding: "48px 32px", textAlign: "center",
        borderTop: "1px solid #E8E8E5", background: "#F5F4F0",
      }}>
        <p style={{ fontSize: 13, color: "#A1A1A1", fontWeight: 500 }}>
          ↓ Problem Stats → Testimonial → Industry Stories → Engines → CTA ↓
        </p>
      </div>
    </div>
  );
}
