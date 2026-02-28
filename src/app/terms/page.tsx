export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">End-User License Agreement</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: February 27, 2026</p>

      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Acceptance of Terms</h2>
          <p>By accessing and using this application, you agree to be bound by this End-User License Agreement. If you do not agree to these terms, do not use the application.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. License Grant</h2>
          <p>We grant you a limited, non-exclusive, non-transferable license to use this payroll and cash management application for your internal business operations.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Permitted Use</h2>
          <p>This application is intended for business payroll management, employee time tracking, cash management, point-of-sale operations, and integration with QuickBooks Online and Stripe for financial processing.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. User Responsibilities</h2>
          <p>You are responsible for maintaining the confidentiality of your login credentials, ensuring the accuracy of data entered, and complying with all applicable labor and tax laws in your jurisdiction.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Third-Party Services</h2>
          <p>This application integrates with QuickBooks Online (Intuit) and Stripe. Your use of those services is subject to their respective terms of service and privacy policies. We are not responsible for the availability or operation of third-party services.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Limitation of Liability</h2>
          <p>This application is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from the use of this application, including but not limited to financial losses, data loss, or business interruption.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Termination</h2>
          <p>We reserve the right to terminate or suspend access to the application at any time. Upon termination, your right to use the application ceases immediately.</p>
        </section>
      </div>
    </div>
  );
}
