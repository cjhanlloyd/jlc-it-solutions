import React from 'react';
import { ChevronRight, Image, Maximize2, X } from 'lucide-react';
import { ProjectGalleryItem, BrandingSettings, ContentSettings } from '../types.js';

interface ProjectGalleryProps {
  projectGallery: ProjectGalleryItem[];
  branding: BrandingSettings;
  content: ContentSettings;
}

export default function ProjectGallery({ projectGallery = [], branding, content }: ProjectGalleryProps) {
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [activeLightboxItem, setActiveLightboxItem] = React.useState<ProjectGalleryItem | null>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const openItem = (item: ProjectGalleryItem, el: HTMLElement) => { openerRef.current = el; setActiveLightboxItem(item); };

  // Lightbox: focus moves to Close, Escape closes, focus returns to the card that opened it.
  React.useEffect(() => {
    if (!activeLightboxItem) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveLightboxItem(null); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); openerRef.current?.focus(); };
  }, [activeLightboxItem]);

  // Compute unique categories
  const categories = React.useMemo(() => {
    const list = new Set<string>();
    projectGallery.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return ['All', ...Array.from(list)];
  }, [projectGallery]);

  // Filter items
  const filteredItems = React.useMemo(() => {
    if (selectedCategory === 'All') return projectGallery;
    return projectGallery.filter(p => p.category === selectedCategory);
  }, [projectGallery, selectedCategory]);

  const getThemeTextClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'text-brand-700';
      case 'slate': return 'text-ink';
      case 'indigo': return 'text-brand-700';
      case 'violet': return 'text-brand-700';
      case 'deepblue':
      default:
        return 'text-brand-700';
    }
  };

  const getThemeBadgeClass = (isActive: boolean) => {
    if (isActive) {
      switch (branding.themeColor) {
        case 'emerald': return 'bg-brand-700 text-white shadow-md shadow-brand-700/10';
        case 'slate': return 'bg-brand-800 text-white shadow-md shadow-brand-700/10';
        case 'indigo': return 'bg-brand-700 text-white shadow-md shadow-brand-700/10';
        case 'violet': return 'bg-brand-700 text-white shadow-md shadow-brand-700/10';
        case 'deepblue':
        default:
          return 'bg-brand-700 text-white shadow-md shadow-brand-700/10';
      }
    }
    return 'bg-sand hover:bg-sand text-ink/80 hover:text-brand-700 border border-gold-light';
  };

  return (
    <section className="bg-sand py-20 sm:py-28 border-t border-b border-gold-light font-sans" id="project-gallery-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12 sm:mb-16">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-ink/80 bg-white border border-gold-light px-3 py-1 rounded-full">Portfolio Showcase</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            {content.portfolioHeader || 'Our Featured Work & Completed Installations'}
          </h2>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed max-w-xl mx-auto">
            {content.portfolioSubtitle || 'Explore authentic photos and details representing our software platforms, structured server rack deployments, and hybrid migrations.'}
          </p>
        </div>

        {/* Categories filter tabs */}
        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center items-center gap-2 mb-10 sm:mb-12">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
                className={`px-4 py-2 rounded-full text-xs font-bold font-sans transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${getThemeBadgeClass(selectedCategory === cat)}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Projects grid */}
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredItems.map(item => (
              <div 
                key={item.id} 
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                className="bg-white rounded-card border border-gold-light overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 group flex flex-col cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                onClick={(e) => openItem(item, e.currentTarget)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(item, e.currentTarget); } }}
              >
                {/* Photo preview panel */}
                <div className="relative aspect-video bg-brand-900 overflow-hidden shrink-0">
                  {item.imageBase64 ? (
                    <img
                      src={item.imageBase64}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/75" aria-label={`${item.title} (no photo yet)`}>
                      <Image className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-brand-900/0 group-hover:bg-brand-800/20 transition-all duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/90 backdrop-blur-xs text-ink rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md">
                      <Maximize2 className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <span className="absolute top-3 left-3 bg-brand-900/80 backdrop-blur-xs text-white text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md">
                    {item.category}
                  </span>
                </div>

                {/* Metadata content */}
                <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-ink font-display tracking-tight leading-snug group-hover:text-brand-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-ink/80 font-sans leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gold-light flex justify-between items-center text-[10px] uppercase font-mono font-bold text-ink/75">
                    <span>Authentic Reference</span>
                    <span className="text-brand-700 group-hover:underline flex items-center">
                      View Large <ChevronRight className="ml-0.5 h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-card border border-gold-light space-y-3">
            <div className="w-12 h-12 bg-sand text-ink/75 rounded-full flex items-center justify-center mx-auto">
              <Image className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-ink">No Showcase Projects Found</h3>
            <p className="text-xs text-ink/75 max-w-sm mx-auto">This category is currently empty. Re-select filter categories or login to upload completed projects.</p>
          </div>
        )}

      </div>

      {/* LIGHTBOX MODAL */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeLightboxItem.title}
          className="fixed inset-0 z-50 bg-brand-900/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveLightboxItem(null)}
        >
          <div 
            className="max-w-4xl w-full bg-white rounded-card overflow-hidden shadow-2xl border border-white/10 flex flex-col relative animate-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Close trigger button */}
            <button
              ref={closeRef}
              onClick={() => setActiveLightboxItem(null)}
              aria-label="Close"
              className="absolute top-4 right-4 bg-brand-900/75 hover:bg-brand-800 text-white p-2 rounded-full z-10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Main high fidelity image display */}
            <div className="relative bg-brand-900 aspect-video w-full flex items-center justify-center">
              {activeLightboxItem.imageBase64 ? (
                <img
                  src={activeLightboxItem.imageBase64}
                  alt={activeLightboxItem.title}
                  className="w-full h-full object-contain max-h-[70vh]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Image className="h-16 w-16 text-white/75" aria-label={`${activeLightboxItem.title} (no photo yet)`} />
              )}
            </div>

            {/* Showcase detail panel */}
            <div className="p-6 sm:p-8 space-y-3 bg-white border-t border-gold-light">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-brand-50 text-brand-700 text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md">
                  {activeLightboxItem.category}
                </span>
                <span className="text-[10px] text-ink/75 font-mono">Project Reference Ref ID: {activeLightboxItem.id}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-ink font-display">
                {activeLightboxItem.title}
              </h3>
              <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">
                {activeLightboxItem.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
