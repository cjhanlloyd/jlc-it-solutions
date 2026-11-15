// /about: company profile (mission, vision, commitments) with links on to services and contact.
import AboutSection from '../components/AboutSection';
import { NavLink, navTo } from './NavLink';
import type { BrandingSettings, ContentSettings, RoadmapStep } from '../types';

const btn = 'inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

export default function AboutPage({ content, branding, roadmapSteps }: { content: ContentSettings; branding: BrandingSettings; roadmapSteps: RoadmapStep[] }) {
  return (
    <div className="bg-ivory font-sans text-ink select-text">
      <AboutSection content={content} branding={branding} onExploreServices={() => navTo('/services')} roadmapSteps={roadmapSteps} />
      <section className="px-4 py-16 text-center sm:py-20">
        <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <NavLink href="/services" className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}>Our services</NavLink>
          <NavLink href="/contact" className={`${btn} border border-gold text-ink hover:bg-sand`}>Contact us</NavLink>
        </div>
      </section>
    </div>
  );
}
