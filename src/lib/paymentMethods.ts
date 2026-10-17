import jcb from "@/assets/payment-methods/jcb.webp.asset.json";
import bank from "@/assets/payment-methods/bank-transfer.webp.asset.json";
import shop from "@/assets/payment-methods/shop-pay.webp.asset.json";
import afterpay from "@/assets/payment-methods/afterpay.webp.asset.json";
import klarna from "@/assets/payment-methods/klarna.webp.asset.json";
import mastercard from "@/assets/payment-methods/mastercard.webp.asset.json";
import stripe from "@/assets/payment-methods/stripe.webp.asset.json";
import google from "@/assets/payment-methods/google-pay.webp.asset.json";
import apple from "@/assets/payment-methods/apple-pay.webp.asset.json";
import paypal from "@/assets/payment-methods/paypal.webp.asset.json";

export const paymentMethods = [
  { name: "Mastercard", logo: mastercard.url },
  { name: "JCB", logo: jcb.url },
  { name: "Apple Pay", logo: apple.url },
  { name: "Google Pay", logo: google.url },
  { name: "PayPal", logo: paypal.url },
  { name: "Stripe", logo: stripe.url },
  { name: "Shop Pay", logo: shop.url },
  { name: "Klarna", logo: klarna.url },
  { name: "Afterpay", logo: afterpay.url },
  { name: "Bank transfer", logo: bank.url },
];