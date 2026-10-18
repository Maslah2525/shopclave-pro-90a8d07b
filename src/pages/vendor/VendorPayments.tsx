import { Link, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WithdrawalRequests from "@/components/vendor/WithdrawalRequests";

const VendorPayments = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();

  return <div className="space-y-6 max-w-3xl">
    <div>
      <h1 className="text-2xl font-semibold">Payment settings</h1>
      <p className="text-sm text-muted-foreground mt-1">Canadian bank details or PayPal. No Stripe connection required.</p>
    </div>
    <Button variant="outline" asChild><Link to="/vendor/settings?section=payouts">Edit bank or PayPal details</Link></Button>
    {vendor?.id && <WithdrawalRequests vendorId={vendor.id} />}
  </div>;
};
export default VendorPayments;
