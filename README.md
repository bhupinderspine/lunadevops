# Luna Deployment Form

A dynamic deployment form built with Next.js, TypeScript, and Vercel SDK that allows users to deploy GitHub repositories to Vercel with comprehensive validation and real-time feedback.

## Features

- **Dynamic Form Validation**: Real-time validation with detailed error messages
- **Vercel SDK Integration**: Direct integration with Vercel's deployment API
- **GitHub Repository Support**: Automatic extraction of repository information from GitHub URLs
- **Comprehensive Error Handling**: Detailed error messages and validation feedback
- **Beautiful UI**: Modern, responsive design with animated backgrounds
- **Deployment Tracking**: Real-time deployment status and result display

## Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm
- Vercel account and API token

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd luna-deployment-form
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` and add your Vercel token:
   ```
   VERCEL_TOKEN=your_vercel_token_here
   ```

4. **Get your Vercel token**
   - Go to [Vercel Account Tokens](https://vercel.com/account/tokens)
   - Create a new token
   - Copy the token to your `.env.local` file

## Running the Application

### Development Mode
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm start
```

## Form Fields

The deployment form includes the following fields:

### Required Fields
- **Repository URL**: GitHub repository URL (must be a valid GitHub URL)
- **Username**: GitHub username
- **Password**: GitHub password or personal access token
- **Project Name**: Name for the Vercel project (alphanumeric, hyphens, underscores only)
- **Branch**: Git branch to deploy (defaults to "main")

### Optional Fields
- **Domain Name**: Custom domain or subdomain for the deployment

## Validation Rules

### Repository URL
- Must be a valid URL
- Must contain "github.com"
- Must follow GitHub repository URL format: `https://github.com/owner/repo`

### Username
- Required field
- Minimum 3 characters

### Password
- Required field
- Minimum 6 characters

### Project Name
- Required field
- Only letters, numbers, hyphens, and underscores allowed
- Used as the project name in Vercel

### Branch
- Required field
- Git branch name (e.g., "main", "develop", "feature-branch")

### Domain Name (Optional)
- Valid domain name format
- Used as deployment alias

## API Endpoints

### POST /api/deploy
Creates a new Vercel deployment.

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/owner/repo",
  "userName": "username",
  "password": "password",
  "projectName": "my-project",
  "branch": "main",
  "target": "production",
  "domainName": "my-domain.com"
}
```

**Response:**
```json
{
  "success": true,
  "deployment": {
    "id": "deployment-id",
    "status": "READY",
    "url": "https://deployment-url.vercel.app",
    "alias": ["my-domain.com"],
    "createdAt": 1234567890,
    "readyAt": 1234567890,
    "state": "READY",
    "inspectorUrl": "https://vercel.com/inspector-url"
  },
  "message": "Deployment created successfully!"
}
```

## Error Handling

The application provides comprehensive error handling:

- **Validation Errors**: Field-specific error messages
- **API Errors**: Detailed error responses from Vercel API
- **Network Errors**: Connection and timeout handling
- **Authentication Errors**: Invalid credentials handling

## Deployment Result Display

After a successful deployment, the form displays:

- Deployment ID
- Deployment Status
- Deployment State
- Deployment URL (clickable link)
- Custom Domain Alias (if provided)
- Inspector URL for logs (if available)

## Technologies Used

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety and better development experience
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component library
- **Vercel SDK**: Official Vercel API integration
- **Zod**: Schema validation
- **React Hook Form**: Form state management

## Project Structure

```
├── app/
│   ├── api/deploy/route.ts    # API endpoint for deployments
│   ├── page.tsx               # Landing page
│   └── layout.tsx             # Root layout
├── components/
│   ├── deployment-form.tsx    # Main deployment form component
│   ├── particle-background.tsx
│   ├── digital-mesh-background.tsx
│   └── ui/                    # Reusable UI components
├── lib/
│   └── utils.ts               # Utility functions
└── public/                    # Static assets
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed description
3. Include error messages and steps to reproduce
