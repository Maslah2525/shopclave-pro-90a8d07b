import { useState } from "react";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import SEO from "@/components/seo/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  faqs: FAQ[];
}

const faqCategories: FAQCategory[] = [
  {
    title: "Orders & Shopping",
    faqs: [
      {
        question: "How do I place an order on Barakaz?",
        answer:
          "Browse products or use the search bar, add items to your cart, and proceed to checkout. Choose your delivery location and preferred payment method, then confirm your order with the vendor.",
      },
      {
        question: "How do I track my order?",
        answer:
          "Go to your Account page and select \"My Orders\" to view real-time status updates and tracking information for all your purchases.",
      },
      {
        question: "Can I cancel or modify my order after placing it?",
        answer:
          "Yes, you can cancel or modify your order before the vendor marks it as shipped. Contact the vendor directly via the in-app chat as soon as possible.",
      },
      {
        question: "What happens if a product is out of stock?",
        answer:
          "If an item becomes unavailable after ordering, the vendor will notify you and offer a replacement or full refund.",
      },
    ],
  },
  {
    title: "Payments",
    faqs: [
      {
        question: "What payment methods are accepted?",
        answer:
          "Available payment methods appear at secure checkout. Card payments are processed through Stripe; options may vary by region.",
      },
      {
        question: "How can I pay safely?",
        answer:
          "Pay through Barakaz checkout. Do not send payments directly to sellers outside the platform.",
      },
      {
        question: "Will I be charged any platform fees?",
        answer:
          "Your checkout total displays applicable product prices, shipping charges and taxes before payment.",
      },
    ],
  },
  {
    title: "Delivery",
    faqs: [
      {
        question: "How long does delivery take?",
        answer:
          "Delivery times vary by vendor and location. Most local orders arrive within 1-3 business days. Check the product page or ask the vendor for an exact estimate.",
      },
      {
        question: "Do you deliver internationally?",
        answer:
          "Yes, vendors on Barakaz ship locally and internationally. Available shipping destinations vary by vendor — check the product page for details.",
      },
      {
        question: "How much does delivery cost?",
        answer:
          "Delivery fees are set by individual vendors and depend on the destination and item size. The cost will be confirmed before you complete checkout.",
      },
    ],
  },
  {
    title: "Returns & Refunds",
    faqs: [
      {
        question: "What is the return policy?",
        answer:
          "You can request a return within 7 days of delivery if the product is defective or not as described. Visit our Return Policy page for full details.",
      },
      {
        question: "How do I get a refund?",
        answer:
          "Request an eligible return from My Orders. Refunds require review and payment-provider processing; contact support if you need assistance.",
      },
    ],
  },
  {
    title: "Selling on Barakaz",
    faqs: [
      {
        question: "How do I become a vendor?",
        answer:
          "Click \"Sell on Barakaz\" in the navigation menu and complete the vendor registration form. Once approved, you can start listing products immediately.",
      },
      {
        question: "Are there fees for listing products?",
        answer:
          "Basic listings are free. Premium subscription plans are available for vendors who want extra visibility and tools.",
      },
      {
        question: "How do I receive payments from buyers?",
        answer:
          "Buyer payments go through Barakaz checkout. Eligible seller payouts use Stripe Connect after onboarding and verification.",
      },
    ],
  },
  {
    title: "Account & Security",
    faqs: [
      {
        question: "How do I create an account?",
        answer:
          "Click \"Sign in\" at the top of the page and choose to register with your email or sign up with Google. You'll be ready to shop in seconds.",
      },
      {
        question: "I forgot my password. What do I do?",
        answer:
          "On the sign-in page, click \"Forgot password?\" and follow the instructions to reset it via email.",
      },
      {
        question: "Is my personal information safe?",
        answer:
          "Yes. We use industry-standard encryption and never share your personal details with third parties without consent. See our Privacy Policy for more.",
      },
    ],
  },
];

const FAQPage = () => {
  const [query, setQuery] = useState("");

  const filtered = faqCategories
    .map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (f) =>
          f.question.toLowerCase().includes(query.toLowerCase()) ||
          f.answer.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.faqs.length > 0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqCategories.flatMap((cat) =>
      cat.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    ),
  };

  return (
    <MarketplaceLayout>
      <SEO
        title="FAQ | Barakaz Help & Common Questions"
        description="Answers to common questions about ordering, payments, delivery, returns, and selling on Barakaz."
        canonicalPath="/faq"
        jsonLd={faqJsonLd}
      />
      <div className="container py-10 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground">
            Find quick answers to the most common questions about shopping and selling on Barakaz.
          </p>
        </div>

        <div className="relative mb-8 max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            No questions found. Try a different search term.
          </p>
        ) : (
          <div className="space-y-8">
            {filtered.map((cat) => (
              <section key={cat.title}>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  {cat.title}
                </h2>
                <Accordion type="single" collapsible className="border rounded-lg bg-card">
                  {cat.faqs.map((faq, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`${cat.title}-${idx}`}
                      className="px-4 last:border-b-0"
                    >
                      <AccordionTrigger className="text-left text-sm md:text-base font-medium hover:no-underline">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 text-center bg-muted/50 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Still need help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Our support team is ready to assist you.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </MarketplaceLayout>
  );
};

export default FAQPage;
