# Cloudinary Setup Guide for File Uploads

## Step 1: Create a Cloudinary Account

1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Click "Sign Up for Free"
3. Complete the registration

## Step 2: Get Your Credentials

1. After logging in, go to your Dashboard
2. You'll see your credentials:
   - **Cloud Name**: Your unique cloud name
   - **API Key**: Your API key
   - **API Secret**: Your API secret (click "Show" to reveal)

## Step 3: Update config.env

Replace the placeholder values in `backend/config.env`:

```env
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=your_actual_api_key
CLOUDINARY_API_SECRET=your_actual_api_secret
```

## Step 4: Test the Upload

1. Start the backend server: `npm start`
2. Start the frontend: `cd ../frontend && npm run dev`
3. Navigate to the Host Application form
4. Go to Step 3 (Media Upload)
5. Select and upload files
6. Check Cloudinary dashboard to see uploaded files

## File Upload Configuration

- **Max file size**: 5MB per file
- **Allowed formats**: JPEG, PNG, WEBP, PDF
- **Storage folder**: `etxplore/host-applications/`
- **Profile photo**: 1 file max
- **ID photo**: 1 file max
- **Additional photos**: 5 files max
- **Documents**: 3 files max

## Free Tier Limits

Cloudinary free tier includes:
- 25 GB storage
- 25 GB bandwidth per month
- Image and video transformations
- Automatic optimization

This should be sufficient for development and small-scale production.

## Troubleshooting

**Issue**: Upload fails with "Missing credentials"
- **Solution**: Make sure config.env has valid Cloudinary credentials

**Issue**: Files upload but don't appear
- **Solution**: Check Cloudinary dashboard media library

**Issue**: "File too large" error
- **Solution**: Ensure files are under 5MB each

**Issue**: Wrong file type error
- **Solution**: Only upload JPEG, PNG, WEBP images or PDF documents

