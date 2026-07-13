/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ContactMethod = 'Email' | 'Phone' | 'Any';
export type InquiryStatus = 'New' | 'In Progress' | 'Completed' | 'Closed';
export type AdminRole = 'Super Admin' | 'Administrator' | 'Editor';

export interface Inquiry {
  id: string;
  fullName: string;
  companyName?: string;
  email: string;
  phone: string;
  serviceRequired: string;
  projectDescription: string;
  preferredContactMethod: ContactMethod;
  status: InquiryStatus;
  createdAt: string;
  adminNotes: string;
  budget?: string;
  fileAttachment?: {
    name: string;
    type: string;
    base64: string;
  };
}

export interface Service {
  id: string;
  title: string;
  description: string;
  iconName: string; // Lucide icon identifier
  features: string[];
}

export interface BrandingSettings {
  companyName: string;
  tagline: string;
  logoType: 'text' | 'icon' | 'image';
  logoText: string;
  logoIcon: string; // Lucide icon name
  logoImageBase64?: string; // Stored logo image
  themeColor: 'deepblue' | 'emerald' | 'slate' | 'indigo' | 'violet';
}

export interface WhyChooseUsPoint {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export interface ContentSettings {
  heroTitle: string;
  heroSubtitle: string;
  heroBadge?: string;
  aboutHeader?: string;
  aboutSubheader?: string;
  aboutText: string;
  aboutText2?: string;
  aboutMission: string;
  aboutVision: string;
  aboutCommitments?: { id: string; title: string; description: string; iconName: string }[];
  aboutImageBase64?: string;
  whyChooseUsText: string;
  whyChooseUsPoints: WhyChooseUsPoint[];
  whyChooseUsPromiseTitle?: string;
  whyChooseUsPromiseDesc?: string;
  whyChooseUsPromises?: { id: string; title: string; description: string }[];
  whyChooseUsCtaTitle?: string;
  whyChooseUsCtaDesc?: string;
  servicesHeader?: string;
  servicesSubtitle?: string;
  portfolioHeader?: string;
  portfolioSubtitle?: string;
  processHeader?: string;
  processSubtitle?: string;
  faqHeader?: string;
  faqSubtitle?: string;
  contactHeader?: string;
  contactSubtitle?: string;
  contactAddress: string;
  contactPhone: string;
  contactEmail: string;
  contactWorkingHours: string;
  contactMapEmbedUrl: string; // Embeddable Google Map URL
  bannerImageUrl: string;
  facebookUrl?: string;
  whatsappUrl?: string;
  viberUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface AdminAccount {
  email: string;
  fullName: string;
  role: AdminRole;
  passwordHash?: string;
  status: 'Active' | 'Disabled' | 'Invited';
  verified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  createdAt: string;
}

export interface SentEmail {
  id: string;
  inquiryId: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  type: 'Acknowledgment' | 'Manual Reply';
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  senderName: string;
  senderEmail: string;
  signature: string;
  enabled: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ProcessStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  iconName: string;
}

export interface RoadmapStep {
  id: string;
  timeline: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'planned';
}

export interface AuditLog {
  timestamp: string;
  type: string;
  message: string;
}

export interface ProjectGalleryItem {
  id: string;
  title: string;
  description: string;
  category: string;
  imageBase64: string;
}

export interface WebsiteData {
  inquiries: Inquiry[];
  services: Service[];
  branding: BrandingSettings;
  content: ContentSettings;
  emailTemplate: EmailTemplate;
  admins: AdminAccount[];
  sentEmails: SentEmail[];
  smtpSettings: SmtpSettings;
  faqs: FaqItem[];
  processSteps: ProcessStep[];
  roadmapSteps: RoadmapStep[];
  auditLogs: AuditLog[];
  projectGallery: ProjectGalleryItem[];
}

// Default settings to seed our application
export const DEFAULT_SERVICES: Service[] = [
  {
    id: 's1',
    title: 'Custom Software Development',
    description: 'End-to-end development of custom web, mobile, and desktop applications tailored to solve unique business bottlenecks and streamline operations.',
    iconName: 'Code',
    features: [
      'React & Node.js Web Apps',
      'Cross-Platform Mobile Apps',
      'API Integrations & Custom Webhooks',
      'Database Engineering & Modernization'
    ]
  },
  {
    id: 's2',
    title: 'Managed IT Support',
    description: 'Proactive remote monitoring, security patches, backups, and prompt helpdesk troubleshooting to keep your workplace technology running smoothly around the clock.',
    iconName: 'Cpu',
    features: [
      '24/7 Server & System Monitoring',
      'Helpdesk Technical Assistance',
      'Automated Daily Cloud Backups',
      'OS Patching & Application Updates'
    ]
  },
  {
    id: 's3',
    title: 'Network Infrastructure & Wi-Fi',
    description: 'Engineering and layout of reliable high-performance office network systems, firewall security systems, and high-density Wi-Fi networks.',
    iconName: 'Network',
    features: [
      'Router & Layer-3 Switch Setup',
      'Structured Ethernet Cabling & Rack Layout',
      'Secure Site-to-Site VPN Setup',
      'Wi-Fi Heatmaps & Optimization'
    ]
  },
  {
    id: 's4',
    title: 'IT Consulting & Technology Strategy',
    description: 'Strategic vendor advisory, standard compliance mapping, architecture blueprints, and technology roadmap planning aligned directly with business scaling metrics.',
    iconName: 'Briefcase',
    features: [
      'Digital Transformation Blueprints',
      'IT Infrastructure Compliance Audits',
      'Disaster Recovery Strategy',
      'Capacity Planning & Budgeting'
    ]
  },
  {
    id: 's5',
    title: 'CCTV Installation',
    description: 'Deployment of smart high-definition security camera networks, remote live viewing configurations, secure storage arrays, and network video recorders.',
    iconName: 'Camera',
    features: [
      'IP Camera Deployments',
      'Network Video Recorder Setup',
      'Remote App Live Viewing Integration',
      'Motion Detection Alerts Config'
    ]
  },
  {
    id: 's6',
    title: 'Cybersecurity Solutions',
    description: 'Comprehensive data protection layers, endpoint threat detection, advanced firewall setup, vulnerability scans, and security awareness training.',
    iconName: 'ShieldCheck',
    features: [
      'Threat Vulnerability Scans',
      'Endpoint Protection & Firewalls',
      'IAM Security & Multi-Factor Auth',
      'Employee Cybersecurity Training'
    ]
  },
  {
    id: 's7',
    title: 'Mobile, Laptop & Desktop Repair',
    description: 'Accurate physical diagnostics, hardware component replacements (RAM/SSD upgrades), liquid damage recovery, and operating system restorations.',
    iconName: 'Wrench',
    features: [
      'RAM & High-Speed SSD Upgrades',
      'Laptop Screen & Keyboard Swaps',
      'Data Retrieval & Restoration',
      'OS Clean Restores & Malware Removal'
    ]
  }
];

export const DEFAULT_WHY_POINTS: WhyChooseUsPoint[] = [
  {
    id: 'w1',
    title: 'Client-Centric Philosophy',
    description: 'We listen first. We design IT solutions around your operational bottlenecks and budget constraints, never suggesting unneeded technologies.',
    iconName: 'Heart'
  },
  {
    id: 'w2',
    title: 'Pristine Code & Quality',
    description: 'We pride ourselves on writing clean, secure, scalable code and setting up well-architected systems that stand the test of time.',
    iconName: 'CheckCircle'
  },
  {
    id: 'w3',
    title: 'Transparent Communication',
    description: 'No technical jargon. We explain what needs to be done, how long it will take, and what it costs with absolute transparency and honesty.',
    iconName: 'MessageSquare'
  },
  {
    id: 'w4',
    title: 'Rigorous Security Standards',
    description: 'Security is not an afterthought. Every solution we build or integrate is hardened against modern security threats from day one.',
    iconName: 'Lock'
  }
];

export const DEFAULT_BRANDING: BrandingSettings = {
  companyName: 'JLC Solutions',
  tagline: 'Empowering Businesses with Reliable, Innovative Technology Services',
  logoType: 'icon',
  logoText: 'JLC',
  logoIcon: 'Activity',
  themeColor: 'deepblue'
};

export const DEFAULT_ABOUT_COMMITMENTS = [
  {
    id: 'ac1',
    title: 'No Hidden Conditions',
    description: 'What we outline in our project scope is exactly what you get, with zero unexpected charges.',
    iconName: 'ShieldAlert'
  },
  {
    id: 'ac2',
    title: 'Meticulous Standards',
    description: 'Every line of code and infrastructure layout follows industry-wide security and performance best practices.',
    iconName: 'Code2'
  },
  {
    id: 'ac3',
    title: 'Direct Communication',
    description: 'You work directly with John Cahilig, the lead systems architect, ensuring no loss of requirements.',
    iconName: 'UserCheck'
  }
];

export const DEFAULT_WHY_PROMISES = [
  {
    id: 'p1',
    title: 'Direct Architect Access',
    description: 'Work directly with John Cahilig, lead developer & system architect, on all project scopes.'
  },
  {
    id: 'p2',
    title: 'Transparent Estimates',
    description: 'We write structured project bids with zero hidden fees, licensing surcharges, or ad-hoc costs.'
  },
  {
    id: 'p3',
    title: 'Industry Standard Audited',
    description: 'Cabling layouts and backend architectures conform to EIA/TIA and secure server schemas.'
  }
];

export const DEFAULT_CONTENT: ContentSettings = {
  heroTitle: 'Innovative IT Solutions Crafted for Business Growth',
  heroSubtitle: 'At JLC Solutions, we deliver premium software, cloud migration, and secure network infrastructure. Reliable, client-focused engineering to build a stable foundation for your company.',
  heroBadge: 'Ready for Inquiries',
  aboutHeader: 'Your Strategic Technical Partner',
  aboutSubheader: 'Establishing a Strong, Trustworthy Foundation for Future Tech Growth',
  aboutText: 'JLC Solutions was founded on the principle that small and medium businesses deserve the same high-caliber technology expertise as multi-million dollar corporations. We act as your strategic technology partner, ensuring your systems are fast, reliable, and secure, so you can focus entirely on your core business.',
  aboutText2: 'We understand that choosing an IT support and custom development partner is an exercise in trust. That\'s why we focus on absolute transparency: we do not inflate our stats, utilize fake client testimonials, or oversell. Instead, we deliver world-class engineering, bulletproof security protocols, and meticulous documentation, ensuring your technology investments support long-term stability and organic growth.',
  aboutMission: 'To build exceptional, stable, and secure technology foundations for growing businesses through high-quality custom development, cloud engineering, and honest IT guidance.',
  aboutVision: 'To be the most trusted, reliable, and client-centric boutique IT consulting and software development provider in the industry, powering future-ready business ecosystems.',
  aboutCommitments: DEFAULT_ABOUT_COMMITMENTS,
  aboutImageBase64: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=crop',
  whyChooseUsText: 'We do not sell pre-packaged, oversized services. We provide honest, scalable, and highly customized tech services driven by a commitment to reliability, trust, and premium quality.',
  whyChooseUsPoints: DEFAULT_WHY_POINTS,
  whyChooseUsPromiseTitle: 'Stable Future Engineering Commitments',
  whyChooseUsPromiseDesc: 'We formulate technology options centered strictly around integrity, performance specifications, and standard protocol compliance.',
  whyChooseUsPromises: DEFAULT_WHY_PROMISES,
  whyChooseUsCtaTitle: 'Need a tailor-made technological solution?',
  whyChooseUsCtaDesc: 'We are dedicated to building long-term, stable technical systems. No matter how simple or complex your project, we will provide a realistic estimate and deliver standard-compliant, pristine execution.',
  servicesHeader: 'Our Technology Offerings',
  servicesSubtitle: 'We offer professional, standard-compliant technology engineering and structured IT services for scaling startups and modern workspaces.',
  portfolioHeader: 'Portfolio Showcase',
  portfolioSubtitle: 'Explore some of our recently delivered software architectures, structured cabling deployments, and custom IT strategy integrations.',
  processHeader: 'Our Operational Lifecycle',
  processSubtitle: 'How we consult, design, implement, and proactively support your startup\'s technology ecosystem with absolute clarity.',
  faqHeader: 'Frequently Asked Questions',
  faqSubtitle: 'Have questions about our custom IT strategy compliance, pricing, or remote patch monitoring? Here are quick answers to common queries.',
  contactHeader: 'Connect With JLC Solutions',
  contactSubtitle: 'Have questions about our technology capabilities, security controls, or pricing models? Let us know. We respond to all inquiries within 1 business day.',
  contactAddress: '123 Tech Avenue, Innovation District, Manila, Philippines',
  contactPhone: '+63 917 123 4567',
  contactEmail: 'contact@jlcsolutions.com',
  contactWorkingHours: 'Monday - Friday: 9:00 AM - 6:00 PM (PHT)',
  contactMapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15444.29871147774!2d121.02237076939947!3d14.599512165038162!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c9ed8c715f91%3A0x63cd2e0e93bdf48!2sManila%2C%20Metro%20Manila!5e0!3m2!1sen!2sph!4v1688123456789!5m2!1sen!2sph',
  bannerImageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
  facebookUrl: 'https://facebook.com/jlcsolutions',
  whatsappUrl: 'https://wa.me/639171234567',
  viberUrl: 'viber://chat?number=639171234567'
};

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  subject: 'Thank You for contacting JLC Solutions!',
  body: `Dear {{name}},

Thank you for reaching out to JLC Solutions! We have received your inquiry regarding our {{service}} service.

Our team is currently reviewing your project description:
"{{projectDescription}}"

We will get back to you shortly via your preferred contact method ({{preferredContact}}). If you need immediate assistance, please feel free to call us at {{companyPhone}}.

Best regards,
The JLC Solutions Team
Email: {{companyEmail}}
Phone: {{companyPhone}}`
};

export const DEFAULT_ADMINS: AdminAccount[] = [
  {
    email: 'admin@jlcsolutions.com',
    fullName: 'John Lloyd Cahilig',
    role: 'Super Admin',
    status: 'Active',
    verified: true,
    createdAt: '2026-06-29T15:45:00Z'
  }
];

export const DEFAULT_SMTP_SETTINGS: SmtpSettings = {
  host: 'smtp.mailtrap.io',
  port: 2525,
  username: '',
  password: '',
  senderName: 'JLC Solutions',
  senderEmail: 'contact@jlcsolutions.com',
  signature: 'Best regards,\nJLC Solutions Support Team',
  enabled: false
};

export const DEFAULT_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'What types of businesses do you support?',
    answer: 'We support small to medium businesses (SMBs), growing startups, as well as residential/individual clients who require reliable IT consulting, custom software, office networking, and cybersecurity systems.'
  },
  {
    id: 'faq-2',
    question: 'Do you offer 24/7 network monitoring?',
    answer: 'Yes, our Managed IT Services include 24/7 remote monitoring of server health, firewall activity, and secure local area networks to prevent anomalies before they affect operations.'
  },
  {
    id: 'faq-3',
    question: 'How do you handle data privacy and security?',
    answer: 'Security is at the heart of JLC Solutions. We implement strict multi-factor authentication, endpoint firewalls, automated encrypted backups, and custom Access Control systems configured for high data compliance.'
  },
  {
    id: 'faq-4',
    question: 'Can you build custom APIs and software systems?',
    answer: 'Absolutely. We design and deliver custom full-stack web architectures, REST APIs, and automated databases matching standard coding specs, ensuring a high-quality product.'
  }
];

export const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  {
    id: 'step-1',
    stepNumber: 1,
    title: 'Technical Consultation',
    description: 'We meet with your team to review your current infrastructure, pain points, and technical objectives with absolute transparency.',
    iconName: 'MessageSquare'
  },
  {
    id: 'step-2',
    stepNumber: 2,
    title: 'Architect & Design',
    description: 'Our lead consultant builds a comprehensive solution design, outlining exact dependencies, pricing models, and hardware specifications.',
    iconName: 'FileText'
  },
  {
    id: 'step-3',
    stepNumber: 3,
    title: 'Secure Implementation',
    description: 'We build your codebase, deploy servers, or run network cabling according to high industry standards and security compliance.',
    iconName: 'Cpu'
  },
  {
    id: 'step-4',
    stepNumber: 4,
    title: 'Testing & Delivery',
    description: 'Every endpoint and capability undergoes thorough quality assurance, vulnerability scans, and load testing prior to operational handover.',
    iconName: 'ShieldCheck'
  },
  {
    id: 'step-5',
    stepNumber: 5,
    title: 'Ongoing Management',
    description: 'We provide active patch monitoring, automated backups, and instant remote technical assistance to keep your startup scaling.',
    iconName: 'Activity'
  }
];

export const DEFAULT_ROADMAP_STEPS: RoadmapStep[] = [
  {
    id: 'rm-1',
    timeline: 'Q3 2026',
    title: 'Service Catalog Expansion',
    description: 'Adding advanced smart office automation and custom IoT integration services to our dynamic capabilities.',
    status: 'in-progress'
  },
  {
    id: 'rm-2',
    timeline: 'Q4 2026',
    title: 'Security Compliance Auditing',
    description: 'Obtaining full SOC2 Type II certification to elevate enterprise confidence and client trust.',
    status: 'planned'
  },
  {
    id: 'rm-3',
    timeline: 'Q1 2027',
    title: 'Interactive Client Portal',
    description: 'Launching a secure self-service portal for active inquiries, real-time ticket tracking, and contract invoices.',
    status: 'planned'
  }
];

export const DEFAULT_PROJECT_GALLERY: ProjectGalleryItem[] = [
  {
    id: 'gal-1',
    title: 'HQ Structured Network & Fiber Cabling',
    description: 'Designed and installed a high-speed fiber backbone infrastructure and structured network racks for a multi-floor startup headquarters.',
    category: 'Network Installation',
    imageBase64: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNTAwIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iIzBmMTcyYSIvPgogIDxjaXJjbGUgY3g9IjQwMCIgY3k9IjI1MCIgcj0iMTIwIiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS1kYXNoYXJyYXk9IjEwIDUiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxjaXJjbGUgY3g9IjQwMCIgY3k9IjI1MCIgcj0iNjAiIGZpbGw9IiMxZDRlZDgiIG9wYWNpdHk9IjAuMiIvPgogIDxyZWN0IHg9IjM1MCIgeT0iMjEwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjgwIiByeD0iMTAiIGZpbGw9IiMxZTI5M2IiIHN0cm9rZT0iIzNiODJmNiIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPHRleHQgeD0iNDAwIiB5PSIyNTUiIGZpbGw9IiNmZmZmZmYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q09SRSBHQVRFV0FZPC90ZXh0PgogIDxjaXJjbGUgY3g9IjIwMCIgY3k9IjE1MCIgcj0iMTUiIGZpbGw9IiMxMGI5ODEiLz4KICA8cGF0aCBkPSJNIDIwMCAxNTAgTCAzNTAgMjUwIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxjaXJjbGUgY3g9IjYwMCIgY3k9IjE1MCIgcj0iMTUiIGZpbGw9IiMxMGI5ODEiLz4KICA8cGF0aCBkPSJNIDYwMCAxNTAgTCA0NTAgMjUwIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxjaXJjbGUgY3g9IjIwMCIgY3k9IjM1MCIgcj0iMTUiIGZpbGw9IiNmNTllMGIiLz4KICA8cGF0aCBkPSJNIDIwMCAzNTAgTCAzNTAgMjUwIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxjaXJjbGUgY3g9IjYwMCIgY3k9IjM1MCIgcj0iMTUiIGZpbGw9IiNlZjQ0NDQiLz4KICA8cGF0aCBkPSJNIDYwMCAzNTAgTCA0NTAgMjUwIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4='
  },
  {
    id: 'gal-2',
    title: 'Custom ERP Logistics & Admin Portal',
    description: 'Developed and launched a custom React & Node.js ERP system featuring real-time warehouse inventory pipelines and invoicing modules.',
    category: 'Software Engineering',
    imageBase64: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNTAwIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iIzBiMTMyOSIvPgogIDxyZWN0IHg9IjE1MCIgeT0iMTAwIiB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgcng9IjgiIGZpbGw9IiMxYzI1NDEiIHN0cm9rZT0iIzQ4Y2FlNCIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGNpcmNsZSBjeD0iMTgwIiBjeT0iMTIwIiByPSI2IiBmaWxsPSIjZmY1ZjU2Ii8+CiAgPGNpcmNsZSBjeD0iMjAwIiBjeT0iMTIwIiByPSI2IiBmaWxsPSIjZmZiZDJlIi8+CiAgPGNpcmNsZSBjeD0iMjIwIiBjeT0iMTIwIiByPSI2IiBmaWxsPSIjMjdjOTNmIi8+CiAgPHJlY3QgeD0iMTgwIiB5PSIxNjAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIiIHJ4PSI0IiBmaWxsPSIjMDBiNGQ4Ii8+CiAgPHJlY3QgeD0iMTgwIiB5PSIxOTAiIHdpZHRoPSIzMDAiIGhlaWdodD0iMTIiIHJ4PSI0IiBmaWxsPSIjOTBlMGVmIi8+CiAgPHJlY3QgeD0iMjIwIiB5PSIyMjAiIHdpZHRoPSIyNTAiIGhlaWdodD0iMTIiIHJ4PSI0IiBmaWxsPSIjY2FmMGY4Ii8+CiAgPHJlY3QgeD0iMjIwIiB5PSIyNTAiIHdpZHRoPSIxODAiIGhlaWdodD0iMTIiIHJ4PSI0IiBmaWxsPSIjMDA3N2I2Ii8+CiAgPHRleHQgeD0iNDAwIiB5PSIzNDAiIGZpbGw9IiNmZmZmZmYiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4mbHQ7IEpMQ19FUlBfUE9SVEFMIC8mZ3Q7PC90ZXh0Pgo8L3N2Zz4='
  },
  {
    id: 'gal-3',
    title: 'Hybrid Multi-Cloud Database Migration',
    description: 'Migrated and replicated legacy databases to secure AWS and Google Cloud environments utilizing Kubernetes automated containers.',
    category: 'Cloud Infrastructure',
    imageBase64: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNTAwIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iIzE4MDAyMiIvPgogIDxwYXRoIGQ9Ik0gMzAwIDI4MCBDIDI2MCAyODAgMjQwIDI1MCAyNjAgMjIwIEMgMjYwIDE4MCAzMDAgMTUwIDM1MCAxNjAgQyAzNzAgMTMwIDQyMCAxMzAgNDQwIDE2MCBDIDQ5MCAxNTAgNTMwIDE4MCAgNTMwIDIyMCBDIDU1MCAyNTAgNTMwIDI4MCA0OTAgMjgwIFoiIGZpbGw9IiM3MjA5YjciIG9wYWNpdHk9IjAuMyIvPgogIDxwYXRoIGQ9Ik0gMzUwIDMxMCBDIDMxMCAzMTAgMjkwIDI4MCAzMTAgMjUwIEMgMzEwIDIxMCAzNTAgMTgwIDQwMCAxOTAgQyA5MjAgMTYwIDQ3MCAxNjAgNDkwIDE5MCBDIDU0MCAxODAgNTgwIDIxMCAgNTgwIDI1MCBDIDYwMCAyODAgNTgwIDMxMCA1NDAgMzEwIFoiIGZpbGw9IiNmNzI1ODUiIG9wYWNpdHk9IjAuMiIvPgogIDxlbGxpcHNlIGN4PSI0MDAiIGN5PSIzNDAiIHJ4PSI2MCIgcnk9IjIwIiBmaWxsPSIjM2YzN2M5IiBzdHJva2U9IiM0Y2M5ZjAiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxlbGxpcHNlIGN4PSI0MDAiIGN5PSIzMTAiIHJ4PSI2MCIgcnk9IjIwIiBmaWxsPSIjM2YzN2M5IiBzdHJva2U9IiM0Y2M5ZjAiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxlbGxpcHNlIGN4PSI0MDAiIGN5PSIyODAiIHJ4PSI2MCIgcnk9IjIwIiBmaWxsPSIjM2YzN2M5IiBzdHJva2U9IiM0Y2M5ZjAiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxsaW5lIHgxPSI0MDAiIHkxPSIyMDAiIHgyPSI0MDAiIHkyPSIyODAiIHN0cm9rZT0iIzRjYzlmMCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtZGFzaGFycmF5PSI1IDUiLz4KPC9zdmc+'
  }
];

