import StaticPage from "./StaticPage";

const HelpCenterPage = () => (
  <StaticPage
    title="Help Center"
    description="Get answers about ordering, payments, delivery, returns, and selling on Barakaz, or reach our support team."
    canonicalPath="/help"
  >
    <p>Welcome to the Barakaz Help Center. Find answers to common questions below or contact our support team for further assistance.</p>

    <h2 className="text-lg font-semibold text-foreground mt-6">Frequently Asked Questions</h2>

    <h3 className="text-base font-semibold text-foreground mt-4">How do I place an order?</h3>
    <p>Browse products, add items to your cart, and proceed to checkout. Select your delivery address and payment method, then confirm your order.</p>

    <h3 className="text-base font-semibold text-foreground mt-4">How can I track my order?</h3>
    <p>Go to your Account page and select "My Orders" to view the status and tracking information for all your orders.</p>

    <h3 className="text-base font-semibold text-foreground mt-4">What payment methods are accepted?</h3>
    <p>Available payment methods are shown securely at checkout. Card payments are processed through Stripe; options may vary by country and order.</p>

    <h3 className="text-base font-semibold text-foreground mt-4">How do I return a product?</h3>
    <p>For eligible items, request a return from My Orders within 7 days of delivery. Review the Return Policy for eligibility and exclusions.</p>

    <h3 className="text-base font-semibold text-foreground mt-4">How do I become a seller?</h3>
    <p>Click "Sell on Barakaz" in the navigation menu to register as a vendor. Once approved, you can start listing products immediately.</p>

    <h2 className="text-lg font-semibold text-foreground mt-6">Contact Support</h2>
    <p>Email: <strong>support@barakaz.com</strong></p>
    <p>Include your order number and a brief description of the issue so our support team can assist you.</p>
  </StaticPage>
);

export default HelpCenterPage;
