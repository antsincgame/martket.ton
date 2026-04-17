import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">
        <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <section>
          <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>
          <p>
            We collect information you provide when creating an account: email address,
            display name, and optional profile information. We also collect your TON wallet
            address when you connect your wallet.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and maintain the Platform</li>
            <li>To process transactions and verify payments</li>
            <li>To communicate about orders and disputes</li>
            <li>To detect and prevent fraud or abuse</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Blockchain Data</h2>
          <p>
            TON blockchain transactions are public and immutable. Transaction hashes, wallet
            addresses, and payment amounts associated with your orders are visible on-chain.
            We cannot delete or modify blockchain data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. Data Sharing</h2>
          <p>
            We do not sell your personal data. We may share data with: payment processors
            (TON blockchain), authentication providers (Clerk), cloud infrastructure
            providers (Appwrite, Cloudflare), and law enforcement when legally required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active or as needed to
            provide services. Transaction records are retained for compliance purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data
            by contacting us. Note that blockchain data cannot be modified or deleted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management, and
            localStorage for user preferences (e.g., network selection). We do not use
            third-party tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Contact</h2>
          <p>
            For privacy-related inquiries, please reach out through the Platform's
            support channels.
          </p>
        </section>
      </div>
    </div>
  );
}
