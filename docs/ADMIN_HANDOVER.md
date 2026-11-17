# LA VAGUE — Admin Handover & Operations Guide

This guide covers taking ownership of the LA VAGUE storefront and admin dashboard (`/admin.html`), rotating credentials so only the store owner has access, and managing day-to-day store operations.

---

## 1. Security Handover (Do This First)

To ensure the developer who set up the site no longer has admin access:

1. **Sign in to the Admin Panel**
   - Open `/admin.html` and log in using the temporary setup password (`ADMIN_PASSWORD`).
2. **Set Your Own Private Admin Password**
   - Go to **Settings -> Admin Security & Handover**.
   - Enter the temporary setup password under **Current Password**, then enter your new private password (minimum 12 characters) and click **Update Admin Password**.
   - What happens immediately:
     - Your new password is salted and hashed with `scrypt` and stored in the database (`admin_password_hash` in `settings`).
     - The initial `ADMIN_PASSWORD` environment variable is **disabled** for login.
     - All other active admin sessions are **signed out immediately**.
3. **Rotate Production Secrets in Your Hosting Provider**
   Update these environment variables in your hosting dashboard (e.g., Render / Netlify) so only you control external integrations:
   - `ADMIN_PASSWORD` — change or remove after setting your in-app password (used only as fallback before in-app password setup).
   - `PAYSTACK_SECRET_KEY` & `PAYSTACK_PUBLIC_KEY` — switch to your live Paystack keys (`sk_live_...`, `pk_live_...`) and verify your Paystack webhook URL points to `/api/payment/webhook`.
   - `BREVO_API_KEY` / `SMTP_PASS` — verify your transactional email sender credentials and `EMAIL_FROM` / `ADMIN_EMAIL`.
   - `DATABASE_URL` — confirm you own the production PostgreSQL credentials.
   - `FRONTEND_URL` — set to your live domain (e.g. `https://la-vague.store`).

### Password Recovery (If Locked Out)
If you ever forget your in-app admin password:
1. Update `ADMIN_PASSWORD` in your hosting environment variables to a new temporary password.
2. Delete the `admin_password_hash` row from the `settings` table in your database:
   ```sql
   DELETE FROM settings WHERE key = 'admin_password_hash';
   ```
3. Sign in at `/admin.html` with the new `ADMIN_PASSWORD`, then set a new in-app password in **Settings -> Admin Security & Handover**.

---

## 2. Launch Day Countdown

The homepage hero includes a live countdown timer (`Days : Hrs : Min : Sec`) controlled from the Admin Panel:

1. Open **Settings -> Launch Day Countdown** in `/admin.html`.
2. Toggle **Enable launch countdown** on or off.
3. Set the **Countdown label** (e.g., `DROP 001 LAUNCHES IN`).
4. Choose the **Launch date & time** (uses your device's local timezone and saves as ISO UTC) and click **Save Settings**.
5. Once the target date/time passes, the countdown hides automatically on the homepage.

---

## 3. Daily Store Operations

- **Products & Inventory**: Add/edit products, upload images (JPEG, PNG, WebP, GIF up to 5MB), and adjust per-variant stock in the **Products** and **Inventory** tabs.
- **Orders & Fulfillment**: View paid orders, update order status (`pending` -> `processing` -> `shipped` -> `delivered` / `cancelled`), and trigger customer status emails in **Orders**.
- **Reviews**: New customer reviews are held as `pending` until approved in **Reviews**. Public product pages only display `approved` reviews and never expose customer emails or order IDs.
- **Store Announcements**: Schedule limited-time top banner messages in **Settings -> Store announcement**. Outside campaign dates, the banner automatically falls back to your free-shipping threshold message.
- **Coupons & Exports**: Create/manage discount codes and export Orders or Products as CSV in **Settings**.
