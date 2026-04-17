import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">
        <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <section>
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing or using TON Web Store ("the Platform"), you agree to be bound by these
            Terms of Service. If you do not agree, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Description of Service</h2>
          <p>
            TON Web Store is a decentralized marketplace for digital goods with payments
            processed via the TON blockchain. The Platform facilitates transactions between
            buyers and sellers of digital products.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. User Accounts</h2>
          <p>
            You must authenticate via a supported provider (Appwrite Account: email
            magic-link or GitHub OAuth) to use certain features. You are responsible
            for maintaining the security of your account credentials
            and your TON wallet private keys.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. Payments & Escrow</h2>
          <p>
            Payments are processed through TON blockchain smart contracts. An escrow mechanism
            holds funds until the buyer confirms delivery or the dispute window expires.
            Platform fees are deducted automatically before funds are released to the seller.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Disputes & Refunds</h2>
          <p>
            Buyers may open a dispute within the specified dispute window after payment.
            The Platform reserves the right to resolve disputes by either releasing funds
            to the seller or refunding the buyer, at its sole discretion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Prohibited Content</h2>
          <p>
            Users may not list or sell: malware, stolen intellectual property, illegal content,
            products that violate third-party rights, or any content prohibited by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Limitation of Liability</h2>
          <p>
            The Platform is provided "as is" without warranties. We are not liable for losses
            resulting from blockchain transactions, wallet compromises, or smart contract
            vulnerabilities.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the Platform constitutes
            acceptance of the updated terms.
          </p>
        </section>
      </div>
    </div>
  );
}
