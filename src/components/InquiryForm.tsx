/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Briefcase, Camera, Check, CheckCircle, CheckCircle2, Code, Cpu, FileText, Loader, Mail, Network, Phone, Plus, RotateCcw, Send, ShieldCheck, Upload, User, Workflow, Wrench, X } from 'lucide-react';
import { fetchDesigns } from '../site/designs-api';
import { Service, BrandingSettings, ContactMethod, ContentSettings } from '../types.js';

// Cloudflare Turnstile. On localhost, use Cloudflare's always-pass test key so dev works without the real widget.
const TURNSTILE_SITE_KEY = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAF6Se95DZhEd5led';

let turnstileScript: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  return (turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve();
    script.onerror = () => { turnstileScript = null; reject(new Error('Turnstile failed to load')); };
    document.head.appendChild(script);
  }));
}

interface InquiryFormProps {
  services: Service[];
  branding: BrandingSettings;
  content: ContentSettings;
  preselectedService?: string;
  onSuccessSubmit: (inquiryId: string) => void;
}

export default function InquiryForm({ services, branding, content, preselectedService = '', onSuccessSubmit }: InquiryFormProps) {
  // A preselected service (from a "Request a quote" button) skips step 1
  const [formStep, setFormStep] = React.useState(preselectedService ? 2 : 1);

  const changeStep = (newStep: number) => {
    const hash = window.location.hash;
    const [routePart] = hash.split('?');
    if (routePart === '#/inquiry') {
      window.location.hash = `#/inquiry?step=${newStep}`;
    } else {
      setFormStep(newStep);
    }
  };

  // Sync step with URL hash step query parameter
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const [routePart, queryPart] = hash.split('?');
      if (routePart === '#/inquiry') {
        const searchParams = new URLSearchParams(queryPart || '');
        const stepParam = searchParams.get('step');
        const step = parseInt(stepParam || '1', 10);
        if (step >= 1 && step <= 3 && step !== formStep) {
          setFormStep(step);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Sync initial step on mount

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [formStep, preselectedService]);

  // Smooth scroll container into view on step transition (excluding initial render)
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const el = document.getElementById('inquiry-system-page');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [formStep]);
  const [fullName, setFullName] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [serviceRequired, setServiceRequired] = React.useState('');
  const [projectDescription, setProjectDescription] = React.useState('');
  const [preferredContactMethod, setPreferredContactMethod] = React.useState<ContactMethod>('Email');

  // Anti-spam: the Turnstile widget renders when its container mounts (step 3) and is removed when it unmounts
  const [turnstileToken, setTurnstileToken] = React.useState('');
  const [turnstileError, setTurnstileError] = React.useState('');
  const turnstileWidgetId = React.useRef<string | null>(null);

  const turnstileContainer = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let unmounted = false;
    loadTurnstile().then(() => {
      if (unmounted) return;
      turnstileWidgetId.current = (window as any).turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => { setTurnstileToken(token); setTurnstileError(''); },
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    }).catch(() => setTurnstileError('The anti-spam check could not load. Please disable content blockers for this site and reload.'));
    return () => {
      unmounted = true;
      if (turnstileWidgetId.current) (window as any).turnstile?.remove(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
      setTurnstileToken('');
    };
  }, []);

  // Tokens are single-use: get a fresh one after any failed submit
  const resetTurnstile = () => {
    setTurnstileToken('');
    if (turnstileWidgetId.current) (window as any).turnstile?.reset(turnstileWidgetId.current);
  };

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [successInquiryId, setSuccessInquiryId] = React.useState('');
  const [sentEmailPreview, setSentEmailPreview] = React.useState<{ to: string; subject: string; body: string } | null>(null);

  // Expanded fields state
  const [budget, setBudget] = React.useState('');
  const [fileAttachment, setFileAttachment] = React.useState<{ name: string; type: string; base64: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("Maximum file attachment size is 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFileAttachment({
          name: file.name,
          type: file.type,
          base64: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Set initial selected service from prop
  React.useEffect(() => {
    if (preselectedService) {
      setServiceRequired(preselectedService);
    } else if (services.length > 0 && !serviceRequired) {
      setServiceRequired(services[0].title);
    }
  }, [preselectedService, services]);

  // /contact?design=<slug>&package=<key> (from "Request this package"): pre-fill the description once.
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const slug = p.get('design'), key = p.get('package');
    if (!slug || !key) return;
    const fill = (d: string, k: string) => setProjectDescription((cur) => cur || `Custom package request: ${d} — ${k}`);
    fetchDesigns().then((all) => {
      const d = all.find((x) => x.slug === slug);
      fill(d?.name ?? slug, d?.packages.find((x) => x.key === key)?.name ?? key);
    }, () => fill(slug, key));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Basic Validation
    if (!fullName || !email || !phone || !serviceRequired || !projectDescription) {
      setErrorMessage('Please fill out all required fields.');
      return;
    }

    if (!turnstileToken) {
      setErrorMessage('Please wait for the anti-spam check to finish, then submit again.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          companyName,
          email,
          phone,
          serviceRequired,
          projectDescription,
          preferredContactMethod,
          budget,
          fileAttachment,
          turnstileToken
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit inquiry.');
      }

      setSuccessInquiryId(data.id);

      // Seed a local visual simulation of the email that has been sent
      setSentEmailPreview({
        to: email,
        subject: `Thank you for contacting ${branding.companyName}!`,
        body: `Dear ${fullName},

Thank you for reaching out to ${branding.companyName}! We have received your inquiry regarding our "${serviceRequired}" service.

Our team is currently reviewing your project description:
"${projectDescription}"

${budget ? `Estimated Project Budget: ${budget}\n` : ''}${fileAttachment ? `Attached File: ${fileAttachment.name}\n` : ''}
We will get back to you shortly via your preferred contact method (${preferredContactMethod}).

Best regards,
The ${branding.companyName} Team
Email: ${content.contactEmail}
Phone: ${content.contactPhone}`
      });

      onSuccessSubmit(data.id);

    } catch (err: any) {
      setErrorMessage(err.message || 'Server network error. Please try again.');
      resetTurnstile();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    changeStep(1);
    setFullName('');
    setCompanyName('');
    setEmail('');
    setPhone('');
    setProjectDescription('');
    setSuccessInquiryId('');
    setSentEmailPreview(null);
    setBudget('');
    setFileAttachment(null);
  };

  // Theme Styling helpers
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

  const getButtonBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
      case 'slate': return 'bg-brand-800 hover:bg-brand-800 focus:ring-brand-700';
      case 'indigo': return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
      case 'violet': return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
      case 'deepblue':
      default:
        return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
    }
  };

  const getCardBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-50 text-brand-700 border-gold-light';
      case 'slate': return 'bg-sand text-ink border-gold-light';
      case 'indigo': return 'bg-brand-50 text-brand-700 border-gold-light';
      case 'violet': return 'bg-brand-50 text-brand-700 border-gold-light';
      case 'deepblue':
      default:
        return 'bg-brand-50 text-brand-700 border-gold-light';
    }
  };

  const getServiceIcon = (title: string) => {
    switch (title) {
      case 'Custom Software Development': return Code;
      case 'Managed IT Support': return Cpu;
      case 'Network Infrastructure & Wi-Fi': return Network;
      case 'IT Consulting & Technology Strategy': return Briefcase;
      case 'CCTV Installation': return Camera;
      case 'Cybersecurity Solutions': return ShieldCheck;
      case 'Mobile, Laptop & Desktop Repair': return Wrench;
      default: return Workflow;
    }
  };

  return (
    <div className="bg-ivory border-t border-gold-light py-20 sm:py-28 relative overflow-hidden font-sans" id="inquiry-system-page">
      {/* Dynamic Animated Tech Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Animated grid and connection nodes */}
        <svg className="absolute top-10 left-10 w-[350px] h-[350px] opacity-10 text-brand-700" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="0.3" strokeDasharray="5 5">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="90s" repeatCount="indefinite" />
          </circle>
          <path d="M10 50 L90 50" stroke="currentColor" strokeWidth="0.2" strokeDasharray="3 3" />
        </svg>
        <svg className="absolute bottom-10 right-10 w-[300px] h-[300px] opacity-15 text-brand-700" viewBox="0 0 100 100" fill="none">
          <polygon points="50,15 90,38 90,82 50,95 10,82 10,38" stroke="currentColor" strokeWidth="0.3">
            <animateTransform attributeName="transform" type="rotate" from="360 50 55" to="0 50 55" dur="45s" repeatCount="indefinite" />
          </polygon>
          <circle cx="50" cy="55" r="1.5" fill="currentColor" />
        </svg>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Step Header */}
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-gold-light rounded-full text-[10px] font-extrabold uppercase tracking-widest text-ink/80 font-mono">
            Requirement Intake
          </div>
          <h2 className="font-serif text-3xl font-extrabold text-ink font-display">
            IT Service Requirement Form
          </h2>
          <p className="text-xs sm:text-sm text-ink/80 font-sans max-w-xl mx-auto leading-relaxed">
            Provide your exact technical objectives below. Our lead consultant will analyze your description and deliver a formal response within 24 hours.
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start space-x-3 shadow-xs" id="inquiry-error-banner">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Successful Inquiry Submission View */}
        {successInquiryId ? (
          <div role="status" className="bg-white rounded-card border border-gold-light shadow-xl p-8 sm:p-12 space-y-8" id="inquiry-success-view">

            {/* Visual Header */}
            <div className="text-center space-y-4">
              <div className="mx-auto h-16 w-16 bg-brand-50 border border-gold-light rounded-full flex items-center justify-center text-brand-700">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-ink font-display">Inquiry Submitted Successfully!</h3>
              <p className="text-xs text-ink/80 font-mono">Reference Code: <span className="font-bold text-ink">{successInquiryId}</span></p>
            </div>

            {/* Explanatory notice */}
            <div className="bg-brand-50 border border-gold-light p-5 rounded-card text-xs text-ink font-sans leading-relaxed">
              <strong>Your inquiry has been stored securely in our system.</strong> A notification has been sent to our administrator mailbox. We have also automatically dispatched a customized acknowledgment email to confirm receipt.
            </div>

            {/* Simulated Email Viewer */}
            {sentEmailPreview && (
              <div className="border border-gold-light rounded-card overflow-hidden shadow-xs">
                <div className="bg-sand px-4 py-3 border-b border-gold-light flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <span className="text-[9px] font-mono text-ink/75 uppercase tracking-widest">Simulated Acknowledgment Email Receipt</span>
                  <Mail className="h-4 w-4 text-ink/75" />
                </div>
                <div className="bg-white p-6 space-y-4 text-xs font-sans text-ink">
                  <div>
                    <span className="text-ink/75 block">To:</span>
                    <strong className="text-ink">{sentEmailPreview.to}</strong>
                  </div>
                  <div>
                    <span className="text-ink/75 block">Subject:</span>
                    <strong className="text-ink">{sentEmailPreview.subject}</strong>
                  </div>
                  <hr className="border-gold-light" />
                  <pre className="font-sans whitespace-pre-wrap leading-relaxed text-ink/80 bg-sand p-4 rounded-xl border border-gold-light">
                    {sentEmailPreview.body}
                  </pre>
                </div>
              </div>
            )}

            {/* Back action */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleResetForm}
                className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                id="inquiry-reset-btn"
              >
                Submit Another Requirement
                <RotateCcw className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Main Form Layout */
          <form onSubmit={handleSubmit} className="bg-white rounded-card border border-gold-light shadow-xl p-8 sm:p-12 space-y-8 relative overflow-hidden" id="inquiry-form-body">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sand rounded-bl-full pointer-events-none border-b border-l border-gold-light"></div>

            {/* Step progress bar */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gold-light max-w-md mx-auto relative z-10">
              <div className="flex items-center space-x-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${formStep === 1 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/10' : formStep > 1 ? 'bg-brand-700 text-white' : 'bg-sand text-ink/75'}`}>
                  {formStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${formStep === 1 ? getThemeTextClass() : 'text-ink/75'}`}>Services</span>
              </div>
              <div className="flex-1 h-0.5 bg-sand mx-4"></div>
              <div className="flex items-center space-x-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${formStep === 2 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/10' : formStep > 2 ? 'bg-brand-700 text-white' : 'bg-sand text-ink/75'}`}>
                  {formStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${formStep === 2 ? getThemeTextClass() : 'text-ink/75'}`}>Scope</span>
              </div>
              <div className="flex-1 h-0.5 bg-sand mx-4"></div>
              <div className="flex items-center space-x-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${formStep === 3 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/10' : 'bg-sand text-ink/75'}`}>
                  3
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${formStep === 3 ? getThemeTextClass() : 'text-ink/75'}`}>Contact</span>
              </div>
            </div>

            {/* STEP 1: CHOOSE SERVICE SOLUTION */}
            {formStep === 1 && (
              <div className="space-y-6 relative z-10">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-base font-bold text-ink font-display">Select Your Required IT Solution</h3>
                  <p className="text-xs text-ink/80 leading-normal">Choose the primary category that matches your technical requirements.</p>
                </div>

                {/* Service Interactive Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {services.map((service) => {
                    const ServiceIcon = getServiceIcon(service.title);
                    const isSelected = serviceRequired === service.title;
                    return (
                      <div
                        key={service.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setServiceRequired(service.title)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                        className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 p-4 rounded-card border text-left cursor-pointer transition-all duration-200 flex items-start space-x-4 select-none relative group ${
                          isSelected 
                            ? 'bg-brand-50 border-brand-700 shadow-xs' 
                            : 'bg-white border-gold-light hover:border-gold hover:bg-sand'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${isSelected ? 'bg-brand-700 text-white' : 'bg-sand text-ink/80 group-hover:bg-gold-light'}`}>
                          <ServiceIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h4 className="text-xs font-bold text-ink font-display leading-tight">{service.title}</h4>
                          <p className="text-[11px] text-ink/80 leading-relaxed line-clamp-2">{service.description}</p>
                        </div>
                        {isSelected && (
                          <span className="absolute top-3 right-3 text-brand-700">
                            <CheckCircle2 className="h-4.5 w-4.5 fill-brand-50" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Other Category Option */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={serviceRequired === 'Other IT Related Requirement'}
                    onClick={() => setServiceRequired('Other IT Related Requirement')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                    className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 p-4 rounded-card border text-left cursor-pointer transition-all duration-200 flex items-start space-x-4 select-none relative group ${
                      serviceRequired === 'Other IT Related Requirement'
                        ? 'bg-brand-50 border-brand-700 shadow-xs' 
                        : 'bg-white border-gold-light hover:border-gold hover:bg-sand'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${serviceRequired === 'Other IT Related Requirement' ? 'bg-brand-700 text-white' : 'bg-sand text-ink/80 group-hover:bg-gold-light'}`}>
                      <Plus className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="text-xs font-bold text-ink font-display leading-tight">Other IT Requirement</h4>
                      <p className="text-[11px] text-ink/80 leading-relaxed line-clamp-2">Any special consulting, hardware procurement, configuration, or custom tech audit task.</p>
                    </div>
                    {serviceRequired === 'Other IT Related Requirement' && (
                      <span className="absolute top-3 right-3 text-brand-700">
                        <CheckCircle2 className="h-4.5 w-4.5 fill-brand-50" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="flex justify-end pt-4 border-t border-gold-light">
                  <button
                    type="button"
                    disabled={!serviceRequired}
                    onClick={() => changeStep(2)}
                    className="inline-flex items-center px-6 py-3 bg-brand-900 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Continue to Scope
                    <ArrowRight className="ml-2 h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DEFINE PROJECT SCOPE */}
            {formStep === 2 && (
              <div className="space-y-6 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink font-display">Define Project Scope &amp; Specs</h3>
                  <p className="text-xs text-ink/80 leading-normal">Describe your technical targets and specify budget guidelines.</p>
                </div>

                {serviceRequired && (
                  <div className="p-3 bg-brand-50 border border-gold-light rounded-card flex items-center space-x-2 text-xs text-brand-700 animate-fade-in shadow-xs">
                    <span className="font-semibold uppercase tracking-wider text-[9px] font-mono bg-brand-700 text-white px-2 py-0.5 rounded">Selected service</span>
                    <span className="font-semibold">{serviceRequired}</span>
                  </div>
                )}

                {/* Project Description textarea */}
                <div className="space-y-2">
                  <label htmlFor="input-description" className="text-xs font-bold text-ink uppercase tracking-wider font-display flex items-center">
                    Project Description <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    id="input-description"
                    required
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Describe your goals, requirements, constraints, or current systems as clearly as possible..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-card border border-gold-light text-sm focus:outline-hidden focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-ink bg-white"
                  ></textarea>
                  <span className="text-[10px] text-ink/80 block">Please provide enough context so we can prepare a realistic technical plan.</span>
                </div>

                {/* Budget visual selector */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider font-display flex items-center">
                    Estimated Project Budget <span className="text-ink/75 text-[10px] lowercase italic ml-1">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Under ₱10,000',
                      '₱10,000 - ₱50,000',
                      '₱50,000 - ₱150,000',
                      '₱150,000 - ₱500,000',
                      '₱500,000+'
                    ].map((opt) => {
                      const isBudgetChecked = budget === opt;
                      return (
                        <button
                          type="button"
                          key={opt}
                          aria-pressed={isBudgetChecked}
                          onClick={() => setBudget(isBudgetChecked ? '' : opt)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer select-none ${
                            isBudgetChecked 
                              ? 'bg-brand-900 border-brand-700 text-white shadow-xs' 
                              : 'bg-white border-gold-light hover:bg-sand text-ink'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* File Attachment Uploader */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider font-display block">
                    Attach Design Specs or Requirements <span className="text-ink/75 text-[10px] lowercase italic">(optional, PDF/Images up to 1MB)</span>
                  </label>
                  
                  <div className="flex items-center space-x-4">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2.5 rounded-xl border border-gold-light bg-white hover:bg-sand text-xs font-bold text-ink shadow-xs transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
                      <Upload className="h-4 w-4 mr-2" />
                      Select File
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.gif,.svg,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>
                    {fileAttachment ? (
                      <div className="flex items-center space-x-2 bg-sand border border-gold-light px-3 py-1.5 rounded-xl">
                        <FileText className="h-4 w-4 text-ink/80" />
                        <span className="text-xs text-ink truncate max-w-xs font-medium">{fileAttachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setFileAttachment(null)}
                          aria-label="Remove attached file"
                          className="text-red-700 hover:text-red-800 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink/75 font-sans">No specifications file attached</span>
                    )}
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="flex justify-between pt-4 border-t border-gold-light">
                  <button
                    type="button"
                    onClick={() => changeStep(1)}
                    className="inline-flex items-center px-6 py-3 border border-gold-light bg-white hover:bg-sand text-ink rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <ArrowLeft className="mr-2 h-4.5 w-4.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!projectDescription.trim()}
                    onClick={() => changeStep(3)}
                    className="inline-flex items-center px-6 py-3 bg-brand-900 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Continue to Contact
                    <ArrowRight className="ml-2 h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CONTACT PROFILE & SUBMIT */}
            {formStep === 3 && (
              <div className="space-y-6 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink font-display">Contact Details &amp; Verification</h3>
                  <p className="text-xs text-ink/80 leading-normal">Provide your operational contact parameters to submit securely.</p>
                </div>

                {serviceRequired && (
                  <div className="p-3 bg-brand-50 border border-gold-light rounded-card flex items-center space-x-2 text-xs text-brand-700 shadow-xs">
                    <span className="font-semibold uppercase tracking-wider text-[9px] font-mono bg-brand-700 text-white px-2 py-0.5 rounded">Selected service</span>
                    <span className="font-semibold">{serviceRequired}</span>
                  </div>
                )}

                {/* Input Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="input-fullname" className="text-xs font-bold text-ink uppercase tracking-wider font-display flex items-center">
                      Full Name <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/75" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Juan Dela Cruz"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gold-light text-sm focus:outline-hidden focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-ink bg-white"
                        id="input-fullname"
                      />
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="input-companyname" className="text-xs font-bold text-ink uppercase tracking-wider font-display">
                      Company Name <span className="text-ink/75 text-[10px] lowercase italic">(optional)</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/75" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. JLC Solutions Corp"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gold-light text-sm focus:outline-hidden focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-ink bg-white"
                        id="input-companyname"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="input-email" className="text-xs font-bold text-ink uppercase tracking-wider font-display flex items-center">
                      Email Address <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/75" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gold-light text-sm focus:outline-hidden focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-ink bg-white"
                        id="input-email"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label htmlFor="input-phone" className="text-xs font-bold text-ink uppercase tracking-wider font-display flex items-center">
                      Phone Number <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/75" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +63 917 123 4567"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gold-light text-sm focus:outline-hidden focus:border-brand-700 focus:ring-1 focus:ring-brand-700 text-ink bg-white"
                        id="input-phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferred Contact Method */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider font-display block">
                    Preferred Contact Channel
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Email', 'Phone', 'Any'] as ContactMethod[]).map((method) => {
                      const isChecked = preferredContactMethod === method;
                      return (
                        <button
                          type="button"
                          key={method}
                          aria-pressed={isChecked}
                          onClick={() => setPreferredContactMethod(method)}
                          className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider font-display rounded-full border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-brand-900 text-white border-brand-700 shadow-xs'
                              : 'border-gold-light bg-white hover:bg-sand text-ink'
                          }`}
                          id={`method-btn-${method}`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Anti-Spam Security challenge */}
                <div className="border-t border-gold-light pt-6 space-y-3">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider font-display flex items-center">
                    Anti-Spam Verification <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div ref={turnstileContainer} id="turnstile-widget" className="min-h-[65px]" />
                  {turnstileError && <p role="alert" className="text-xs text-red-600">{turnstileError}</p>}
                  <p className="text-[10px] text-ink/75">Protects our administrative routing mailbox against automated script payloads.</p>
                </div>

                {/* Actions & Submit */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-gold-light">
                  <button
                    type="button"
                    onClick={() => changeStep(2)}
                    className="inline-flex items-center justify-center px-6 py-3 border border-gold-light bg-white hover:bg-sand text-ink rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <ArrowLeft className="mr-2 h-4.5 w-4.5" />
                    Back
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`inline-flex items-center justify-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                    id="inquiry-submit-btn"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Secure Inquiry
                        <Send className="ml-2.5 h-4.5 w-4.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
