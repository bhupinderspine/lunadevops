"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2, Github, Globe, User, Lock, Code, GitBranch } from "lucide-react"
import Swal from 'sweetalert2'

interface FormData {
  repositoryUrl: string
  userName: string
  password: string
  domainName: string
  projectName: string
  branch: string
  target: 'production' | 'preview'
  // Environment variables
  envVars: Array<{
    key: string
    value: string
  }>
}

interface FormErrors {
  repositoryUrl?: string
  userName?: string
  password?: string
  domainName?: string
  projectName?: string
  branch?: string
  target?: string
  envVars?: string
}

interface DeploymentResult {
  id: string
  status: string
  url: string
  alias?: string[]
  createdAt: number
  readyAt?: number
  state: string
  inspectorUrl?: string
}

export default function DeploymentForm() {
  const [formData, setFormData] = useState<FormData>({
    repositoryUrl: "",
    userName: "",
    password: "",
    domainName: "",
    projectName: "",
    branch: "main",
    target: "production",
    // Environment variables
    envVars: []
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)

  // Environment variable management
  const addEnvVar = () => {
    setFormData(prev => ({
      ...prev,
      envVars: [...prev.envVars, {
        key: "",
        value: ""
      }]
    }))
  }

  const removeEnvVar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index)
    }))
  }

  const updateEnvVar = (index: number, field: keyof FormData['envVars'][0], value: any) => {
    setFormData(prev => ({
      ...prev,
      envVars: prev.envVars.map((envVar, i) => 
        i === index ? { ...envVar, [field]: value } : envVar
      )
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Repository URL validation
    if (!formData.repositoryUrl.trim()) {
      newErrors.repositoryUrl = "Repository URL is required"
    } else if (!formData.repositoryUrl.includes("github.com")) {
      newErrors.repositoryUrl = "Please enter a valid GitHub repository URL"
    } else if (!/^https:\/\/github\.com\/[^\/]+\/[^\/]+(?:\.git)?$/.test(formData.repositoryUrl)) {
      newErrors.repositoryUrl = "Invalid format. Use: https://github.com/username/repository"
    }

    // Username validation
    if (!formData.userName.trim()) {
      newErrors.userName = "Username is required"
    } else if (formData.userName.length < 3) {
      newErrors.userName = "Username must be at least 3 characters"
    }

    // Password validation (optional - for user convenience)
    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    // Project name validation
    if (!formData.projectName.trim()) {
      newErrors.projectName = "Project name is required"
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.projectName)) {
      newErrors.projectName = "Only letters, numbers, hyphens, and underscores allowed"
    }

    // Branch validation
    if (!formData.branch.trim()) {
      newErrors.branch = "Branch is required"
    }

    // Domain validation (optional)
    if (formData.domainName && !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/.test(formData.domainName)) {
      newErrors.domainName = "Invalid domain format (e.g., mydomain.com)"
    }

    // Environment variables validation
    const invalidEnvVars = formData.envVars.filter(envVar => 
      !envVar.key.trim() || !envVar.value.trim()
    )
    if (invalidEnvVars.length > 0) {
      newErrors.envVars = "All environment variables must have both key and value"
    }

    console.log('Validation errors:', newErrors) // Debug log
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (field in errors && errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field as keyof FormErrors]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      setSubmitStatus("error")
      setStatusMessage("Please fix the errors above and try again.")
      return
    }

    setIsSubmitting(true)
    setSubmitStatus("idle")
    setStatusMessage("")
    setDeploymentResult(null)

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()
      
      // Log complete API response
      console.log('🚀 DEPLOYMENT API RESPONSE:')
      console.log('Status:', response.status)
      console.log('Status Text:', response.statusText)
      console.log('Headers:', Object.fromEntries(response.headers.entries()))
      console.log('Response Body:', JSON.stringify(result, null, 2))
      console.log('=====================================')

      if (result.success) {
        setSubmitStatus("success")
        setDeploymentResult(result.deployment)
        
      // Show success in SweetAlert
      let successHtml = `
        <div style="text-align: left; color: #ffffff;">
          <p><strong>Deployment ID:</strong> ${result.deployment.id}</p>
          <p><strong>Status:</strong> ${result.deployment.status}</p>
          <p><strong>URL:</strong> <a href="${result.deployment.url}" target="_blank" style="color: #17a2b8;">${result.deployment.url}</a></p>
          ${result.deployment.alias && result.deployment.alias.length > 0 ? `<p><strong>Alias:</strong> ${result.deployment.alias.join(', ')}</p>` : ''}
      `

      // Add domain information if available
      if (result.domain) {
        if (result.domain.added) {
          successHtml += `
            <div style="margin-top: 15px; padding: 10px; background: rgba(23, 162, 184, 0.1); border-radius: 8px; border-left: 3px solid #17a2b8;">
              <p><strong>🌐 Domain Added:</strong> ${result.domain.name}</p>
              <p><strong>Status:</strong> ${result.domain.status}</p>
              <p style="font-size: 0.9em; color: #17a2b8;">Domain configuration may take a few minutes to propagate.</p>
            </div>
          `
        } else {
          successHtml += `
            <div style="margin-top: 15px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid #ef4444;">
              <p><strong>⚠️ Domain Error:</strong> ${result.domain.name}</p>
              <p><strong>Error:</strong> ${result.domain.error}</p>
            </div>
          `
        }
      }

      // Add environment variables information if available
      if (result.envVars) {
        if (result.envVars.added) {
          successHtml += `
            <div style="margin-top: 15px; padding: 10px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 3px solid #22c55e;">
              <p><strong>🔧 Environment Variables Added:</strong> ${result.envVars.count} variables</p>
              <p><strong>Variables:</strong> ${result.envVars.variables.join(', ')}</p>
              <p style="font-size: 0.9em; color: #22c55e;">Environment variables are now available in your deployment.</p>
            </div>
          `
        } else {
          successHtml += `
            <div style="margin-top: 15px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid #ef4444;">
              <p><strong>⚠️ Environment Variables Error:</strong></p>
              <p><strong>Error:</strong> ${result.envVars.error}</p>
            </div>
          `
        }
      }

      successHtml += `</div>`

      Swal.fire({
        icon: 'success',
        title: 'Deployment Created!',
        html: successHtml,
        confirmButtonText: 'Great!',
        confirmButtonColor: '#17a2b8',
        background: '#003D58',
        color: '#ffffff',
        customClass: {
          popup: 'swal-popup-custom',
          title: 'swal-title-custom',
          htmlContainer: 'swal-content-custom'
        }
      })
        
        // Reset form after success
        setTimeout(() => {
          setFormData({
            repositoryUrl: "",
            userName: "",
            password: "",
            domainName: "",
            projectName: "",
            branch: "main",
            target: "production",
            envVars: []
          })
          setSubmitStatus("idle")
          setStatusMessage("")
          setDeploymentResult(null)
        }, 10000) // Keep result visible for 10 seconds
      } else {
        setSubmitStatus("error")
        if (result.details && Array.isArray(result.details)) {
          const fieldErrors: FormErrors = {}
          result.details.forEach((detail: any) => {
            fieldErrors[detail.field as keyof FormErrors] = detail.message
          })
          setErrors(fieldErrors)
          setStatusMessage("")
        } else {
          // Show API error in SweetAlert - prioritize error over message
          const errorMessage = result.error || result.message || "Deployment failed. Please check your credentials and try again."
          
          // Determine error type and icon
          let icon: 'error' | 'warning' | 'info' = 'error'
          let title = 'Deployment Failed'
          
          if (errorMessage.includes('Vercel token') || errorMessage.includes('invalid') || errorMessage.includes('expired')) {
            icon = 'warning'
            title = 'Authentication Error'
          } else if (errorMessage.includes('Repository not found')) {
            icon = 'info'
            title = 'Repository Error'
          } else if (errorMessage.includes('projectSettings') || errorMessage.includes('framework')) {
            icon = 'info'
            title = 'Project Configuration Error'
          }
          
          Swal.fire({
            icon: icon,
            title: title,
            text: errorMessage,
            confirmButtonText: 'OK',
            confirmButtonColor: '#17a2b8',
            background: '#003D58',
            color: '#ffffff',
            customClass: {
              popup: 'swal-popup-custom',
              title: 'swal-title-custom',
              htmlContainer: 'swal-content-custom'
            }
          })
          
          console.error('API Error:', result) // Debug log
        }
      }
    } catch (error) {
      console.error('Deployment error:', error)
      setSubmitStatus("error")
      
      // Show network error in SweetAlert
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Please check your connection and try again.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#17a2b8',
        background: '#003D58',
        color: '#ffffff',
            customClass: {
              popup: 'swal-popup-custom',
              title: 'swal-title-custom',
              htmlContainer: 'swal-content-custom'
            }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.repositoryUrl && formData.userName && formData.projectName && formData.branch

  return (
    <Card className="w-full max-w-md bg-[#003D58]/40 backdrop-blur-2xl border-2 border-[#17a2b8]/40 shadow-2xl rounded-2xl overflow-hidden hover:border-[#17a2b8]/60 hover:shadow-[#17a2b8]/20 transition-all duration-500">
      <CardHeader className="text-center pb-6 pt-8">
        <CardTitle className="text-3xl font-bold font-heading text-white mb-2 tracking-tight">
          Vortex
        </CardTitle>
        <CardDescription className="text-[#17a2b8] text-base font-medium">Repository Deployment</CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-8">
        {/* Validation Error Summary */}
        {Object.keys(errors).length > 0 && (
          <Alert className="border-2 border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] rounded-xl backdrop-blur-sm p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <AlertDescription className="font-semibold text-sm">
                Please fix the following errors: {Object.values(errors).filter(Boolean).join(', ')}
              </AlertDescription>
            </div>
          </Alert>
        )}
        

        <form onSubmit={handleSubmit} className={`space-y-5 transition-all duration-500 ${isSubmitting ? 'opacity-90 scale-[0.99]' : 'opacity-100 scale-100'}`}>
          {/* Repository URL */}
          <div className="space-y-2 group">
            <Label htmlFor="repositoryUrl" className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Github className="w-4 h-4 text-[#17a2b8]" />
              Repository URL <span className="text-[#ff6b6b]">*</span>
              <svg
                className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="12" cy="16" rx="4" ry="5" />
                <ellipse cx="8" cy="9" rx="2.5" ry="3" />
                <ellipse cx="12" cy="7" rx="2.5" ry="3" />
                <ellipse cx="16" cy="9" rx="2.5" ry="3" />
                <ellipse cx="18" cy="12" rx="2" ry="2.5" />
              </svg>
            </Label>
            <Input
              id="repositoryUrl"
              type="url"
              placeholder="Enter GitHub repository URL"
              value={formData.repositoryUrl}
              onChange={(e) => handleInputChange("repositoryUrl", e.target.value)}
              className={`border-2 rounded-xl transition-all duration-300 h-11 text-base ${
                errors.repositoryUrl
                  ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20 bg-red-900/20"
                  : "border-[#17a2b8]/30 focus:border-[#17a2b8] focus:ring-[#17a2b8]/30 bg-white/5 hover:bg-white/10"
              } text-white placeholder:text-white/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[#17a2b8]/10 focus:shadow-xl focus:shadow-[#17a2b8]/20`}
              disabled={isSubmitting}
            />
          </div>

          {/* Username */}
          <div className="space-y-2 group">
            <Label htmlFor="userName" className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <User className="w-4 h-4 text-[#17a2b8]" />
              User Name <span className="text-[#ff6b6b]">*</span>
              <svg
                className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="12" cy="16" rx="4" ry="5" />
                <ellipse cx="8" cy="9" rx="2.5" ry="3" />
                <ellipse cx="12" cy="7" rx="2.5" ry="3" />
                <ellipse cx="16" cy="9" rx="2.5" ry="3" />
                <ellipse cx="18" cy="12" rx="2" ry="2.5" />
              </svg>
            </Label>
            <Input
              id="userName"
              type="text"
              placeholder="Enter your GitHub username"
              value={formData.userName}
              onChange={(e) => handleInputChange("userName", e.target.value)}
              className={`border-2 rounded-xl transition-all duration-300 h-11 text-base ${
                errors.userName
                  ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20 bg-red-900/20"
                  : "border-[#17a2b8]/30 focus:border-[#17a2b8] focus:ring-[#17a2b8]/30 bg-white/5 hover:bg-white/10"
              } text-white placeholder:text-white/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[#17a2b8]/10 focus:shadow-xl focus:shadow-[#17a2b8]/20`}
              disabled={isSubmitting}
            />
          </div>

          {/* Password */}
         {/* <div className="space-y-2 group">
            <Label htmlFor="password" className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#17a2b8]" />
              Password <span className="text-white/50 text-xs font-normal">(optional)</span>
              <svg
                className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="12" cy="16" rx="4" ry="5" />
                <ellipse cx="8" cy="9" rx="2.5" ry="3" />
                <ellipse cx="12" cy="7" rx="2.5" ry="3" />
                <ellipse cx="16" cy="9" rx="2.5" ry="3" />
                <ellipse cx="18" cy="12" rx="2" ry="2.5" />
              </svg>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password (optional)"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              className={`border-2 rounded-xl transition-all duration-300 h-11 text-base ${
                errors.password
                  ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20 bg-red-900/20"
                  : "border-[#17a2b8]/30 focus:border-[#17a2b8] focus:ring-[#17a2b8]/30 bg-white/5 hover:bg-white/10"
              } text-white placeholder:text-white/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[#17a2b8]/10 focus:shadow-xl focus:shadow-[#17a2b8]/20`}
              disabled={isSubmitting}
            />
            <p className="text-xs text-white/60 mt-1">
              Note: Vercel SDK uses your Vercel token for authentication. Password is optional.
            </p>
          </div>*/}

          {/* Project Name */}
          <div className="space-y-2 group">
            <Label htmlFor="projectName" className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Code className="w-4 h-4 text-[#17a2b8]" />
              Project Name <span className="text-[#ff6b6b]">*</span>
              <svg
                className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="12" cy="16" rx="4" ry="5" />
                <ellipse cx="8" cy="9" rx="2.5" ry="3" />
                <ellipse cx="12" cy="7" rx="2.5" ry="3" />
                <ellipse cx="16" cy="9" rx="2.5" ry="3" />
                <ellipse cx="18" cy="12" rx="2" ry="2.5" />
              </svg>
            </Label>
            <Input
              id="projectName"
              type="text"
              placeholder="Enter project name"
              value={formData.projectName}
              onChange={(e) => handleInputChange("projectName", e.target.value)}
              className={`border-2 rounded-xl transition-all duration-300 h-11 text-base ${
                errors.projectName
                  ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20 bg-red-900/20"
                  : "border-[#17a2b8]/30 focus:border-[#17a2b8] focus:ring-[#17a2b8]/30 bg-white/5 hover:bg-white/10"
              } text-white placeholder:text-white/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[#17a2b8]/10 focus:shadow-xl focus:shadow-[#17a2b8]/20`}
              disabled={isSubmitting}
            />
          </div>

          {/* Branch */}
          <div className="space-y-2 group">
            <Label htmlFor="branch" className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#17a2b8]" />
              Branch <span className="text-[#ff6b6b]">*</span>
              <svg
                className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="12" cy="16" rx="4" ry="5" />
                <ellipse cx="8" cy="9" rx="2.5" ry="3" />
                <ellipse cx="12" cy="7" rx="2.5" ry="3" />
                <ellipse cx="16" cy="9" rx="2.5" ry="3" />
                <ellipse cx="18" cy="12" rx="2" ry="2.5" />
              </svg>
            </Label>
            <Input
              id="branch"
              type="text"
              placeholder="Enter branch name (e.g., main, develop)"
              value={formData.branch}
              onChange={(e) => handleInputChange("branch", e.target.value)}
              className={`border-2 rounded-xl transition-all duration-300 h-11 text-base ${
                errors.branch
                  ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20 bg-red-900/20"
                  : "border-[#17a2b8]/30 focus:border-[#17a2b8] focus:ring-[#17a2b8]/30 bg-white/5 hover:bg-white/10"
              } text-white placeholder:text-white/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[#17a2b8]/10 focus:shadow-xl focus:shadow-[#17a2b8]/20`}
              disabled={isSubmitting}
            />
          </div>

          {/* Domain Name */}
          <div className="space-y-2 group">
            <Label htmlFor="domainName" className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#17a2b8]" />
              Domain Name <span className="text-white/50 text-xs font-normal">(optional)</span>
              <svg
                className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <ellipse cx="12" cy="16" rx="4" ry="5" />
                <ellipse cx="8" cy="9" rx="2.5" ry="3" />
                <ellipse cx="12" cy="7" rx="2.5" ry="3" />
                <ellipse cx="16" cy="9" rx="2.5" ry="3" />
                <ellipse cx="18" cy="12" rx="2" ry="2.5" />
              </svg>
            </Label>
            <Input
              id="domainName"
              type="text"
              placeholder="Enter domain/subdomain"
              value={formData.domainName}
              onChange={(e) => handleInputChange("domainName", e.target.value)}
              className={`border-2 rounded-xl transition-all duration-300 h-11 text-base ${
                errors.domainName
                  ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20 bg-red-900/20"
                  : "border-[#17a2b8]/30 focus:border-[#17a2b8] focus:ring-[#17a2b8]/30 bg-white/5 hover:bg-white/10"
              } text-white placeholder:text-white/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[#17a2b8]/10 focus:shadow-xl focus:shadow-[#17a2b8]/20`}
              disabled={isSubmitting}
            />
          </div>

          {/* Environment Variables */}
          <div className="space-y-4 group">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Code className="w-4 h-4 text-[#17a2b8]" />
                Environment Variables <span className="text-white/50 text-xs font-normal">(optional)</span>
              </Label>
              <Button
                type="button"
                onClick={addEnvVar}
                className="px-3 py-1 text-xs bg-[#17a2b8]/20 hover:bg-[#17a2b8]/30 text-[#17a2b8] border border-[#17a2b8]/30 rounded-lg transition-all duration-200"
              >
                + Add Variable
              </Button>
            </div>
            
            {formData.envVars.length > 0 && (
              <div className="space-y-3">
                {formData.envVars.map((envVar, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start">
                    {/* Key */}
                    <div className="col-span-4">
                      <Input
                        placeholder="KEY"
                        value={envVar.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        className="border-2 border-[#17a2b8]/30 focus:border-[#17a2b8] bg-white/5 text-white placeholder:text-white/40 rounded-lg h-9 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    {/* Value */}
                    <div className="col-span-7">
                      <Input
                        placeholder="value"
                        value={envVar.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        className="border-2 border-[#17a2b8]/30 focus:border-[#17a2b8] bg-white/5 text-white placeholder:text-white/40 rounded-lg h-9 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    {/* Remove button */}
                    <div className="col-span-1">
                      <Button
                        type="button"
                        onClick={() => removeEnvVar(index)}
                        className="w-full h-9 p-0 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all duration-200"
                        disabled={isSubmitting}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            
            {formData.envVars.length === 0 && (
              <p className="text-sm text-white/50 italic">
                No environment variables added. Click "Add Variable" to add them.
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-gradient-to-r from-[#17a2b8] to-[#17a2b8]/80 hover:from-[#17a2b8] hover:to-[#17a2b8] text-white font-bold py-4 text-base rounded-xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#17a2b8]/60 hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] mt-6 relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center">
              {isSubmitting ? (
                <>
                  {/* Enhanced loading animation */}
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                      <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping"></div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-white font-semibold">Deploying...</span>
                      <div className="flex space-x-1 mt-1">
                        <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Deploy to Vercel</span>
                  <div className="w-2 h-2 bg-white/80 rounded-full animate-pulse"></div>
                </div>
              )}
            </span>
            {/* Enhanced shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#17a2b8] via-[#20c997] to-[#17a2b8] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Ripple effect on submit */}
            {isSubmitting && (
              <div className="absolute inset-0 bg-white/10 animate-ping rounded-xl"></div>
            )}
          </Button>

          {/* Progress bar during submission */}
          {isSubmitting && (
            <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#17a2b8] to-[#20c997] rounded-full animate-pulse relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
          )}


          {/* Deployment Result */}
          {deploymentResult && (
            <div className="mt-4 p-4 bg-[#17a2b8]/10 border border-[#17a2b8]/30 rounded-xl backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#17a2b8]" />
                Deployment Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Deployment ID:</span>
                  <span className="text-white font-mono text-xs">{deploymentResult.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Status:</span>
                  <span className="text-[#17a2b8] font-semibold capitalize">{deploymentResult.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">State:</span>
                  <span className="text-white capitalize">{deploymentResult.state}</span>
                </div>
                {deploymentResult.url && (
                  <div className="flex justify-between">
                    <span className="text-white/70">URL:</span>
                    <a 
                      href={deploymentResult.url.startsWith('http') ? deploymentResult.url : `https://${deploymentResult.url}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#17a2b8] hover:text-[#17a2b8]/80 underline truncate max-w-[200px]"
                      onClick={() => {
                        console.log('🔗 URL Click Debug:')
                        console.log('Original URL:', deploymentResult.url)
                        console.log('Starts with http:', deploymentResult.url.startsWith('http'))
                        console.log('Final href:', deploymentResult.url.startsWith('http') ? deploymentResult.url : `https://${deploymentResult.url}`)
                      }}
                    >
                      {deploymentResult.url}
                    </a>
                  </div>
                )}
                {deploymentResult.alias && deploymentResult.alias.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Alias:</span>
                    <span className="text-white">{deploymentResult.alias.join(', ')}</span>
                  </div>
                )}
                {deploymentResult.inspectorUrl && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Inspector:</span>
                    <a 
                      href={deploymentResult.inspectorUrl?.startsWith('http') ? deploymentResult.inspectorUrl : `https://${deploymentResult.inspectorUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#17a2b8] hover:text-[#17a2b8]/80 underline text-xs"
                    >
                      View Logs
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
