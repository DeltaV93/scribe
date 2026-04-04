import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  product: [
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/#how", label: "How It Works" },
  ],
  useCases: [
    { href: "/use-cases/nonprofits", label: "Nonprofits" },
    { href: "/use-cases/healthcare", label: "Healthcare" },
    { href: "/use-cases/sales", label: "Sales" },
    { href: "/use-cases/ux-research", label: "UX Research" },
    { href: "/use-cases/legal", label: "Legal" },
  ],
  resources: [
    { href: "/blog", label: "Blog" },
    { href: "#", label: "Documentation" },
    { href: "#", label: "Help Center" },
  ],
  company: [
    { href: "#", label: "About" },
    { href: "mailto:hello@inkra.app", label: "Contact" },
    { href: "#", label: "Careers" },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/inkra-logo.svg"
                alt="Inkra"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-bold text-lg tracking-tight">Inkra</span>
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              Conversation-to-Work Platform
            </p>
          </div>

          {/* Links Grid */}
          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Product */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Product
              </h5>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Use Cases */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Use Cases
              </h5>
              <ul className="space-y-3">
                {footerLinks.useCases.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Resources
              </h5>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Company
              </h5>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Inkra &middot; Phoenixing LLC
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Terms
            </Link>
            <Link
              href="#"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
