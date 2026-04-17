import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const E = 'TonForge LLC';
const ST = 'Delaware';
const D = 'tonforge.org';
const C = `privacy@${D}`;

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Effective: April 18, 2026 · Last updated: April 18, 2026</p>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">

        <section>
          <h2 className="text-xl font-semibold text-white">1. Data Controller</h2>
          <p><strong>{E}</strong>, a limited liability company incorporated in the State of {ST}, United States, is the data controller for personal information collected through <a href={`https://${D}`} className="text-[#00F5FF] hover:underline">{D}</a> (&quot;Platform&quot;).</p>
          <p>For privacy inquiries: <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a></p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-white mt-4">2.1. Information You Provide</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> email address (via OTP authentication) or GitHub profile information (via OAuth)</li>
            <li><strong>Profile data:</strong> display name, biography, social links, avatar (optional)</li>
            <li><strong>Publisher data:</strong> product listings, descriptions, uploaded build files</li>
            <li><strong>Support communications:</strong> emails sent to our support addresses</li>
          </ul>

          <h3 className="text-lg font-medium text-white mt-4">2.2. Information Collected Automatically</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Session data:</strong> Appwrite session tokens, JWT tokens (temporary, not stored beyond session lifetime)</li>
            <li><strong>Usage data:</strong> pages visited, actions taken, timestamps</li>
            <li><strong>Device data:</strong> browser type, operating system, IP address (for rate limiting and abuse prevention)</li>
          </ul>

          <h3 className="text-lg font-medium text-white mt-4">2.3. Blockchain Data</h3>
          <p>When you connect your TON wallet via TonConnect, we receive your public wallet address. We do NOT receive or have access to your private keys, seed phrases, or wallet passwords. Transaction hashes (tx_hash) are recorded for purchase verification.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. What We Do NOT Collect or Store</h2>
          <p className="font-medium text-white">The Company explicitly does not collect or store:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Passwords (authentication is passwordless via OTP or OAuth)</li>
            <li>Wallet private keys, seed phrases, or mnemonic phrases</li>
            <li>Fiat currency or cryptocurrency funds</li>
            <li>Bank account numbers, credit card details, or payment card data</li>
            <li>Social Security numbers or government-issued ID numbers</li>
            <li>Biometric data</li>
          </ul>
          <p><strong>The Platform does not hold, custody, or transmit any funds.</strong> All monetary transactions occur directly on the TON blockchain between participant wallets.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Providing and maintaining the Platform and your account</li>
            <li>Authenticating your identity via Appwrite Account services</li>
            <li>Verifying on-chain transaction hashes to confirm purchases</li>
            <li>Moderating published products (security scanning, content review)</li>
            <li>Communicating order confirmations, disputes, and support responses</li>
            <li>Detecting and preventing fraud, abuse, and Terms violations</li>
            <li>Enforcing rate limits and security protections</li>
            <li>Complying with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Data Sharing &amp; Third Parties</h2>
          <p>We do not sell, rent, or trade your personal information. We share data only with:</p>
          <table className="w-full text-sm border border-white/10 mt-2">
            <thead>
              <tr className="border-b border-white/10 text-white">
                <th className="text-left p-2">Provider</th>
                <th className="text-left p-2">Purpose</th>
                <th className="text-left p-2">Data Shared</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-white/5"><td className="p-2">Appwrite</td><td className="p-2">Authentication &amp; database</td><td className="p-2">Email, profile, session tokens</td></tr>
              <tr className="border-b border-white/5"><td className="p-2">Cloudflare (R2)</td><td className="p-2">File storage &amp; CDN</td><td className="p-2">Uploaded files (builds, images)</td></tr>
              <tr className="border-b border-white/5"><td className="p-2">VirusTotal</td><td className="p-2">Security scanning</td><td className="p-2">Uploaded build files (hashes)</td></tr>
              <tr className="border-b border-white/5"><td className="p-2">Resend</td><td className="p-2">Email delivery</td><td className="p-2">Email address, message content</td></tr>
              <tr className="border-b border-white/5"><td className="p-2">TON Blockchain</td><td className="p-2">Payment settlement</td><td className="p-2">Public wallet address, tx hashes</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Law Enforcement Disclosure &amp; Stored Communications Act</h2>
          <p><strong>Stored Communications Act (18 U.S.C. &sect;&sect; 2701-2713).</strong> The Company complies with the Stored Communications Act. We do not voluntarily disclose the content of User communications except as permitted under 18 U.S.C. &sect; 2702.</p>
          <p><strong>Disclosure to law enforcement:</strong> The Company will disclose User data to law enforcement only in response to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>A valid search warrant issued by a court of competent jurisdiction</li>
            <li>A court order under 18 U.S.C. &sect; 2703(d)</li>
            <li>A lawful subpoena (for non-content records only)</li>
            <li>An emergency disclosure request where there is a good faith belief that an emergency involving danger of death or serious physical injury requires disclosure without delay (18 U.S.C. &sect; 2702(b)(8))</li>
          </ul>
          <p><strong>User notification:</strong> Unless prohibited by a court order or gag provision under 18 U.S.C. &sect; 2705, the Company will notify the affected User of any law enforcement request within seventy-two (72) hours of receipt.</p>
          <p><strong>National Security Letters (NSLs):</strong> If the Company receives an NSL, disclosure is limited to metadata (subscriber name, address, session times) as authorized under 18 U.S.C. &sect; 2709. Content data requires a warrant.</p>
          <p><strong>Transparency:</strong> The Company intends to publish an annual transparency report disclosing the aggregate number of law enforcement requests received, complied with, and challenged.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Blockchain Data (Public &amp; Immutable)</h2>
          <p>TON blockchain transactions are <strong>public and immutable</strong>. Transaction hashes, wallet addresses, and payment amounts associated with your purchases are permanently recorded on the blockchain and visible to anyone. The Company cannot delete, modify, or redact on-chain data.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Cookies &amp; Local Storage</h2>
          <p>The Platform uses essential cookies and localStorage for:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Authentication session management (Appwrite session cookies)</li>
            <li>User preferences (theme, network selection)</li>
            <li>CSRF protection tokens</li>
          </ul>
          <p>We do <strong>not</strong> use third-party tracking cookies, advertising pixels, or analytics services that track individual users across websites. No data is sold to advertisers.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">9. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> retained while your account is active; deleted upon request within 30 days</li>
            <li><strong>Transaction records:</strong> retained for 7 years for legal compliance and audit purposes</li>
            <li><strong>Security scan logs:</strong> retained for 1 year</li>
            <li><strong>Server logs (IP, request metadata):</strong> retained for 90 days</li>
            <li><strong>Blockchain data:</strong> permanent and immutable (outside our control)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">10. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access</strong> your personal data</li>
            <li><strong>Correct</strong> inaccurate data</li>
            <li><strong>Delete</strong> your account and associated data (&quot;right to erasure&quot;)</li>
            <li><strong>Export</strong> your data in a portable format</li>
            <li><strong>Object</strong> to certain processing activities</li>
            <li><strong>Opt out</strong> of non-essential communications</li>
          </ul>
          <p>To exercise these rights, contact <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a>. We will respond within 30 days. Note that we cannot modify or delete data recorded on the TON blockchain.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">11. Children&apos;s Privacy (COPPA)</h2>
          <p>The Platform is not directed at children under the age of 18. We do not knowingly collect personal information from minors. In compliance with the Children&apos;s Online Privacy Protection Act (15 U.S.C. &sect;&sect; 6501-6506, as amended April 2025), if we learn that we have collected data from a child under 13, we will delete it promptly. If you believe a child has provided us personal information, contact <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a>.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">12. California Privacy Rights (CCPA/CPRA)</h2>
          <p>If you are a California resident, you have the right under the California Consumer Privacy Act (Cal. Civ. Code &sect;&sect; 1798.100-1798.199) to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Know</strong> what personal information is collected, used, disclosed, and sold</li>
            <li><strong>Delete</strong> personal information held by the Company</li>
            <li><strong>Opt out</strong> of the sale or sharing of personal information</li>
            <li><strong>Correct</strong> inaccurate personal information</li>
            <li><strong>Limit</strong> use and disclosure of sensitive personal information</li>
            <li><strong>Non-discrimination</strong> for exercising any CCPA rights</li>
          </ul>
          <p><strong>We do not sell or share personal information</strong> as defined by the CCPA/CPRA. To exercise your rights, contact {C}. We will respond within 45 days.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">13. Email Communications (CAN-SPAM)</h2>
          <p>In compliance with the CAN-SPAM Act (15 U.S.C. &sect;&sect; 7701-7713), all commercial emails sent by the Company:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Contain accurate header information and non-deceptive subject lines</li>
            <li>Are identified as advertisements where applicable</li>
            <li>Include the Company&apos;s physical mailing address</li>
            <li>Provide a clear and conspicuous unsubscribe mechanism</li>
            <li>Honor opt-out requests within 10 business days</li>
          </ul>
          <p>Transactional emails (order confirmations, security alerts, dispute updates) are exempt from CAN-SPAM opt-out requirements as they relate to an existing business relationship.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">14. International Transfers</h2>
          <p>Your data may be processed in the United States, the European Union, and other jurisdictions where our service providers operate. By using the Platform, you consent to the transfer of your data to these jurisdictions.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">15. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Material changes will be communicated via the Platform or email with at least seven (7) days&apos; advance notice. Continued use of the Platform constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">16. Contact</h2>
          <p>{E}<br />State of {ST}, United States<br />Privacy inquiries: <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a></p>
        </section>
      </div>
    </div>
  );
}
