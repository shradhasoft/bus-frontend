// components/footer.tsx
import React from "react";
import Link from "next/link";
import {
  Bus,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

const Footer = () => {
  const footerLinks = {
    company: [
      { name: "About BookMySeat", href: "/about" },
      { name: "Our Fleet", href: "/fleet" },
      { name: "Careers", href: "/careers" },
      { name: "Press", href: "/press" },
    ],
    support: [
      { name: "Help Center", href: "/help" },
      { name: "Contact Us", href: "/help#contact" },
      { name: "Cancellation & Refunds", href: "/help#refunds" },
      { name: "Travel Guidelines", href: "/help#guidelines" },
    ],
    legal: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Cookie Policy", href: "/cookies" },
    ],
  };

  const socialLinks = [
    { icon: Instagram, href: "#", label: "Instagram" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Youtube, href: "#", label: "Youtube" },
  ];

  return (
    <footer className="bg-white text-rose-600 dark:bg-slate-950 dark:text-rose-200 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-rose-100 dark:border-rose-200/15">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-200/15 rounded-full flex items-center justify-center">
                <Bus className="w-5 h-5 text-rose-600 dark:text-rose-200" />
              </div>
              <span className="font-bold text-xl text-rose-600 dark:text-rose-200">
                BookMySeat
              </span>
            </Link>
            <p className="text-rose-600/80 dark:text-rose-200/80 mb-6 max-w-sm leading-relaxed">
              Book intercity and regional buses in minutes. Compare operators,
              pick your seat, and travel with real-time tracking and instant
              e-tickets.
            </p>

            <div className="space-y-3">
              <a
                href="mailto:support@bookmyseat.com"
                className="flex items-center gap-3 text-rose-600/80 hover:text-rose-600 dark:text-rose-200/80 dark:hover:text-rose-200 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">support@bookmyseat.com</span>
              </a>
              <a
                href="tel:+18005550120"
                className="flex items-center gap-3 text-rose-600/80 hover:text-rose-600 dark:text-rose-200/80 dark:hover:text-rose-200 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">1-800-555-0120</span>
              </a>
              <div className="flex items-center gap-3 text-rose-600/80 dark:text-rose-200/80">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Seattle, Washington, USA</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-rose-600 dark:text-rose-200 mb-6">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-rose-600/80 hover:text-rose-600 dark:text-rose-200/80 dark:hover:text-rose-200 transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-rose-600 dark:text-rose-200 mb-6">
              Support
            </h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-rose-600/80 hover:text-rose-600 dark:text-rose-200/80 dark:hover:text-rose-200 transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-rose-600 dark:text-rose-200 mb-6">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-rose-600/80 hover:text-rose-600 dark:text-rose-200/80 dark:hover:text-rose-200 transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-rose-600/70 dark:text-rose-200/70 text-center md:text-left">
            © {new Date().getFullYear()} BookMySeat. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-10 h-10 rounded-full bg-rose-50 text-rose-600/80 hover:bg-rose-500 hover:text-white dark:bg-rose-200/10 dark:text-rose-200/80 dark:hover:bg-rose-500 dark:hover:text-white flex items-center justify-center transition-all duration-300"
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
