import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Vercel } from '@vercel/sdk'

// Validation schema
const deploymentSchema = z.object({
  repositoryUrl: z.string().refine(
    (url) => {
      // Check if it's a valid GitHub URL (HTTPS or SSH)
      const httpsPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+(?:\.git)?$/
      const sshPattern = /^git@github\.com:[^\/]+\/[^\/]+(?:\.git)?$/
      return httpsPattern.test(url) || sshPattern.test(url)
    },
    'Invalid repository URL. Use HTTPS (https://github.com/username/repository) or SSH (git@github.com:username/repository.git) format'
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

// Helper function to extract GitHub info from URL (supports both HTTPS and SSH)
function extractGitHubInfo(repositoryUrl: string) {
  // Try HTTPS format first: https://github.com/username/repository
  let match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/)
  
  // If not HTTPS, try SSH format: git@github.com:username/repository.git
  if (!match) {
    match = repositoryUrl.match(/git@github\.com:([^\/]+)\/([^\/]+)(?:\.git)?$/)
  }
  
  if (!match) {
    throw new Error('Invalid GitHub repository URL. Use HTTPS (https://github.com/username/repository) or SSH (git@github.com:username/repository.git) format')
  }
  
  const [, org, repo] = match
  return {
    org: org,
    repo: repo.replace('.git', ''),
    // Convert SSH URL to HTTPS format for Vercel API
    httpsUrl: `https://github.com/${org}/${repo.replace('.git', '')}`
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
    const { org, repo, httpsUrl } = extractGitHubInfo(validatedData.repositoryUrl)
    
    console.log('Extracted GitHub info:', { org, repo, httpsUrl, branch: validatedData.branch })
    
    // Create deployment using direct Vercel API with skipAutoDetectionConfirmation
    const deploymentPayload = {
      name: validatedData.projectName,
      target: validatedData.target,
      gitSource: {
        type: 'github',
        repo: repo,
        ref: validatedData.branch,
        org: org,
        // Use HTTPS URL for Vercel API compatibility
        url: httpsUrl
      },
      // Let Vercel auto-detect the project type and build configuration
      // Ensure the project is public or accessible
      public: true,
      ...(validatedData.domainName && {
        alias: [validatedData.domainName]
      })
    }
    
    console.log('Deployment payload:', JSON.stringify(deploymentPayload, null, 2))
    
    // First, try to import the project to ensure Vercel has access to it
    try {
      console.log('Attempting to import project first...')
      const importResponse = await fetch('https://api.vercel.com/v10/projects/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        },
        body: JSON.stringify({
          name: validatedData.projectName,
          gitRepository: {
            type: 'github',
            repo: `${org}/${repo}`,
            ref: validatedData.branch,
            url: httpsUrl
          }
        })
      })
      
      if (importResponse.ok) {
        const importData = await importResponse.json()
        console.log('Project import successful:', importData)
      } else {
        const importError = await importResponse.text()
        console.warn('Project import failed (this might be normal):', importError)
      }
    } catch (importError) {
      console.warn('Project import error (continuing with deployment):', importError)
    }
    
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
      },
      body: JSON.stringify(deploymentPayload)
    })

    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.json()
      console.error('Vercel deployment failed:', errorData)
      throw new Error(JSON.stringify(errorData))
    }

    const deployment = await deploymentResponse.json()
    console.log('Vercel deployment created:', JSON.stringify(deployment, null, 2))

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

        console.log('Domain add response:', JSON.stringify(addDomainResponse, null, 2))

        // Try to get verification records immediately after adding domain
        let verificationRecords = null
        
        // Wait longer for the domain to be processed by Vercel
        console.log('Waiting for domain to be processed by Vercel...')
        await new Promise<void>(resolve => setTimeout(resolve, 5000))
        
        // FIRST: Try the correct Vercel API endpoint for domain configuration (v10)
        console.log('Attempting to get verification records from domain config (CORRECT API v10)')
        
        try {
          // Use the correct Vercel API endpoint for domain configuration (v10)
          const domainConfigResponse = await fetch(`https://api.vercel.com/v10/projects/${validatedData.projectName}/domains`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
            },
          })
          
          console.log('Domain config response status:', domainConfigResponse.status)
          
          if (domainConfigResponse.ok) {
            const domainConfigData = await domainConfigResponse.json()
            console.log('Domain config data (v10):', JSON.stringify(domainConfigData, null, 2))
            
            // Handle v10 API response structure: { "domains": [...] }
            if (domainConfigData.domains && Array.isArray(domainConfigData.domains)) {
              console.log('Processing domains array from v10 API')
              
              // Find the specific domain
              const targetDomain = domainConfigData.domains.find((domain: any) => 
                domain.name === validatedData.domainName
              )
              
              if (targetDomain) {
                console.log('Found target domain:', JSON.stringify(targetDomain, null, 2))
                console.log('Domain verified status:', targetDomain.verified)
                console.log('Domain configuration status:', targetDomain.configured || 'not specified')
                
                // Extract subdomain from the domain name
                const domainParts = validatedData.domainName.split('.')
                const subdomain = domainParts.length > 2 ? domainParts[0] : ''
                
                // Check if domain is verified/configured
                if (targetDomain.verified === false || targetDomain.configured === false) {
                  console.warn('Domain is not verified/configured yet - verification records may not be available')
                  console.warn('This is normal for newly added domains. DNS records need to be configured first.')
                }
                
                // Look for verification records in the domain
                if (targetDomain.verification && Array.isArray(targetDomain.verification)) {
                  console.log('Processing verification array:', targetDomain.verification)
                  
                  // Look for CNAME records in verification array
                  const cnameRecord = targetDomain.verification.find((record: any) => 
                    record.type === 'CNAME' && record.value && record.value.includes('vercel-dns')
                  )
                  
                  if (cnameRecord) {
                    verificationRecords = [
                      {
                        type: 'CNAME',
                        name: subdomain || '@',
                        value: cnameRecord.value,
                        required: true,
                        purpose: 'verification'
                      }
                    ]
                    console.log('Found dynamic CNAME from v10 verification array:', verificationRecords)
                  } else {
                    console.warn('No CNAME record found in v10 verification array')
                    console.warn('Available verification records:', targetDomain.verification.map((r: any) => ({ type: r.type, value: r.value })))
                    
                    // If no CNAME found but domain is not verified, this is expected
                    if (targetDomain.verified === false) {
                      console.warn('Domain is not verified yet - CNAME records will be available after DNS configuration')
                    }
                  }
                } else {
                  console.warn('No verification array found in target domain')
                  if (targetDomain.verified === false) {
                    console.warn('This is expected for unverified domains - verification records will appear after DNS setup')
                  }
                }
              } else {
                console.warn('Target domain not found in domains array')
                console.warn('Available domains:', domainConfigData.domains.map((d: any) => d.name))
              }
            } else {
              console.warn('No domains array found in v10 API response')
              console.warn('Available keys:', Object.keys(domainConfigData))
            }
          } else {
            const errorText = await domainConfigResponse.text()
            console.warn('Failed to fetch domain config:', domainConfigResponse.status, errorText)
          }
        } catch (domainConfigError) {
          console.warn('Error fetching domain config:', domainConfigError)
        }
        
        // SECOND: Try to get the domain configuration using Vercel SDK (fallback)
        if (!verificationRecords) {
          try {
            const domainConfig = await vercel.projects.getProjectDomain({
              idOrName: validatedData.projectName,
              domain: validatedData.domainName,
            })
            
            console.log('Domain config from SDK:', JSON.stringify(domainConfig, null, 2))
            
            // Check if verification records are in the response
            if (domainConfig.verification && domainConfig.verification.length > 0) {
              verificationRecords = domainConfig.verification.map((record: any) => ({
                type: record.type,
                name: record.name,
                value: record.value,
                required: true,
                purpose: 'verification'
              }))
              console.log('Found verification records from SDK:', verificationRecords)
            }
          } catch (sdkError) {
            console.warn('Failed to get domain config from SDK:', sdkError)
          }
        }

        // Fetch DNS records for the domain verification
        let dnsRecords = null
        try {
          // Get domain configuration from project domains endpoint
          const projectDomainsResponse = await fetch(`https://api.vercel.com/v9/projects/${validatedData.projectName}/domains`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
            },
          })
          
          if (projectDomainsResponse.ok) {
            const projectDomains = await projectDomainsResponse.json()
            console.log('Project domains response:', JSON.stringify(projectDomains, null, 2))
            
            // Find the specific domain
            const domainConfig = projectDomains.domains?.find((domain: any) => domain.name === validatedData.domainName)
            
            if (domainConfig) {
              console.log('Found domain config:', JSON.stringify(domainConfig, null, 2))
              
              // Extract verification records from domain configuration
              if (domainConfig.verification && domainConfig.verification.length > 0) {
                verificationRecords = domainConfig.verification.map((record: any) => ({
                  type: record.type,
                  name: record.name,
                  value: record.value,
                  required: true,
                  purpose: 'verification'
                }))
              }
              
              console.log(`Verification records for ${validatedData.domainName}:`, verificationRecords?.length || 0, 'records')
            }
          } else {
            console.warn('Failed to fetch project domains:', projectDomainsResponse.status, projectDomainsResponse.statusText)
          }
          
          // Try to get DNS records using the domains API
          const dnsResponse = await fetch(`https://api.vercel.com/v4/domains/${validatedData.domainName}/records`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
            },
          })
          
          console.log('DNS response status:', dnsResponse.status)
          
          if (dnsResponse.ok) {
            const dnsData = await dnsResponse.json()
            console.log('DNS data:', JSON.stringify(dnsData, null, 2))
            
            dnsRecords = dnsData.map((record: any) => ({
              id: record.id,
              name: record.name,
              type: record.type,
              value: record.value,
              ttl: record.ttl,
              priority: record.priority,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt
            }))
            
            console.log(`DNS records fetched for ${validatedData.domainName}:`, dnsRecords.length, 'records')
          } else {
            const errorText = await dnsResponse.text()
            console.warn('Failed to fetch DNS records:', dnsResponse.status, dnsResponse.statusText, errorText)
          }
        } catch (dnsError) {
          console.warn('Failed to fetch DNS records:', dnsError)
          dnsRecords = null
          verificationRecords = null
        }

        // Try direct domains API call (like the curl command you suggested)
        if (!verificationRecords && validatedData.domainName) {
          console.log('Attempting direct domains API call (v9/domains)')
          console.log('This will show all domains and their verification records')
          
          try {
            // Try the direct domains API endpoint
            const domainsResponse = await fetch(`https://api.vercel.com/v9/domains`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
              },
            })
            
            console.log('Domains API response status:', domainsResponse.status)
            
            if (domainsResponse.ok) {
              const domainsData = await domainsResponse.json()
              console.log('All domains data:', JSON.stringify(domainsData, null, 2))
              
              // Look for our specific domain in the response
              if (domainsData.domains && Array.isArray(domainsData.domains)) {
                const targetDomain = domainsData.domains.find((domain: any) => 
                  domain.name === validatedData.domainName
                )
                
                if (targetDomain) {
                  console.log('Found target domain in domains API:', JSON.stringify(targetDomain, null, 2))
                  
                  // Extract subdomain from the domain name
                  const domainParts = validatedData.domainName.split('.')
                  const subdomain = domainParts.length > 2 ? domainParts[0] : ''
                  
                  // Look for verification records
                  if (targetDomain.verification && Array.isArray(targetDomain.verification)) {
                    console.log('Processing verification array from domains API:', targetDomain.verification)
                    
                    // Look for CNAME records
                    const cnameRecord = targetDomain.verification.find((record: any) => 
                      record.type === 'CNAME' && record.value && record.value.includes('vercel-dns')
                    )
                    
                    if (cnameRecord) {
                      verificationRecords = [
                        {
                          type: 'CNAME',
                          name: subdomain || '@',
                          value: cnameRecord.value,
                          required: true,
                          purpose: 'verification'
                        }
                      ]
                      console.log('Found dynamic CNAME from domains API:', verificationRecords)
                    } else {
                      console.warn('No CNAME record found in domains API verification array')
                      console.warn('Available verification records:', targetDomain.verification.map((r: any) => ({ type: r.type, value: r.value })))
                    }
                  } else {
                    console.warn('No verification array found in domains API response')
                  }
                } else {
                  console.warn('Target domain not found in domains API response')
                  console.warn('Available domains:', domainsData.domains.map((d: any) => d.name))
                }
              } else {
                console.warn('No domains array found in domains API response')
                console.warn('Available keys:', Object.keys(domainsData))
              }
            } else {
              const errorText = await domainsResponse.text()
              console.warn('Failed to fetch domains:', domainsResponse.status, errorText)
            }
          } catch (domainsError) {
            console.warn('Error fetching domains:', domainsError)
          }
        }

        // Try alternative approach to get verification records (for invalid configuration domains)
        if (!verificationRecords && validatedData.domainName) {
          console.log('Attempting alternative verification record fetch for:', validatedData.domainName)
          console.log('This might be needed for domains with invalid configuration status')
          
          try {
            // Try to get domain verification records using the domains API
            const domainVerificationResponse = await fetch(`https://api.vercel.com/v9/domains/${validatedData.domainName}/config`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
              },
            })
            
            console.log('Domain verification response status:', domainVerificationResponse.status)
            
            if (domainVerificationResponse.ok) {
              const domainVerificationData = await domainVerificationResponse.json()
              console.log('Domain verification data:', JSON.stringify(domainVerificationData, null, 2))
              
              if (domainVerificationData.verification && domainVerificationData.verification.length > 0) {
                verificationRecords = domainVerificationData.verification.map((record: any) => ({
                  type: record.type,
                  name: record.name,
                  value: record.value,
                  required: true,
                  purpose: 'verification'
                }))
                console.log('Found verification records from domain config:', verificationRecords)
              }
            } else {
              const errorText = await domainVerificationResponse.text()
              console.warn('Failed to fetch domain verification:', domainVerificationResponse.status, errorText)
            }
          } catch (verificationError) {
            console.warn('Error fetching domain verification:', verificationError)
          }
        }

        // Try to get verification records from project domain settings (another approach)
        if (!verificationRecords && validatedData.domainName) {
          console.log('Attempting to get verification records from project domain settings')
          
          try {
            // Try the project domains endpoint with more specific parameters
            const projectDomainResponse = await fetch(`https://api.vercel.com/v9/projects/${validatedData.projectName}/domains/${validatedData.domainName}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
              },
            })
            
            console.log('Project domain response status:', projectDomainResponse.status)
            
            if (projectDomainResponse.ok) {
              const projectDomainData = await projectDomainResponse.json()
              console.log('Project domain data:', JSON.stringify(projectDomainData, null, 2))
              
              // Look for verification records in different possible locations
              if (projectDomainData.verification && projectDomainData.verification.length > 0) {
                verificationRecords = projectDomainData.verification.map((record: any) => ({
                  type: record.type,
                  name: record.name,
                  value: record.value,
                  required: true,
                  purpose: 'verification'
                }))
                console.log('Found verification records from project domain:', verificationRecords)
              } else if (projectDomainData.dns && projectDomainData.dns.length > 0) {
                // Sometimes verification records are in the dns array
                const verificationDns = projectDomainData.dns.filter((record: any) => record.type === 'CNAME' && record.name)
                if (verificationDns.length > 0) {
                  verificationRecords = verificationDns.map((record: any) => ({
                    type: record.type,
                    name: record.name,
                    value: record.value,
                    required: true,
                    purpose: 'verification'
                  }))
                  console.log('Found verification records from DNS array:', verificationRecords)
                }
              }
            } else {
              const errorText = await projectDomainResponse.text()
              console.warn('Failed to fetch project domain:', projectDomainResponse.status, errorText)
            }
          } catch (projectDomainError) {
            console.warn('Error fetching project domain:', projectDomainError)
          }
        }

        // Try to get verification records from the project's domain settings
        if (!verificationRecords && validatedData.domainName) {
          console.log('Attempting to get verification records from project domain settings')
          
          try {
            // Try the project domains endpoint with more specific parameters
            const projectDomainResponse = await fetch(`https://api.vercel.com/v9/projects/${validatedData.projectName}/domains/${validatedData.domainName}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
              },
            })
            
            console.log('Project domain response status:', projectDomainResponse.status)
            
            if (projectDomainResponse.ok) {
              const projectDomainData = await projectDomainResponse.json()
              console.log('Project domain data:', JSON.stringify(projectDomainData, null, 2))
              
              // Look for verification records in different possible locations
              if (projectDomainData.verification && projectDomainData.verification.length > 0) {
                verificationRecords = projectDomainData.verification.map((record: any) => ({
                  type: record.type,
                  name: record.name,
                  value: record.value,
                  required: true,
                  purpose: 'verification'
                }))
                console.log('Found verification records from project domain:', verificationRecords)
              } else if (projectDomainData.dns && projectDomainData.dns.length > 0) {
                // Sometimes verification records are in the dns array
                const verificationDns = projectDomainData.dns.filter((record: any) => record.type === 'CNAME' && record.name)
                if (verificationDns.length > 0) {
                  verificationRecords = verificationDns.map((record: any) => ({
                    type: record.type,
                    name: record.name,
                    value: record.value,
                    required: true,
                    purpose: 'verification'
                  }))
                  console.log('Found verification records from DNS array:', verificationRecords)
                }
              }
            } else {
              const errorText = await projectDomainResponse.text()
              console.warn('Failed to fetch project domain:', projectDomainResponse.status, errorText)
            }
          } catch (projectDomainError) {
            console.warn('Error fetching project domain:', projectDomainError)
          }
        }


        // Try to get verification records from the deployment's domain configuration
        if (!verificationRecords && validatedData.domainName) {
          console.log('Attempting to get verification records from deployment domain config')
          
          try {
            // Wait a bit longer for the domain to be fully processed
            await new Promise<void>(resolve => setTimeout(resolve, 2000))
            
            // Try to get the domain configuration using the deployment ID
            const deploymentDomainResponse = await fetch(`https://api.vercel.com/v13/deployments/${deployment.id}/domains`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
              },
            })
            
            console.log('Deployment domain response status:', deploymentDomainResponse.status)
            
            if (deploymentDomainResponse.ok) {
              const deploymentDomainData = await deploymentDomainResponse.json()
              console.log('Deployment domain data:', JSON.stringify(deploymentDomainData, null, 2))
              
              // Look for verification records in the deployment domain data
              if (deploymentDomainData.verification && deploymentDomainData.verification.length > 0) {
                verificationRecords = deploymentDomainData.verification.map((record: any) => ({
                  type: record.type,
                  name: record.name,
                  value: record.value,
                  required: true,
                  purpose: 'verification'
                }))
                console.log('Found verification records from deployment domain:', verificationRecords)
              }
            } else {
              const errorText = await deploymentDomainResponse.text()
              console.warn('Failed to fetch deployment domain:', deploymentDomainResponse.status, errorText)
            }
          } catch (deploymentDomainError) {
            console.warn('Error fetching deployment domain:', deploymentDomainError)
          }
        }

        // Final fallback: If still no verification records, try to get them from deployment response
        if (!verificationRecords && deployment.alias && deployment.alias.length > 0) {
          console.log('Attempting to extract verification info from deployment aliases')
          
          // Look for the custom domain in aliases
          const customDomain = deployment.alias.find((alias: string) => alias === validatedData.domainName)
          
          if (customDomain) {
            // Extract subdomain from the domain name
            const domainParts = validatedData.domainName.split('.')
            const subdomain = domainParts.length > 2 ? domainParts[0] : ''
            
            // Use generic Vercel CNAME (this is the standard one)
            verificationRecords = [
              {
                type: 'CNAME',
                name: subdomain || '@',
                value: 'cname.vercel-dns.com',
                required: true,
                purpose: 'verification',
                note: 'Standard Vercel verification record'
              }
            ]
            
            console.log('Generated standard verification record:', verificationRecords)
          }
        }

        // Debug: Log what we found
        console.log('=== VERIFICATION RECORDS DEBUG ===')
        console.log('Final verification records:', verificationRecords)
        console.log('Domain name:', validatedData.domainName)
        console.log('Project name:', validatedData.projectName)
        console.log('Deployment ID:', deployment.id)
        console.log('=====================================')

        domainResult = {
          name: addDomainResponse.name,
          status: 'added',
          added: true,
          dnsRecords: dnsRecords,
          verificationRecords: verificationRecords
        }

        console.log(`Domain added: ${addDomainResponse.name}`)
      } catch (domainError) {
        console.error('Domain addition error:', domainError)
        domainResult = {
          name: validatedData.domainName,
          status: 'error',
          added: false,
          error: domainError instanceof Error ? domainError.message : String(domainError),
          dnsRecords: null,
          verificationRecords: null
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
          variables: validatedData.envVars.map(envVar => envVar.key),
          redeployment: null as any
        }

        console.log(`Environment variables added: ${validatedData.envVars.length} variables`)
        
        // Trigger a redeployment to apply the new environment variables
        try {
          console.log('Triggering redeployment to apply environment variables...')
          
          const redeployResponse = await fetch('https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1', {
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

          if (redeployResponse.ok) {
            const redeployData = await redeployResponse.json()
            console.log('Redeployment triggered successfully:', redeployData.id)
            
            // Update the deployment info with the new deployment
            deployment.id = redeployData.id
            deployment.url = redeployData.url ? (redeployData.url.startsWith('http') ? redeployData.url : `https://${redeployData.url}`) : null
            deployment.alias = redeployData.alias
            deployment.inspectorUrl = redeployData.inspectorUrl ? (redeployData.inspectorUrl.startsWith('http') ? redeployData.inspectorUrl : `https://${redeployData.inspectorUrl}`) : null
            
            envVarsResult.redeployment = {
              triggered: true,
              deploymentId: redeployData.id,
              message: 'Redeployment triggered to apply environment variables'
            }
          } else {
            console.warn('Failed to trigger redeployment:', redeployResponse.status)
            envVarsResult.redeployment = {
              triggered: false,
              error: 'Failed to trigger redeployment'
            }
          }
        } catch (redeployError) {
          console.warn('Error triggering redeployment:', redeployError)
          envVarsResult.redeployment = {
            triggered: false,
            error: redeployError instanceof Error ? redeployError.message : String(redeployError)
          }
        }
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
    console.log('Domain Result:', JSON.stringify(domainResult, null, 2))
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
