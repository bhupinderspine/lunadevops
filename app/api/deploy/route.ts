import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Vercel } from '@vercel/sdk'

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
  target: z.enum(['production', 'preview']).default('production'),
  envVars: z.array(z.object({
    key: z.string().min(1, 'Environment variable key is required'),
    value: z.string().min(1, 'Environment variable value is required')
  })).optional().default([])
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
    
    // Log incoming request
    console.log('📥 DEPLOYMENT REQUEST RECEIVED:')
    console.log('Request Body:', JSON.stringify(body, null, 2))
    console.log('=====================================')
    
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

    // If domain name is provided, add it to the project
    let domainResult = null
    if (validatedData.domainName) {
      try {
        const vercel = new Vercel({
          bearerToken: process.env.VERCEL_TOKEN,
        })

        const addDomainResponse = await vercel.projects.addProjectDomain({
          idOrName: validatedData.projectName,
          requestBody: {
            name: validatedData.domainName,
          },
        })

        domainResult = {
          name: addDomainResponse.name,
          status: 'added',
          added: true
        }

        console.log(`Domain added: ${addDomainResponse.name}`)
      } catch (domainError) {
        console.error('Domain addition error:', domainError)
        domainResult = {
          name: validatedData.domainName,
          status: 'error',
          added: false,
          error: domainError instanceof Error ? domainError.message : String(domainError)
        }
      }
    }

    // Add environment variables if provided
    let envVarsResult = null
    if (validatedData.envVars && validatedData.envVars.length > 0) {
      try {
        const vercel = new Vercel({
          bearerToken: process.env.VERCEL_TOKEN,
        })

        const addEnvVarsResponse = await vercel.projects.createProjectEnv({
          idOrName: validatedData.projectName,
          upsert: 'true',
          requestBody: validatedData.envVars.map(envVar => ({
            key: envVar.key,
            value: envVar.value,
            target: ['production'],
            type: 'plain',
          }))
        })

        envVarsResult = {
          added: true,
          count: validatedData.envVars.length,
          variables: validatedData.envVars.map(envVar => envVar.key)
        }

        console.log(`Environment variables added: ${validatedData.envVars.length} variables`)
      } catch (envVarsError) {
        console.error('Environment variables addition error:', envVarsError)
        envVarsResult = {
          added: false,
          count: 0,
          error: envVarsError instanceof Error ? envVarsError.message : String(envVarsError)
        }
      }
    }

    const response = {
      success: true,
      deployment: {
        id: deployment.id,
        status: deployment.status,
        url: deployment.url ? (deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`) : null,
        alias: deployment.alias,
        createdAt: deployment.createdAt,
        readyAt: deployment.ready,
        state: 'BUILDING',
        inspectorUrl: deployment.inspectorUrl ? (deployment.inspectorUrl.startsWith('http') ? deployment.inspectorUrl : `https://${deployment.inspectorUrl}`) : null
      },
      domain: domainResult,
      envVars: envVarsResult,
      message: 'Deployment created successfully!'
    }

    // Log complete API response
    console.log('🎯 VERCEL DEPLOYMENT SUCCESS:')
    console.log('Deployment ID:', deployment.id)
    console.log('Status:', deployment.status)
    console.log('URL:', deployment.url)
    console.log('Aliases:', deployment.alias)
    console.log('Domain Result:', domainResult)
    console.log('Environment Variables:', envVarsResult)
    console.log('Full Response:', JSON.stringify(response, null, 2))
    console.log('=====================================')

    return NextResponse.json(response)

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

    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Deployment failed. Check your Vercel token and repository permissions.'
    }

    // Log error response
    console.log('❌ VERCEL DEPLOYMENT ERROR:')
    console.log('Error:', error instanceof Error ? error.message : 'Unknown error occurred')
    console.log('Full Error Response:', JSON.stringify(errorResponse, null, 2))
    console.log('=====================================')

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Deployment API is running'
  })
}
