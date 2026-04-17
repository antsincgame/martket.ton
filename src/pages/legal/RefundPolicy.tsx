import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="text-3xl font-bold text-white mb-8">Refund & DMCA Policy</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">
        <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <section>
          <h2 className="text-xl font-semibold text-white">Refund Policy</h2>

          <h3 className="text-lg font-medium text-white mt-4">Dispute Window</h3>
          <p>
            After completing a purchase, buyers have a dispute window (typically 24 hours)
            to report issues. During this period, funds are held in escrow.
          </p>

          <h3 className="text-lg font-medium text-white mt-4">Eligible Refund Reasons</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Product not delivered after payment confirmation</li>
            <li>Product significantly differs from its listing description</li>
            <li>Product contains malware or is non-functional</li>
            <li>Duplicate or accidental purchase</li>
          </ul>

          <h3 className="text-lg font-medium text-white mt-4">Refund Process</h3>
          <p>
            To request a refund, open a dispute through the Orders page. Provide a clear
            description of the issue. The Platform will review and resolve within 5 business
            days by either releasing funds to the seller or refunding the buyer.
          </p>

          <h3 className="text-lg font-medium text-white mt-4">Non-Refundable</h3>
          <p>
            Refunds are not available after the dispute window closes and funds have been
            released to the seller, unless the Platform determines fraud has occurred.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">DMCA / Copyright Policy</h2>

          <h3 className="text-lg font-medium text-white mt-4">Reporting Infringement</h3>
          <p>
            If you believe your copyrighted work has been listed on the Platform without
            authorization, submit a takedown notice including:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Identification of the copyrighted work</li>
            <li>URL of the infringing listing</li>
            <li>Your contact information</li>
            <li>A statement of good faith belief</li>
            <li>A statement of accuracy under penalty of perjury</li>
            <li>Your physical or electronic signature</li>
          </ul>

          <h3 className="text-lg font-medium text-white mt-4">Counter-Notice</h3>
          <p>
            If your listing was removed and you believe it was done in error, you may submit
            a counter-notice. The Platform will restore the content within 10-14 business
            days unless the complainant files a court action.
          </p>

          <h3 className="text-lg font-medium text-white mt-4">Repeat Infringers</h3>
          <p>
            Accounts with repeated copyright violations will be permanently suspended.
          </p>
        </section>
      </div>
    </div>
  );
}
