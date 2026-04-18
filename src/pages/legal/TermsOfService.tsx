import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const E = 'TonForge LLC';
const ST = 'Delaware';
const D = 'tonforge.org';
const C = `legal@${D}`;
const FEE = '2.5%';

export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-gray-500 text-sm mb-4">Effective: April 18, 2026 · Last updated: April 18, 2026</p>

      <div className="mb-8 rounded-xl border border-[#FFD700]/25 bg-gradient-to-r from-[#FFD700]/[0.06] to-transparent p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#FFD700] mb-2">
          Binding Legal Agreement
        </h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">
          This document is a <strong className="text-white">legally binding contract</strong> (User Agreement)
          between you and {E}, a {ST} limited liability company. Under United States law,
          your use of the Platform constitutes acceptance of all terms below.
        </p>
        <p className="text-sm text-gray-300 leading-relaxed">
          This agreement also incorporates our{' '}
          <Link to="/privacy" className="text-[#8B5CF6] hover:underline">Privacy Policy</Link> and{' '}
          <Link to="/refund-policy" className="text-[#00FF88] hover:underline">Refund &amp; DMCA Policy</Link>.
          If you do not agree to any part of these terms, <strong className="text-white">you must not use the Platform</strong>.
        </p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">

        <section>
          <h2 className="text-xl font-semibold text-white">1. Parties &amp; Acceptance</h2>
          <p>These Terms of Service (&quot;Terms&quot;, &quot;Agreement&quot;, &quot;User Agreement&quot;) constitute a legally binding agreement between you (&quot;User&quot;, &quot;you&quot;, &quot;Buyer&quot;, &quot;Seller&quot;, &quot;Publisher&quot;) and <strong>{E}</strong>, a limited liability company organized under the laws of the State of {ST}, United States (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, &quot;Platform Operator&quot;), operating the digital marketplace at <a href={`https://${D}`} className="text-[#00F5FF] hover:underline">{D}</a> (&quot;Platform&quot;).</p>
          <p>By accessing, browsing, registering on, or using the Platform in any manner, you acknowledge that you have read, understood, and agree to be bound by these Terms, our <Link to="/privacy" className="text-[#8B5CF6] hover:underline">Privacy Policy</Link>, and our <Link to="/refund-policy" className="text-[#00FF88] hover:underline">Refund &amp; DMCA Policy</Link>. If you do not agree, you must immediately cease all use of the Platform.</p>
          <p><strong>Electronic agreement.</strong> In accordance with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. &sect;&sect; 7001-7031), your electronic acceptance of these Terms has the same legal force and effect as a handwritten signature on a paper contract. Your continued use of the Platform after posting of updated Terms constitutes your electronic acceptance of the modified Agreement.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Nature of the Platform; No Fiduciary Duty</h2>
          <p>The Platform is a <strong>hybrid marketplace</strong> for digital goods — applications, games, AI tools, and developer utilities. &quot;Hybrid&quot; means we combine Web2 user experience (email authentication, familiar UI) with Web3 settlement rails (TON blockchain payments).</p>
          <p><strong>The Company is not a financial institution, money transmitter, bank, custodian, escrow agent, broker, dealer, investment adviser, payment processor, or money services business.</strong> The Company does not hold, store, transmit, or custody User funds at any time. All payments are processed directly on the TON blockchain between buyer and seller wallets. The Company&apos;s sole role in payment flow is to verify on-chain transaction hashes and record purchase confirmations.</p>
          <p><strong>The Company is not a party to any transaction between Buyer and Seller.</strong> All transactions are conducted directly between the Seller and the Buyer. The parties to the transaction — not the Company — are responsible for the subject matter, legality, and compliance of each transaction. The Company provides only a technical interface (software solutions and API) that enables the placement of product listings and automates the exchange of information between Seller and Buyer.</p>
          <p><strong>No Fiduciary Duty.</strong> These Terms are not intended to, and do not, create or impose any fiduciary duties on the Company. To the fullest extent permitted by law, you acknowledge and agree that the Company owes no fiduciary duties or liabilities to you or any other party, and that to the extent any such duties or liabilities may exist at law or in equity, those duties and liabilities are hereby irrevocably disclaimed, waived, and eliminated.</p>
          <p>The Company earns revenue by collecting a platform commission of {FEE} on completed transactions, deducted at the smart-contract level before settlement to the seller.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Eligibility; Sanctions &amp; Export Control</h2>
          <p>You must be at least 18 years of age (or the age of majority in your jurisdiction) to use the Platform. By creating an account, you represent and warrant that you meet this requirement.</p>
          <p><strong>OFAC &amp; Sanctions Compliance.</strong> By using the Platform, you represent and warrant that:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>You are not located in, organized in, or a resident of any country or territory subject to comprehensive U.S. sanctions, including but not limited to: Cuba, Iran, North Korea, Syria, and the Crimea, Donetsk, and Luhansk regions.</li>
            <li>You are not listed on, or owned or controlled by a person listed on, the U.S. Treasury Department&apos;s Specially Designated Nationals and Blocked Persons List (SDN List), Foreign Sanctions Evaders List, or Sectoral Sanctions Identifications List.</li>
            <li>You are not subject to sanctions administered by the European Union, United Nations Security Council, or Her Majesty&apos;s Treasury (UK).</li>
            <li>You will not use the Platform to transact with any person or entity in violation of any applicable sanctions or export control laws.</li>
          </ul>
          <p><strong>Export Control.</strong> You agree not to export, re-export, or transfer any software, data, or technical information obtained through the Platform in violation of the Export Administration Regulations (EAR, 15 CFR Parts 730-774) or any other applicable export control laws.</p>
          <p>The Company reserves the right to restrict access from any jurisdiction at its sole discretion and without prior notice.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. User Accounts &amp; Authentication</h2>
          <p>Authentication is provided through Appwrite Account services. Supported methods: email one-time password (OTP) and GitHub OAuth. No passwords are created or stored by the Platform. Wallet connection via TonConnect is required only for purchase transactions.</p>
          <p>You are solely responsible for maintaining the security of your authentication credentials and wallet private keys. The Company is not liable for unauthorized access resulting from your failure to secure these credentials.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Publishers (Sellers)</h2>
          <p>Both human developers and AI agents may publish digital products on the Platform under identical terms. Origin of the publisher (human or artificial) does not confer any privilege or exemption (&quot;parity principle&quot;).</p>
          <p>All published products must:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pass automated security scanning (VirusTotal multi-engine analysis)</li>
            <li>Pass content moderation review</li>
            <li>Comply with all applicable laws and these Terms</li>
            <li>Not contain malware, spyware, or undisclosed data collection mechanisms</li>
            <li>Not infringe third-party intellectual property rights</li>
          </ul>
          <p>The Company reserves the right to remove any product and suspend any publisher account at its sole discretion, with or without prior notice.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Payments &amp; On-Chain Settlement</h2>
          <p>All payments are denominated and settled in TON (Toncoin) on the TON blockchain. Transactions are peer-to-peer between the buyer&apos;s wallet and the designated treasury/seller contract. The Company:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Does NOT</strong> receive, hold, pool, or transmit User funds</li>
            <li><strong>Does NOT</strong> act as an escrow agent or payment processor</li>
            <li><strong>Does NOT</strong> have access to or control over User wallet private keys</li>
            <li>Verifies on-chain transaction hashes (tx_hash) to confirm payment completion</li>
            <li>Records purchase confirmations in its database for order fulfillment</li>
          </ul>
          <p>A platform commission of {FEE} is deducted at the contract level. The remaining amount is settled directly to the seller. Blockchain transaction fees (gas) are borne by the party initiating the transaction.</p>
          <p><strong>Irreversibility:</strong> Blockchain transactions are final and irreversible. The Company cannot reverse, cancel, or modify any on-chain transaction.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Disputes &amp; Dispute Window</h2>
          <p>Buyers may open a dispute within twenty-four (24) hours after payment confirmation (&quot;Dispute Window&quot;). Disputes must be submitted through the Platform&apos;s dispute mechanism on the Orders page.</p>
          <p>The Company will review disputes and issue a non-binding recommendation. Because transactions occur on-chain, the Company&apos;s ability to enforce refunds depends entirely on the smart-contract terms governing the specific transaction. The Company is not liable for losses arising from the inherent limitations of blockchain settlement.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Prohibited Conduct</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Uploading malware, ransomware, or malicious code</li>
            <li>Listing stolen, counterfeit, or unauthorized intellectual property</li>
            <li>Circumventing security scans or moderation processes</li>
            <li>Using the Platform for money laundering, terrorist financing, or sanctions evasion</li>
            <li>Creating multiple accounts to evade bans or abuse promotions</li>
            <li>Automated scraping, crawling, or data extraction in violation of these Terms</li>
            <li>Denial-of-service attacks, exploitation of vulnerabilities, or reverse engineering</li>
            <li>Accessing or attempting to access the Platform&apos;s systems, servers, or networks without authorization, in violation of the Computer Fraud and Abuse Act (18 U.S.C. &sect; 1030)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">9. Assumption of Risk</h2>
          <p>BY USING THE PLATFORM, YOU EXPRESSLY ACKNOWLEDGE AND ASSUME ALL RISKS ASSOCIATED WITH:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Cryptocurrency volatility:</strong> the value of TON and other digital assets may fluctuate significantly and may decrease to zero</li>
            <li><strong>Smart contract risk:</strong> smart contracts may contain bugs, vulnerabilities, or be subject to exploits</li>
            <li><strong>Blockchain risk:</strong> network congestion, hard/soft forks, protocol changes, outages, or 51% attacks may disrupt transactions</li>
            <li><strong>Loss of access:</strong> loss of wallet private keys, seed phrases, or authentication credentials is permanent and irreversible; the Company cannot recover lost access</li>
            <li><strong>Regulatory risk:</strong> changes in laws or regulations in any jurisdiction may adversely affect the use, transfer, or value of digital assets</li>
            <li><strong>Third-party product risk:</strong> digital products are created and published by third-party publishers; the Company does not guarantee their quality, functionality, safety, or legality</li>
            <li><strong>Tax liability:</strong> you are solely responsible for determining and paying any taxes applicable to your cryptocurrency transactions</li>
            <li><strong>Irreversibility:</strong> blockchain transactions cannot be reversed; funds sent to incorrect addresses are permanently lost</li>
          </ul>
          <p>You agree that the Company is not responsible for any of the foregoing risks, and you voluntarily assume and accept such risks.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">10. Intellectual Property</h2>
          <p>The Platform name, logo, UI design, and documentation are the intellectual property of {E}. Publishers retain all rights to their published content. By publishing on the Platform, publishers grant the Company a non-exclusive, worldwide, royalty-free license to display, distribute, and promote the product listing on the Platform.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">11. Federal Platform Immunity</h2>
          <p><strong>Section 230 of the Communications Decency Act (47 U.S.C. &sect; 230).</strong> The Platform is an &quot;interactive computer service&quot; as defined under Section 230 of the CDA. The Company is not the publisher or speaker of any content created, uploaded, or listed by Users or Publishers. The Company shall not be treated as the publisher or speaker of any information provided by third parties through the Platform. The Company&apos;s moderation activities (including security scanning, content review, and product removal) do not waive Section 230 immunity.</p>
          <p><strong>DMCA Safe Harbor (17 U.S.C. &sect; 512).</strong> The Company qualifies as a &quot;service provider&quot; under the Digital Millennium Copyright Act and maintains a designated agent for copyright takedown notices. The Company&apos;s DMCA procedures are described in our <Link to="/refund-policy" className="text-[#8B5CF6] hover:underline">Refund &amp; DMCA Policy</Link>.</p>
          <p><strong>Computer Fraud and Abuse Act (18 U.S.C. &sect; 1030).</strong> Unauthorized access to the Platform&apos;s systems, automated scraping in violation of these Terms, denial-of-service attacks, and exploitation of Platform vulnerabilities constitute violations of the CFAA. The Company reserves all rights to pursue civil and criminal remedies for such violations.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">12. Regulatory Compliance</h2>
          <p><strong>SEC.</strong> The Platform operates as a non-custodial user interface consistent with the SEC Division of Trading and Markets Staff Statement dated April 13, 2026. The Platform: (a) does not custody User assets; (b) does not solicit or recommend specific transactions; (c) charges an objective, product-agnostic fee of {FEE}; (d) permits Users to initiate and customize their own transactions. Nothing on the Platform constitutes investment advice, a solicitation, or a recommendation to buy or sell any digital asset.</p>
          <p><strong>FinCEN.</strong> The Company does not meet the definition of &quot;money transmitter&quot; under 31 CFR &sect; 1010.100(ff)(5) because it does not accept and transmit currency, funds, or other value that substitutes for currency. All value transfers occur directly between User wallets on the TON blockchain without passing through Company-controlled accounts.</p>
          <p><strong>EFTA / Regulation E.</strong> The Company does not maintain consumer accounts, does not hold consumer funds, and does not facilitate &quot;electronic fund transfers&quot; as defined under the Electronic Fund Transfer Act (15 U.S.C. &sect; 1693). Accordingly, Regulation E (12 CFR Part 1005) obligations do not apply to the Company&apos;s operations. This position will be reassessed if regulatory guidance changes.</p>
          <p><strong>Digital Asset Classification.</strong> Under the framework proposed by the Financial Innovation and Technology for the 21st Century Act (FIT21), TON — as a token native to a functional, decentralized blockchain — would likely be classified as a &quot;digital commodity&quot; subject to CFTC jurisdiction. The Platform facilitates the sale of digital goods for digital commodities; it does not facilitate securities trading.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">13. Disclaimer of Warranties</h2>
          <p>THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, TITLE, OR AVAILABILITY.</p>
          <p>The Company does not warrant that: (a) the Platform will be uninterrupted or error-free; (b) products listed by third-party publishers will meet your expectations; (c) blockchain networks will operate without disruption; (d) digital assets will maintain their value; (e) security scans will detect all threats.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">14. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, {E.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR DIGITAL ASSETS, WHETHER IN AN ACTION OF CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE, ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM.</p>
          <p>The Company&apos;s total aggregate liability for all claims arising from or related to these Terms shall not exceed the total platform commissions paid by you to the Company in the twelve (12) months preceding the claim, or one hundred U.S. dollars (US $100), whichever is greater.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">15. Indemnification</h2>
          <p>You agree to indemnify, defend, and hold harmless {E}, its officers, directors, employees, agents, affiliates, successors, and assigns from any claims, damages, losses, liabilities, costs, or expenses (including reasonable attorneys&apos; fees) arising from: (a) your use of the Platform; (b) your violation of these Terms; (c) your infringement of any third-party rights; (d) your violation of any applicable law or regulation; (e) content you publish on the Platform.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">16. Force Majeure</h2>
          <p>The Company shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including but not limited to: acts of God, natural disasters, pandemics, war, terrorism, riots, embargoes, acts of governmental authorities, blockchain network outages or congestion, protocol forks, smart contract failures, distributed denial-of-service (DDoS) attacks, power or telecommunications failures, failures of third-party service providers (including but not limited to Appwrite, Cloudflare, VirusTotal, and Resend), changes in applicable law or regulation, and sanctions or trade restrictions.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">17. Governing Law &amp; Jurisdiction</h2>
          <p>These Terms shall be governed by and construed in accordance with the laws of the State of {ST}, United States, without regard to its conflict-of-law principles. Any dispute arising under these Terms shall be resolved exclusively in the state or federal courts located in {ST}, and you consent to the personal jurisdiction of such courts.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">18. Arbitration Agreement</h2>
          <p>Any dispute, claim, or controversy arising out of or relating to these Terms or the breach, termination, enforcement, interpretation, or validity thereof (&quot;Disputes&quot;) shall be finally settled by binding arbitration administered under the rules of the American Arbitration Association (AAA), conducted in English, with the seat of arbitration in Wilmington, {ST}. This agreement to arbitrate is governed by the Federal Arbitration Act (9 U.S.C. &sect;&sect; 1-16) and shall survive termination of these Terms. The arbitrator&apos;s award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.</p>
          <p><strong>CLASS ACTION WAIVER:</strong> You agree to resolve Disputes on an individual basis and waive any right to participate in a class, collective, consolidated, or representative action or proceeding.</p>
          <p><strong>OPT-OUT RIGHT:</strong> You may opt out of this arbitration agreement by sending written notice to <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a> within thirty (30) days of first accepting these Terms. The notice must include your name, email address, and a clear statement that you wish to opt out of the arbitration agreement. If you opt out, all Disputes will be resolved in the courts specified in Section 17.</p>
          <p><strong>SMALL CLAIMS EXCEPTION:</strong> Notwithstanding the above, either party may bring an individual action in small claims court for Disputes within the jurisdictional limits of such court (generally up to US $10,000).</p>
          <p><strong>30-DAY DISPUTE RESOLUTION PERIOD:</strong> Before initiating arbitration, you must first send a written description of the Dispute to <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a>. The parties shall attempt to resolve the Dispute informally for thirty (30) days. If unresolved, either party may commence arbitration.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">19. Severability</h2>
          <p>If any provision of these Terms is held to be unenforceable or invalid by a court of competent jurisdiction, that provision shall be enforced to the maximum extent permissible, and the remaining provisions shall continue in full force and effect.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">20. Entire Agreement</h2>
          <p>These Terms, together with the <Link to="/privacy" className="text-[#8B5CF6] hover:underline">Privacy Policy</Link> and <Link to="/refund-policy" className="text-[#8B5CF6] hover:underline">Refund &amp; DMCA Policy</Link>, constitute the entire agreement between you and the Company regarding the Platform and supersede all prior agreements and understandings.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">21. Modifications</h2>
          <p>The Company reserves the right to modify these Terms at any time. Material changes will be communicated via the Platform or email with at least seven (7) days&apos; advance notice. Continued use of the Platform after the effective date of modified Terms constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">22. Contact</h2>
          <p>{E}<br />State of {ST}, United States<br />Email: <a href={`mailto:${C}`} className="text-[#00F5FF] hover:underline">{C}</a></p>
        </section>
      </div>
    </div>
  );
}
