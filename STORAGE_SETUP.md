# Supabase Storage Setup for Book Photos

This guide explains how to set up Supabase Storage to enable book photo uploads.

## Prerequisites

- Access to your Supabase project dashboard
- Admin or owner role in your Supabase project

## Setup Steps

### 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `book-photos`
   - **Public bucket**: ✓ Enable
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`
5. Click **Create bucket**

### 2. Configure Storage Policies

Go to the SQL Editor in your Supabase dashboard and run the following SQL:

```sql
-- Storage policies for book-photos bucket
CREATE POLICY IF NOT EXISTS "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-photos' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-photos' AND auth.role() = 'authenticated');
```

Or manually configure in the Storage Policies section:

1. Go to **Storage** > **Policies** in Supabase dashboard
2. Select the `book-photos` bucket
3. Add the following policies:

   **Policy 1 - Public Access (SELECT)**
   - Policy name: "Public Access"
   - Allowed operation: SELECT
   - Target roles: `anon`, `authenticated`
   - USING expression: `bucket_id = 'book-photos'`

   **Policy 2 - Authenticated Upload (INSERT)**
   - Policy name: " "
   - Allowed operation: INSERT
   - Target roles: `authenticated`
   - WITH CHECK expression: `bucket_id = 'book-photos' AND auth.role() = 'authenticated'`

   **Policy 3 - Authenticated Delete (DELETE)**
   - Policy name: "Authenticated users can delete"
   - Allowed operation: DELETE
   - Target roles: `authenticated`
   - USING expression: `bucket_id = 'book-photos' AND auth.role() = 'authenticated'`

### 3. Update Database Schema

Make sure you've added the `photo_url` column to the books table:

```sql
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS photo_url text null;
```

## Verification

To verify the setup:

1. Upload a test book with a photo through the admin dashboard
2. Check the `book-photos` bucket in Storage to confirm the file appears
3. Verify the book card displays a thumbnail
4. Click the thumbnail to open the full-size photo viewer

## Troubleshooting

**Issue**: Photos not uploading
- Check that the bucket name is exactly `book-photos`
- Verify storage policies are correctly configured
- Ensure the file size is under 5MB

**Issue**: Photos not displaying
- Check browser console for CORS errors
- Verify the bucket is marked as public
- Check that the SELECT policy allows public access

**Issue**: Cannot delete photos
- Verify the DELETE policy exists and is enabled
- Check that you're logged in as an authenticated user
