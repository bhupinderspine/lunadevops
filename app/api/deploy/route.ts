import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const deploymentSchema = z.object({
  repositoryUrl: z.string().url('Invalid repository URL').refine(
    (url) => url.includes('github.com'),
    'Only GitHub repositories are supported'
  ),
  userName: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
  domainName: z.string().optional(),
  projectName: z.string().min(1, 'Project name is required'),
  branch: z.string().min(1, 'Branch is required').default('main'),
  target: z.enum(['production', 'preview']).default('production')
})

// Helper function to extract GitHub info from URL
function extractGitHubInfo(repositoryUrl: string) {
  const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/)
  if (!match) {
    throw new Error('Invalid GitHub repository URL')
  }
  
  const [, org, repo] = match
  return {
    org: org,
    repo: repo.replace('.git', '')
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = deploymentSchema.parse(body)
    
    // Extract GitHub organization and repository name
    const { org, repo } = extractGitHubInfo(validatedData.repositoryUrl)
    
    // Create deployment using direct Vercel API with skipAutoDetectionConfirmation
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
      },
      body: JSON.stringify({
        name: validatedData.projectName,
        target: validatedData.target,
        gitSource: {
          type: 'github',
          repo: repo,
          ref: validatedData.branch,
          org: org,
        },
        ...(validatedData.domainName && {
          alias: [validatedData.domainName]
        })
      })
    })

    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.json()
      throw new Error(JSON.stringify(errorData))
    }

    const deployment = await deploymentResponse.json()

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        status: deployment.status,
        url: deployment.url,
        alias: deployment.alias,
        createdAt: deployment.createdAt,
        readyAt: deployment.ready,
        state: 'BUILDING',
        inspectorUrl: deployment.inspectorUrl || null
      },
      message: 'Deployment created successfully!'
    })

  } catch (error) {
    console.error('Deployment error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    // Handle specific Vercel API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status
      if (status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid Vercel token. Check your VERCEL_TOKEN environment variable.'
        }, { status: 401 })
      }
      if (status === 403) {
        return NextResponse.json({
          success: false,
          error: 'Access denied',
          message: 'Vercel token is invalid or expired. Please check your VERCEL_TOKEN environment variable.'
        }, { status: 403 })
      }
      if (status === 404) {
        return NextResponse.json({
          success: false,
          error: 'Repository not found',
          message: 'Repository not found. Check the repository URL and permissions.'
        }, { status: 404 })
      }
    }

    // Handle Vercel SDK specific errors
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as any).message
      if (errorMessage.includes('forbidden') || errorMessage.includes('Not authorized')) {
        return NextResponse.json({
          success: false,
          error: 'Vercel authentication failed',
          message: 'Vercel token is invalid or expired. Please check your VERCEL_TOKEN environment variable.'
        }, { status: 403 })
      }
      if (errorMessage.includes('projectSettings') || errorMessage.includes('framework')) {
        return NextResponse.json({
          success: false,
          error: errorMessage,
          message: 'Project configuration error. Please check your repository setup.'
        }, { status: 400 })
      }
      if (errorMessage.includes('incorrect_git_source_info')) {
        return NextResponse.json({
          success: false,
          error: 'Repository not found or branch does not exist',
          message: 'Please check your repository URL and branch name.'
        }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Deployment failed. Check your Vercel token and repository permissions.'
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Deployment API is running'
  })
}
