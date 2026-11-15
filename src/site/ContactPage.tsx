// /contact: contact details and the inquiry form. A preselected service starts the form at its second step.
import ContactSection from '../components/ContactSection';
import InquiryForm from '../components/InquiryForm';
import type { BrandingSettings, ContentSettings, Service } from '../types';

export interface ContactPageProps {
  branding: BrandingSettings;
  content: ContentSettings;
  services: Service[];
  preselectedService: string;
  onInquireClick: () => void;
  onSuccessSubmit: () => void;
}

export default function ContactPage(p: ContactPageProps) {
  return (
    <div className="bg-ivory font-sans text-ink select-text">
      <ContactSection content={p.content} branding={p.branding} onInquireClick={p.onInquireClick} />
      <div id="inquiry">
        <InquiryForm services={p.services} branding={p.branding} content={p.content} preselectedService={p.preselectedService} onSuccessSubmit={p.onSuccessSubmit} />
      </div>
    </div>
  );
}
