#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const helmet = require('helmet');
const rateLimit = require('rate-limiter-flexible');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const archiver = require('archiver');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env.PORT || 3001;
const TEMP_DIR = path.join(__dirname, '../temp');
const CLI_SCRIPT_PATH = path.join(__dirname, '../../../create-next-starter.sh');

// Ensure temp directory exists
fs.ensureDirSync(TEMP_DIR);

// Rate limiting configuration
const rateLimiter = new rateLimit.RateLimiterMemory({
  keyPrefix: 'project_generation',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10, // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600, // Per hour in seconds
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Job tracking
const activeJobs = new Map();
const connectedClients = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  connectedClients.set(clientId, ws);
  
  console.log(`📡 WebSocket client connected: ${clientId}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe' && data.jobId) {
        ws.jobId = data.jobId;
        console.log(`🔗 Client ${clientId} subscribed to job: ${data.jobId}`);
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    connectedClients.delete(clientId);
    console.log(`📡 WebSocket client disconnected: ${clientId}`);
  });
});

// Broadcast progress to WebSocket clients
function broadcastProgress(jobId, progressData) {
  connectedClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN && ws.jobId === jobId) {
      ws.send(JSON.stringify({
        type: 'progress',
        jobId,
        ...progressData
      }));
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get available templates
app.get('/api/templates', (req, res) => {
  try {
    const templates = [
      {
        id: 'default',
        name: 'Default',
        slug: 'default',
        description: 'Standard setup with Next.js, TypeScript, and Tailwind CSS',
        category: 'Web App',
        features: ['Next.js 14+', 'TypeScript', 'Tailwind CSS', 'ESLint'],
        tags: ['typescript', 'tailwind', 'nextjs'],
        isFree: true,
        isPopular: true,
        config: {
          skipConvex: { type: 'boolean', default: false, label: 'Skip Convex Database' },
          skipClerk: { type: 'boolean', default: false, label: 'Skip Clerk Authentication' }
        }
      },
      {
        id: 'saas',
        name: 'SaaS Starter',
        slug: 'saas-starter',
        description: 'Full-stack SaaS with auth, payments, and database',
        category: 'SaaS',
        features: ['Next.js 14+', 'TypeScript', 'Tailwind CSS', 'Clerk Auth', 'Stripe', 'Convex DB'],
        tags: ['saas', 'auth', 'payments', 'database'],
        isFree: true,
        isPopular: true,
        config: {
          skipConvex: { type: 'boolean', default: false, label: 'Skip Convex Database' },
          skipClerk: { type: 'boolean', default: false, label: 'Skip Clerk Authentication' }
        }
      },
      {
        id: 'landing',
        name: 'Landing Page',
        slug: 'landing-page',
        description: 'Marketing landing page with animations and forms',
        category: 'Marketing',
        features: ['Next.js 14+', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Forms'],
        tags: ['landing', 'marketing', 'animation'],
        isFree: true,
        config: {
          skipConvex: { type: 'boolean', default: true, label: 'Skip Convex Database' },
          skipClerk: { type: 'boolean', default: true, label: 'Skip Clerk Authentication' }
        }
      },
      {
        id: 'ecommerce',
        name: 'E-commerce',
        slug: 'ecommerce',
        description: 'Online store with cart, checkout, and inventory',
        category: 'E-commerce',
        features: ['Next.js 14+', 'TypeScript', 'Tailwind CSS', 'Stripe', 'Product Management'],
        tags: ['ecommerce', 'store', 'payments'],
        isFree: false,
        price: 2900, // $29.00
        config: {
          skipConvex: { type: 'boolean', default: false, label: 'Skip Convex Database' },
          skipClerk: { type: 'boolean', default: false, label: 'Skip Clerk Authentication' }
        }
      }
    ];
    
    res.json({ templates });
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Generate project endpoint
app.post('/api/project/generate', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    await rateLimiter.consume(clientIP);
    
    const { name, template, skipConvex, skipClerk, userId, ...config } = req.body;
    
    // Validation
    if (!name || !template) {
      return res.status(400).json({ error: 'Project name and template are required' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check subscription limits (simplified check - in production, you'd check the database)
    // For now, we'll trust the frontend to handle subscription checks
    // TODO: Implement server-side subscription validation
    
    // Generate unique job ID
    const jobId = uuidv4();
    const outputDir = path.join(TEMP_DIR, jobId);
    
    // Create job tracking
    const job = {
      id: jobId,
      name,
      template,
      config: { skipConvex, skipClerk, ...config },
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      outputDir,
      zipPath: null,
    };
    
    activeJobs.set(jobId, job);
    
    res.json({ jobId, status: 'started' });
    
    // Start project generation asynchronously
    generateProject(job).then(async () => {
      // Record project generation in database after successful completion
      if (job.status === 'completed') {
        try {
          await fetch('http://localhost:3000/api/projects/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              name,
              template,
              status: 'completed'
            }),
          });
        } catch (error) {
          console.error('Failed to record project:', error);
        }
      }
    });
    
  } catch (error) {
    if (error instanceof rateLimit.RateLimiterRes) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: error.msBeforeNext
      });
    }
    
    console.error('❌ Error starting project generation:', error);
    res.status(500).json({ error: 'Failed to start project generation' });
  }
});

// Generate project function
async function generateProject(job) {
  try {
    const { id: jobId, name, template, config, outputDir } = job;
    
    // Update job status
    job.status = 'generating';
    job.progress = 10;
    broadcastProgress(jobId, { status: 'generating', progress: 10, currentStep: 'Initializing...' });
    
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    // Prepare CLI arguments
    const args = [
      name,
      '--output', outputDir,
      '--template', template
    ];
    
    if (config.skipConvex) args.push('--skip-convex');
    if (config.skipClerk) args.push('--skip-clerk');
    
    console.log(`🚀 Generating project: ${name} with template: ${template}`);
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`⚙️ CLI arguments:`, args);
    
    // Execute CLI script
    const child = spawn('bash', [CLI_SCRIPT_PATH, ...args], {
      cwd: outputDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    let progressStep = 20;
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`📝 CLI Output:`, output.trim());
      
      // Update progress based on output
      if (output.includes('Installing dependencies')) {
        progressStep = 40;
      } else if (output.includes('Setting up')) {
        progressStep = 60;
      } else if (output.includes('Configuring')) {
        progressStep = 80;
      }
      
      job.progress = progressStep;
      broadcastProgress(jobId, { 
        progress: progressStep, 
        status: 'generating', 
        message: output.trim() 
      });
    });
    
    child.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`❌ CLI Error:`, error.trim());
    });
    
    child.on('close', async (code) => {
      if (code === 0) {
        console.log(`✅ Project generation completed: ${name}`);
        
        // Create ZIP file
        job.progress = 90;
        broadcastProgress(jobId, { 
          progress: 90, 
          status: 'generating', 
          currentStep: 'Creating download package...' 
        });
        
        const zipPath = path.join(TEMP_DIR, `${jobId}.zip`);
        await createZipFile(outputDir, zipPath);
        
        job.zipPath = zipPath;
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date();
        
        broadcastProgress(jobId, {
          progress: 100,
          status: 'completed',
          currentStep: 'Ready for download!',
          downloadUrl: `/api/project/download/${jobId}`
        });
        
        // Schedule cleanup after 1 hour
        setTimeout(() => {
          cleanupJob(jobId);
        }, 3600000); // 1 hour
        
      } else {
        console.error(`❌ Project generation failed: ${name} (exit code: ${code})`);
        job.status = 'failed';
        job.error = `Generation failed with exit code: ${code}`;
        
        broadcastProgress(jobId, {
          status: 'failed',
          error: job.error
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Project generation error:', error);
    job.status = 'failed';
    job.error = error.message;
    
    broadcastProgress(jobId, {
      status: 'failed',
      error: job.error
    });
  }
}

// Create ZIP file
async function createZipFile(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`📦 ZIP created: ${archive.pointer()} total bytes`);
      resolve();
    });
    
    archive.on('error', (err) => {
      console.error('❌ ZIP creation error:', err);
      reject(err);
    });
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Download project endpoint
app.get('/api/project/download/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = activeJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (job.status !== 'completed' || !job.zipPath) {
      return res.status(400).json({ error: 'Project not ready for download' });
    }
    
    if (!fs.existsSync(job.zipPath)) {
      return res.status(404).json({ error: 'Download file not found' });
    }
    
    const filename = `${job.name}.zip`;
    res.download(job.zipPath, filename, (err) => {
      if (err) {
        console.error('❌ Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Get project status
app.get('/api/project/status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = activeJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      name: job.name,
      template: job.template,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      downloadUrl: job.status === 'completed' ? `/api/project/download/${jobId}` : null
    });
    
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({ error: 'Failed to get project status' });
  }
});

// Cleanup job function
function cleanupJob(jobId) {
  try {
    const job = activeJobs.get(jobId);
    if (job) {
      // Remove temporary files
      if (job.outputDir && fs.existsSync(job.outputDir)) {
        fs.removeSync(job.outputDir);
      }
      if (job.zipPath && fs.existsSync(job.zipPath)) {
        fs.removeSync(job.zipPath);
      }
      
      activeJobs.delete(jobId);
      console.log(`🧹 Cleaned up job: ${jobId}`);
    }
  } catch (error) {
    console.error(`❌ Cleanup error for job ${jobId}:`, error);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Next.js Starter SaaS API Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time updates`);
  console.log(`🌍 CORS enabled for: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
}); 