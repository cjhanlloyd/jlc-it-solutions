/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { Service, BrandingSettings, ContactMethod, ContentSettings } from '../types.js';

interface InquiryFormProps {
  services: Service[];
  branding: BrandingSettings;
  content: ContentSettings;
  preselectedService?: string;
  onSuccessSubmit: (inquiryId: string) => void;
}

export default function InquiryForm({ services, branding, content, preselectedService = '', onSuccessSubmit }: InquiryFormProps) {
  const [formStep, setFormStep] = React.useState(1);

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
        const step = parseInt(searchParams.get('step') || '1', 10);
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
  }, [formStep]);

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

  // Stateless Server-Side Cryptographic CAPTCHA
  const [captchaQuestion, setCaptchaQuestion] = React.useState('');
  const [captchaSignature, setCaptchaSignature] = React.useState('');
  const [captchaAnswer, setCaptchaAnswer] = React.useState('');

  const loadCaptcha = async () => {
    try {
      const response = await fetch('/api/captcha');
      const data = await response.json();
      setCaptchaQuestion(data.question);
      setCaptchaSignature(data.signature);
    } catch (err) {
      console.error("Failed to fetch CAPTCHA from server: ", err);
    }
  };

  React.useEffect(() => {
    loadCaptcha();
  }, []);

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

    if (file.size > 2 * 1024 * 1024) {
      alert("Maximum file attachment size is 2MB.");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Basic Validation
    if (!fullName || !email || !phone || !serviceRequired || !projectDescription) {
      setErrorMessage('Please fill out all required fields.');
      return;
    }

    if (!captchaAnswer) {
      setErrorMessage('Please solve the anti-spam verification challenge.');
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
          captchaAnswer,
          captchaSignature
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
      loadCaptcha(); // load fresh captcha on failure
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
    setCaptchaAnswer('');
    setSuccessInquiryId('');
    setSentEmailPreview(null);
    setBudget('');
    setFileAttachment(null);
    loadCaptcha();
  };

  // Theme Styling helpers
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

  const getCardBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'slate': return 'bg-slate-50 text-slate-800 border-slate-200';
      case 'indigo': return 'bg-indigo-50 text-indigo-800 border-indigo-100';
      case 'violet': return 'bg-violet-50 text-violet-800 border-violet-100';
      case 'deepblue':
      default:
        return 'bg-blue-50 text-blue-800 border-blue-100';
    }
  };

  const getServiceIcon = (title: string) => {
    switch (title) {
      case 'Custom Software Development': return Icons.Code;
      case 'Managed IT Support': return Icons.Cpu;
      case 'Network Infrastructure & Wi-Fi': return Icons.Network;
      case 'IT Consulting & Technology Strategy': return Icons.Briefcase;
      case 'CCTV Installation': return Icons.Camera;
      case 'Cybersecurity Solutions': return Icons.ShieldCheck;
      case 'Mobile, Laptop & Desktop Repair': return Icons.Wrench;
      default: return Icons.Workflow;
    }
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden font-sans" id="inquiry-system-page">
      {/* Decorative mesh/grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Step Header */}
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
            Requirement Intake
          </div>
          <h2 className="text-3xl font-extrabold text-slate-950 font-display">
            IT Service Requirement Form
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans max-w-xl mx-auto leading-relaxed">
            Provide your exact technical objectives below. Our lead consultant will analyze your description and deliver a formal response within 24 hours.
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start space-x-3 shadow-xs" id="inquiry-error-banner">
            <Icons.AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Successful Inquiry Submission View */}
        {successInquiryId ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-12 space-y-8" id="inquiry-success-view">

            {/* Visual Header */}
            <div className="text-center space-y-4">
              <div className="mx-auto h-16 w-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <Icons.CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-955 font-display">Inquiry Submitted Successfully!</h3>
              <p className="text-xs text-slate-500 font-mono">Reference Code: <span className="font-bold text-slate-800">{successInquiryId}</span></p>
            </div>

            {/* Explanatory notice */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl text-xs text-emerald-850 font-sans leading-relaxed">
              <strong>Your inquiry has been stored securely in our system.</strong> A notification has been sent to our administrator mailbox. We have also automatically dispatched a customized acknowledgment email to confirm receipt.
            </div>

            {/* Simulated Email Viewer */}
            {sentEmailPreview && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Simulated Acknowledgment Email Receipt</span>
                  <Icons.Mail className="h-4 w-4 text-slate-400" />
                </div>
                <div className="bg-white p-6 space-y-4 text-xs font-sans text-slate-700">
                  <div>
                    <span className="text-slate-400 block">To:</span>
                    <strong className="text-slate-900">{sentEmailPreview.to}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Subject:</span>
                    <strong className="text-slate-900">{sentEmailPreview.subject}</strong>
                  </div>
                  <hr className="border-slate-100" />
                  <pre className="font-sans whitespace-pre-wrap leading-relaxed text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
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
                <Icons.RotateCcw className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Main Form Layout */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-12 space-y-8 relative overflow-hidden" id="inquiry-form-body">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full pointer-events-none border-b border-l border-slate-100"></div>

            {/* Step progress bar */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 max-w-md mx-auto relative z-10">
              <div className="flex items-center space-x-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${formStep === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : formStep > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {formStep > 1 ? <Icons.Check className="h-4 w-4" /> : '1'}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${formStep === 1 ? getThemeTextClass() : 'text-slate-400'}`}>Services</span>
              </div>
              <div className="flex-1 h-0.5 bg-slate-100 mx-4"></div>
              <div className="flex items-center space-x-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${formStep === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : formStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {formStep > 2 ? <Icons.Check className="h-4 w-4" /> : '2'}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${formStep === 2 ? getThemeTextClass() : 'text-slate-400'}`}>Scope</span>
              </div>
              <div className="flex-1 h-0.5 bg-slate-100 mx-4"></div>
              <div className="flex items-center space-x-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${formStep === 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'bg-slate-100 text-slate-400'}`}>
                  3
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${formStep === 3 ? getThemeTextClass() : 'text-slate-400'}`}>Contact</span>
              </div>
            </div>

            {/* STEP 1: CHOOSE SERVICE SOLUTION */}
            {formStep === 1 && (
              <div className="space-y-6 relative z-10">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-base font-bold text-slate-900 font-display">Select Your Required IT Solution</h3>
                  <p className="text-xs text-slate-500 leading-normal">Choose the primary category that matches your technical requirements.</p>
                </div>

                {/* Service Interactive Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {services.map((service) => {
                    const ServiceIcon = getServiceIcon(service.title);
                    const isSelected = serviceRequired === service.title;
                    return (
                      <div
                        key={service.id}
                        onClick={() => setServiceRequired(service.title)}
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex items-start space-x-4 select-none relative group ${
                          isSelected 
                            ? 'bg-blue-50/30 border-blue-500 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                          <ServiceIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 font-display leading-tight">{service.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{service.description}</p>
                        </div>
                        {isSelected && (
                          <span className="absolute top-3 right-3 text-blue-600">
                            <Icons.CheckCircle2 className="h-4.5 w-4.5 fill-blue-50" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Other Category Option */}
                  <div
                    onClick={() => setServiceRequired('Other IT Related Requirement')}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex items-start space-x-4 select-none relative group ${
                      serviceRequired === 'Other IT Related Requirement'
                        ? 'bg-blue-50/30 border-blue-500 shadow-xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${serviceRequired === 'Other IT Related Requirement' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                      <Icons.Plus className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 font-display leading-tight">Other IT Requirement</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">Any special consulting, hardware procurement, configuration, or custom tech audit task.</p>
                    </div>
                    {serviceRequired === 'Other IT Related Requirement' && (
                      <span className="absolute top-3 right-3 text-blue-600">
                        <Icons.CheckCircle2 className="h-4.5 w-4.5 fill-blue-50" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={!serviceRequired}
                    onClick={() => changeStep(2)}
                    className="inline-flex items-center px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Continue to Scope
                    <Icons.ArrowRight className="ml-2 h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DEFINE PROJECT SCOPE */}
            {formStep === 2 && (
              <div className="space-y-6 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 font-display">Define Project Scope &amp; Specs</h3>
                  <p className="text-xs text-slate-500 leading-normal">Describe your technical targets and specify budget guidelines.</p>
                </div>

                {/* Project Description textarea */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center">
                    Project Description <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    required
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Describe your goals, requirements, constraints, or current systems as clearly as possible..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 bg-white"
                  ></textarea>
                  <span className="text-[10px] text-gray-400 block">Please provide enough context so we can prepare a realistic technical plan.</span>
                </div>

                {/* Budget visual selector */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center">
                    Estimated Project Budget <span className="text-slate-400 text-[10px] lowercase italic ml-1">(optional)</span>
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
                          onClick={() => setBudget(isBudgetChecked ? '' : opt)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer select-none ${
                            isBudgetChecked 
                              ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-750'
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
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display block">
                    Attach Design Specs or Requirements <span className="text-slate-400 text-[10px] lowercase italic">(optional, PDF/Images up to 2MB)</span>
                  </label>
                  
                  <div className="flex items-center space-x-4">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs transition-colors">
                      <Icons.Upload className="h-4 w-4 mr-2" />
                      Select File
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.gif,.svg,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {fileAttachment ? (
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Icons.FileText className="h-4 w-4 text-slate-500" />
                        <span className="text-xs text-slate-700 truncate max-w-xs font-medium">{fileAttachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setFileAttachment(null)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <Icons.X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-sans">No specifications file attached</span>
                    )}
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="flex justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => changeStep(1)}
                    className="inline-flex items-center px-6 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <Icons.ArrowLeft className="mr-2 h-4.5 w-4.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!projectDescription.trim()}
                    onClick={() => changeStep(3)}
                    className="inline-flex items-center px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Continue to Contact
                    <Icons.ArrowRight className="ml-2 h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CONTACT PROFILE & SUBMIT */}
            {formStep === 3 && (
              <div className="space-y-6 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 font-display">Contact Details &amp; Verification</h3>
                  <p className="text-xs text-slate-500 leading-normal">Provide your operational contact parameters to submit securely.</p>
                </div>

                {/* Input Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center">
                      Full Name <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <Icons.User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. John Cahilig"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 bg-white"
                        id="input-fullname"
                      />
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display">
                      Company Name <span className="text-slate-400 text-[10px] lowercase italic">(optional)</span>
                    </label>
                    <div className="relative">
                      <Icons.Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. JLC Solutions Corp"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 bg-white"
                        id="input-companyname"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center">
                      Email Address <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <Icons.Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 bg-white"
                        id="input-email"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center">
                      Phone Number <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <Icons.Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +63 917 123 4567"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 bg-white"
                        id="input-phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferred Contact Method */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display block">
                    Preferred Contact Channel
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Email', 'Phone', 'Any'] as ContactMethod[]).map((method) => {
                      const isChecked = preferredContactMethod === method;
                      return (
                        <button
                          type="button"
                          key={method}
                          onClick={() => setPreferredContactMethod(method)}
                          className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider font-display rounded-full border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
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
                <div className="border-t border-slate-100 pt-6 space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center">
                    Anti-Spam Verification <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-4 py-2.5 rounded-xl font-mono border border-slate-200 shadow-xs select-none min-w-36 text-center">
                      {captchaQuestion || 'Loading...'}
                    </span>
                    <button
                      type="button"
                      onClick={loadCaptcha}
                      className="p-2.5 text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="Load another verification challenge"
                    >
                      <Icons.RefreshCw className="h-4.5 w-4.5" />
                    </button>
                    <input
                      type="number"
                      required
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Your answer"
                      className="w-36 px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-900 font-sans focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white shadow-xs"
                      id="input-anti-spam"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Protects our administrative routing mailbox against automated script payloads.</p>
                </div>

                {/* Actions & Submit */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => changeStep(2)}
                    className="inline-flex items-center justify-center px-6 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <Icons.ArrowLeft className="mr-2 h-4.5 w-4.5" />
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
                        <Icons.Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Secure Inquiry
                        <Icons.Send className="ml-2.5 h-4.5 w-4.5" />
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
