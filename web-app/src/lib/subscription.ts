import { PrismaClient } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';

const prisma = new PrismaClient();

export interface UserSubscription {
  plan: string;
  status: string;
  projectsUsed: number;
  projectsLimit: number;
  canGenerateProjects: boolean;
  isOnFreeTrial: boolean;
  trialEndsAt?: Date;
}

export async function getUserSubscription(): Promise<UserSubscription | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Count projects created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const projectsThisMonth = await prisma.project.count({
      where: {
        userId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Determine plan and limits
    let plan = 'starter';
    let projectsLimit = 3; // Starter plan limit
    let status = 'active';
    let isOnFreeTrial = false;
    let trialEndsAt: Date | undefined;

    if (subscription) {
      plan = subscription.plan;
      status = subscription.status;
      
      // Check if on free trial
      if (subscription.trialEndsAt && subscription.trialEndsAt > new Date()) {
        isOnFreeTrial = true;
        trialEndsAt = subscription.trialEndsAt;
      }

      // Set limits based on plan
      switch (plan) {
        case 'professional':
        case 'team':
        case 'enterprise':
          projectsLimit = -1; // Unlimited
          break;
        default:
          projectsLimit = 3; // Starter plan
      }
    }

    const canGenerateProjects = 
      projectsLimit === -1 || // Unlimited plan
      projectsThisMonth < projectsLimit; // Within monthly limit

    return {
      plan,
      status,
      projectsUsed: projectsThisMonth,
      projectsLimit,
      canGenerateProjects,
      isOnFreeTrial,
      trialEndsAt,
    };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
}

export async function checkProjectGenerationLimit(): Promise<{
  canGenerate: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}> {
  const subscription = await getUserSubscription();
  
  if (!subscription) {
    return {
      canGenerate: false,
      reason: 'Please sign in to generate projects',
    };
  }

  if (subscription.status !== 'active' && !subscription.isOnFreeTrial) {
    return {
      canGenerate: false,
      reason: 'Your subscription is not active',
      upgradeRequired: true,
    };
  }

  if (!subscription.canGenerateProjects) {
    return {
      canGenerate: false,
      reason: `You've reached your monthly limit of ${subscription.projectsLimit} projects`,
      upgradeRequired: true,
    };
  }

  return { canGenerate: true };
}

export async function recordProjectGeneration(projectData: {
  name: string;
  template: string;
  userId: string;
}): Promise<void> {
  try {
    await prisma.project.create({
      data: {
        userId: projectData.userId,
        name: projectData.name,
        template: projectData.template,
        status: 'completed',
      },
    });
  } catch (error) {
    console.error('Error recording project generation:', error);
    throw error;
  }
}

export function getPlanFeatures(plan: string) {
  const plans = {
    starter: {
      name: 'Starter',
      projectsPerMonth: 3,
      templates: ['basic'],
      support: 'community',
      features: [
        '3 projects per month',
        'Basic templates',
        'Community support',
      ],
    },
    professional: {
      name: 'Professional',
      projectsPerMonth: -1, // Unlimited
      templates: ['basic', 'premium'],
      support: 'priority',
      features: [
        'Unlimited projects',
        'All premium templates',
        'Priority support',
        'Project history',
      ],
    },
    team: {
      name: 'Team',
      projectsPerMonth: -1, // Unlimited
      templates: ['basic', 'premium'],
      support: 'priority',
      teamMembers: 10,
      features: [
        'Everything in Professional',
        'Up to 10 team members',
        'Shared workspaces',
        'Team analytics',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      projectsPerMonth: -1, // Unlimited
      templates: ['basic', 'premium', 'custom'],
      support: 'dedicated',
      teamMembers: -1, // Unlimited
      features: [
        'Everything in Team',
        'Unlimited team members',
        'Custom templates',
        'Dedicated support',
        'SLA guarantee',
      ],
    },
  };

  return plans[plan as keyof typeof plans] || plans.starter;
} 