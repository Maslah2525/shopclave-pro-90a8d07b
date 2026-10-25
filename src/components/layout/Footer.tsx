import { Link } from "react-router-dom";
import { Facebook, Headphones, Instagram, LockKeyhole, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";
import barakazLogo from "@/assets/barakaz-logo.webp";
import appBadges from "@/assets/app-store-badges.webp";
import { paymentMethods } from "@/lib/paymentMethods";

const assuranceItems = [
  { icon: LockKeyhole, title: "Secure checkout", detail: "Encrypted payment processing", href: "/help" },
  { icon: RotateCcw, title: "7-day returns", detail: "On eligible purchases", href: "/return-policy" },
  { icon: Truck, title: "Tracked delivery", detail: "Updates on supported shipments", href: "/delivery" },
  { icon: Headphones, title: "Customer support", detail: "Help when you need it", href: "/contact" },
];

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer>
      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="w-full bg-[hsl(var(--nav-secondary))] hover:bg-[hsl(var(--nav-secondary))]/90 text-primary-foreground text-sm py-3 text-center font-medium transition-colors"
      >
        {t("footer.backToTop")}
      </button>

      {/* Newsletter */}
      <div className="bg-[hsl(var(--marketplace-orange))]">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-center gap-4">
          <p className="text-primary-foreground font-semibold text-sm md:text-base">
            {t("footer.newsletter")}
          </p>
          <div className="flex gap-2 w-full max-w-md">
            <Input
              placeholder={t("footer.enterEmail")}
              className="bg-white text-foreground border-none h-10"
            />
            <Button className="bg-[hsl(var(--nav-dark))] text-primary-foreground hover:bg-[hsl(var(--nav-dark))]/90 shrink-0 font-semibold">
              {t("footer.subscribe")}
            </Button>
          </div>
        </div>
      </div>

      {/* Marketplace assurance */}
      <div className="border-b border-primary-foreground/10 bg-[hsl(var(--nav-dark))] text-primary-foreground">
        <div className="container grid grid-cols-2 gap-px bg-primary-foreground/10 lg:grid-cols-4">
          {assuranceItems.map(({ icon: Icon, title, detail, href }) => (
            <Link key={title} to={href} className="flex items-center gap-3 bg-[hsl(var(--nav-dark))] px-5 py-5 transition-colors hover:bg-primary-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-foreground">
              <Icon className="h-6 w-6 shrink-0 text-[hsl(var(--marketplace-orange))]" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-primary-foreground/60">{detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Link columns */}
      <div className="bg-[hsl(var(--nav-dark))] text-primary-foreground">
        <div className="container py-12">
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-5">
            <div>
              <h4 className="font-bold text-sm mb-4">{t("footer.needHelp")}</h4>
              <ul className="space-y-2.5 text-sm text-primary-foreground/70">
                <li><Link to="/contact" className="hover:text-primary-foreground transition-colors">{t("footer.chatWithUs")}</Link></li>
                <li><Link to="/help" className="hover:text-primary-foreground transition-colors">{t("footer.helpCenter")}</Link></li>
                <li><Link to="/faq" className="hover:text-primary-foreground transition-colors">FAQ</Link></li>
                <li><Link to="/contact" className="hover:text-primary-foreground transition-colors">{t("footer.contactUs")}</Link></li>
                <li><Link to="/account" className="hover:text-primary-foreground transition-colors">Track an order</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4">Shop</h4>
              <ul className="space-y-2.5 text-sm text-primary-foreground/70">
                <li><Link to="/search" className="hover:text-primary-foreground transition-colors">Browse all products</Link></li>
                <li><Link to="/search?sort=newest" className="hover:text-primary-foreground transition-colors">New arrivals</Link></li>
                <li><Link to="/search?deals=true" className="hover:text-primary-foreground transition-colors">Deals</Link></li>
                <li><Link to="/wishlist" className="hover:text-primary-foreground transition-colors">Wishlist</Link></li>
                <li><Link to="/cart" className="hover:text-primary-foreground transition-colors">Shopping cart</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4">{t("footer.aboutBarakaz")}</h4>
              <ul className="space-y-2.5 text-sm text-primary-foreground/70">
                <li><Link to="/about" className="hover:text-primary-foreground transition-colors">{t("footer.aboutUs")}</Link></li>
                <li><Link to="/contact" className="hover:text-primary-foreground transition-colors">Careers & partnerships</Link></li>
                <li><Link to="/terms" className="hover:text-primary-foreground transition-colors">{t("footer.terms")}</Link></li>
                <li><Link to="/privacy-policy" className="hover:text-primary-foreground transition-colors">{t("footer.privacy")}</Link></li>
                <li><Link to="/cookie-policy" className="hover:text-primary-foreground transition-colors">{t("footer.cookies")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4">{t("footer.makeMoney")}</h4>
              <ul className="space-y-2.5 text-sm text-primary-foreground/70">
                <li><Link to="/vendor/register" className="hover:text-primary-foreground transition-colors">{t("footer.sellOnBarakaz")}</Link></li>
                <li><Link to="/vendor/dashboard" className="hover:text-primary-foreground transition-colors">{t("footer.vendorHub")}</Link></li>
                <li><Link to="/vendor/register" className="hover:text-primary-foreground transition-colors">{t("footer.becomePartner")}</Link></li>
                <li><Link to="/vendor/resources" className="hover:text-primary-foreground transition-colors">Seller resources</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4">{t("footer.services")}</h4>
              <ul className="space-y-2.5 text-sm text-primary-foreground/70">
                <li><Link to="/delivery" className="hover:text-primary-foreground transition-colors">{t("footer.delivery")}</Link></li>
                <li><Link to="/return-policy" className="hover:text-primary-foreground transition-colors">{t("footer.returnPolicy")}</Link></li>
                <li><Link to="/account" className="hover:text-primary-foreground transition-colors">{t("footer.myAccount")}</Link></li>
                <li><Link to="/cart" className="hover:text-primary-foreground transition-colors">{t("footer.myCart")}</Link></li>
                <li><Link to="/account" className="hover:text-primary-foreground transition-colors">Orders & returns</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <div className="border-t border-primary-foreground/10 bg-[hsl(var(--nav-dark))] text-primary-foreground">
        <div className="container py-8">
          <div className="mb-5 flex items-end justify-between gap-6">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--marketplace-orange))]" aria-hidden="true" />
                Payment options
              </h4>
              <p className="mt-1 text-xs text-primary-foreground/55">
                Available methods are confirmed securely at checkout and may vary by order.
              </p>
            </div>
            <p className="hidden text-xs text-primary-foreground/45 lg:block">Prices shown in Canadian dollars (CAD)</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10" aria-label="Payment methods that may be available at checkout">
            {paymentMethods.map((method) => (
              <div key={method.name} className="flex h-14 min-w-0 items-center justify-center overflow-hidden rounded-lg border border-primary-foreground/15 bg-background px-3 py-2" title={method.name}>
                <img src={method.logo} alt={method.name} className="h-8 max-h-full w-full max-w-[110px] object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* App badges + bottom bar */}
      <div className="bg-[hsl(var(--nav-dark))] border-t border-primary-foreground/10">
        <div className="container py-6 flex flex-col items-center gap-4">
          <p className="text-sm text-primary-foreground/70 font-medium">{t("footer.getApp")}</p>
          <div className="flex items-center gap-3">
            <a
              href="/downloads/barakaz.apk"
              download="Barakaz.apk"
              aria-label="Download Barakaz Android app (APK)"
            >
              <img src={appBadges} alt="Download Barakaz on App Store & Google Play" className="h-10 w-auto" />
            </a>
          </div>
          <div className="flex items-center gap-4 mt-2" aria-label="Barakaz social media">
            <a href="https://www.facebook.com/share/1E58qDYbDL/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"><Facebook className="h-5 w-5" /></a>
            <a href="https://www.tiktok.com/@barakazofficial" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>
            </a>
            <a href="https://www.instagram.com/barakazofficial" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"><Instagram className="h-5 w-5" /></a>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <img
              src={barakazLogo}
              alt="Barakaz"
              className="h-12 w-auto brightness-0 invert"
            />
            <p className="text-xs text-primary-foreground/50">
              © {new Date().getFullYear()} Barakaz. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Powered by */}
      <div className="bg-[hsl(var(--nav-dark))] border-t border-primary-foreground/5">
        <div className="container py-3 text-center">
          <p className="text-[11px] text-primary-foreground/40">
            Powered by Texcortech Systems
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
