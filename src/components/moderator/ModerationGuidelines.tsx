import type { FC } from 'react';
import { BookOpen, CheckCircle, AlertTriangle, Shield, MessageCircle } from 'lucide-react';

const Section: FC<{ title: string; icon: FC<{ className?: string }>; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl border border-[#8B5CF6]/15 bg-[#0D0D1A] p-5 mb-4">
    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
      <Icon className="w-5 h-5 mr-2 text-[#8B5CF6]" />
      {title}
    </h3>
    {children}
  </div>
);

const Li: FC<{ children: React.ReactNode; ok?: boolean }> = ({ children, ok = true }) => (
  <li className="flex items-start gap-2 text-sm text-[#999999] mb-1.5">
    {ok ? (
      <CheckCircle className="w-4 h-4 text-[#00FF88] shrink-0 mt-0.5" />
    ) : (
      <AlertTriangle className="w-4 h-4 text-[#FF4444] shrink-0 mt-0.5" />
    )}
    <span>{children}</span>
  </li>
);

const ModerationGuidelines: FC = () => (
  <div>
    <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-6 flex items-center">
      <BookOpen className="w-6 h-6 mr-3 text-[#8B5CF6]" />
      Moderation Guidelines
    </h2>

    <Section title="Product Review Checklist" icon={CheckCircle}>
      <ul className="space-y-1">
        <Li>Title accurately describes the product</Li>
        <Li>Description is informative, not misleading or clickbait</Li>
        <Li>Category is correctly selected</Li>
        <Li>Price is reasonable for the product type</Li>
        <Li>Images correspond to the actual product</Li>
        <Li>No signs of plagiarism or copyright violation</Li>
        <Li>No malicious code indicators (manual check; VirusTotal in future)</Li>
        <Li>Version field is properly filled</Li>
      </ul>
    </Section>

    <Section title="Prohibited Content" icon={AlertTriangle}>
      <ul className="space-y-1">
        <Li ok={false}>Malware, spyware, or any harmful software</Li>
        <Li ok={false}>Stolen content or unauthorized copies</Li>
        <Li ok={false}>Copyright-infringing material</Li>
        <Li ok={false}>NSFW content without proper labeling</Li>
        <Li ok={false}>Spam, clickbait, or deceptive listings</Li>
        <Li ok={false}>Products promoting illegal activities</Li>
        <Li ok={false}>Empty or placeholder products (no real deliverable)</Li>
        <Li ok={false}>Third-party watermarks on images</Li>
      </ul>
    </Section>

    <Section title="Status Transition Rules" icon={Shield}>
      <div className="text-sm text-[#999999] space-y-2">
        <p><span className="text-[#FFD700] font-mono">pending_review</span> &rarr; <span className="text-[#00FF88] font-mono">published</span> &mdash; Product meets all checklist criteria</p>
        <p><span className="text-[#FFD700] font-mono">pending_review</span> &rarr; <span className="text-[#FF4444] font-mono">rejected</span> &mdash; Product fails one or more criteria. Always provide a reason.</p>
        <p><span className="text-[#FFD700] font-mono">pending_review</span> &rarr; <span className="text-yellow-400 font-mono">suspended</span> &mdash; Suspicious content requiring deeper investigation</p>
        <p><span className="text-[#00FF88] font-mono">published</span> &rarr; <span className="text-yellow-400 font-mono">suspended</span> &mdash; Post-publish violation reported</p>
        <p><span className="text-yellow-400 font-mono">suspended</span> &rarr; <span className="text-[#00FF88] font-mono">published</span> &mdash; Investigation complete, content is clean</p>
      </div>
    </Section>

    <Section title="Support Ticket Ethics" icon={MessageCircle}>
      <ul className="space-y-1">
        <Li>Respond within 24 hours</Li>
        <Li>Be polite, professional, and concise</Li>
        <Li>Never disclose personal data of other users</Li>
        <Li>Escalate complex cases to admin (change priority to urgent)</Li>
        <Li>Always explain the reason for any action taken</Li>
        <Li>If unsure about a decision, mark ticket as in_progress and consult</Li>
        <Li ok={false}>Do not take sides in user conflicts without investigation</Li>
        <Li ok={false}>Do not promise outcomes you cannot guarantee</Li>
      </ul>
    </Section>

    <Section title="Future: Automated Scanning" icon={Shield}>
      <p className="text-sm text-[#999999]">
        VirusTotal integration is planned for automated malware scanning of uploaded files.
        Until then, moderators should manually verify file integrity and check for known
        malware signatures. Flag suspicious files with <span className="text-yellow-400 font-mono">suspended</span> status
        and note your findings in the rejection reason.
      </p>
    </Section>
  </div>
);

export default ModerationGuidelines;
