import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  // Get real subscription data
  const headersList = await headers();
  const subscriptionResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/subscription/status`, {
    headers: {
      'Cookie': headersList.get('cookie') || '',
    },
  }).catch(() => null);
  
  let userStats = {
    projectsCreated: 0,
    monthlyLimit: 3,
    plan: 'Starter',
    joinedDate: new Date(user.createdAt).toLocaleDateString(),
    status: 'active',
    isOnFreeTrial: false,
  };
  
  if (subscriptionResponse?.ok) {
    const subscriptionData = await subscriptionResponse.json();
    userStats = {
      projectsCreated: subscriptionData.projectsUsed || 0,
      monthlyLimit: subscriptionData.projectsLimit === -1 ? 'Unlimited' : subscriptionData.projectsLimit,
      plan: subscriptionData.plan === 'starter' ? 'Starter' : 
            subscriptionData.plan === 'professional' ? 'Professional' :
            subscriptionData.plan === 'team' ? 'Team' : 'Starter',
      joinedDate: new Date(user.createdAt).toLocaleDateString(),
      status: subscriptionData.status,
      isOnFreeTrial: subscriptionData.isOnFreeTrial,
    };
  }

  // Get real project history
  const projectsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/projects/history`, {
    headers: {
      'Cookie': headersList.get('cookie') || '',
    },
  }).catch(() => null);
  
  let recentProjects: any[] = [];
  if (projectsResponse?.ok) {
    const projectsData = await projectsResponse.json();
    recentProjects = projectsData.projects || [];
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Welcome back, {user.firstName || user.emailAddresses[0].emailAddress}
              </span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-gray-500">Projects Created</h2>
                <p className="text-2xl font-semibold text-gray-900">
                  {userStats.projectsCreated}{typeof userStats.monthlyLimit === 'string' ? '' : `/${userStats.monthlyLimit}`}
                  {typeof userStats.monthlyLimit === 'string' && (
                    <span className="text-sm text-gray-500 ml-2">this month</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-gray-500">Current Plan</h2>
                <p className="text-2xl font-semibold text-gray-900">{userStats.plan}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-gray-500">Member Since</h2>
                <p className="text-2xl font-semibold text-gray-900">{userStats.joinedDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg text-center transition-colors"
            >
              <div className="text-xl font-semibold mb-2">Create New Project</div>
              <div className="text-blue-100">Start building your next application</div>
            </Link>
            
            <Link 
              href="/pricing"
              className="bg-white hover:bg-gray-50 text-gray-900 p-6 rounded-lg text-center border border-gray-200 transition-colors"
            >
              <div className="text-xl font-semibold mb-2">Upgrade Plan</div>
              <div className="text-gray-500">Get unlimited projects and premium templates</div>
            </Link>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Projects</h2>
          </div>
          
          {recentProjects.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {recentProjects.map((project) => (
                <div key={project.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-500">Template: {project.template}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900">{project.createdAt}</div>
                      <div className="text-sm text-green-600 capitalize">{project.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No projects yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first project.</p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Project
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 