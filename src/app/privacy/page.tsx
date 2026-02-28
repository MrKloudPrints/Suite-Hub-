export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: February 27, 2026</p>

      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Information We Collect</h2>
          <p>We collect information necessary to operate our payroll and cash management services, including: employee names, work hours, pay rates, and transaction records. When you connect QuickBooks Online, we access invoice, customer, and payment data from your QuickBooks account as authorized by you.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. How We Use Your Information</h2>
          <p>Your data is used solely to provide payroll processing, cash management, point-of-sale operations, and financial reporting services. We do not sell, rent, or share your personal or financial data with third parties for marketing purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. QuickBooks Integration</h2>
          <p>When you connect your QuickBooks Online account, we access your accounting data (invoices, customers, payments, items) through Intuit&apos;s secure OAuth 2.0 API. We store access tokens securely in our database to maintain the connection. You can disconnect QuickBooks at any time from the Settings page, which immediately revokes our access.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Data Security</h2>
          <p>We implement industry-standard security measures including encrypted connections (HTTPS), secure password hashing, role-based access controls, rate limiting, and security headers. Access to financial data is restricted to authorized administrators.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Data Retention</h2>
          <p>We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your data by contacting us.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Contact</h2>
          <p>For questions about this privacy policy or your data, contact us through the application administrator.</p>
        </section>
      </div>
    </div>
  );
}
