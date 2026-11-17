/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  DEFAULT_SERVICES,
  DEFAULT_BRANDING,
  DEFAULT_CONTENT,
  DEFAULT_FAQS,
  DEFAULT_PROCESS_STEPS,
  DEFAULT_ROADMAP_STEPS,
  DEFAULT_PROJECT_GALLERY,
  BrandingSettings,
  ContentSettings,
  Service,
  FaqItem,
  ProcessStep,
  RoadmapStep,
  ProjectGalleryItem
} from './types.js';

import Navbar from './components/Navbar.tsx';
import Footer from './components/Footer.tsx';
import DesignsPage from './site/DesignsPage.tsx';
import ServicesPage from './site/ServicesPage';
import AboutPage from './site/AboutPage';
import ContactPage from './site/ContactPage';
import SiteBanner from './site/SiteBanner.tsx';
import SiteLoader from './site/SiteLoader.tsx';
import HomePage from './site/HomePage.tsx';
import DesignPage from './site/DesignPage.tsx';
import CustomiserPage from './invitations/CustomiserPage.tsx';
import OrderPage from './invitations/OrderPage.tsx';
import TrackPage from './invitations/TrackPage.tsx';
import ManagePage from './invitations/ManagePage.tsx';
import PolicyPage from './invitations/PolicyPage.tsx';
import { go, Link } from './invitations/kit.tsx';
import { routeFor, PAGE_META, withSearch, type Route } from './site/routes.ts';

// The route of the current URL; legacy URLs are replaced in history (not pushed) so Back doesn't bounce to them.
function currentRoute(): Route {
  for (let i = 0; i < 3; i++) {
    const r = routeFor(window.location.pathname, window.location.hash);
    if ('route' in r) return r.route;
    window.history.replaceState(null, '', withSearch(r.redirect, window.location.search));
  }
  return { page: 'notFound' };
}

function readLocation() {
  const route = currentRoute();
  // Only plain anchors (#pricing) scroll;
  return { route, path: window.location.pathname, anchor: /^#[\w-]+$/.test(window.location.hash) ? window.location.hash.slice(1) : '' };
}

export default function App() {
  const [loc, setLoc] = React.useState(readLocation);
  const route = loc.route;
  const [services, setServices] = React.useState<Service[]>(DEFAULT_SERVICES);
  const [branding, setBranding] = React.useState<BrandingSettings>(() => {
    try {
      const cached = localStorage.getItem('jlc_branding_cache');
      return cached ? JSON.parse(cached) : DEFAULT_BRANDING;
    } catch (e) {
      return DEFAULT_BRANDING;
    }
  });
  const [content, setContent] = React.useState<ContentSettings>(DEFAULT_CONTENT);
  const [faqs, setFaqs] = React.useState<FaqItem[]>(DEFAULT_FAQS);
  const [processSteps, setProcessSteps] = React.useState<ProcessStep[]>(DEFAULT_PROCESS_STEPS);
  const [roadmapSteps, setRoadmapSteps] = React.useState<RoadmapStep[]>(DEFAULT_ROADMAP_STEPS);
  const [projectGallery, setProjectGallery] = React.useState<ProjectGalleryItem[]>(DEFAULT_PROJECT_GALLERY);

  // Public data loading
  const [isDataLoading, setIsDataLoading] = React.useState(true);


  // Inquiry preselected service hook
  const [preselectedService, setPreselectedService] = React.useState('');

  // Follow the URL on load, Back/Forward, go() and hash changes.
  React.useEffect(() => {
    const sync = () => {
      const hashRoute = window.location.hash.split('?')[0].replace(/^#\/?/, '');
      setLoc(readLocation());
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    sync();
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  // Scroll to the #anchor once the page has rendered, else to the top on a route change
  React.useEffect(() => {
    const target = loc.anchor && document.getElementById(loc.anchor);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [loc.path, loc.anchor, isDataLoading]);

  // Fallback per page kind only (not per slug): design pages set their own title once loaded and must not be overwritten.
  React.useEffect(() => {
    const meta = PAGE_META[route.page];
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  }, [route.page]);

  // Fetch corporate public data on mount
  const loadPublicData = async () => {
    try {
      const response = await fetch('/api/public-data');
      if (response.ok) {
        const data = await response.json();
        if (data.services) setServices(data.services);
        if (data.branding) {
          setBranding(data.branding);
          localStorage.setItem('jlc_branding_cache', JSON.stringify(data.branding));
        }
        if (data.content) setContent(data.content);
        if (data.faqs) setFaqs(data.faqs);
        if (data.processSteps) setProcessSteps(data.processSteps);
        if (data.roadmapSteps) setRoadmapSteps(data.roadmapSteps);
        if (data.projectGallery) setProjectGallery(data.projectGallery);
      }
    } catch (err) {
      console.error("Failed to load public settings from server, using default static presets.", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  React.useEffect(() => {
    loadPublicData();
  }, []);

  // Favicon follows the branding settings
  React.useEffect(() => {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    if (branding.logoType === 'image' && branding.logoImageBase64) {
      // Use the public server route for favicon instead of base64 data URI to comply with search engines
      link.href = `/favicon.ico?v=${branding.logoImageBase64.length}`;
    } else {
      link.href = '/favicon.svg';
    }
  }, [branding]);

  // Service inquiries open the inquiry form on the contact page
  const handlePreselectServiceInquiry = (serviceTitle: string) => {
    setPreselectedService(serviceTitle);
    go('/contact#inquiry');
  };

  // Reset preselected service on direct Inquiry clicks
  const handleDirectInquiryClick = () => {
    setPreselectedService('');
    go('/contact#inquiry');
  };

  // Theme Styling Helper
  const getThemeTextClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'text-emerald-600';
      case 'slate': return 'text-slate-800';
      case 'indigo': return 'text-indigo-600';
      case 'violet': return 'text-violet-600';
      case 'deepblue':
      default:
        return 'text-blue-600';
    }
  };

  const getButtonBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500';
      case 'slate': return 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-500';
      case 'indigo': return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
      case 'violet': return 'bg-violet-600 hover:bg-violet-700 focus:ring-violet-500';
      case 'deepblue':
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
  };

  const btn = getButtonBgClass();
  const renderPage = (r: Route): React.ReactNode => {
    switch (r.page) {
      case 'home':
        return <HomePage />;
      case 'designs':
        return <DesignsPage />;
      case 'design':
        return <React.Fragment key={r.slug}><DesignPage slug={r.slug} /></React.Fragment>;
      case 'customise':
        // shortcut: a design switch only replaces the URL; a later popstate or hashchange remounts on the new slug and photos are lost (details come back from the draft). Lift photos above the route if that matters.
        return <React.Fragment key={r.slug}><CustomiserPage slug={r.slug} btn={btn} /></React.Fragment>;
      case 'services':
        return <ServicesPage branding={branding} content={content} services={services} faqs={faqs} processSteps={processSteps} projectGallery={projectGallery} onInquireService={handlePreselectServiceInquiry} onInquireClick={handleDirectInquiryClick} />;
      case 'about':
        return <AboutPage content={content} branding={branding} roadmapSteps={roadmapSteps} />;
      case 'contact':
        return <ContactPage branding={branding} content={content} services={services} preselectedService={preselectedService} onInquireClick={handleDirectInquiryClick} onSuccessSubmit={() => loadPublicData()} />;
      case 'order':
        return <React.Fragment key={r.ref}><OrderPage reference={r.ref} /></React.Fragment>;
      case 'track':
        return <TrackPage />;
      case 'manage':
        return <ManagePage btn={btn} />;
      case 'policy':
        return <PolicyPage kind={r.kind} company={branding.companyName || 'JLC IT Solutions'} email={content.contactEmail} />;
      case 'notFound':
        return (
          <section className="mx-auto max-w-xl px-4 py-24 text-center space-y-4">
            <h1 className="text-3xl font-serif text-slate-900">Page not found</h1>
            <p className="text-sm text-slate-600">The page you were looking for isn't here. It may have moved.</p>
            <p className="flex justify-center gap-6 text-sm font-semibold">
              <Link href="/" className="underline">Go to the homepage</Link>
              <Link href="/designs" className="underline">Browse designs</Link>
            </p>
          </section>
        );
    }
  };

  if (isDataLoading) return <SiteLoader name={branding.companyName || 'JLC Solutions'} icon={branding.logoIcon} />;

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans select-none" id="app-wrapper">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white">Skip to content</a>

      <SiteBanner />

      {/* Sticky Navigation Bar */}
      <Navbar
        branding={branding}
        page={route.page}
        onAdminClick={() => window.location.assign('/admin')}
      />

      {/* Main Content Areas */}
      <main id="main" tabIndex={-1} className="flex-grow focus:outline-none">

        {renderPage(route)}

      </main>

      {/* Sticky Corporate Footer */}
      <Footer
        branding={branding}
        content={content}
      />

    </div>
  );
}
