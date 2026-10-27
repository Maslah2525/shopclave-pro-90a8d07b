import { Link } from "react-router-dom";
import StaticPage from "./StaticPage";
import SEO from "@/components/seo/SEO";

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Barakaz",
  url: "https://barakaz.com/",
  email: "support@barakaz.com",
  address: {
    "@type": "PostalAddress",
    addressCountry: "CA",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "support@barakaz.com",
      contactType: "customer service",
      availableLanguage: ["English", "French"],
    },
    {
      "@type": "ContactPoint",
      email: "vendors@barakaz.com",
      contactType: "vendor support",
    },
  ],
};

const ContactPage = () => (
  <StaticPage
    title="Contact Us"
    description="Reach Barakaz support by email. Vendor and issue reporting contacts included."
    canonicalPath="/contact"
  >
    <SEO
      title="Contact Barakaz | Support, Vendor & Reporting"
      description="Reach Barakaz support by email. Vendor and issue reporting contacts included."
      canonicalPath="/contact"
      jsonLd={contactJsonLd}
    />
    <p>We'd love to hear from you! Whether you have a question, feedback, or need assistance, our team is here to help.</p>

    <h2 className="text-lg font-semibold text-foreground mt-6">Get in Touch</h2>
    <ul className="list-none space-y-2">
      <li><strong>Email:</strong> <a href="mailto:support@barakaz.com" className="text-primary hover:underline">support@barakaz.com</a></li>
      <li><strong>Business Hours:</strong> Monday – Friday, 9:00 AM – 6:00 PM</li>
    </ul>

    <h2 className="text-lg font-semibold text-foreground mt-6">Headquarters</h2>
    <p>Barakaz Marketplace<br />Canada</p>

    <h2 className="text-lg font-semibold text-foreground mt-6">For Vendors</h2>
    <p>If you are a vendor and need assistance with your account, please contact us at <a href="mailto:vendors@barakaz.com" className="font-semibold text-primary hover:underline">vendors@barakaz.com</a> or visit the <Link to="/vendor/dashboard" className="text-primary hover:underline">Vendor Hub</Link>.</p>

    <h2 className="text-lg font-semibold text-foreground mt-6">Report an Issue</h2>
    <p>To report a product listing, suspicious activity, or technical issue, please email <a href="mailto:report@barakaz.com" className="font-semibold text-primary hover:underline">report@barakaz.com</a> with details of the issue.</p>
  </StaticPage>
);

export default ContactPage;
