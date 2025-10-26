# Book Photo Feature Documentation

## Overview

Added photo upload and viewing functionality to the Book Inventory Management system. Administrators can now upload photos for books and view them in the book inventory.

## Features Added

### 1. Database Schema Update
- Added `photo_url` column to the `books` table to store the URL of uploaded photos

### 2. Photo Upload Functionality
- **File Upload**: Admins can upload book photos when adding a new book
- **File Validation**: 
  - Only image files are accepted (jpeg, png, gif, webp)
  - Maximum file size: 5MB
- **Preview**: Photo preview is shown before saving
- **Storage**: Photos are stored in Supabase Storage bucket `book-photos`

### 3. Photo Display
- **Thumbnail View**: Book cards display a thumbnail of the photo (if available)
- **Interactive Thumbnail**: Click on thumbnail to view full-size photo
- **Photo Viewer**: Modal dialog to view full-size book photos

### 4. Photo Management
- **Delete Photos**: When a book is deleted, its photo is also deleted from storage
- **Photo Storage**: Photos are organized in the `book-photos` bucket

## Technical Changes

### Files Modified

1. **supabase/schema.sql**
   - Added `photo_url` column to books table
   - Added storage setup comments

2. **src/services/books.js**
   - Added `uploadBookPhoto()` function
   - Added `deleteBookPhoto()` function
   - Added `updateBookPhoto()` function
   - Updated `createBook()` to handle photo_url

3. **src/components/DashboardAdmin.vue**
   - Added photo upload UI in Add Book dialog
   - Added photo preview functionality
   - Added photo thumbnail display in book cards
   - Added photo viewer dialog for full-size viewing
   - Added photo handling functions

4. **STORAGE_SETUP.md** (New File)
   - Complete guide for setting up Supabase Storage
   - Storage bucket configuration
   - Storage policies setup
   - Troubleshooting guide

## Setup Instructions

### 1. Database Setup
Run the updated schema.sql to add the `photo_url` column:
```sql
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS photo_url text null;
```

### 2. Storage Setup
Follow the instructions in `STORAGE_SETUP.md` to:
1. Create the `book-photos` storage bucket
2. Configure storage policies
3. Set up public access for viewing photos

### 3. Application Ready
Once storage is configured, the feature is ready to use!

## Usage Guide

### Uploading a Book Photo

1. Navigate to **Manage Books** tab in the admin dashboard
2. Click **Add Book** button
3. Fill in book details (title, author, shelf number)
4. Click on **Book Photo (Optional)** file input
5. Select an image file (max 5MB)
6. Preview will appear below the file input
7. Click **Save** to add the book with photo

### Viewing a Book Photo

1. In the **Books by Shelf** view
2. Locate the book with a photo (shows thumbnail)
3. Click on the thumbnail to open full-size viewer
4. Close the viewer by clicking the **Close** button

### Removing a Photo

Currently, to remove a photo, you would need to:
1. Delete the book
2. Add the book again without a photo

Future enhancement could add an "Edit Book" feature to update photos.

## API Functions

### Upload Photo
```javascript
uploadBookPhoto(file, bookId)
```
- Uploads a photo file to Supabase Storage
- Returns the public URL of the uploaded photo

### Delete Photo
```javascript
deleteBookPhoto(photoUrl)
```
- Deletes a photo from Supabase Storage
- Extracts file path from URL and removes from storage

### Update Book Photo
```javascript
updateBookPhoto(id, photoUrl)
```
- Updates the photo_url field for a book
- Used after uploading a photo

## Storage Structure

```
book-photos/
  ├── {bookId}_{timestamp}.jpg
  ├── {bookId}_{timestamp}.png
  └── ...
```

## Security Considerations

- Photos are stored in a public bucket for easy viewing
- Only authenticated admins can upload photos
- File size and type validation on client and server
- Photos are deleted when books are deleted

## Future Enhancements

1. **Edit Book Feature**: Allow updating book photos without deleting the book
2. **Multiple Photos**: Support multiple photos per book
3. **Photo Compression**: Automatic image compression before upload
4. **Drag & Drop**: Add drag-and-drop file upload interface
5. **Photo Cropping**: In-browser photo cropping before upload

