"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

// ============================================
// Brand Colors (aligned with Inkra design system)
// ============================================
const B = {
  paper: "#FAFAF8",
  paperWarm: "#F5F4F0",
  paperDim: "#EEEDEA",
  ink: "#111111",
  inkSoft: "#3A3A3A",
  inkMuted: "#6B6B6B",
  inkFaint: "#A1A1A1",
  inkBlue: "#1B2A4A",
  inkBlueMid: "#2F3A59",
  blueCta: "#2B4C8C",
  inkGreen: "#3F6F5A",
  inkGreenWash: "rgba(63,111,90,0.08)",
  border: "#DADAD7",
  borderLight: "#E8E8E5",
  coral: "#E8634A",
};

const sans = "'Inter', var(--font-inter), sans-serif";
const serif = "'Newsreader', Georgia, serif";

// ============================================
// SVG Components
// ============================================
const ScribMark = ({
  color = B.inkBlue,
  width = 140,
  opacity = 0.9,
}: {
  color?: string;
  width?: number;
  opacity?: number;
}) => (
  <svg
    viewBox="0 0 280 60"
    width={width}
    height={(width * 60) / 280}
    style={{ display: "block", opacity }}
  >
    <path
      d="M 12,32 C 18,32 24,31 32,29 C 40,27 46,24 52,20 C 56,17 58,15 62,13 C 66,11 70,12 74,17 C 78,22 80,30 84,36 C 88,42 90,45 94,46 C 98,47 100,42 104,35 C 108,28 110,19 114,13 C 118,7 122,6 126,11 C 130,16 132,26 136,34 C 140,42 142,47 146,48 C 150,49 152,44 156,37 C 160,30 162,22 166,17 C 170,12 174,12 178,16 C 182,20 184,28 188,34 C 192,40 196,43 202,43 C 208,43 214,42 222,41 C 232,40 244,40 260,40"
      fill="none"
      stroke={color}
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

const Check = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    style={{ flexShrink: 0 }}
  >
    <circle cx="10" cy="10" r="10" fill={B.inkGreen} />
    <path
      d="M6 10.5L8.5 13L14 7.5"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ============================================
// Form Data
// ============================================
const roles = [
  "Sales",
  "Account Management",
  "Case Manager",
  "Social Worker",
  "Program Director",
  "Executive Director",
  "CEO",
  "Engineering",
  "Product Manager",
  "UX Researcher",
  "IT",
  "Operations",
  "Clinician",
  "Therapist",
  "Doctor",
  "Customer Support Lead",
  "Other",
];
const teamSizes = ["1-5", "6-15", "16-50", "51-100", "100+"];
const industries = [
  "Sales",
  "Tech",
  "Nonprofit",
  "Human Services",
  "Behavioral Health",
  "Healthcare",
  "Medical",
  "UX Research",
  "Design",
  "Product",
  "Engineering",
  "Customer Support",
  "Legal",
  "Real Estate",
  "Education",
  "Financial Services",
  "Government",
  "Multi-Location Retail",
  "Operations",
  "Other",
];

// ============================================
// Styles
// ============================================
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 14,
  fontFamily: sans,
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.07)",
  color: "white",
  outline: "none",
  transition: "border-color 0.2s",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%23A1A1A1' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: sans,
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 4,
};

// ============================================
// Components
// ============================================
const ValueRow = ({
  label,
  value,
  desc,
}: {
  label: string;
  value: string;
  desc: string;
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      padding: "16px 0",
      borderBottom: `1px solid ${B.borderLight}`,
    }}
  >
    <div style={{ flex: 1, marginRight: 16 }}>
      <div
        style={{
          fontFamily: sans,
          fontSize: 14,
          fontWeight: 600,
          color: B.ink,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: sans,
          fontSize: 12,
          color: B.inkMuted,
          lineHeight: 1.5,
        }}
      >
        {desc}
      </div>
    </div>
    <div
      style={{
        fontFamily: serif,
        fontSize: 18,
        fontWeight: 600,
        color: B.inkGreen,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {value}
    </div>
  </div>
);

// Form state type
type FormStatus = "idle" | "submitting" | "success" | "error" | "duplicate";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  teamSize: string;
  industry: string;
}

// Inner component that uses useSearchParams
function DemoPageContent() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    organization: "",
    role: "",
    teamSize: "",
    industry: "",
  });
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [ref, setRef] = useState("direct");

  useEffect(() => {
    const refParam = searchParams.get("ref");
    if (refParam) setRef(refParam);
  }, [searchParams]);

  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status === "submitting") return;

    if (!form.firstName || !form.email || !form.organization) {
      setErrorMessage("Please fill out all required fields.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.oninkra.com";
      const response = await fetch(`${appUrl}/api/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          referralSource: ref,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.duplicate) {
          setStatus("duplicate");
        } else {
          setStatus("success");
        }
      } else {
        setErrorMessage(result.error?.message || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  const isSubmitted = status === "success" || status === "duplicate";

  return (
    <div style={{ background: B.paper, minHeight: "100vh", fontFamily: serif }}>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap");
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        input::placeholder,
        select {
          color: rgba(255, 255, 255, 0.35);
        }
        option {
          color: #111;
          background: white;
        }
        ::selection {
          background: ${B.blueCta};
          color: white;
        }
        @media (max-width: 680px) {
          .hero-grid {
            flex-direction: column !important;
          }
          .hero-left,
          .hero-right {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════
           HERO - Headline left, Form right
         ═══════════════════════════════════════════ */}
      <div
        style={{
          background: B.inkBlue,
          padding: "40px 24px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 10, right: -40, opacity: 0.05 }}>
          <ScribMark color="#FFF" width={500} />
        </div>
        <div
          className="hero-grid"
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "flex",
            gap: 40,
            alignItems: "flex-start",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* LEFT - Headline + value prop */}
          <div className="hero-left" style={{ flex: "1 1 50%", maxWidth: 440 }}>
            <div style={{ marginBottom: 10 }}>
              <Image
                src="/inkra-logo.svg"
                alt="Inkra"
                width={68}
                height={20}
                style={{ opacity: 0.5, filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h1
              style={{
                fontFamily: sans,
                fontWeight: 800,
                fontSize: 24,
                color: "white",
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              Inkra
            </h1>
            <p
              style={{
                fontSize: 13,
                color: B.inkFaint,
                fontStyle: "italic",
                marginBottom: 28,
              }}
            >
              Where your words work.
            </p>

            <p
              style={{
                fontFamily: sans,
                fontSize: 12,
                fontWeight: 600,
                color: B.coral,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              What if you could...
            </p>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 400,
                lineHeight: 1.25,
                color: "white",
                marginBottom: 16,
              }}
            >
              Get 16 hours back
              <br />
              every week — and never
              <br />
              <span style={{ color: B.paperDim }}>miss a data point again?</span>
            </h2>
            <p
              style={{
                fontFamily: sans,
                fontSize: 13,
                lineHeight: 1.7,
                color: "#A1A1A1",
                marginBottom: 20,
              }}
            >
              One conversation becomes completed case notes, forms, follow-ups, grant
              reports, and compliance filings — automatically.
            </p>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {["HIPAA-ready", "AES-256 encrypted", "SOC 2 in progress"].map((t, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: sans,
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 4,
                    padding: "4px 10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT - Form */}
          <div
            className="hero-right"
            style={{
              flex: "1 1 50%",
              maxWidth: 420,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "28px 24px",
            }}
          >
            {!isSubmitted ? (
              <>
                <p
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: B.coral,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 4,
                  }}
                >
                  Limited spots
                </p>
                <h3
                  style={{
                    fontFamily: sans,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "white",
                    marginBottom: 4,
                  }}
                >
                  Apply for the Spring 2026 Pilot
                </h3>
                <p
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 20,
                    lineHeight: 1.5,
                  }}
                >
                  Free access · Free onboarding · Shape the platform
                </p>

                <form
                  onSubmit={handleSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Row: First + Last name */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>First name</label>
                      <input
                        type="text"
                        placeholder="First name"
                        required
                        value={form.firstName}
                        onChange={set("firstName")}
                        disabled={status === "submitting"}
                        style={inputStyle}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "rgba(255,255,255,0.35)")
                        }
                        onBlur={(e) =>
                          (e.target.style.borderColor = "rgba(255,255,255,0.15)")
                        }
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Last name</label>
                      <input
                        type="text"
                        placeholder="Last name"
                        required
                        value={form.lastName}
                        onChange={set("lastName")}
                        disabled={status === "submitting"}
                        style={inputStyle}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "rgba(255,255,255,0.35)")
                        }
                        onBlur={(e) =>
                          (e.target.style.borderColor = "rgba(255,255,255,0.15)")
                        }
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label style={labelStyle}>Work email</label>
                    <input
                      type="email"
                      placeholder="you@yourorg.com"
                      required
                      value={form.email}
                      onChange={set("email")}
                      disabled={status === "submitting"}
                      style={inputStyle}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.35)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.15)")
                      }
                    />
                  </div>

                  {/* Organization */}
                  <div>
                    <label style={labelStyle}>Organization</label>
                    <input
                      type="text"
                      placeholder="Organization name"
                      required
                      value={form.organization}
                      onChange={set("organization")}
                      disabled={status === "submitting"}
                      style={inputStyle}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.35)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.15)")
                      }
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label style={labelStyle}>Your role</label>
                    <select
                      value={form.role}
                      onChange={set("role")}
                      required
                      disabled={status === "submitting"}
                      style={{
                        ...selectStyle,
                        color: form.role ? "white" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      <option value="" disabled>
                        Your role
                      </option>
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Team size */}
                  <div>
                    <label style={labelStyle}>Team size</label>
                    <select
                      value={form.teamSize}
                      onChange={set("teamSize")}
                      required
                      disabled={status === "submitting"}
                      style={{
                        ...selectStyle,
                        color: form.teamSize ? "white" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      <option value="" disabled>
                        Team size
                      </option>
                      {teamSizes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Industry */}
                  <div>
                    <label style={labelStyle}>Industry</label>
                    <select
                      value={form.industry}
                      onChange={set("industry")}
                      required
                      disabled={status === "submitting"}
                      style={{
                        ...selectStyle,
                        color: form.industry ? "white" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      <option value="" disabled>
                        Industry
                      </option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Error message */}
                  {status === "error" && (
                    <div
                      style={{
                        background: "rgba(220, 38, 38, 0.15)",
                        border: "1px solid rgba(220, 38, 38, 0.4)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#fca5a5",
                        textAlign: "center",
                      }}
                    >
                      {errorMessage}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    style={{
                      marginTop: 4,
                      padding: "13px 20px",
                      fontSize: 14,
                      fontFamily: sans,
                      fontWeight: 600,
                      color: "white",
                      background: B.blueCta,
                      border: "none",
                      borderRadius: 8,
                      cursor: status === "submitting" ? "not-allowed" : "pointer",
                      transition: "background 0.2s, transform 0.1s",
                      width: "100%",
                      opacity: status === "submitting" ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (status !== "submitting") {
                        e.currentTarget.style.background = "#1E3A6E";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = B.blueCta;
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {status === "submitting"
                      ? "Submitting..."
                      : "Apply for the Spring 2026 Pilot"}
                  </button>
                  <p
                    style={{
                      fontFamily: sans,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    No credit card · No commitment · We respond within 48 hours
                  </p>
                </form>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(63,111,90,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4 10.5L8 14.5L16 5.5"
                      stroke={B.inkGreen}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3
                  style={{
                    fontFamily: sans,
                    fontSize: 20,
                    fontWeight: 700,
                    color: "white",
                    marginBottom: 6,
                  }}
                >
                  {status === "duplicate" ? "You're already on the list!" : "You're on the list."}
                </h3>
                <p
                  style={{
                    fontFamily: sans,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1.6,
                  }}
                >
                  {status === "duplicate"
                    ? "We already have your application. We'll notify you when your access is ready."
                    : "We'll reach out within 48 hours with next steps for your pilot onboarding."}
                </p>
                <p
                  style={{
                    fontFamily: sans,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 12,
                  }}
                >
                  Questions? <span style={{ color: B.coral }}>hello@inkra.app</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ COST OF INACTION ═══ */}
      <div
        style={{
          background: B.paperWarm,
          padding: "32px 24px",
          borderBottom: `1px solid ${B.borderLight}`,
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: sans,
              fontSize: 12,
              fontWeight: 600,
              color: B.coral,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            The cost of doing nothing
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { stat: "16 hrs", unit: "/week", line: "spent on documentation" },
              { stat: "5\u00d7", unit: "", line: "same info retyped into systems" },
              { stat: "$41K", unit: "/year", line: "per case manager in wasted time" },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 200px",
                  background: "white",
                  borderRadius: 8,
                  border: `1px solid ${B.borderLight}`,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 3,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: serif,
                      fontSize: 30,
                      fontWeight: 600,
                      color: B.coral,
                    }}
                  >
                    {s.stat}
                  </span>
                  <span style={{ fontFamily: sans, fontSize: 12, color: B.inkMuted }}>
                    {s.unit}
                  </span>
                </div>
                <div style={{ fontFamily: sans, fontSize: 12, color: B.inkMuted }}>
                  {s.line}
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              fontFamily: sans,
              fontSize: 13,
              color: B.inkMuted,
              marginTop: 14,
              lineHeight: 1.6,
            }}
          >
            Every hour behind a screen is an hour not spent with the people who need you.
            Every lost data point is a grant that&apos;s harder to win.
          </p>
        </div>
      </div>

      {/* ═══ VALUE STACK ═══ */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <p
          style={{
            fontFamily: sans,
            fontSize: 12,
            fontWeight: 600,
            color: B.blueCta,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          What you get with Inkra
        </p>
        <h2 style={{ fontSize: 24, color: B.inkBlue, lineHeight: 1.3, marginBottom: 4 }}>
          Total value of the pilot program
        </h2>
        <p style={{ fontFamily: sans, fontSize: 13, color: B.inkMuted, marginBottom: 24 }}>
          Here&apos;s what switching to Inkra is actually worth to your organization.
        </p>

        <ValueRow
          label="Automated documentation from every conversation"
          desc="Case notes, forms, follow-ups — generated instantly. No typing. No re-entry. 16 hours/week back to your team."
          value="$41K/yr"
        />
        <ValueRow
          label="Paper form digitization"
          desc="Upload any intake form — Inkra builds the digital version. No rebuilding. No retyping client history."
          value="$3,200"
        />
        <ValueRow
          label="Offline field work capture"
          desc="Print attendance sheets. Use them at courts, jails, community events. Upload a photo — everyone's marked present."
          value="$5,400/yr"
        />
        <ValueRow
          label="One-click funder reports"
          desc="Grant reports generate automatically with the right data, explained in plain English. No data analyst needed."
          value="$12K/yr"
        />
        <ValueRow
          label="Mass client updates"
          desc="See 10 clients in a day? Update all their notes at once. Nothing gets missed."
          value="$8,600/yr"
        />
        <ValueRow
          label="Single source of truth"
          desc="Stop copying between systems. Every update feeds goal reporting in real time. Inkra is both platforms."
          value="$6,000/yr"
        />
        <ValueRow
          label="HIPAA-ready compliance infrastructure"
          desc="AES-256 encryption, role-based access, full audit trail, recording consent. Built for regulated industries."
          value="$15K+"
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 0",
            marginTop: 4,
            borderTop: `2px solid ${B.inkBlue}`,
          }}
        >
          <div>
            <div
              style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: B.inkBlue }}
            >
              Total annual value
            </div>
            <div style={{ fontFamily: sans, fontSize: 12, color: B.inkMuted }}>
              per case manager / team lead
            </div>
          </div>
          <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: B.inkBlue }}>
            $91,200+
          </div>
        </div>

        <div
          style={{
            background: B.inkBlue,
            borderRadius: 10,
            padding: "24px",
            marginTop: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: sans, fontSize: 13, color: B.inkFaint, marginBottom: 4 }}>
            Your cost during the pilot?
          </p>
          <p
            style={{
              fontFamily: serif,
              fontSize: 42,
              fontWeight: 600,
              color: "white",
              marginBottom: 4,
            }}
          >
            $0
          </p>
          <p style={{ fontFamily: sans, fontSize: 14, color: B.paperDim, lineHeight: 1.5 }}>
            Free access. Free onboarding. Free data migration.
            <br />
            You help shape the platform. We handle the rest.
          </p>
        </div>
      </div>

      {/* ═══ RISK REVERSAL ═══ */}
      <div
        style={{
          background: B.paperWarm,
          padding: "28px 24px",
          borderTop: `1px solid ${B.borderLight}`,
          borderBottom: `1px solid ${B.borderLight}`,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: sans,
              fontSize: 12,
              fontWeight: 600,
              color: B.blueCta,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Zero risk
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "No credit card. No contract. No commitment.",
              "Your data stays yours — export anytime.",
              "White-glove onboarding included. We set everything up.",
              "Built by a former case manager and a nonprofit founder who taught herself to code.",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Check />
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 13,
                    color: B.inkSoft,
                    lineHeight: 1.5,
                  }}
                >
                  {t}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SOCIAL PROOF ═══ */}
      <div style={{ background: B.inkBlue, padding: "32px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <blockquote
            style={{
              fontSize: 19,
              fontStyle: "italic",
              color: "white",
              lineHeight: 1.4,
              marginBottom: 8,
            }}
          >
            &quot;People are walking through the doors and I&apos;m having to get up and
            say, I got more data to enter.&quot;
          </blockquote>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 500, color: B.inkFaint }}>
            — Karley, Director of Reentry Services · 14 partner nonprofits · 400+ weekly
            client interactions
          </p>
        </div>
      </div>

      {/* ═══ BOTTOM CTA ═══ */}
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <ScribMark color={B.inkBlue} width={60} opacity={0.3} />
          <h3
            style={{
              fontFamily: sans,
              fontSize: 20,
              fontWeight: 700,
              color: B.inkBlue,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            Be a change multiplier.
          </h3>
          <p
            style={{
              fontFamily: sans,
              fontSize: 14,
              color: B.inkMuted,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            Turn your words into completed work so you can focus on the people who need
            you.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              padding: "13px 32px",
              fontSize: 15,
              fontFamily: sans,
              fontWeight: 600,
              color: "white",
              background: B.blueCta,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = B.inkBlue)}
            onMouseLeave={(e) => (e.currentTarget.style.background = B.blueCta)}
          >
            Apply Now &#x2191;
          </button>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div
        style={{
          padding: "20px 24px 28px",
          textAlign: "center",
          borderTop: `1px solid ${B.borderLight}`,
        }}
      >
        <p style={{ fontFamily: sans, fontSize: 12, color: B.inkMuted }}>
          Inkra · <span style={{ color: B.blueCta }}>oninkra.com</span> · hello@inkra.app
        </p>
        <p style={{ fontFamily: sans, fontSize: 10, color: B.inkFaint, marginTop: 6 }}>
          HIPAA-ready · AES-256 encrypted · Role-based access · Full audit trail
        </p>
      </div>
    </div>
  );
}

// Main export with Suspense boundary for useSearchParams
export default function InkraPilotPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background: "#1B2A4A",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "white", fontFamily: "sans-serif" }}>Loading...</div>
        </div>
      }
    >
      <DemoPageContent />
    </Suspense>
  );
}
