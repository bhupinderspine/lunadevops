# Setup Guide for Luna Deployment Form

## 🔧 Environment Setup

### 1. Create Environment File
Create a `.env.local` file in the root directory:

```bash
# Copy the example file
cp env.example .env.local
```

### 2. Get Your Vercel Token
1. Go to [Vercel Account Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Give it a name like "Luna Deployment Form"
4. Select "Full Account" scope
5. Copy the generated token

### 3. Add Token to Environment File
Edit `.env.local` and add your token:

```env
VERCEL_TOKEN=your_actual_token_here
```

### 4. Test the Setup
1. Run the development server:
   ```bash
   npm run dev
   ```
2. Open http://localhost:3001 (or 3000 if available)
3. Try submitting the form with a valid GitHub repository

## 🚨 Common Issues

### Error: "Vercel token is invalid or expired"
- **Cause**: Missing or invalid VERCEL_TOKEN
- **Solution**: Check your `.env.local` file has the correct token

### Error: "Repository not found"
- **Cause**: Repository doesn't exist or is private
- **Solution**: Use a public repository or check the URL

### Error: "Network error"
- **Cause**: No internet connection or API issues
- **Solution**: Check your internet connection

## 📝 Example Usage

1. **Repository URL**: `https://github.com/username/repository-name`
2. **Username**: Your GitHub username
3. **Project Name**: `my-awesome-project`
4. **Branch**: `main` (or any branch name)
5. **Domain**: `my-custom-domain.com` (optional)

## 🔍 Debug Mode

In development mode, you'll see:
- Error count display
- "Test Errors" button
- Console logs for debugging

## 📞 Support

If you're still having issues:
1. Check the browser console for error logs
2. Verify your Vercel token is valid
3. Make sure the repository is accessible
4. Check that all required fields are filled
