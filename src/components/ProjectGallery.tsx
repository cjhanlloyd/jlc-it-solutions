import React from 'react';
import * as Icons from 'lucide-react';
import { ProjectGalleryItem, BrandingSettings, ContentSettings } from '../types.js';

interface ProjectGalleryProps {
  projectGallery: ProjectGalleryItem[];
  branding: BrandingSettings;
  content: ContentSettings;
}

export default function ProjectGallery({ projectGallery = [], branding, content }: ProjectGalleryProps) {
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [activeLightboxItem, setActiveLightboxItem] = React.useState<ProjectGalleryItem | null>(null);

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
      case 'emerald': return 'text-emerald-600';
      case 'slate': return 'text-slate-700';
      case 'indigo': return 'text-indigo-600';
      case 'violet': return 'text-violet-600';
      case 'deepblue':
      default:
        return 'text-blue-600';
    }
  };

  const getThemeBadgeClass = (isActive: boolean) => {
    if (isActive) {
      switch (branding.themeColor) {
        case 'emerald': return 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15';
        case 'slate': return 'bg-slate-700 text-white shadow-md shadow-slate-700/15';
        case 'indigo': return 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15';
        case 'violet': return 'bg-violet-600 text-white shadow-md shadow-violet-600/15';
        case 'deepblue':
        default:
          return 'bg-blue-600 text-white shadow-md shadow-blue-600/15';
      }
    }
    return 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60';
  };

  return (
    <section className="bg-slate-50/50 py-20 sm:py-28 border-t border-b border-slate-200/60 font-sans" id="project-gallery-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12 sm:mb-16">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500 bg-white border border-slate-200/80 px-3 py-1 rounded-full">Portfolio Showcase</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 font-display tracking-tight">
            {content.portfolioHeader || 'Our Featured Work & Completed Installations'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed max-w-xl mx-auto">
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
                className={`px-4 py-2 rounded-full text-xs font-bold font-sans transition-all cursor-pointer ${getThemeBadgeClass(selectedCategory === cat)}`}
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
                className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 group flex flex-col cursor-pointer"
                onClick={() => setActiveLightboxItem(item)}
              >
                {/* Photo preview panel */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden shrink-0">
                  <img 
                    src={item.imageBase64} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition-all duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/90 backdrop-blur-xs text-slate-900 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md">
                      <Icons.Maximize2 className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md">
                    {item.category}
                  </span>
                </div>

                {/* Metadata content */}
                <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-slate-900 font-display tracking-tight leading-snug group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] uppercase font-mono font-bold text-slate-400">
                    <span>Authentic Reference</span>
                    <span className="text-blue-600 group-hover:underline flex items-center">
                      View Large <Icons.ChevronRight className="ml-0.5 h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Icons.Image className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Showcase Projects Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">This category is currently empty. Re-select filter categories or login to upload completed projects.</p>
          </div>
        )}

      </div>

      {/* LIGHTBOX MODAL */}
      {activeLightboxItem && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveLightboxItem(null)}
        >
          <div 
            className="max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col relative animate-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Close trigger button */}
            <button 
              onClick={() => setActiveLightboxItem(null)}
              className="absolute top-4 right-4 bg-slate-950/75 hover:bg-slate-950 text-white p-2 rounded-full z-10 transition-colors cursor-pointer"
            >
              <Icons.X className="h-5 w-5" />
            </button>

            {/* Main high fidelity image display */}
            <div className="relative bg-slate-950 aspect-video w-full flex items-center justify-center">
              <img 
                src={activeLightboxItem.imageBase64} 
                alt={activeLightboxItem.title} 
                className="w-full h-full object-contain max-h-[70vh]"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Showcase detail panel */}
            <div className="p-6 sm:p-8 space-y-3 bg-white border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md">
                  {activeLightboxItem.category}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Project Reference Ref ID: {activeLightboxItem.id}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-display">
                {activeLightboxItem.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed">
                {activeLightboxItem.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
