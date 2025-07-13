'use client';

import { useState, useEffect } from 'react';
// import { useUser } from '@clerk/nextjs'; // Temporarily disabled for testing
import Link from 'next/link';
import { config } from '@/lib/config';
import { 
  Template, 
  ProjectConfig, 
  GenerationProgress, 
  TemplatesResponse 
} from '@/types';

export function ProjectGenerator() {
  // const { isSignedIn, user, isLoaded } = useUser(); // Temporarily disabled for testing
  const isSignedIn = true; // For testing without authentication
  const user = { id: 'test_user_123' }; // Mock user for testing without authentication
  const isLoaded = true; // For testing without authentication
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({
    name: '',
    template: '',
    skipConvex: false,
    skipClerk: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [step, setStep] = useState(1);

  // Fetch available templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  // WebSocket connection for real-time progress
  useEffect(() => {
    if (progress?.jobId && !ws) {
      connectWebSocket(progress.jobId);
    }
    
    return () => {
      if (ws) {
        ws.close();
        setWs(null);
      }
    };
  }, [progress?.jobId, ws]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data: TemplatesResponse = await response.json();
      setTemplates(data.templates);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setLoading(false);
    }
  };

  const connectWebSocket = (jobId: string) => {
    try {
      const websocket = new WebSocket(config.WS_URL);
      
      websocket.onopen = () => {
        websocket.send(JSON.stringify({
          type: 'subscribe',
          jobId
        }));
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'progress') {
            setProgress(prev => prev ? { ...prev, ...data } : null);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      websocket.onclose = () => {
        setWs(null);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWs(null);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setProjectConfig(prev => ({
      ...prev,
      template: template.id,
      ...Object.fromEntries(
        Object.entries(template.config).map(([key, option]) => [key, option.default])
      )
    }));
    setStep(2);
  };

  const handleConfigChange = (key: string, value: any) => {
    setProjectConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleGenerate = async () => {
    if (!isSignedIn) {
      alert('Please sign in to generate projects');
      return;
    }
    
    if (!projectConfig.name.trim() || !selectedTemplate) {
      alert('Please enter a project name and select a template');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Check subscription limits first
      const subscriptionResponse = await fetch('/api/subscription/check-limits');
      const subscriptionData = await subscriptionResponse.json();
      
      if (!subscriptionData.canGenerate) {
        alert(subscriptionData.reason || 'Unable to generate project');
        if (subscriptionData.upgradeRequired) {
          window.location.href = '/pricing';
        }
        setIsGenerating(false);
        return;
      }
      
      const response = await fetch('/api/project/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...projectConfig,
          userId: user?.id,
        }),
      });

      const data = await response.json();
      
      if (data.jobId) {
        setProgress({
          jobId: data.jobId,
          status: 'pending',
          progress: 0,
          currentStep: 'Initializing project generation...',
        });
        setStep(3);
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to start project generation');
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (progress?.downloadUrl) {
      window.open(progress.downloadUrl, '_blank');
    }
  };

  const resetGenerator = () => {
    setIsGenerating(false);
    setProgress(null);
    setStep(1);
    setSelectedTemplate(null);
    setProjectConfig({
      name: '',
      template: '',
      skipConvex: false,
      skipClerk: false,
    });
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              1
            </div>
            <span className="ml-2 font-medium">Select Template</span>
          </div>
          
          <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              2
            </div>
            <span className="ml-2 font-medium">Configure Project</span>
          </div>
          
          <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
            <span className="ml-2 font-medium">Generate & Download</span>
          </div>
        </div>
      </div>

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Choose Your Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
                  selectedTemplate?.id === template.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  <div className="flex gap-2">
                    {template.isPopular && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        Popular
                      </span>
                    )}
                    {template.isFree ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        Free
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        ${(template.price! / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Features
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.features.map((feature, index) => (
                        <span 
                          key={index}
                          className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Category
                    </span>
                    <div className="text-sm text-gray-700 mt-1">{template.category}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Project Configuration */}
      {step === 2 && selectedTemplate && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Configure Your Project</h2>
            <button
              onClick={prevStep}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Templates
            </button>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Selected Template</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{selectedTemplate.name}</h4>
                    <p className="text-gray-600 text-sm">{selectedTemplate.description}</p>
                  </div>
                  {selectedTemplate.isFree ? (
                    <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded">
                      Free
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">
                      ${(selectedTemplate.price! / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={projectConfig.name}
                  onChange={(e) => handleConfigChange('name', e.target.value)}
                  placeholder="my-awesome-project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use lowercase letters, numbers, and hyphens only
                </p>
              </div>

              {/* Template Configuration */}
              {Object.entries(selectedTemplate.config).map(([key, option]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {option.label}
                  </label>
                  
                  {option.type === 'boolean' && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={projectConfig[key] || false}
                        onChange={(e) => handleConfigChange(key, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600">
                        {option.label}
                      </span>
                    </label>
                  )}
                  
                  {option.type === 'string' && (
                    <input
                      type="text"
                      value={projectConfig[key] || ''}
                      onChange={(e) => handleConfigChange(key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                  
                  {option.type === 'select' && option.options && (
                    <select
                      value={projectConfig[key] || option.default}
                      onChange={(e) => handleConfigChange(key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {option.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-8">
              {!isLoaded ? (
                <div className="animate-pulse bg-gray-200 h-10 w-32 rounded-md"></div>
              ) : !isSignedIn ? (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Sign in to generate your project</p>
                  <div className="flex gap-3 justify-center">
                    <Link
                      href="/sign-in"
                      className="bg-gray-100 text-gray-900 px-6 py-2 rounded-md hover:bg-gray-200 font-medium"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/sign-up"
                      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!projectConfig.name.trim() || isGenerating}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isGenerating ? 'Starting Generation...' : 'Generate Project'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Generation Progress */}
      {step === 3 && progress && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Generating Your Project</h2>
          
          <div className="bg-white rounded-lg border p-6">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-500">{progress.progress}%</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.status === 'completed' ? 'bg-green-500' :
                    progress.status === 'failed' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">Status</h3>
                <p className="text-sm text-gray-600 capitalize">{progress.status}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900">Current Step</h3>
                <p className="text-sm text-gray-600">{progress.currentStep}</p>
              </div>
              
              {progress.message && (
                <div>
                  <h3 className="font-medium text-gray-900">Details</h3>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                    {progress.message}
                  </p>
                </div>
              )}
              
              {progress.error && (
                <div>
                  <h3 className="font-medium text-red-900">Error</h3>
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {progress.error}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={resetGenerator}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Start New Project
              </button>
              
              {progress.status === 'completed' && progress.downloadUrl && (
                <button
                  onClick={handleDownload}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-medium"
                >
                  Download Project
                </button>
              )}
              
              {progress.status === 'failed' && (
                <button
                  onClick={resetGenerator}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 