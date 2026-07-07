/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { Service, BrandingSettings, ContentSettings } from '../types.js';

interface ServicesSectionProps {
  services: Service[];
  branding: BrandingSettings;
  content: ContentSettings;
  onInquireService: (serviceTitle: string) => void;
}

export default function ServicesSection({ services, branding, content, onInquireService }: ServicesSectionProps) {
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  
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

  const getThemeBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-50 text-emerald-700';
      case 'slate': return 'bg-slate-100 text-slate-800';
      case 'indigo': return 'bg-indigo-50 text-indigo-700';
      case 'violet': return 'bg-violet-50 text-violet-700';
      case 'deepblue':
      default:
        return 'bg-blue-50 text-blue-700';
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

  const getBorderColorClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'hover:border-emerald-300 hover:shadow-emerald-600/5';
      case 'slate': return 'hover:border-slate-400 hover:shadow-slate-600/5';
      case 'indigo': return 'hover:border-indigo-300 hover:shadow-indigo-600/5';
      case 'violet': return 'hover:border-violet-300 hover:shadow-violet-600/5';
      case 'deepblue':
      default:
        return 'hover:border-blue-300 hover:shadow-blue-600/5';
    }
  };

  const getThemeTextHoverClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'group-hover:text-emerald-600';
      case 'slate': return 'group-hover:text-slate-800';
      case 'indigo': return 'group-hover:text-indigo-600';
      case 'violet': return 'group-hover:text-violet-600';
      case 'deepblue':
      default:
        return 'group-hover:text-blue-600';
    }
  };

  const getCheckColorClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'text-emerald-500';
      case 'slate': return 'text-slate-650';
      case 'indigo': return 'text-indigo-500';
      case 'violet': return 'text-violet-500';
      case 'deepblue':
      default:
        return 'text-blue-500';
    }
  };

  const getThemeIconBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'group-hover:bg-emerald-600 group-hover:border-emerald-500';
      case 'slate': return 'group-hover:bg-slate-700 group-hover:border-slate-600';
      case 'indigo': return 'group-hover:bg-indigo-600 group-hover:border-indigo-500';
      case 'violet': return 'group-hover:bg-violet-600 group-hover:border-violet-500';
      case 'deepblue':
      default:
        return 'group-hover:bg-blue-600 group-hover:border-blue-500';
    }
  };

  const getServiceFocusTag = (title: string) => {
    switch (title) {
      case 'Custom Software Development': return 'Workflow Automation';
      case 'Managed IT Support': return '99.9% Uptime SLA';
      case 'Network Infrastructure & Wi-Fi': return 'Fiber Cabling & Speed';
      case 'IT Consulting & Technology Strategy': return 'Vendor Strategy Map';
      case 'CCTV Installation': return 'HD Camera Telemetry';
      case 'Cybersecurity Solutions': return 'Zero Trust Shield';
      case 'Mobile, Laptop & Desktop Repair': return 'Rapid Recovery';
      default: return 'Business Grade';
    }
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200/60 py-20 sm:py-28 font-sans" id="services-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
            Core capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-955 font-display">
            {content.servicesHeader || 'Comprehensive IT & Software Solutions'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed max-w-2xl mx-auto">
            {content.servicesSubtitle || 'We engineer secure, compliant, and scalable technology foundations to minimize your operational risks and support long-term growth.'}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="services-grid">
          {services.map((service) => {
            const IconComponent = (Icons as any)[service.iconName] || Icons.Cpu;
            
            return (
              <div 
                key={service.id}
                className={`bg-white rounded-3xl border border-slate-200 p-8 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col h-full group hover:-translate-y-1 ${getBorderColorClass()}`}
                id={`service-card-${service.id}`}
              >
                {/* Header Icon & Title */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className={`w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 border border-slate-800 group-hover:rotate-90 transition-all duration-500 ${getThemeIconBgClass()}`}>
                    <IconComponent className="h-5 w-5 text-white transform -rotate-45" />
                  </div>
                  <span className={`inline-flex items-center text-[9px] uppercase font-mono font-bold tracking-wider px-2.5 py-1 rounded-md ${getThemeBgClass()}`}>
                    {getServiceFocusTag(service.title)}
                  </span>
                </div>

                <div className="space-y-3 flex-grow flex flex-col">
                  <h3 className={`text-lg font-extrabold text-slate-950 font-display leading-snug transition-colors ${getThemeTextHoverClass()}`}>
                    {service.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-xs text-slate-500 font-sans leading-relaxed flex-grow">
                    {service.description}
                  </p>
                </div>

                {/* Service features list */}
                {service.features && service.features.length > 0 && (
                  <div className="border-t border-slate-100 pt-5 mt-5 mb-6">
                    <h4 className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono mb-3">Service Standard Capabilities</h4>
                    <ul className="space-y-2.5">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start text-xs text-slate-600 font-sans">
                          <Icons.Check className={`h-4 w-4 mr-2 shrink-0 mt-0.5 ${getCheckColorClass()}`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA Action */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setSelectedService(service)}
                    className="inline-flex items-center justify-center px-4 py-3 rounded-full text-[10px] font-bold uppercase tracking-wider font-display border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                    id={`service-more-btn-${service.id}`}
                  >
                    Learn More
                  </button>
                  <button
                    onClick={() => onInquireService(service.title)}
                    className={`inline-flex items-center justify-center px-4 py-3 rounded-full text-[10px] font-bold uppercase tracking-wider font-display text-white shadow-md shadow-blue-500/10 cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                    id={`service-btn-${service.id}`}
                  >
                    Inquire
                    <Icons.ArrowRight className="ml-1.5 h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Learn More Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" id="service-detail-modal">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative overflow-hidden">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedService(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <Icons.X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 border border-slate-800">
                {React.createElement((Icons as any)[selectedService.iconName] || Icons.Cpu, { className: 'h-5 w-5 text-white transform -rotate-45' })}
              </div>
              <div>
                <span className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest block">Capabilities details</span>
                <h3 className="text-xl font-bold text-slate-900 font-display">{selectedService.title}</h3>
              </div>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-sm text-slate-600 font-sans leading-relaxed">
              <p>{selectedService.description}</p>
              
              {selectedService.features && selectedService.features.length > 0 && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <h4 className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest mb-3">Service Standard Features</h4>
                  <ul className="space-y-2">
                    {selectedService.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start text-xs text-slate-600">
                        <Icons.Check className="h-4 w-4 mr-2 shrink-0 text-blue-600 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer CTA */}
            <div className="flex space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedService(null)}
                className="flex-grow inline-flex items-center justify-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close details
              </button>
              <button
                onClick={() => {
                  onInquireService(selectedService.title);
                  setSelectedService(null);
                }}
                className={`flex-grow inline-flex items-center justify-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-md cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
              >
                Inquire now
                <Icons.ArrowRight className="ml-2 h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
