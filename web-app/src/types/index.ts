// Project Configuration Types
export interface ProjectConfig {
  name: string;
  template: string;
  skipConvex: boolean;
  skipClerk: boolean;
  [key: string]: any;
}

// Template Types
export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  features: string[];
  tags: string[];
  isFree: boolean;
  isPopular?: boolean;
  price?: number; // Price in cents
  config: Record<string, TemplateConfigOption>;
}

export interface TemplateConfigOption {
  type: 'boolean' | 'string' | 'number' | 'select';
  default: any;
  label: string;
  options?: string[]; // For select type
}

// Project Generation Types
export interface GenerationProgress {
  jobId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  message?: string;
  downloadUrl?: string;
  error?: string;
}

export interface ProjectJob {
  id: string;
  name: string;
  template: string;
  config: ProjectConfig;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
}

// User Types
export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  subscription?: Subscription;
  usage?: UserUsage;
}

export interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface UserUsage {
  id: string;
  userId: string;
  projectsCreatedThisMonth: number;
  templatesDownloaded: number;
  apiCallsThisMonth: number;
  lastResetDate: Date;
}

// Enums
export enum SubscriptionStatus {
  FREE = 'FREE',
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  PAST_DUE = 'PAST_DUE',
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
  TRIALING = 'TRIALING',
  UNPAID = 'UNPAID',
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum ProjectStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TemplatesResponse {
  templates: Template[];
}

export interface ProjectGenerationResponse {
  jobId: string;
  status: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'progress' | 'subscribe' | 'error';
  jobId?: string;
  data?: any;
}

export interface ProgressMessage extends WebSocketMessage {
  type: 'progress';
  jobId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  message?: string;
  downloadUrl?: string;
  error?: string;
}

// Pricing Types
export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number; // Monthly price in cents
  yearlyPrice?: number; // Yearly price in cents
  features: string[];
  limits: {
    projects: number | 'unlimited';
    templates: 'basic' | 'all' | 'premium';
    support: 'community' | 'priority' | 'dedicated';
    teamMembers?: number;
  };
  popular?: boolean;
  tier: SubscriptionTier;
}

// Form Types
export interface ProjectFormData {
  name: string;
  template: string;
  templateConfig: Record<string, any>;
}

export interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  message: string;
}

// Component Props Types
export interface TemplateCardProps {
  template: Template;
  selected?: boolean;
  onSelect?: (template: Template) => void;
}

export interface ProjectCardProps {
  project: ProjectJob;
  onDownload?: (project: ProjectJob) => void;
  onDelete?: (project: ProjectJob) => void;
}

export interface ProgressBarProps {
  progress: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  currentStep: string;
  animated?: boolean;
} 