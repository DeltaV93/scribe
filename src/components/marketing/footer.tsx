import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  product: {
    title: "Product",
    links: [
      { name: "Features", href: "/features" },
      { name: "Pricing", href: "/pricing" },
      { name: "How It Works", href: "/#how" },
    ],
  },
  useCases: {
    title: "Use Cases",
    links: [
      { name: "Nonprofits", href: "/use-cases/nonprofits" },
      { name: "Healthcare", href: "/use-cases/healthcare" },
      { name: "Sales", href: "/use-cases/sales" },
      { name: "UX Research", href: "/use-cases/ux-research" },
      { name: "Legal", href: "/use-cases/legal" },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { name: "Blog", href: "/blog" },
      { name: "Documentation", href: "#" },
      { name: "Help Center", href: "#" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { name: "About", href: "#" },
      { name: "Contact", href: "mailto:hello@inkra.app" },
      { name: "Careers", href: "#" },
    ],
  },
};

const legalLinks = [
  { name: "Privacy", href: "#" },
  { name: "Terms", href: "#" },
  { name: "Security", href: "#" },
];

export function MarketingFooter() {
  return (
    <>
      <style jsx global>{`
        .site-footer {
          border-top: 1px solid var(--border-light);
          padding: 64px 32px 32px;
          background: var(--paper-warm);
        }

        .footer-inner {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.2fr 3fr;
          gap: 64px;
        }

        .footer-brand {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .footer-brand-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .footer-name {
          font-weight: 800;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .footer-tagline {
          font-size: 14px;
          color: var(--ink-muted);
          line-height: 1.5;
        }

        .footer-columns {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }

        .footer-col h5 {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-muted);
          margin-bottom: 16px;
        }

        .footer-col a {
          display: block;
          font-size: 14px;
          color: var(--ink-soft);
          margin-bottom: 12px;
          text-decoration: none;
          transition: color 0.15s var(--ease);
        }

        .footer-col a:hover {
          color: var(--ink-blue-accent);
        }

        .footer-col a:last-child {
          margin-bottom: 0;
        }

        .footer-bottom {
          max-width: 1120px;
          margin: 48px auto 0;
          padding-top: 24px;
          border-top: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: var(--ink-muted);
        }

        .footer-legal {
          display: flex;
          gap: 24px;
        }

        .footer-legal a {
          color: var(--ink-muted);
          text-decoration: none;
          transition: color 0.15s var(--ease);
        }

        .footer-legal a:hover {
          color: var(--ink-blue-accent);
        }

        @media (max-width: 900px) {
          .footer-inner {
            grid-template-columns: 1fr;
            gap: 48px;
          }

          .footer-columns {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 520px) {
          .site-footer {
            padding: 48px 20px 24px;
          }

          .footer-columns {
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }

          .footer-bottom {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
        }
      `}</style>

      <footer className="site-footer">
        <div className="footer-inner">
          {/* Brand column */}
          <div className="footer-brand">
            <div className="footer-brand-top">
              <Image
                src="/inkra-logo.svg"
                alt="Inkra"
                width={40}
                height={12}
              />
              <span className="footer-name">Inkra</span>
            </div>
            <p className="footer-tagline">
              Conversation-to-Work Platform.
              <br />
              Your words become completed work.
            </p>
          </div>

          {/* Link columns */}
          <div className="footer-columns">
            <div className="footer-col">
              <h5>{footerLinks.product.title}</h5>
              {footerLinks.product.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.name}
                </Link>
              ))}
            </div>
            <div className="footer-col">
              <h5>{footerLinks.useCases.title}</h5>
              {footerLinks.useCases.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.name}
                </Link>
              ))}
            </div>
            <div className="footer-col">
              <h5>{footerLinks.resources.title}</h5>
              {footerLinks.resources.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.name}
                </Link>
              ))}
            </div>
            <div className="footer-col">
              <h5>{footerLinks.company.title}</h5>
              {footerLinks.company.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <span>&copy; 2026 Inkra &middot; Phoenixing LLC</span>
          <div className="footer-legal">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
