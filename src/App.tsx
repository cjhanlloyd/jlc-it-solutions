/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import {
  DEFAULT_SERVICES,
  DEFAULT_BRANDING,
  DEFAULT_CONTENT,
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_ADMINS,
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
  Inquiry,
  ProjectGalleryItem
} from './types.js';

import Navbar from './components/Navbar.tsx';
import Footer from './components/Footer.tsx';
import HomeHero from './components/HomeHero.tsx';
import AboutSection from './components/AboutSection.tsx';
import ServicesSection from './components/ServicesSection.tsx';
import WhyChooseUs from './components/WhyChooseUs.tsx';
import ContactSection from './components/ContactSection.tsx';
import InquiryForm from './components/InquiryForm.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import ProcessTimeline from './components/ProcessTimeline.tsx';
import FaqAccordion from './components/FaqAccordion.tsx';
import ProjectGallery from './components/ProjectGallery.tsx';

export default function App() {
  const [activeTab, setActiveTabState] = React.useState<string>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      const route = hash.split('?')[0].substring(2);
      if (['home', 'about', 'services', 'why', 'contact', 'inquiry', 'admin'].includes(route)) {
        return route;
      }
    }
    return 'home';
  });

  const setActiveTab = (tabName: string) => {
    window.location.hash = '#/' + tabName;
  };
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

  // Admin login states
  const [adminToken, setAdminToken] = React.useState<string>(() => localStorage.getItem('jlc_admin_token') || '');
  const [adminUser, setAdminUser] = React.useState<{ email: string; role: any; fullName: string } | null>(() => {
    const saved = localStorage.getItem('jlc_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showLoginModal, setShowLoginModal] = React.useState(false);
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  // Token recovery and setup fields
  const [inviteToken, setInviteToken] = React.useState('');
  const [resetToken, setResetToken] = React.useState('');
  const [tokenEmail, setTokenEmail] = React.useState('');
  const [setupPassword, setSetupPassword] = React.useState('');
  const [setupFullName, setSetupFullName] = React.useState('');
  const [setupError, setSetupError] = React.useState('');
  const [setupSuccess, setSetupSuccess] = React.useState('');
  const [isSettingUp, setIsSettingUp] = React.useState(false);

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = React.useState('');
  const [forgotPasswordError, setForgotPasswordError] = React.useState('');
  const [isRequestingReset, setIsRequestingReset] = React.useState(false);

  // Inquiry preselected service hook
  const [preselectedService, setPreselectedService] = React.useState('');
  const [hasTransitionedTitle, setHasTransitionedTitle] = React.useState(false);

  // Synchronize state with URL hash on mount and hashchange
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/home';
      const [routePart] = hash.split('?');
      const route = routePart.substring(2) || 'home';

      if (route === 'login') {
        setShowLoginModal(true);
        setShowForgotPassword(false);
      } else if (route === 'login/forgot-password') {
        setShowLoginModal(true);
        setShowForgotPassword(true);
      } else {
        setShowLoginModal(false);
        setShowForgotPassword(false);
        if (['home', 'about', 'services', 'why', 'contact', 'inquiry', 'admin'].includes(route)) {
          setActiveTabState(route);
        } else {
          setActiveTabState('home');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Sync initial state

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Smooth scroll to top of viewport when tab switches
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Read invite/reset links
  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const invite = query.get('inviteToken');
    const reset = query.get('resetToken');
    const email = query.get('email');
    if (invite || reset) {
      localStorage.removeItem('jlc_admin_token');
      localStorage.removeItem('jlc_admin_user');
      setAdminToken('');
      setAdminUser(null);
    }
    if (invite) {
      setInviteToken(invite);
      if (email) setTokenEmail(email);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (reset) {
      setResetToken(reset);
      if (email) setTokenEmail(email);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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

  // Update layout theme details and favicon dynamically based on settings
  React.useEffect(() => {
    if (!hasTransitionedTitle) {
      document.title = "JLC Solutions";
      const timer = setTimeout(() => {
        const coName = branding.companyName || "JLC Solutions";
        document.title = `${coName} | Premium IT Solutions`;
        setHasTransitionedTitle(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      const coName = branding.companyName || "JLC Solutions";
      document.title = `${coName} | Premium IT Solutions`;
    }
  }, [branding.companyName, hasTransitionedTitle]);

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

  // Handler for Admin Login Submission
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid login details.');
      }

      // Save token & credentials
      localStorage.setItem('jlc_admin_token', data.token);
      localStorage.setItem('jlc_admin_user', JSON.stringify({
        email: data.email,
        role: data.role,
        fullName: data.fullName
      }));

      setAdminToken(data.token);
      setAdminUser({
        email: data.email,
        role: data.role,
        fullName: data.fullName
      });

      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');

      // Auto navigate to administrative view
      setActiveTab('admin');
      loadPublicData(); // Reload to capture current dynamic changes

    } catch (err: any) {
      setLoginError(err.message || 'Server error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('jlc_admin_token');
    localStorage.removeItem('jlc_admin_user');
    setAdminToken('');
    setAdminUser(null);
    setActiveTab('home');
    loadPublicData();
  };

  // Handler for Forgot Password Request
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    setForgotPasswordMessage('');
    setIsRequestingReset(true);

    try {
      const response = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed.');
      setForgotPasswordMessage(data.message || 'A recovery link has been dispatched to your email address.');
      setForgotPasswordEmail('');
    } catch (err: any) {
      setForgotPasswordError(err.message || 'Error processing password reset request.');
    } finally {
      setIsRequestingReset(false);
    }
  };

  // Handler for Verify Invite Submission
  const handleVerifyInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setSetupSuccess('');
    setIsSettingUp(true);

    try {
      const response = await fetch('/api/admin/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tokenEmail, token: inviteToken, password: setupPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Activation failed.');
      setSetupSuccess(data.message || 'Account activated successfully!');
      setSetupPassword('');
      setInviteToken('');
      setTimeout(() => {
        window.location.hash = '#/login';
      }, 2000);
    } catch (err: any) {
      setSetupError(err.message || 'Activation failed.');
    } finally {
      setIsSettingUp(false);
    }
  };

  // Handler for Reset Password Execution
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setSetupSuccess('');
    setIsSettingUp(true);

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tokenEmail, token: resetToken, password: setupPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reset failed.');
      setSetupSuccess(data.message || 'Password reset successfully!');
      setSetupPassword('');
      setResetToken('');
      setTimeout(() => {
        window.location.hash = '#/login';
      }, 2000);
    } catch (err: any) {
      setSetupError(err.message || 'Password reset failed.');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleAdminPortalClick = () => {
    if (adminToken) {
      setActiveTab('admin');
    } else {
      window.location.hash = '#/login';
    }
  };

  // Preselected service routing
  const handlePreselectServiceInquiry = (serviceTitle: string) => {
    setPreselectedService(serviceTitle);
    setActiveTab('inquiry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset preselected service on direct Inquiry clicks
  const handleDirectInquiryClick = () => {
    setPreselectedService('');
    setActiveTab('inquiry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="space-y-4 text-center">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
          </div>
          <p className="text-[10px] text-slate-400 font-mono tracking-widest animate-pulse uppercase">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  if (inviteToken) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans animate-fade-in" id="invite-activation-panel">
        <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Icons.UserCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-display">Verify Email & Set Password</h2>
            <p className="text-xs text-slate-500 font-sans leading-relaxed font-medium">Complete your JLC Solutions administration profile for: <span className="font-bold text-slate-800">{tokenEmail}</span></p>
          </div>

          {setupError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-start space-x-2">
              <Icons.AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{setupError}</span>
            </div>
          )}

          {setupSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
              <Icons.CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{setupSuccess}</span>
            </div>
          )}

          <form onSubmit={handleVerifyInviteSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Create Secure Password</label>
              <input
                type="password"
                required
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-slate-200 p-3.5 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={isSettingUp}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-blue-500/25 transition-all hover:scale-102 font-display"
            >
              {isSettingUp ? 'Activating Profile...' : 'Activate & Save Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (resetToken) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans" id="password-reset-panel">
        <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Icons.Key className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-display">Reset Your Password</h2>
            <p className="text-xs text-slate-500 font-sans leading-relaxed font-medium">Enter a new secure password for: <span className="font-bold text-slate-800">{tokenEmail}</span></p>
          </div>

          {setupError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-start space-x-2">
              <Icons.AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{setupError}</span>
            </div>
          )}

          {setupSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
              <Icons.CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{setupSuccess}</span>
            </div>
          )}

          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">New Password</label>
              <input
                type="password"
                required
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-slate-200 p-3.5 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={isSettingUp}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-blue-500/25 transition-all hover:scale-102 font-display"
            >
              {isSettingUp ? 'Resetting Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans select-none" id="app-wrapper">

      {/* Sticky Navigation Bar */}
      <Navbar
        branding={branding}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdminClick={handleAdminPortalClick}
        isAdminLoggedIn={!!adminToken}
      />

      {/* Main Content Areas */}
      <main className="flex-grow">

        {/* HOMEPAGE VIEW */}
        {activeTab === 'home' && (
          <div className="space-y-4" id="view-home">
            {/* Hero Main Slider */}
            <HomeHero
              branding={branding}
              content={content}
              onExploreServices={() => setActiveTab('services')}
              onGetQuote={handleDirectInquiryClick}
            />

            {/* Quick Teaser Services portfolio */}
            <div className="bg-slate-50 border-y border-slate-200/60 py-20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-12">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono mb-4">
                    Our Capabilities
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 font-display">Corporate IT Categories</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.slice(0, 3).map(srv => {
                    const SrvIcon = (Icons as any)[srv.iconName] || Icons.Cpu;
                    return (
                      <div key={srv.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 group">
                        <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 border border-slate-800 transition-transform duration-300 group-hover:rotate-90">
                          <SrvIcon className="h-5 w-5 text-white transform -rotate-45" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 font-display pt-2">{srv.title}</h3>
                        <p className="text-xs text-slate-500 font-sans leading-relaxed line-clamp-3">{srv.description}</p>
                        <button
                          onClick={() => handlePreselectServiceInquiry(srv.title)}
                          className="text-xs font-bold font-display uppercase tracking-wider inline-flex items-center text-blue-600 hover:text-blue-700 cursor-pointer pt-2"
                        >
                          Request details <Icons.ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center mt-10">
                  <button
                    onClick={() => setActiveTab('services')}
                    className={`inline-flex items-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-md shadow-blue-500/10 cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                  >
                    View All Services <Icons.ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Value assurance block */}
            <div className="bg-white py-20 relative overflow-hidden">
              <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">Establishing Credibility and Stable Future Engineering</h3>
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed font-sans max-w-3xl mx-auto">
                  We are a client-focused, boutique IT team. We don't utilize exaggerated, unverified metrics, inflated statistics, or fake reviews. We believe in pristine technical execution, rigorous data security standards, and honest consulting.
                </p>
                <div className="flex justify-center space-x-6 text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest pt-4">
                  <span className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span> SSL Ready</span>
                  <span className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span> Spam Guarded</span>
                  <span className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span> Clean Codebase</span>
                </div>
              </div>
            </div>

            {/* Showcase project gallery list */}
            <ProjectGallery
              projectGallery={projectGallery}
              branding={branding}
              content={content}
            />

            {/* Service Process Timeline */}
            <ProcessTimeline
              processSteps={processSteps}
              branding={branding}
              content={content}
            />

            {/* FAQ Section */}
            <FaqAccordion
              faqs={faqs}
              branding={branding}
              content={content}
            />

            {/* Contact CTA banner */}
            <div className="bg-slate-950 text-white py-16 sm:py-20 border-t border-slate-900 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="max-w-5xl mx-auto px-4 text-center space-y-6 relative z-10">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500">Intake Process</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold font-display">Ready to deploy secure, standard-compliant technology?</h3>
                <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  Start your discovery phase today. Submit your detailed requirements and receive strategic feedback directly from John Cahilig, our lead software systems architect.
                </p>
                <div className="pt-4 flex justify-center">
                  <button
                    onClick={handleDirectInquiryClick}
                    className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                  >
                    Start Your Inquiry
                    <Icons.ArrowRight className="ml-2.5 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT US TAB */}
        {activeTab === 'about' && (
          <AboutSection
            content={content}
            branding={branding}
            onExploreServices={() => setActiveTab('services')}
            roadmapSteps={roadmapSteps}
          />
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <ServicesSection
            services={services}
            branding={branding}
            content={content}
            onInquireService={handlePreselectServiceInquiry}
          />
        )}

        {/* WHY CHOOSE US TAB */}
        {activeTab === 'why' && (
          <WhyChooseUs
            content={content}
            branding={branding}
            onInquireClick={handleDirectInquiryClick}
          />
        )}

        {/* CONTACT US TAB */}
        {activeTab === 'contact' && (
          <ContactSection
            content={content}
            branding={branding}
            onInquireClick={handleDirectInquiryClick}
          />
        )}

        {/* INQUIRY FORM TAB */}
        {activeTab === 'inquiry' && (
          <InquiryForm
            services={services}
            branding={branding}
            content={content}
            preselectedService={preselectedService}
            onSuccessSubmit={() => loadPublicData()} // Reload to refresh count on dashboard
          />
        )}

        {/* SECURE ADMIN CONTROL PANEL DASHBOARD */}
        {activeTab === 'admin' && adminToken && adminUser && (
          <AdminPanel
            adminToken={adminToken}
            adminUser={adminUser}
            onLogout={handleAdminLogout}
            branding={branding}
            onDataChange={loadPublicData}
          />
        )}

      </main>

      {/* Sticky Corporate Footer */}
      <Footer
        branding={branding}
        content={content}
        services={services}
        setActiveTab={setActiveTab}
      />

      {/* ADMINISTRATIVE LOGIN SECURE MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans" id="login-modal-overlay">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-6 relative overflow-hidden" id="login-modal-box">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full pointer-events-none border-b border-l border-slate-100"></div>

            {/* Close button */}
            <button
              onClick={() => {
                setLoginError('');
                window.location.hash = '#/' + activeTab;
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              id="login-close-btn"
            >
              <Icons.X className="h-5 w-5" />
            </button>

            {showForgotPassword ? (
              // FORGOT PASSWORD SUB-VIEW
              <>
                <div className="text-center space-y-3 relative z-10">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <Icons.Key className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">Forgot Password</h3>
                  <p className="text-xs text-slate-500 font-sans leading-relaxed">Enter your registered email address and we will dispatch a secure link to reset your account credentials.</p>
                </div>

                {forgotPasswordError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-start space-x-2">
                    <Icons.AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{forgotPasswordError}</span>
                  </div>
                )}

                {forgotPasswordMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
                    <Icons.CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{forgotPasswordMessage}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Email Address</label>
                    <input
                      type="email"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="Enter Email Address"
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordError('');
                        setForgotPasswordMessage('');
                        window.location.hash = '#/login';
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Back to Login
                    </button>
                    <button
                      type="submit"
                      disabled={isRequestingReset}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold cursor-pointer"
                    >
                      {isRequestingReset ? 'Requesting...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // DEFAULT LOGIN FORM SUB-VIEW
              <>
                {/* Header */}
                <div className="text-center space-y-3 relative z-10">
                  <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 mx-auto border border-slate-800">
                    <Icons.Lock className="h-5 w-5 text-white transform -rotate-45" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">Administrative Credentials</h3>
                  <p className="text-xs text-slate-500 font-sans leading-relaxed">Authorized corporate operators only. Enter your credentials to establish a secure administrative session.</p>
                </div>

                {/* Login error alerts */}
                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-start space-x-2" id="login-error-alert">
                    <Icons.AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Input Form */}
                <form onSubmit={handleAdminLoginSubmit} className="space-y-4 relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Email Address</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="Enter Email Address"
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                      id="login-username-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError('');
                          window.location.hash = '#/login/forgot-password';
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer focus:outline-hidden"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="************"
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                      id="login-password-input"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg shadow-blue-500/15 cursor-pointer focus:outline-hidden transition-all hover:scale-102 ${getButtonBgClass()}`}
                      id="login-submit-btn"
                    >
                      {isLoggingIn ? 'Establishing session...' : 'Verify & Open Panel'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
