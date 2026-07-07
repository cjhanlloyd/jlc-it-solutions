/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { BrandingSettings, ContentSettings, Service } from '../types.js';

interface FooterProps {
  branding: BrandingSettings;
  content: ContentSettings;
  services: Service[];
  setActiveTab: (tab: string) => void;
}

export default function Footer({ branding, content, services, setActiveTab }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (tabId: string) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic Theme Styling
  const getThemeColorClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'text-emerald-500';
      case 'slate': return 'text-slate-400';
      case 'indigo': return 'text-indigo-500';
      case 'violet': return 'text-violet-500';
      case 'deepblue':
      default:
        return 'text-blue-500';
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 font-sans" id="app-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Col */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              {branding.logoType === 'icon' && (
                <div className="w-10 h-10 bg-slate-800 flex items-center justify-center transform rotate-45 shrink-0 border border-slate-700">
                  {React.createElement((Icons as any)[branding.logoIcon] || Icons.Activity, { className: 'h-5 w-5 text-blue-500 transform -rotate-45' })}
                </div>
              )}
              {branding.logoType === 'image' && branding.logoImageBase64 && (
                <img 
                  src={branding.logoImageBase64} 
                  alt="Company Logo" 
                  className="h-9 w-auto object-contain rounded-md"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-xl font-bold tracking-tight text-white font-display">
                {branding.companyName}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-sans leading-relaxed">
              {branding.tagline}
            </p>
            <div className="flex items-center space-x-3 pt-2">
              {content.facebookUrl && (
                <a href={content.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all transform hover:rotate-12" title="Facebook">
                  <Icons.Facebook className="h-4 w-4" />
                </a>
              )}
              {content.whatsappUrl && (
                <a href={content.whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-slate-800 hover:bg-emerald-600 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all transform hover:rotate-12" title="WhatsApp">
                  <Icons.MessageCircle className="h-4 w-4" />
                </a>
              )}
              {content.viberUrl && (
                <a href={content.viberUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-slate-800 hover:bg-indigo-650 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all transform hover:rotate-12" title="Viber">
                  <Icons.PhoneCall className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono mb-6">Company</h3>
            <ul className="space-y-4 text-sm font-medium">
              <li>
                <button onClick={() => handleLinkClick('home')} className="hover:text-white hover:translate-x-1 transition-all flex items-center cursor-pointer">
                  <Icons.ChevronRight className="h-3 w-3 mr-1 text-slate-600" /> Home
                </button>
              </li>
              <li>
                <button onClick={() => handleLinkClick('about')} className="hover:text-white hover:translate-x-1 transition-all flex items-center cursor-pointer">
                  <Icons.ChevronRight className="h-3 w-3 mr-1 text-slate-600" /> About Us
                </button>
              </li>
              <li>
                <button onClick={() => handleLinkClick('services')} className="hover:text-white hover:translate-x-1 transition-all flex items-center cursor-pointer">
                  <Icons.ChevronRight className="h-3 w-3 mr-1 text-slate-600" /> Services
                </button>
              </li>
              <li>
                <button onClick={() => handleLinkClick('why')} className="hover:text-white hover:translate-x-1 transition-all flex items-center cursor-pointer">
                  <Icons.ChevronRight className="h-3 w-3 mr-1 text-slate-600" /> Why Choose Us
                </button>
              </li>
              <li>
                <button onClick={() => handleLinkClick('contact')} className="hover:text-white hover:translate-x-1 transition-all flex items-center cursor-pointer">
                  <Icons.ChevronRight className="h-3 w-3 mr-1 text-slate-600" /> Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Services Quick Links */}
          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono mb-6">Our Services</h3>
            <ul className="space-y-4 text-sm font-medium">
              {services.slice(0, 5).map((service) => (
                <li key={service.id}>
                  <button onClick={() => handleLinkClick('services')} className="hover:text-white text-left hover:translate-x-1 transition-all flex items-center cursor-pointer">
                    <Icons.ChevronRight className="h-3 w-3 mr-1 text-slate-600 shrink-0" /> 
                    <span className="truncate">{service.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Location & Map Embed */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">Office Location</h3>
            <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg h-36">
              {content.contactMapEmbedUrl ? (
                <iframe
                  title="JLC IT Solutions Location Map"
                  src={content.contactMapEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  id="footer-google-map"
                ></iframe>
              ) : (
                <div className="h-full bg-slate-800 flex items-center justify-center">
                  <Icons.MapPin className="h-6 w-6 text-slate-600 animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex items-start space-x-3 text-xs text-slate-400">
              <Icons.MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              <span>{content.contactAddress}</span>
            </div>
          </div>
        </div>

        {/* Lower Footer */}
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 space-y-4 sm:space-y-0">
          <p>© {currentYear} {branding.companyName}. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-gray-300">Privacy Policy</a>
            <a href="#" className="hover:text-gray-300">Terms of Service</a>
            <a href="#" className="hover:text-gray-300">Cookie Settings</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
