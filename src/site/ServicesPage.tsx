// /services: the IT services pages: services, process, pricing, why us, gallery, FAQ and a quote call to action.
import { ArrowRight } from 'lucide-react';
import ServicesSection from '../components/ServicesSection';
import ProcessTimeline from '../components/ProcessTimeline';
import PricingSection from '../components/PricingSection';
import WhyChooseUs from '../components/WhyChooseUs';
import ProjectGallery from '../components/ProjectGallery';
import FaqAccordion from '../components/FaqAccordion';
import { NavLink } from './NavLink';
import type { BrandingSettings, ContentSettings, FaqItem, ProcessStep, ProjectGalleryItem, Service } from '../types';

export interface ServicesPageProps {
  branding: BrandingSettings;
  content: ContentSettings;
  services: Service[];
  faqs: FaqItem[];
  processSteps: ProcessStep[];
  projectGallery: ProjectGalleryItem[];
  onInquireService: (title: string) => void;
  onInquireClick: () => void;
}

export default function ServicesPage(p: ServicesPageProps) {
  return (
    <div className="bg-ivory font-sans text-ink select-text">
      <header className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Other services</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight text-ink sm:text-6xl">IT services and software</h1>
        <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
        <p className="mt-6 text-lg leading-relaxed text-ink/80">Alongside our invitations, we build and support technology for small teams and growing businesses.</p>
      </header>
      <ServicesSection services={p.services} branding={p.branding} content={p.content} onInquireService={p.onInquireService} />
      <ProcessTimeline processSteps={p.processSteps} branding={p.branding} content={p.content} />
      <div id="pricing">
        <PricingSection branding={p.branding} content={p.content} onInquire={p.onInquireService} onContactClick={p.onInquireClick} />
      </div>
      <div id="why">
        <WhyChooseUs content={p.content} branding={p.branding} onInquireClick={p.onInquireClick} />
      </div>
      {p.projectGallery.length > 0 && <ProjectGallery projectGallery={p.projectGallery} branding={p.branding} content={p.content} />}
      {p.faqs.length > 0 && <FaqAccordion faqs={p.faqs} branding={p.branding} content={p.content} />}
      <section className="bg-sand px-4 py-16 text-center sm:py-20" aria-labelledby="quote-title">
        <h2 id="quote-title" className="font-serif text-4xl font-semibold text-ink sm:text-5xl">Have a project in mind?</h2>
        <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
        <NavLink href="/contact" className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-7 py-3.5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Request a quote <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </NavLink>
      </section>
    </div>
  );
}
