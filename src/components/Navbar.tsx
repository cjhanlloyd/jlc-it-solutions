/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { BrandingSettings } from '../types.js';

interface NavbarProps {
  branding: BrandingSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAdminClick: () => void;
  isAdminLoggedIn: boolean;
}

export default function Navbar({ branding, activeTab, setActiveTab, onAdminClick, isAdminLoggedIn }: NavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Hidden Admin Portal Click Counter
  const [logoClicks, setLogoClicks] = React.useState(0);
  const [lastClickTime, setLastClickTime] = React.useState(0);

  const handleLogoClick = () => {
    handleNavClick('home');
    const now = Date.now();
    if (now - lastClickTime < 1000) {
      const nextClicks = logoClicks + 1;
      setLogoClicks(nextClicks);
      if (nextClicks >= 4) { // 5 consecutive clicks
        setLogoClicks(0);
        onAdminClick();
      }
    } else {
      setLogoClicks(1);
    }
    setLastClickTime(now);
  };

  // Dynamic Icon retrieval from lucide-react
  const LogoIcon = (Icons as any)[branding.logoIcon] || Icons.Activity;

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'why', label: 'Why Choose Us' },
    { id: 'contact', label: 'Contact Us' },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic Theme Styling
  const getThemeColorClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'text-emerald-600 hover:bg-emerald-50';
      case 'slate': return 'text-slate-700 hover:bg-slate-50';
      case 'indigo': return 'text-indigo-600 hover:bg-indigo-50';
      case 'violet': return 'text-violet-600 hover:bg-violet-50';
      case 'deepblue':
      default:
        return 'text-blue-600 hover:bg-blue-50';
    }
  };

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

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/85 shadow-xs" id="app-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Logo Section */}
          <div className="flex items-center">
            <button 
              onClick={handleLogoClick}
              className="flex items-center space-x-4 text-left focus:outline-hidden cursor-pointer"
              id="logo-button"
            >
              {branding.logoType === 'icon' && (
                <div className="w-10 h-10 bg-slate-900 flex items-center justify-center transform rotate-45 shadow-md border border-slate-700 transition-transform duration-500 hover:rotate-90">
                  <LogoIcon className="h-5 w-5 text-white transform -rotate-45" />
                </div>
              )}
              {branding.logoType === 'image' && branding.logoImageBase64 ? (
                <img 
                  src={branding.logoImageBase64} 
                  alt="Company Logo" 
                  className="h-10 w-auto object-contain rounded-md"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900 block font-display">
                  {branding.companyName.split(' ')[0]} <span className={getThemeTextClass()}>{branding.companyName.split(' ').slice(1).join(' ') || 'IT Solutions'}</span>
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono block leading-none mt-0.5">
                  {branding.tagline || 'Your Tech Companion'}
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider font-display transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  id={`nav-item-${item.id}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Desktop CTA & Admin */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={() => handleNavClick('inquiry')}
              className={`inline-flex items-center px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-102 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${getButtonBgClass()}`}
              id="nav-cta-inquire"
            >
              Get a Quote
              <Icons.ArrowRight className="ml-2 h-4 w-4" />
            </button>

            {isAdminLoggedIn && (
              <button
                onClick={onAdminClick}
                className={`p-2.5 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer ${
                  activeTab === 'admin' ? 'bg-slate-900 text-white border-slate-800' : ''
                }`}
                title="Go to Dashboard"
                id="nav-admin-portal"
              >
                <Icons.Settings className="h-5 w-5 animate-spin-slow" />
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden space-x-2">
            {isAdminLoggedIn && (
              <button
                onClick={onAdminClick}
                className="p-2 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-50"
                id="mobile-admin-btn"
              >
                <Icons.Settings className="h-5 w-5 text-gray-800" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus:outline-hidden"
              id="mobile-menu-hamburger"
            >
              {isOpen ? (
                <Icons.X className="h-6 w-6" />
              ) : (
                <Icons.Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white" id="mobile-menu-drawer">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left block px-4 py-3 rounded-full text-sm font-bold uppercase tracking-wider font-display transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  id={`mobile-nav-${item.id}`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => handleNavClick('inquiry')}
              className={`w-full mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg focus:outline-hidden ${getButtonBgClass()}`}
              id="mobile-nav-cta"
            >
              Get a Quote
              <Icons.ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
