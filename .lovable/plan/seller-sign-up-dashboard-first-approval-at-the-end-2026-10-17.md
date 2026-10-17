# Seller sign-up: dashboard first, approval at the end

## New flow
```text
"Become a seller" click
  -> "We are preparing your vendor dashboard..." screen (2-3 s)
  -> Vendor dashboard opens, Store Settings highlighted:
     "Finish your store setup to proceed"
  -> Seller completes Store Settings sections, clicks Submit
  -> Pop-up: "Your application has been submitted for review.
     You will get an email confirmation upon approval.
     For queries contact support at support@barakaz.com"
  -> Admin approves in Vendor Management -> approval email sent
```

## What changes
1. **Become a seller button** goes to a short "Preparing your vendor dashboard" screen. Behind it, a store is created for the user with status *pending* (store name defaults to their name; editable later). Existing sellers skip straight to the dashboard.
2. **Vendor dashboard for pending sellers**
   - Orange banner at the top: "Finish your store setup to proceed" with a button to Store Settings.
   - Store Settings is highlighted in the side menu; other pages (products, orders, payouts) show a locked note until approved.
   - The public store stays hidden until approval (already the case for pending stores).
3. **Store Settings becomes the setup checklist**: store profile, business details, ID verification (where Canada rules need it), payouts (Stripe), and policy agreements, each with a done tick. A **Submit for review** button at the bottom only activates when every required section is done.
4. **Submit pop-up** with the exact wording above. After submitting, the banner changes to "Application under review".
5. **Approval email**: when an admin presses Approve (or Re-approve) in Vendor Management, the seller gets an "Your store is approved" email. Rejection keeps the existing Re-approve option.
6. The old 7-step registration page is retired; links to it redirect to the new flow. Drafts already started are carried over into Store Settings so nobody loses data.

## Technical details
- New backend function to create the pending vendor row idempotently for the signed-in user (no duplicate stores).
- Reuse the existing server-side submission checks (business info, Canada rules, Stripe payout account, six policy acceptances) so approval rules stay identical; the submit button calls that same validation.
- Approval email uses the app email system (one recipient, triggered by the approval) with a branded template.
- Add tests for: submit blocked until required sections done; only one store per user.
