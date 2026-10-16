import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, BarChart3, BookOpen, Box, CircleHelp, Globe2, Headset, Package, ShieldCheck, Store, Tag, TrendingUp, Users, UserRoundCheck } from "lucide-react";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import sellerHero from "@/assets/hero-banner-1.webp";

const benefits = [
  { icon: Users, title: "Reach More Customers", description: "Make your products discoverable to shoppers across supported markets.", color: "bg-orange-100 text-orange-600" },
  { icon: Tag, title: "Competitive Selling Fees", description: "Build your business with transparent selling terms.", color: "bg-emerald-100 text-emerald-700" },
  { icon: ShieldCheck, title: "Secure Payments", description: "Sell with integrated payment processing and account verification.", color: "bg-sky-100 text-blue-700" },
  { icon: BarChart3, title: "Business Growth Tools", description: "Manage products, orders and performance in one place.", color: "bg-violet-100 text-violet-700" },
];
const steps = [
  { icon: UserRoundCheck, title: "Register", detail: "Create your seller account.", color: "bg-orange-100 text-orange-600" },
  { icon: BadgeCheck, title: "Verify", detail: "Complete identity and business verification.", color: "bg-sky-100 text-blue-700" },
  { icon: Store, title: "Set Up Store", detail: "Add your store details and preferences.", color: "bg-violet-100 text-violet-700" },
  { icon: Package, title: "List Products", detail: "Publish your products after approval.", color: "bg-emerald-100 text-emerald-700" },
  { icon: TrendingUp, title: "Start Selling", detail: "Reach customers and grow your business.", color: "bg-rose-100 text-rose-700" },
];
export default function SellerLandingPage() {
  return <MarketplaceLayout>
    <main className="bg-white text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-r from-sky-50 via-sky-50 to-orange-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:px-10 md:py-20">
          <div className="relative z-10">
            <span className="inline-flex rounded-full bg-orange-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-700">Sell on Barakaz</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-[#0b1749] sm:text-5xl lg:text-6xl">Become a Seller<br />on Barakaz</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">Start selling your products to customers locally and around the world.</p>
            <div className="mt-8 flex max-w-md flex-col gap-3">
              <Link to="/vendor/register" className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-[#ff4d0b] px-6 text-lg font-bold text-white shadow-sm transition hover:bg-orange-700">Create Seller Account <ArrowRight className="h-5 w-5" /></Link>
              <Link to="/auth" state={{from:"/vendor/dashboard"}} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-orange-500 bg-white px-5 font-medium text-[#0b1749] transition hover:bg-orange-50">Already have a seller account? <span className="font-bold text-orange-600">Sign in</span></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-4 text-sm font-medium text-[#0b1749]">
              <span className="flex items-center gap-2"><Globe2 className="h-7 w-7" /> Global Marketplace</span>
              <span className="flex items-center gap-2"><ShieldCheck className="h-7 w-7" /> Secure Payments</span>
              <span className="flex items-center gap-2"><BarChart3 className="h-7 w-7" /> Grow Your Business</span>
            </div>
          </div>
          <div className="relative min-h-72 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 to-orange-100 shadow-lg md:min-h-[440px]">
            <img src={sellerHero} alt="Small business seller preparing customer orders" className="h-full min-h-72 w-full object-cover md:absolute md:inset-0 md:min-h-full" onError={e=>{e.currentTarget.style.display="none";}} />
            <div className="absolute left-4 top-5 rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold text-[#0b1749] shadow-lg"><TrendingUp className="mr-2 inline h-5 w-5 text-emerald-600" /> Grow Your Sales</div>
            <div className="absolute bottom-6 left-4 rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold text-[#0b1749] shadow-lg"><Users className="mr-2 inline h-5 w-5 text-blue-600" /> Reach More Shoppers</div>
            <div className="absolute right-4 top-20 rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold text-[#0b1749] shadow-lg"><Box className="mr-2 inline h-5 w-5 text-orange-600" /> Sell Worldwide</div>
          </div>
        </div>
      </section>
      <section className="bg-sky-50 px-5 py-14 md:px-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-extrabold text-[#0b1749] md:text-4xl">Why Sell on Barakaz?</h2>
          <p className="mt-3 text-center text-slate-600">Everything you need to grow your business in one place.</p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{benefits.map(({icon:Icon,title,description,color})=><article key={title} className="rounded-xl bg-white p-6 text-center shadow-sm"><span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-xl ${color}`}><Icon className="h-8 w-8" /></span><h3 className="mt-5 font-bold text-[#0b1749]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p></article>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-10">
        <h2 className="text-center text-3xl font-extrabold text-[#0b1749] md:text-4xl">How It Works</h2>
        <p className="mt-3 text-center text-slate-600">Start selling in a few simple steps.</p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">{steps.map(({icon:Icon,title,detail,color},index)=><div key={title} className="text-center"><span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${color}`}><Icon className="h-9 w-9" /></span><h3 className="mt-4 font-bold text-[#0b1749]">{index+1}. {title}</h3><p className="mt-2 text-sm text-slate-600">{detail}</p></div>)}</div>
      </section>
      <section className="bg-orange-50 px-5 py-12 md:px-10"><div className="mx-auto max-w-7xl"><div className="flex items-center gap-3"><Headset className="h-10 w-10 text-orange-600" /><div><h2 className="text-3xl font-extrabold text-[#0b1749]">Need Help?</h2><p className="text-slate-600">Our seller support resources are here to assist you.</p></div></div><div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Link to="/contact" className="flex items-center gap-3 rounded-xl bg-white p-5 font-semibold text-[#0b1749] shadow-sm hover:shadow-md"><Headset className="h-7 w-7 text-blue-600" /> Contact Support <ArrowRight className="ml-auto h-4 w-4" /></Link>
        <Link to="/help" className="flex items-center gap-3 rounded-xl bg-white p-5 font-semibold text-[#0b1749] shadow-sm hover:shadow-md"><CircleHelp className="h-7 w-7 text-blue-600" /> Help Center <ArrowRight className="ml-auto h-4 w-4" /></Link>
        <Link to="/faq" className="flex items-center gap-3 rounded-xl bg-white p-5 font-semibold text-[#0b1749] shadow-sm hover:shadow-md"><BookOpen className="h-7 w-7 text-blue-600" /> Seller Resources <ArrowRight className="ml-auto h-4 w-4" /></Link>
      </div></div></section>
    </main>
  </MarketplaceLayout>;
}
