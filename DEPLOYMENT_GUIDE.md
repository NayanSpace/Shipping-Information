# Deployment Guide for Shipping Tracker on Render

## 🚀 Quick Start

Your shipping tracker is now ready to deploy to Render's free tier! Here's everything you need to know.

## 📋 Prerequisites

1. **GitHub Account**: You'll need to push your code to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com) (free)
3. **Git**: Make sure you have Git installed locally

## 🔧 Changes Made for Render Deployment

### 1. Configuration Files Added
- `render.yaml` - Render deployment configuration
- `.gitignore` - Excludes unnecessary files from Git
- Updated `package.json` with Node.js version requirement

### 2. Server Updates
- **Production Mode Detection**: Automatically detects if running on Render
- **Puppeteer Configuration**: Optimized for Render's environment
- **Port Configuration**: Uses Render's PORT environment variable
- **Headless Mode**: Runs in headless mode on production

### 3. Puppeteer Optimizations
- Added production-specific Chrome arguments for Render
- Disabled unnecessary features for better performance
- Optimized memory usage for free tier limitations

## 📝 Step-by-Step Deployment

### Step 1: Prepare Your Code for Git

1. **Initialize Git Repository** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Shipping Tracker ready for deployment"
   ```

2. **Create GitHub Repository**:
   - Go to [GitHub.com](https://github.com)
   - Click "New Repository"
   - Name it something like `shipping-tracker`
   - Make it **Public** (required for Render free tier)
   - Don't initialize with README (you already have files)

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/shipping-tracker.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render

1. **Sign up/Login to Render**:
   - Go to [render.com](https://render.com)
   - Sign up with your GitHub account

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account if not already connected
   - Select your `shipping-tracker` repository

3. **Configure the Service**:
   - **Name**: `shipping-tracker` (or whatever you prefer)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty (default)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Environment Variables** (Optional but recommended):
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render will override this automatically)

5. **Deploy**:
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - This process takes 3-5 minutes

### Step 3: Verify Deployment

1. **Check Build Logs**: 
   - Monitor the build process in Render dashboard
   - Look for any errors in the logs

2. **Test Your App**:
   - Once deployed, you'll get a URL like `https://shipping-tracker-xyz.onrender.com`
   - Open the URL in your browser
   - Test tracking a package to ensure Puppeteer works

## ⚠️ Important Notes for Render Free Tier

### Limitations
- **Sleep Mode**: Your app will sleep after 15 minutes of inactivity
- **Cold Start**: First request after sleep takes 30-60 seconds
- **Build Time**: Limited build minutes per month
- **Memory**: 512MB RAM limit

### Performance Tips
1. **Optimize Puppeteer**: Already configured for production
2. **Error Handling**: Your app has robust error handling
3. **Timeouts**: Consider adding request timeouts for better UX

### If Your App Sleeps
- The first request after sleep will be slow (30-60 seconds)
- This is normal for the free tier
- Consider upgrading to a paid plan for always-on service

## 🔍 Troubleshooting

### Common Issues

1. **Build Fails**:
   - Check that all dependencies are in `package.json`
   - Ensure Node.js version is compatible (we set it to >=18.0.0)

2. **Puppeteer Errors**:
   - The production configuration should handle most issues
   - Check Render logs for specific error messages

3. **App Crashes**:
   - Monitor the logs in Render dashboard
   - Check memory usage (free tier has 512MB limit)

4. **Slow Performance**:
   - Normal for free tier when app sleeps
   - Consider optimizing Puppeteer settings further

### Getting Help
- Check Render's documentation: [render.com/docs](https://render.com/docs)
- Monitor your app's logs in the Render dashboard
- Test locally first with `NODE_ENV=production npm start`

## 🔄 Updating Your App

To update your deployed app:

1. Make changes to your code locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update: describe your changes"
   git push origin main
   ```
3. Render will automatically detect changes and redeploy

## 📊 Monitoring

- **Logs**: Available in Render dashboard
- **Metrics**: Basic metrics available on free tier
- **Uptime**: Monitor through Render dashboard

## 🎉 Success!

Once deployed, your shipping tracker will be available at your Render URL. Users can:
- Track UPS shipments
- View tracking history
- Use the auto-removal and manual removal features
- Filter and search their tracking history

The app will automatically handle the production environment and Puppeteer will work correctly on Render's infrastructure.

---

**Need Help?** Check the Render documentation or create an issue in your GitHub repository.
