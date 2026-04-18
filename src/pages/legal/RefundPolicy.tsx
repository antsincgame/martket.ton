import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const ENTITY = 'TonForge LLC';
const STATE = 'Delaware';
const DOMAIN = 'tonforge.org';
const DMCA_CONTACT = `dmca@${DOMAIN}`;
const LEGAL_CONTACT = `legal@${DOMAIN}`;
const DISPUTE_WINDOW_HOURS = 72;

export default function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Refund &amp; DMCA Policy</h1>
      <p className="text-gray-500 text-sm mb-4">
        Effective date: April 18, 2026 · Last updated: April 18, 2026
      </p>

      <div className="mb-8 rounded-xl border border-[#00FF88]/25 bg-gradient-to-r from-[#00FF88]/[0.06] to-transparent p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#00FF88] mb-2">
          Buyer &amp; Seller Protection
        </h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          This policy is part of the{' '}
          <Link to="/terms" className="text-[#FFD700] hover:underline">Terms of Service</Link> and
          governs refund eligibility, dispute resolution, and DMCA copyright takedown procedures.
          <strong className="text-white"> All transactions are on-chain and irreversible after the dispute window closes.</strong>
        </p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">

        {/* ── REFUND POLICY ── */}
        <section>
          <h2 className="text-2xl font-bold text-white border-b border-white/10 pb-2">
            Part I — Refund Policy
          </h2>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">1. Scope</h2>
          <p>
            This Refund Policy applies to all digital product purchases made on{' '}
            <a href={`https://${DOMAIN}`} className="text-[#00F5FF] hover:underline">{DOMAIN}</a>{' '}
            (&quot;Platform&quot;), operated by <strong>{ENTITY}</strong>, a {STATE} limited liability company.
          </p>
          <p>
            <strong>Important:</strong> All payments are settled on the TON blockchain. The Company
            does not hold, custody, or have access to User funds. Refund availability is subject
            to the technical capabilities of the on-chain transaction mechanism.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Dispute Window</h2>
          <p>
            After payment is confirmed on-chain, buyers have a <strong>{DISPUTE_WINDOW_HOURS}-hour
            Dispute Window</strong> to report issues. During this period, proceeds may be held in
            the smart-contract escrow (where applicable) pending resolution.
          </p>
          <p>
            <strong>After the Dispute Window closes,</strong> funds are released to the seller.
            Once released, the Company has no technical ability to reverse the transaction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Eligible Refund Reasons</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Product not delivered after on-chain payment confirmation</li>
            <li>Product is materially different from its listing description</li>
            <li>Product contains malware, spyware, or undisclosed data collection (confirmed by scan)</li>
            <li>Product is non-functional or completely broken on all supported platforms</li>
            <li>Duplicate or accidental purchase (verified by on-chain records)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. Non-Refundable Cases</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Dispute Window has expired and funds have been released to the seller</li>
            <li>Buyer has downloaded and used the product (unless it contains malware)</li>
            <li>Buyer&apos;s dissatisfaction with subjective quality (&quot;I don&apos;t like it&quot;)</li>
            <li>Price changes after purchase</li>
            <li>Buyer&apos;s inability to connect a TON wallet or technical issues on the buyer&apos;s side</li>
            <li>Blockchain network congestion, gas fee fluctuations, or network outages</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Refund Process</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Open a dispute</strong> through the{' '}
              <Link to="/orders" className="text-[#8B5CF6] hover:underline">Orders</Link>{' '}
              page within {DISPUTE_WINDOW_HOURS} hours of purchase.
            </li>
            <li>
              <strong>Provide evidence:</strong> describe the issue clearly. Screenshots, error logs,
              and transaction hashes strengthen your case.
            </li>
            <li>
              <strong>Review:</strong> the Company will review and respond within 5 business days.
              The seller may provide a counter-statement.
            </li>
            <li>
              <strong>Resolution:</strong> the Company will issue a non-binding recommendation. If the
              smart-contract escrow allows, funds will be returned to the buyer&apos;s wallet. If funds
              have already been released, the Company will attempt to facilitate a voluntary refund
              from the seller but cannot guarantee it.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Blockchain Limitations</h2>
          <p>
            The Company cannot: reverse on-chain transactions; recover funds sent to incorrect
            wallet addresses; compensate for losses due to private key compromise, phishing,
            or smart-contract exploits outside the Platform&apos;s control. Users accept these
            inherent risks of blockchain-based commerce.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6.5. Dispute Abuse &amp; Fraud Protection</h2>
          <p>
            The Company takes dispute abuse seriously. The following conduct constitutes abuse
            of the dispute mechanism and may result in account suspension or permanent ban:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Filing disputes in bad faith (e.g., claiming non-delivery after downloading and using a product)</li>
            <li>Filing three (3) or more disputes found to be without merit within any twelve (12) month period</li>
            <li>Attempting to obtain a refund while retaining access to the purchased product</li>
            <li>Colluding with sellers to file fraudulent disputes</li>
            <li>Re-opening a dispute on the same grounds after a prior dispute on the same transaction was resolved</li>
          </ul>
          <p>
            <strong>Legal notice:</strong> Fraudulent refund claims may constitute wire fraud under
            18 U.S.C. &sect; 1343, which carries penalties of up to 20 years imprisonment and fines
            up to $250,000. The Company reserves the right to report suspected fraud to the
            Federal Bureau of Investigation (FBI) Internet Crime Complaint Center (IC3) and other
            relevant law enforcement agencies.
          </p>
          <p>
            <strong>Seller protection:</strong> If a buyer&apos;s dispute is resolved in favor of the
            seller, the buyer may not re-open a dispute on the same transaction for the same reason.
            Sellers impacted by fraudulent disputes may contact <a href={`mailto:${LEGAL_CONTACT}`} className="text-[#00F5FF] hover:underline">{LEGAL_CONTACT}</a> for assistance.
          </p>
        </section>

        {/* ── DMCA ── */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-white border-b border-white/10 pb-2">
            Part II — DMCA &amp; Copyright Policy
          </h2>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Commitment to IP Protection</h2>
          <p>
            {ENTITY} respects the intellectual property rights of others and expects all publishers
            on the Platform to do the same. We comply with the Digital Millennium Copyright Act
            of 1998 (17 U.S.C. § 512) (&quot;DMCA&quot;).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. DMCA Designated Agent</h2>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mt-2">
            <p className="font-medium text-white mb-2">Designated Copyright Agent:</p>
            <p>
              {ENTITY}<br />
              Attn: DMCA Agent<br />
              State of {STATE}, United States<br />
              Email:{' '}
              <a href={`mailto:${DMCA_CONTACT}`} className="text-[#00F5FF] hover:underline">{DMCA_CONTACT}</a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">9. Filing a Takedown Notice</h2>
          <p>
            If you believe that your copyrighted work has been copied and is accessible on the
            Platform in a way that constitutes copyright infringement, please send a written
            notification to our DMCA Agent containing:
          </p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              A <strong>physical or electronic signature</strong> of the copyright owner or a person
              authorized to act on their behalf.
            </li>
            <li>
              <strong>Identification of the copyrighted work</strong> claimed to be infringed, or,
              if multiple works are covered, a representative list.
            </li>
            <li>
              <strong>Identification of the infringing material</strong> — the URL or other specific
              location on the Platform where the material is found. Provide enough detail for us
              to locate it.
            </li>
            <li>
              Your <strong>contact information:</strong> full name, mailing address, telephone number,
              and email address.
            </li>
            <li>
              A statement that you have a <strong>good faith belief</strong> that the use of the
              material is not authorized by the copyright owner, its agent, or the law.
            </li>
            <li>
              A statement, <strong>under penalty of perjury</strong>, that the information in the
              notification is accurate and that you are the copyright owner or authorized to act
              on behalf of the owner.
            </li>
          </ol>
          <p className="mt-2">
            Send takedown notices to:{' '}
            <a href={`mailto:${DMCA_CONTACT}`} className="text-[#00F5FF] hover:underline">{DMCA_CONTACT}</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">10. Counter-Notice</h2>
          <p>
            If your product listing was removed and you believe the takedown was issued in error
            or based on misidentification, you may submit a counter-notice to our DMCA Agent
            containing:
          </p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Your physical or electronic signature.</li>
            <li>Identification of the material that was removed and the location where it appeared before removal.</li>
            <li>
              A statement under penalty of perjury that you have a good faith belief that the
              material was removed as a result of mistake or misidentification.
            </li>
            <li>Your name, address, and telephone number.</li>
            <li>
              A statement that you consent to the jurisdiction of the federal district court for
              the judicial district in which your address is located (or, if outside the U.S.,
              any judicial district in which {ENTITY} may be found), and that you will accept
              service of process from the person who filed the original DMCA notice.
            </li>
          </ol>
          <p className="mt-2">
            Upon receipt of a valid counter-notice, we will forward it to the original complainant.
            If the complainant does not file a court action within <strong>10–14 business days</strong>,
            we will restore the removed content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">11. Repeat Infringers</h2>
          <p>
            In accordance with the DMCA, the Platform maintains a policy of terminating accounts
            of users who are repeat copyright infringers. Accounts that receive three (3) valid
            DMCA takedown notices within any twelve (12) month period will be permanently
            suspended without prior warning.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">12. Good Faith &amp; Misuse Warning</h2>
          <p>
            Under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents
            that material is infringing, or that material was removed by mistake, may be
            subject to liability for damages, including costs and attorney&apos;s fees. Do not
            submit false claims.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">13. Contact</h2>
          <p>
            {ENTITY}<br />
            State of {STATE}, United States<br />
            Legal:{' '}
            <a href={`mailto:${LEGAL_CONTACT}`} className="text-[#00F5FF] hover:underline">{LEGAL_CONTACT}</a>
            <br />
            DMCA:{' '}
            <a href={`mailto:${DMCA_CONTACT}`} className="text-[#00F5FF] hover:underline">{DMCA_CONTACT}</a>
          </p>
        </section>
      </div>
    </div>
  );
}
