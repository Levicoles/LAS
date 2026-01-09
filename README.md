# Library Attendance System (LAS)

A comprehensive Vue.js application for managing school library attendance, student logs, and book inventories. This system features real-time attendance tracking, a full inventory management system with photo support, and an administrative dashboard with tiered access roles.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
* **Node.js**: Version 20.19.0 or higher (or 22.12.0+ recommended)
* **npm**: Included with Node.js
* **Supabase Account**: For the backend database and authentication

## 🚀 Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd library-attendance-system
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

## ⚙️ Configuration

### 1. Environment Variables & Credentials
You need to connect your Vue.js application to your Supabase project using environment variables.

1.  Create a file named `.env` in the root directory of your project.
2.  Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
3.  Click on your project card to open it.
4.  In the left-hand sidebar, click the **Settings** icon (⚙️) at the bottom.
5.  Select **API** from the configuration menu.
6.  Copy the values from this page into your `.env` file:
    * **Project URL**: Copy this value for `VITE_SUPABASE_URL`.
    * **Project API Keys**: Look for the `anon` / `public` key. Copy this value for `VITE_SUPABASE_ANON_KEY`.

**Your `.env` file should look like this:**
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** Do not use the service_role key in your client-side application.


### 2. Supabase Database Setup
You need to set up the database tables, views, and security functions.

1. Go to the SQL Editor icon in the left sidebar of your Supabase dashboard.

2. Click New Query (or open a blank query).

3. Open the file supabase/schema.sql from this repository.

4. Copy the entire content of schema.sql and paste it into the Supabase SQL Editor.

5. Click the Run button (bottom right) to execute the script.

This will create:

- **Tables**: books, students, attendance
- **Views**: attendance_view (for recent activity)
- **Functions**: attendance_avg_stay_seconds, admin management RPCs (has_admin, get_all_admins, etc.)
- **Storage Bucket**: book-photos (with policies for public access and authenticated uploads)

**Note:** The storage bucket creation is included in the schema.sql file. If you encounter issues with storage, see the [Storage Setup Guide](STORAGE_SETUP.md) for detailed instructions.

### 3. Supabase Storage Setup (Optional but Recommended)

The `schema.sql` file includes storage bucket creation, but if you need to set up storage manually or verify the setup:

1. Go to **Storage** in your Supabase dashboard
2. Verify that a bucket named `book-photos` exists and is set to **Public**
3. For detailed storage setup instructions, see [STORAGE_SETUP.md](STORAGE_SETUP.md)

## 🏃‍♂️ Running the Application

### Development Mode

To start the development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the next available port).

### Production Build

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory. To preview the production build:

```bash
npm run preview
```

## 👥 Usage & Roles

### Initial Admin Setup

The system uses a "First-come, First-served" logic for assigning administrative roles during registration:

1. Super Admin: The first user to register on the system is automatically assigned the super_admin role.

2. Admins: The next two users to register are assigned the admin role.

3. Users: Any subsequent registrations are assigned the standard user role.

**Note:** Only the Super Admin can manage other admin accounts (promote, delete, or update emails).

## ✨ Key Features

- **Daily Attendance Reset**: Attendance metrics (Total Visits, Avg Stay Time) automatically reset every day at midnight to provide fresh daily insights.

- **Book Inventory**:
  - Add books with details (Title, Author, Shelf)
  - Upload book covers (supported by the book-photos bucket)
  - "View More" feature allows students to see full book descriptions and high-quality images

- **Reports**: Export attendance logs to PDF or Excel

## 🛠️ Troubleshooting

- **Missing Photos**: 
  - Ensure your storage bucket is named exactly `book-photos` and is set to Public
  - Verify storage policies are correctly configured (see [STORAGE_SETUP.md](STORAGE_SETUP.md))
  - Check that file size is under 5MB and file type is supported (JPEG, PNG, GIF, WebP)

- **Connection Errors**: 
  - Double-check that your `.env` file contains the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Ensure there are no extra spaces or quotes around the values
  - Restart the development server after creating or modifying the `.env` file

- **Role Issues**: 
  - If you registered by mistake and are not an admin, you can clear the `auth.users` table in Supabase (development only) to restart the role assignment logic
  - Verify that the database functions (`has_admin`, `admin_count`, etc.) were created successfully

- **Database Errors**: 
  - Ensure all SQL from `schema.sql` executed successfully
  - Check the Supabase dashboard logs for any error messages
  - Verify that Row Level Security (RLS) policies are enabled and configured correctly