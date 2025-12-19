<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchBooks, createBook, deleteBookById, toggleAvailability, uploadBookPhoto, deleteBookPhoto, updateBookPhoto } from '@/services/books'
import { fetchStudents, createStudent, deleteStudentById, updateStudentById } from '@/services/students'
import { fetchRecentActivity, fetchReportsSummary, formatDuration } from '@/services/attendance'
import { getCurrentUserRole, getAllAdmins, updateAdminRole, deleteAdminAccount, updateAdminEmail, resetAdminPassword, getCurrentUser } from '@/services/auth'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const router = useRouter()

// Active tab state
const activeTab = ref('reports')

// Current user role
const currentUserRole = ref(null)
const currentUserId = ref(null)
const isSuperAdmin = computed(() => currentUserRole.value === 'super_admin')

// Admin Management state
const admins = ref([])
const adminLoading = ref(false)
const adminMessage = ref({ type: '', text: '' })

// Edit Admin Dialog
const editAdminDialog = ref(false)
const editingAdmin = ref(null)
const editAdminForm = ref({ email: '', role: '' })

// Delete Admin Dialog
const deleteAdminDialog = ref(false)
const adminToDelete = ref(null)

// Reset Password Dialog
const resetPasswordDialog = ref(false)
const adminToResetPassword = ref(null)

// Library Reports Data - populated from Supabase
const totalVisits = ref(0)
const activeUsers = ref(0)
const avgStayTime = ref('0m 00s')
const recentActivity = ref([])
const booksByAttendance = ref({})

// Book Management Data - populated from Supabase
const totalBooks = ref(0)
const availableBooks = ref(0)
const totalShelves = ref(0)
const books = ref([])
const loading = ref(false)

// Add Book dialog and form state
const addDialog = ref(false)
const addFormValid = ref(false)
const newBook = ref({
  title: '',
  author: '',
  shelf: 1,
  available: true,
  photo: null,
  description: '',
})

// Photo upload and preview state
const photoPreview = ref(null)
const photoFile = ref(null)

// Photo viewer dialog
const showPhotoViewer = ref(false)
const viewingPhoto = ref(null)

// Delete Book dialog state
const deleteDialog = ref(false)
const bookPendingDelete = ref(null)

// Simple validation rules
const required = v => (!!v && String(v).trim().length > 0) || 'Required'
const positiveInt = v => (Number.isInteger(Number(v)) && Number(v) > 0) || 'Must be a positive number'

// Students state
const students = ref([])
const studentSearch = ref('')
const studentFormValid = ref(false)
const newStudent = ref({
  lrn: '',
  name: '',
  year_level: '',
  section: '',
})
const editDialog = ref(false)
const editStudentFormValid = ref(false)
const editStudent = ref({
  id: null,
  lrn: '',
  name: '',
  year_level: '',
  section: '',
})
const actionDrawer = ref(false)
const drawerStudent = ref(null)

// Delete student dialog state
const studentDeleteDialog = ref(false)
const studentPendingDelete = ref(null)

const lrnFourDigits = v => (/^\d{4}$/.test(String(v)) ? true : 'Enter exactly 4 digits')
const nameRequired = v => (!!v && String(v).trim().length > 0) || 'Name is required'
const yearLevelRequired = v => (!!v && String(v).trim().length > 0) || 'Year level is required'
const sectionRequired = v => (!!v && String(v).trim().length > 0) || 'Section is required'

const addStudent = async () => {
  try {
    loading.value = true
    const lrn = String(newStudent.value.lrn).trim()
    const name = String(newStudent.value.name).trim()
    const yearLevel = String(newStudent.value.year_level).trim()
    const section = String(newStudent.value.section).trim()
    if (!/^\d{4}$/.test(lrn) || !name || !yearLevel || !section) return

    // Unique LRN check locally
    const exists = students.value.some(s => String(s.lrn) === lrn)
    if (exists) {
      alert('A student with this LRN already exists.')
      return
    }

    const created = await createStudent({ lrn, name, year_level: yearLevel, section })
    students.value.push(created)

    newStudent.value = { lrn: '', name: '', year_level: '', section: '' }
  } catch (error) {
    console.error('Error adding student:', error)
  } finally {
    loading.value = false
  }
}

// Sanitize LRN input to 4 digits max
const sanitizeLrn = () => {
  newStudent.value.lrn = String(newStudent.value.lrn || '')
    .replace(/\D/g, '')
    .slice(0, 4)
}

const sanitizeEditLrn = () => {
  editStudent.value.lrn = String(editStudent.value.lrn || '')
    .replace(/\D/g, '')
    .slice(0, 4)
}

const requestDeleteStudent = (student) => {
  studentPendingDelete.value = student
  studentDeleteDialog.value = true
}

const requestEditStudent = (student) => {
  if (!student) return
  editStudent.value = { ...student }
  editDialog.value = true
}

const openActionDrawer = (student) => {
  drawerStudent.value = student
  actionDrawer.value = true
}

const updateStudent = async () => {
  try {
    loading.value = true
    const lrn = String(editStudent.value.lrn).trim()
    const name = String(editStudent.value.name).trim()
    const yearLevel = String(editStudent.value.year_level).trim()
    const section = String(editStudent.value.section).trim()

    if (!/^\d{4}$/.test(lrn) || !name || !yearLevel || !section) return

    // Ensure LRN uniqueness except for the current student
    const exists = students.value.some(
      s => String(s.lrn) === lrn && s.id !== editStudent.value.id
    )
    if (exists) {
      alert('A student with this LRN already exists.')
      return
    }

    const updated = await updateStudentById(editStudent.value.id, {
      lrn,
      name,
      year_level: yearLevel,
      section,
    })

    const idx = students.value.findIndex(s => s.id === updated.id)
    if (idx !== -1) {
      students.value[idx] = updated
    } else {
      students.value.push(updated)
    }

    editDialog.value = false
  } catch (error) {
    console.error('Error updating student:', error)
  } finally {
    loading.value = false
  }
}

const deleteStudent = async () => {
  try {
    if (!studentPendingDelete.value) return
    loading.value = true
    const id = studentPendingDelete.value.id
    await deleteStudentById(id)
    students.value = students.value.filter(s => s.id !== id)
    studentDeleteDialog.value = false
    studentPendingDelete.value = null
  } catch (error) {
    console.error('Error deleting student:', error)
  } finally {
    loading.value = false
  }
}

// Computed properties for books by shelf
const booksByShelf = computed(() => {
  const shelfMap = {}
  for (let i = 1; i <= totalShelves.value; i++) {
    shelfMap[i] = books.value.filter(book => book.shelf === i)
  }
  return shelfMap
})

// Methods
const toggleBookAvailability = async (bookId) => {
  try {
    loading.value = true
    const updated = await toggleAvailability(bookId)
    const idx = books.value.findIndex(b => b.id === bookId)
    if (idx !== -1) books.value[idx] = updated
    availableBooks.value = books.value.filter(b => b.available).length
  } catch (error) {
    console.error('Error updating book availability:', error)
  } finally {
    loading.value = false
  }
}

const addBook = async () => {
  try {
    loading.value = true
    // Basic validation
    if (!newBook.value.title.trim() || !newBook.value.author.trim()) return
    const shelfNumber = Number(newBook.value.shelf)
    if (!Number.isInteger(shelfNumber) || shelfNumber <= 0) return

    let photoUrl = null
    
    // Upload photo if provided
    if (photoFile.value) {
      // Create a temporary book ID for photo upload
      const tempBook = await createBook({
        title: newBook.value.title.trim(),
        author: newBook.value.author.trim(),
        shelf: shelfNumber,
        available: !!newBook.value.available,
        description: newBook.value.description?.trim() || null,
      })
      
      try {
        photoUrl = await uploadBookPhoto(photoFile.value, tempBook.id)
        // Update the book with the photo URL
        const updated = await updateBookPhoto(tempBook.id, photoUrl)
        books.value.push(updated)
      } catch (photoError) {
        console.error('Error uploading photo:', photoError)
        // Delete the book if photo upload failed
        await deleteBookById(tempBook.id)
        books.value.push(tempBook)
      }
    } else {
      const created = await createBook({
        title: newBook.value.title.trim(),
        author: newBook.value.author.trim(),
        shelf: shelfNumber,
        available: !!newBook.value.available,
        description: newBook.value.description?.trim() || null,
      })
      books.value.push(created)
    }

    // Update counters
    totalBooks.value = books.value.length
    availableBooks.value = books.value.filter(b => b.available).length
    if (shelfNumber > totalShelves.value) {
      totalShelves.value = shelfNumber
    }

    // Reset form and close dialog
    newBook.value = { title: '', author: '', shelf: 1, available: true, photo: null, description: '' }
    photoPreview.value = null
    photoFile.value = null
    addDialog.value = false
  } catch (error) {
    console.error('Error adding book:', error)
  } finally {
    loading.value = false
  }
}

const requestDeleteBook = (book) => {
  bookPendingDelete.value = book
  deleteDialog.value = true
}

const deleteBook = async () => {
  try {
    if (!bookPendingDelete.value) return
    loading.value = true
    const id = bookPendingDelete.value.id
    const photoUrl = bookPendingDelete.value.photo_url
    
    // Delete photo from storage if exists
    if (photoUrl) {
      await deleteBookPhoto(photoUrl)
    }
    
    await deleteBookById(id)
    books.value = books.value.filter(b => b.id !== id)
    totalBooks.value = books.value.length
    availableBooks.value = books.value.filter(b => b.available).length
    totalShelves.value = books.value.length > 0 ? Math.max(...books.value.map(b => b.shelf)) : 0
    deleteDialog.value = false
    bookPendingDelete.value = null
  } catch (error) {
    console.error('Error deleting book:', error)
  } finally {
    loading.value = false
  }
}

// Photo handling functions
const handlePhotoUpload = (event) => {
  const file = event.target.files?.[0]
  if (file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }
    
    photoFile.value = file
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      photoPreview.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const removePhoto = () => {
  photoPreview.value = null
  photoFile.value = null
}

const viewPhoto = (book) => {
  if (book.photo_url) {
    viewingPhoto.value = book
    showPhotoViewer.value = true
  }
}

const exportToPDF = () => {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const marginX = 40
    const marginY = 40
    const lineHeight = 18

    // Title
    const title = 'Library Usage Report'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(title, marginX, marginY)

    // Date range / generated at
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const generatedAt = new Date().toLocaleString()
    doc.text(`Generated: ${generatedAt}`, marginX, marginY + lineHeight)

    // Metrics
    const metricsY = marginY + lineHeight * 3
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', marginX, metricsY)
    doc.setFont('helvetica', 'normal')
    const metrics = [
      [`Total Visits`, String(totalVisits.value)],
      [`Active Users`, String(activeUsers.value)],
      [`Avg Stay Time`, String(avgStayTime.value)],
    ]
    autoTable(doc, {
      startY: metricsY + 8,
      head: [['Metric', 'Value']],
      body: metrics,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [63, 81, 181] },
      theme: 'striped',
      margin: { left: marginX, right: marginX },
    })

    // Recent Activity table
    const activityRows = (recentActivity.value || []).map(a => {
      const attendanceId = typeof a.id === 'string' && a.id.includes('-') ? a.id.split('-')[0] : ''
      const books = Array.isArray(booksByAttendance.value[attendanceId]) ? booksByAttendance.value[attendanceId].join(', ') : ''
      return [
        a.user || '',
        a.action || '',
        a.time || '',
        typeof a.duration === 'string' ? a.duration : (a.duration || ''),
        books
      ]
    })
    const nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 24 : metricsY + 80
    doc.setFont('helvetica', 'bold')
    doc.text('Recent Activity (today)', marginX, nextY)
    doc.setFont('helvetica', 'normal')
    autoTable(doc, {
      startY: nextY + 8,
      head: [['User', 'Action', 'Time', 'Duration', 'Books Read']],
      body: activityRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243] },
      theme: 'striped',
      margin: { left: marginX, right: marginX },
    })

    // Detailed Visit History (Logins / Logouts)
    const startY2 = doc.lastAutoTable ? doc.lastAutoTable.finalY + 28 : (nextY + 120)
    doc.setFont('helvetica', 'bold')
    doc.text('Detailed Visit History', marginX, startY2)

    // Logins table
    const loginRows = (visitRowsIn.value || []).map(r => [r.user, r.timeText || '', r.durationText || '', (r.books || []).join(', ')])
    autoTable(doc, {
      startY: startY2 + 8,
      head: [['Logins']],
      body: [],
      theme: 'plain',
      styles: { fontSize: 11 },
      margin: { left: marginX, right: marginX },
    })
    autoTable(doc, {
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 4 : startY2 + 24,
      head: [['User', 'Time', 'Duration', 'Books Read']],
      body: loginRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [76, 175, 80] },
      theme: 'striped',
      margin: { left: marginX, right: marginX },
    })

    // Logouts table
    const logoutRows = (visitRowsOut.value || []).map(r => [r.user, r.timeText || '', r.durationText || '', (r.books || []).join(', ')])
    autoTable(doc, {
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : undefined,
      head: [['Logouts']],
      body: [],
      theme: 'plain',
      styles: { fontSize: 11 },
      margin: { left: marginX, right: marginX },
    })
    autoTable(doc, {
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 4 : undefined,
      head: [['User', 'Time', 'Duration', 'Books Read']],
      body: logoutRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [244, 67, 54] },
      theme: 'striped',
      margin: { left: marginX, right: marginX },
    })

    const dateStr = new Date().toISOString().slice(0, 10)
    doc.save(`Library_Usage_Report_${dateStr}.pdf`)
  } catch (err) {
    console.error('PDF export failed:', err)
    alert('Failed to export PDF')
  }
}

const exportToExcel = () => {
  try {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Visits', totalVisits.value],
      ['Active Users', activeUsers.value],
      ['Avg Stay Time', avgStayTime.value],
      ['Generated', new Date().toLocaleString()],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // Recent Activity sheet
    const activityData = [
      ['User', 'Action', 'Time', 'Duration', 'Books Read'],
      ...(recentActivity.value || []).map(a => {
        const attendanceId = typeof a.id === 'string' && a.id.includes('-') ? a.id.split('-')[0] : ''
        const books = Array.isArray(booksByAttendance.value[attendanceId]) ? booksByAttendance.value[attendanceId].join(', ') : ''
        return [a.user || '', a.action || '', a.time || '', a.duration || '', books]
      }),
    ]
    const wsActivity = XLSX.utils.aoa_to_sheet(activityData)
    XLSX.utils.book_append_sheet(wb, wsActivity, 'Recent Activity')

    // Detailed Visit History sheets
    const loginSheet = [
      ['User', 'Time', 'Duration', 'Books Read'],
      ...(visitRowsIn.value || []).map(r => [r.user, r.timeText || '', r.durationText || '', (r.books || []).join(', ')])
    ]
    const wsLogins = XLSX.utils.aoa_to_sheet(loginSheet)
    XLSX.utils.book_append_sheet(wb, wsLogins, 'Logins')

    const logoutSheet = [
      ['User', 'Time', 'Duration', 'Books Read'],
      ...(visitRowsOut.value || []).map(r => [r.user, r.timeText || '', r.durationText || '', (r.books || []).join(', ')])
    ]
    const wsLogouts = XLSX.utils.aoa_to_sheet(logoutSheet)
    XLSX.utils.book_append_sheet(wb, wsLogouts, 'Logouts')

    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const dateStr = new Date().toISOString().slice(0, 10)
    saveAs(blob, `Library_Usage_Report_${dateStr}.xlsx`)
  } catch (err) {
    console.error('Excel export failed:', err)
    alert('Failed to export Excel')
  }
}

const logout = () => {
  router.push('/')
}

// Load data from Supabase
const loadLibraryData = async () => {
  try {
    loading.value = true
    const [summary, activity] = await Promise.all([
      fetchReportsSummary(),
      fetchRecentActivity(20),
    ])
    totalVisits.value = summary.totalVisits || 0
    activeUsers.value = summary.activeUsers || 0
    avgStayTime.value = formatDuration(summary.avgStaySeconds || 0)
    recentActivity.value = activity.map(a => ({
      ...a,
      // 'duration' from service is in seconds for 'out' events; keep as pretty text here
      duration: typeof a.duration === 'number' ? formatDuration(a.duration) : a.duration,
    }))

    // Load local mapping of books read keyed by attendance id
    try {
      const raw = localStorage.getItem('books_by_attendance')
      booksByAttendance.value = raw ? JSON.parse(raw) : {}
    } catch (_) {
      booksByAttendance.value = {}
    }
  } catch (error) {
    console.error('Error loading library data:', error)
  } finally {
    loading.value = false
  }
}

const loadBooksData = async () => {
  try {
    loading.value = true
    const data = await fetchBooks()
    books.value = Array.isArray(data) ? data : []
    totalBooks.value = books.value.length
    availableBooks.value = books.value.filter(b => b.available).length
    totalShelves.value = books.value.length > 0 ? Math.max(...books.value.map(b => b.shelf)) : 0
  } catch (error) {
    console.error('Error loading books data:', error)
  } finally {
    loading.value = false
  }
}

const loadStudentsData = async () => {
  try {
    loading.value = true
    const data = await fetchStudents()
    students.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error loading students data:', error)
  } finally {
    loading.value = false
  }
}

// Admin Management Functions
const loadAdmins = async () => {
  if (!isSuperAdmin.value) return
  try {
    adminLoading.value = true
    admins.value = await getAllAdmins()
  } catch (error) {
    console.error('Error loading admins:', error)
    adminMessage.value = { type: 'error', text: 'Failed to load admin accounts' }
  } finally {
    adminLoading.value = false
  }
}

const openEditAdmin = (admin) => {
  editingAdmin.value = admin
  editAdminForm.value = { email: admin.email, role: admin.role }
  editAdminDialog.value = true
}

const saveAdminChanges = async () => {
  if (!editingAdmin.value) return
  try {
    adminLoading.value = true
    adminMessage.value = { type: '', text: '' }
    
    // Update email if changed
    if (editAdminForm.value.email !== editingAdmin.value.email) {
      await updateAdminEmail(editingAdmin.value.id, editAdminForm.value.email)
    }
    
    // Update role if changed
    if (editAdminForm.value.role !== editingAdmin.value.role) {
      await updateAdminRole(editingAdmin.value.id, editAdminForm.value.role)
    }
    
    adminMessage.value = { type: 'success', text: 'Admin account updated successfully' }
    editAdminDialog.value = false
    await loadAdmins()
  } catch (error) {
    console.error('Error updating admin:', error)
    adminMessage.value = { type: 'error', text: error.message || 'Failed to update admin account' }
  } finally {
    adminLoading.value = false
  }
}

const confirmDeleteAdmin = (admin) => {
  if (admin.id === currentUserId.value) {
    adminMessage.value = { type: 'error', text: 'You cannot delete your own account' }
    return
  }
  adminToDelete.value = admin
  deleteAdminDialog.value = true
}

const deleteAdmin = async () => {
  if (!adminToDelete.value) return
  try {
    adminLoading.value = true
    adminMessage.value = { type: '', text: '' }
    await deleteAdminAccount(adminToDelete.value.id)
    adminMessage.value = { type: 'success', text: 'Admin account deleted successfully' }
    deleteAdminDialog.value = false
    adminToDelete.value = null
    await loadAdmins()
  } catch (error) {
    console.error('Error deleting admin:', error)
    adminMessage.value = { type: 'error', text: error.message || 'Failed to delete admin account' }
  } finally {
    adminLoading.value = false
  }
}

const confirmResetPassword = (admin) => {
  adminToResetPassword.value = admin
  resetPasswordDialog.value = true
}

const sendPasswordReset = async () => {
  if (!adminToResetPassword.value) return
  try {
    adminLoading.value = true
    adminMessage.value = { type: '', text: '' }
    await resetAdminPassword(adminToResetPassword.value.email)
    adminMessage.value = { type: 'success', text: `Password reset email sent to ${adminToResetPassword.value.email}` }
    resetPasswordDialog.value = false
    adminToResetPassword.value = null
  } catch (error) {
    console.error('Error sending password reset:', error)
    adminMessage.value = { type: 'error', text: error.message || 'Failed to send password reset email' }
  } finally {
    adminLoading.value = false
  }
}

// Load data when component mounts
onMounted(async () => {
  // Get current user role
  const user = await getCurrentUser()
  currentUserId.value = user?.id
  currentUserRole.value = user?.user_metadata?.role
  
  loadLibraryData()
  loadBooksData()
  loadStudentsData()
  
  if (currentUserRole.value === 'super_admin') {
    loadAdmins()
  }
})

const filteredStudents = computed(() => {
  const q = String(studentSearch.value || '').trim().toLowerCase()
  if (!q) return students.value
  return (students.value || []).filter(s => {
    const lrn = String(s.lrn || '').toLowerCase()
    const name = String(s.name || '').toLowerCase()
    const yl = String(s.year_level || '').toLowerCase()
    const sec = String(s.section || '').toLowerCase()
    return lrn.includes(q) || name.includes(q) || yl.includes(q) || sec.includes(q)
  })
})

// Compact summary (top 2 activities) and table-friendly rows
const recentActivityCompact = computed(() => {
  return (recentActivity.value || []).slice(0, 2).map(a => {
    const isIn = a.type === 'in'
    const timeText = a.time ? new Date(a.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''
    return {
      user: a.user || '',
      actionText: isIn ? 'In' : 'Out',
      color: isIn ? 'green' : 'red',
      timeText,
      durationText: isIn ? (a.duration || 'Active') : (a.duration || '')
    }
  })
})

const visitRows = computed(() => {
  return (recentActivity.value || []).map(a => {
    const isIn = a.type === 'in'
    // Extract attendance id from event id pattern `${attendanceId}-in|out`
    const attendanceId = typeof a.id === 'string' && a.id.includes('-') ? a.id.split('-')[0] : ''
    const books = Array.isArray(booksByAttendance.value[attendanceId]) ? booksByAttendance.value[attendanceId] : []
    return {
      user: a.user || '',
      action: isIn ? 'In' : 'Out',
      timeText: a.time ? new Date(a.time).toLocaleString() : '',
      durationText: isIn ? (a.duration || 'Active') : (a.duration || ''),
      books
    }
  })
})

const visitRowsIn = computed(() => visitRows.value.filter(r => r.action === 'In'))
const visitRowsOut = computed(() => visitRows.value.filter(r => r.action === 'Out'))

// Pair login/logout into single rows
const combinedVisitRows = computed(() => {
  const map = {}
  ;(recentActivity.value || []).forEach(a => {
    const attendanceId = typeof a.id === 'string' && a.id.includes('-') ? a.id.split('-')[0] : ''
    const key = attendanceId || `${a.user || 'unknown'}-${a.time || ''}`
    const existingBooks = Array.isArray(booksByAttendance.value[attendanceId]) ? booksByAttendance.value[attendanceId] : []
    const entry = map[key] || {
      user: a.user || '',
      loginTime: '',
      logoutTime: '',
      duration: '',
      books: existingBooks,
    }
    const timeText = a.time ? new Date(a.time).toLocaleString() : ''
    if (a.type === 'in') {
      entry.loginTime = entry.loginTime || timeText
    } else {
      entry.logoutTime = entry.logoutTime || timeText
      entry.duration = typeof a.duration === 'number' ? formatDuration(a.duration) : (a.duration || '')
    }
    if (!entry.books?.length) entry.books = existingBooks
    map[key] = entry
  })
  return Object.values(map).filter(e => e.loginTime || e.logoutTime)
})
</script>

<template>
  <v-app>
    <!-- Header -->
    <v-app-bar class="admin-header" dark height="80" elevation="4">
      <v-container fluid>
        <v-row align="center" no-gutters>
          <v-col cols="auto" class="mr-6">
            <v-menu location="bottom start" transition="fade-transition">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon class="text-white mr-3" aria-label="Navigation menu">
                  <v-icon>mdi-menu</v-icon>
                </v-btn>
              </template>
              <v-list density="comfortable">
                <v-list-item :active="activeTab === 'reports'" @click="activeTab = 'reports'">
                  <template #prepend>
                    <v-icon color="primary" class="mr-2">mdi-chart-line</v-icon>
                  </template>
                  <v-list-item-title>Library Reports</v-list-item-title>
                </v-list-item>
                <v-list-item :active="activeTab === 'books'" @click="activeTab = 'books'">
                  <template #prepend>
                    <v-icon color="primary" class="mr-2">mdi-book-open-variant</v-icon>
                  </template>
                  <v-list-item-title>Manage Books</v-list-item-title>
                </v-list-item>
                <v-list-item :active="activeTab === 'students'" @click="activeTab = 'students'">
                  <template #prepend>
                    <v-icon color="primary" class="mr-2">mdi-account-school</v-icon>
                  </template>
                  <v-list-item-title>Manage Students</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="isSuperAdmin" :active="activeTab === 'admins'" @click="activeTab = 'admins'">
                  <template #prepend>
                    <v-icon color="primary" class="mr-2">mdi-shield-account</v-icon>
                  </template>
                  <v-list-item-title>Admin Management</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
            <h1 class="text-h5 font-weight-bold d-inline text-white">Library Admin Dashboard</h1>
          </v-col>
          <v-col>
          </v-col>
          <v-col cols="auto">
            <v-btn 
              color="error" 
              variant="elevated"
              @click="logout" 
              class="text-white"
              prepend-icon="mdi-logout"
            >
              Log out
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-app-bar>

    <!-- Main Content -->
    <v-main class="admin-main-bg">
      <v-container fluid class="pa-4">
        
        <!-- Library Reports Tab -->
        <div v-if="activeTab === 'reports'">
          <!-- Page Header -->
          <v-row class="mb-4">
            <v-col>
              <v-card class="pa-4" elevation="2">
                <v-row align="center">
                  <v-col>
                    <h2 class="text-h4 font-weight-bold text-primary mb-2">
                      <v-icon left color="primary">mdi-chart-line</v-icon>
                      Library Usage Reports
                    </h2>
                    <p class="text-body-1 text-grey-darken-1 mb-0">
                      Monitor library activity and generate reports
                    </p>
                  </v-col>
                  <v-col cols="auto">
                    <v-btn-group>
                      <v-btn 
                        color="error" 
                        variant="elevated"
                        @click="exportToPDF"
                        prepend-icon="mdi-file-pdf-box"
                        class="mr-2"
                      >
                        Export PDF
                      </v-btn>
                      <v-btn 
                        color="success" 
                        variant="elevated"
                        @click="exportToExcel"
                        prepend-icon="mdi-file-excel-box"
                      >
                        Export Excel
                      </v-btn>
                    </v-btn-group>
                  </v-col>
                </v-row>
              </v-card>
            </v-col>
          </v-row>

          <!-- Metrics Cards -->
          <v-row class="mb-6">
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card metric-card-blue" elevation="3">
                <v-icon size="36" color="#1565C0" class="mb-2">mdi-account-group</v-icon>
                <div class="text-h3 font-weight-bold metric-value-blue mb-1">{{ totalVisits }}</div>
                <div class="text-subtitle-2 text-grey-darken-2">Total Visits</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">All time visits</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card metric-card-green" elevation="3">
                <v-icon size="36" color="#2E7D32" class="mb-2">mdi-account-check</v-icon>
                <div class="text-h3 font-weight-bold metric-value-green mb-1">{{ activeUsers }}</div>
                <div class="text-subtitle-2 text-grey-darken-2">Active Users</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Currently in library</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card metric-card-teal" elevation="3">
                <v-icon size="36" color="#00796B" class="mb-2">mdi-clock-outline</v-icon>
                <div class="text-h3 font-weight-bold metric-value-teal mb-1">{{ avgStayTime }}</div>
                <div class="text-subtitle-2 text-grey-darken-2">Avg Stay Time</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Average duration</div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Recent Activity -->
          <v-row>
            <v-col>
              <!-- Compact Recent Activity Card (top 2) -->
              <v-card elevation="3" class="recent-activity-card">
                <v-card-title class="text-h6 font-weight-bold text-primary pa-4 pb-2">
                  <v-icon left color="primary">mdi-history</v-icon>
                  Recent Activity
                </v-card-title>
                <v-card-text class="pa-4">
                  <div v-if="!loading && recentActivityCompact.length">
                    <div v-for="(a, i) in recentActivityCompact" :key="i" class="mb-2">
                      <span :class="a.color === 'green' ? 'text-green' : 'text-red'" class="font-weight-medium">{{ a.user }}</span>
                      <span class="ml-1" :class="a.color === 'green' ? 'text-green' : 'text-red'">- {{ a.actionText }}</span>
                      <span class="ml-1">at {{ a.timeText }}</span>
                      <span v-if="a.durationText" class="ml-1 text-green">(Duration: {{ a.durationText }})</span>
                    </div>
                  </div>
                  <div v-else-if="loading" class="text-center">
                    <v-progress-circular indeterminate color="primary" size="32"></v-progress-circular>
                  </div>
                  <div v-else class="text-grey">No activity yet</div>
                </v-card-text>
              </v-card>

              <!-- Detailed Visit History Table -->
              <v-card class="mt-4 visit-history-card" elevation="3">
                <v-card-title class="text-h6 font-weight-bold text-primary pa-4 pb-2">
                  <v-icon left color="primary">mdi-text-box-outline</v-icon>
                  Detailed Visit History
                </v-card-title>
                <v-card-text class="pa-0">
                  <div v-if="!loading && combinedVisitRows.length">
                    <v-table density="comfortable">
                      <thead>
                        <tr>
                          <th class="text-left">User</th>
                          <th class="text-left">Login Time</th>
                          <th class="text-left">Logout Time</th>
                          <th class="text-left">Duration</th>
                          <th class="text-left">Books Read</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(r, i) in combinedVisitRows" :key="`visit-${i}`">
                          <td>{{ r.user }}</td>
                          <td>{{ r.loginTime }}</td>
                          <td>{{ r.logoutTime }}</td>
                          <td>{{ r.duration || '—' }}</td>
                          <td>
                            <span v-if="r.books && r.books.length">{{ r.books.join(', ') }}</span>
                            <span v-else class="text-grey">—</span>
                          </td>
                        </tr>
                      </tbody>
                    </v-table>
                  </div>
                  <div v-else-if="loading" class="pa-6 text-center">
                    <v-progress-circular indeterminate color="primary" size="32"></v-progress-circular>
                  </div>
                  <div v-else class="pa-6 text-center text-grey">No visit history</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Delete Student Dialog -->
        <v-dialog v-model="studentDeleteDialog" max-width="500">
          <v-card>
            <v-card-title class="text-h6 font-weight-bold">Delete Student</v-card-title>
            <v-card-text>
              Are you sure you want to delete
              <strong v-if="studentPendingDelete">"{{ studentPendingDelete.name }}"</strong>
              (LRN: <span v-if="studentPendingDelete">{{ studentPendingDelete.lrn }}</span>)?
              This action cannot be undone.
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn variant="text" @click="studentDeleteDialog = false; studentPendingDelete = null">Cancel</v-btn>
              <v-btn color="error" :loading="loading" @click="deleteStudent" variant="elevated">Delete</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Edit Student Dialog -->
        <v-dialog v-model="editDialog" max-width="500">
          <v-card>
            <v-card-title class="text-h6 font-weight-bold">Edit Student</v-card-title>
            <v-card-text>
              <v-form v-model="editStudentFormValid">
                <v-text-field
                  label="LRN"
                  v-model="editStudent.lrn"
                  @input="sanitizeEditLrn"
                  :rules="[lrnFourDigits]"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-card-account-details"
                  maxlength="4"
                  counter="4"
                  required
                />
                <v-text-field
                  label="Name"
                  v-model="editStudent.name"
                  :rules="[nameRequired]"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-account"
                  required
                />
                <v-text-field
                  label="Year Level"
                  v-model="editStudent.year_level"
                  :rules="[yearLevelRequired]"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-school"
                  required
                />
                <v-text-field
                  label="Section"
                  v-model="editStudent.section"
                  :rules="[sectionRequired]"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-view-grid-outline"
                  required
                />
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn variant="text" @click="editDialog = false">Cancel</v-btn>
              <v-btn color="primary" :disabled="!editStudentFormValid || loading" :loading="loading" @click="updateStudent" variant="elevated">
                Save Changes
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Actions Navigation Drawer -->
        <v-navigation-drawer
          v-model="actionDrawer"
          location="right"
          temporary
          width="320"
          elevation="4"
        >
          <v-sheet class="pa-4" height="100%">
            <div class="d-flex align-center mb-4">
              <v-icon color="primary" class="mr-2">mdi-account-cog</v-icon>
              <h3 class="text-h6 font-weight-bold mb-0">Student Actions</h3>
              <v-spacer></v-spacer>
              <v-btn icon variant="text" @click="actionDrawer = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>

            <div v-if="drawerStudent">
              <div class="mb-4">
                <div class="text-subtitle-1 font-weight-bold">{{ drawerStudent.name }}</div>
                <div class="text-body-2 text-grey-darken-1">LRN: {{ drawerStudent.lrn }}</div>
                <div class="text-body-2 text-grey-darken-1">Year: {{ drawerStudent.year_level }}</div>
                <div class="text-body-2 text-grey-darken-1">Section: {{ drawerStudent.section }}</div>
              </div>

              <v-divider class="mb-4"></v-divider>

              <v-btn
                color="primary"
                block
                class="mb-3"
                :loading="loading"
                @click="requestEditStudent(drawerStudent); actionDrawer = false"
                variant="elevated"
              >
                <v-icon left size="18">mdi-pencil</v-icon>
                Edit Student
              </v-btn>

              <v-btn
                color="error"
                block
                :loading="loading"
                @click="requestDeleteStudent(drawerStudent); actionDrawer = false"
                variant="elevated"
              >
                <v-icon left size="18">mdi-delete</v-icon>
                Delete Student
              </v-btn>
            </div>

            <div v-else class="text-center text-grey">
              No student selected.
            </div>
          </v-sheet>
        </v-navigation-drawer>

        <!-- Manage Books Tab -->
        <div v-if="activeTab === 'books'">
          <!-- Page Header -->
          <v-row class="mb-4">
            <v-col>
              <v-card class="pa-4" elevation="2">
                <h2 class="text-h4 font-weight-bold text-primary mb-2">
                  <v-icon left color="primary">mdi-book-open-variant</v-icon>
                  Book Inventory Management
                </h2>
                <p class="text-body-1 text-grey-darken-1 mb-0">
                  Manage your library's book collection and track availability
                </p>
                <div class="mt-4">
                  <v-btn color="primary" variant="elevated" prepend-icon="mdi-book-plus" @click="addDialog = true">
                    Add Book
                  </v-btn>
                </div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Add Book Dialog -->
          <v-dialog v-model="addDialog" max-width="560">
            <v-card>
              <v-card-title class="text-h6 font-weight-bold">Add New Book</v-card-title>
              <v-card-text>
                <v-form v-model="addFormValid">
                  <v-text-field
                    label="Title"
                    v-model="newBook.title"
                    :rules="[required]"
                    prepend-icon="mdi-format-title"
                    variant="outlined"
                    density="comfortable"
                    required
                  />
                  <v-text-field
                    label="Author"
                    v-model="newBook.author"
                    :rules="[required]"
                    prepend-icon="mdi-account"
                    variant="outlined"
                    density="comfortable"
                    required
                  />
                  <v-text-field
                    label="Shelf Number"
                    v-model.number="newBook.shelf"
                    type="number"
                    :rules="[required, positiveInt]"
                    prepend-icon="mdi-bookshelf"
                    variant="outlined"
                    density="comfortable"
                    min="1"
                    required
                  />
                  
                  <v-textarea
                    label="Description (Optional)"
                    v-model="newBook.description"
                    prepend-icon="mdi-text-box-outline"
                    variant="outlined"
                    density="comfortable"
                    rows="3"
                    hint="Add a brief description about the book"
                    persistent-hint
                  />
                  
                  <!-- Photo Upload -->
                  <v-file-input
                    label="Book Photo (Optional)"
                    prepend-icon="mdi-camera"
                    accept="image/*"
                    variant="outlined"
                    density="comfortable"
                    @change="handlePhotoUpload"
                    show-size
                  />
                  
                  <!-- Photo Preview -->
                  <div v-if="photoPreview" class="mt-2">
                    <v-img
                      :src="photoPreview"
                      max-height="150"
                      contain
                      class="mb-2"
                    ></v-img>
                    <v-btn
                      size="small"
                      color="error"
                      @click="removePhoto"
                    >
                      Remove Photo
                    </v-btn>
                  </div>
                  
                  <v-switch
                    v-model="newBook.available"
                    color="success"
                    inset
                    hide-details
                    :label="newBook.available ? 'Available' : 'Unavailable'"
                    class="mt-2"
                  />
                </v-form>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="addDialog = false">Cancel</v-btn>
                <v-btn color="primary" :disabled="!addFormValid || loading" :loading="loading" @click="addBook" variant="elevated">
                  Save
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          
          <!-- Photo Viewer Dialog -->
          <v-dialog v-model="showPhotoViewer" max-width="800">
            <v-card v-if="viewingPhoto">
              <v-card-title class="text-h6 font-weight-bold">
                {{ viewingPhoto.title }}
              </v-card-title>
              <v-card-text class="text-center">
                <img
                  v-if="viewingPhoto.photo_url"
                  :src="viewingPhoto.photo_url"
                  alt="Book Photo"
                  style="max-width: 100%; max-height: 600px; object-fit: contain;"
                />
                <p class="text-subtitle-1 mt-4">
                  by {{ viewingPhoto.author }}
                </p>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary" @click="showPhotoViewer = false" variant="elevated">
                  Close
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          
          <!-- Delete Book Dialog -->
          <v-dialog v-model="deleteDialog" max-width="500">
            <v-card>
              <v-card-title class="text-h6 font-weight-bold">Delete Book</v-card-title>
              <v-card-text>
                Are you sure you want to delete
                <strong v-if="bookPendingDelete">"{{ bookPendingDelete.title }}"</strong>
                by
                <span v-if="bookPendingDelete">{{ bookPendingDelete.author }}</span>?
                This action cannot be undone.
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="deleteDialog = false; bookPendingDelete = null">Cancel</v-btn>
                <v-btn color="error" :loading="loading" @click="deleteBook" variant="elevated">Delete</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          
          <!-- Summary Cards -->
          <v-row class="mb-6">
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card metric-card-blue" elevation="3">
                <v-icon size="36" color="#1565C0" class="mb-2">mdi-book-multiple</v-icon>
                <div class="text-h3 font-weight-bold metric-value-blue mb-1">{{ totalBooks }}</div>
                <div class="text-subtitle-2 text-grey-darken-2">Total Books</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">In collection</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card metric-card-green" elevation="3">
                <v-icon size="36" color="#2E7D32" class="mb-2">mdi-check-circle</v-icon>
                <div class="text-h3 font-weight-bold metric-value-green mb-1">{{ availableBooks }}</div>
                <div class="text-subtitle-2 text-grey-darken-2">Available</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Ready to borrow</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card metric-card-teal" elevation="3">
                <v-icon size="36" color="#00796B" class="mb-2">mdi-bookshelf</v-icon>
                <div class="text-h3 font-weight-bold metric-value-teal mb-1">{{ totalShelves }}</div>
                <div class="text-subtitle-2 text-grey-darken-2">Shelves</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Storage units</div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Books by Shelf -->
          <v-row>
            <v-col>
              <v-card elevation="3">
                <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-2">
                  <v-icon left color="primary">mdi-bookshelf</v-icon>
                  Books by Shelf
                </v-card-title>
                <v-card-text class="pa-6">
                  <div v-if="loading" class="text-center pa-8">
                    <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
                    <p class="mt-4 text-h6 text-grey-darken-1">Loading books...</p>
                  </div>
                  <div v-else-if="totalShelves === 0" class="text-center pa-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-bookshelf</v-icon>
                    <p class="text-h6 text-grey-darken-1">No shelves found</p>
                    <p class="text-body-2 text-grey">Please add some books to get started</p>
                  </div>
                  <v-row v-else>
                    <v-col 
                      v-for="shelfNum in totalShelves" 
                      :key="shelfNum" 
                      cols="12" 
                      sm="6" 
                      md="4" 
                      lg="2"
                    >
                      <v-card elevation="2" class="pa-4 h-100 shelf-card">
                        <div class="text-center mb-4">
                          <v-icon size="32" color="primary" class="mb-2">mdi-bookshelf</v-icon>
                          <h4 class="text-h6 font-weight-bold text-primary">
                            Shelf {{ shelfNum }}
                          </h4>
                        </div>
                        <div v-if="booksByShelf[shelfNum] && booksByShelf[shelfNum].length > 0">
                          <v-card 
                            v-for="book in booksByShelf[shelfNum]" 
                            :key="book.id"
                            class="mb-3 pa-3 book-card" 
                            elevation="1"
                            :color="book.available ? 'green-lighten-5' : 'red-lighten-5'"
                          >
                            <!-- Book Photo Thumbnail -->
                            <div v-if="book.photo_url" class="mb-2 text-center" @click="viewPhoto(book)" style="cursor: pointer;">
                              <v-img
                                :src="book.photo_url"
                                max-height="120"
                                cover
                                style="border-radius: 8px;"
                              >
                                <div class="d-flex align-center justify-center fill-height" style="background: rgba(0,0,0,0.3);">
                                  <v-icon color="white" size="24">mdi-eye</v-icon>
                                </div>
                              </v-img>
                            </div>
                            
                            <div class="text-subtitle-2 font-weight-bold mb-1 text-truncate">
                              {{ book.title }}
                            </div>
                            <div class="text-caption text-grey-darken-1 mb-3">
                              by {{ book.author }}
                            </div>
                            <v-chip 
                              :color="book.available ? 'green' : 'red'" 
                              size="small" 
                              class="mb-3"
                              variant="elevated"
                            >
                              <v-icon left size="16">
                                {{ book.available ? 'mdi-check' : 'mdi-close' }}
                              </v-icon>
                              {{ book.available ? 'Available' : 'Unavailable' }}
                            </v-chip>
                            <v-btn 
                              :color="book.available ? 'red' : 'green'" 
                              size="small" 
                              block
                              :loading="loading"
                              @click="toggleBookAvailability(book.id)"
                              variant="elevated"
                            >
                              <v-icon left size="16">
                                {{ book.available ? 'mdi-close' : 'mdi-check' }}
                              </v-icon>
                              {{ book.available ? 'Mark Unavailable' : 'Mark Available' }}
                            </v-btn>
                            <v-btn 
                              color="error" 
                              size="small" 
                              class="mt-2"
                              block
                              :loading="loading"
                              @click="requestDeleteBook(book)"
                              variant="elevated"
                            >
                              <v-icon left size="16">mdi-delete</v-icon>
                              Delete
                            </v-btn>
                          </v-card>
                        </div>
                        <div v-else class="text-center pa-4">
                          <v-icon size="32" color="grey-lighten-1" class="mb-2">mdi-book-off</v-icon>
                          <p class="text-caption text-grey">No books</p>
                        </div>
                      </v-card>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Manage Students Tab -->
        <div v-if="activeTab === 'students'">
          <!-- Page Header -->
          <v-row class="mb-4">
            <v-col>
              <v-card class="pa-4" elevation="2">
                <h2 class="text-h4 font-weight-bold text-primary mb-2">
                  <v-icon left color="primary">mdi-account-school</v-icon>
                  Student Management
                </h2>
                <p class="text-body-1 text-grey-darken-1 mb-0">
                  Add students and manage their profiles
                </p>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="5">
              <v-card elevation="3" class="pa-4">
                <v-card-title class="text-h6 font-weight-bold text-primary pa-0 mb-4">
                  <v-icon left color="primary">mdi-account-plus</v-icon>
                  Add Student
                </v-card-title>
                <v-form v-model="studentFormValid">
                  <v-text-field
                    label="LRN"
                    v-model="newStudent.lrn"
                    @input="sanitizeLrn"
                    :rules="[lrnFourDigits]"
                    variant="outlined"
                    density="comfortable"
                    prepend-icon="mdi-card-account-details"
                    maxlength="4"
                    counter="4"
                    required
                  />
                  <v-text-field
                    label="Name"
                    v-model="newStudent.name"
                    :rules="[nameRequired]"
                    variant="outlined"
                    density="comfortable"
                    prepend-icon="mdi-account"
                    required
                  />
                  <v-text-field
                    label="Year Level"
                    v-model="newStudent.year_level"
                    :rules="[yearLevelRequired]"
                    variant="outlined"
                    density="comfortable"
                    prepend-icon="mdi-school"
                    required
                  />
                  <v-text-field
                    label="Section"
                    v-model="newStudent.section"
                    :rules="[sectionRequired]"
                    variant="outlined"
                    density="comfortable"
                    prepend-icon="mdi-view-grid-outline"
                    required
                  />
                  <div class="d-flex justify-end mt-2">
                    <v-btn color="primary" :disabled="!studentFormValid || loading" :loading="loading" @click="addStudent" variant="elevated">
                      Save Student
                    </v-btn>
                  </div>
                </v-form>
              </v-card>
            </v-col>
            <v-col cols="12" md="7">
              <v-card elevation="3">
                <v-card-title class="text-h6 font-weight-bold text-primary pa-6 pb-2">
                  <v-icon left color="primary">mdi-account-multiple</v-icon>
                  Students
                </v-card-title>
                <v-card-text class="pa-0">
                  <div class="px-6 pb-4">
                    <v-text-field
                      v-model="studentSearch"
                      variant="outlined"
                      density="comfortable"
                      prepend-inner-icon="mdi-magnify"
                      label="Search by LRN, Name, Year Level, or Section"
                      hide-details
                    />
                  </div>
                  <v-table v-if="filteredStudents.length > 0">
                    <thead>
                      <tr>
                        <th class="text-left">LRN</th>
                        <th class="text-left">Name</th>
                        <th class="text-left">Year Level</th>
                        <th class="text-left">Section</th>
                        <th class="text-left" style="width: 140px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="s in filteredStudents" :key="s.id">
                        <td>{{ s.lrn }}</td>
                        <td>{{ s.name }}</td>
                        <td>{{ s.year_level }}</td>
                        <td>{{ s.section }}</td>
                        <td>
                          <v-btn 
                            color="primary" 
                            size="small" 
                            block
                            :loading="loading" 
                            @click="openActionDrawer(s)" 
                            variant="elevated"
                          >
                            <v-icon left size="16">mdi-menu</v-icon>
                            Actions
                          </v-btn>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="pa-8 text-center">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-account-off</v-icon>
                    <p class="text-h6 text-grey-darken-1">No matching students</p>
                    <p class="text-body-2 text-grey">Adjust your search or add students</p>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Admin Management Tab (Super Admin Only) -->
        <div v-if="activeTab === 'admins' && isSuperAdmin">
          <!-- Page Header -->
          <v-row class="mb-4">
            <v-col>
              <v-card class="pa-4" elevation="2">
                <h2 class="text-h4 font-weight-bold text-primary mb-2">
                  <v-icon left color="primary">mdi-shield-account</v-icon>
                  Admin Management
                </h2>
                <p class="text-body-1 text-grey-darken-1 mb-0">
                  View and manage administrator accounts
                </p>
              </v-card>
            </v-col>
          </v-row>

          <!-- Success/Error Messages -->
          <v-row v-if="adminMessage.text" class="mb-4">
            <v-col>
              <v-alert 
                :type="adminMessage.type" 
                variant="tonal" 
                closable 
                @click:close="adminMessage = { type: '', text: '' }"
              >
                {{ adminMessage.text }}
              </v-alert>
            </v-col>
          </v-row>

          <!-- Admin List -->
          <v-row>
            <v-col>
              <v-card elevation="3">
                <v-card-title class="text-h6 font-weight-bold text-primary pa-6 pb-2">
                  <v-icon left color="primary">mdi-account-multiple</v-icon>
                  Admin Accounts
                  <v-btn 
                    icon 
                    variant="text" 
                    size="small" 
                    class="ml-2" 
                    @click="loadAdmins"
                    :loading="adminLoading"
                  >
                    <v-icon>mdi-refresh</v-icon>
                  </v-btn>
                </v-card-title>
                <v-card-text class="pa-0">
                  <div v-if="adminLoading" class="pa-8 text-center">
                    <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
                    <p class="mt-4 text-h6 text-grey-darken-1">Loading admins...</p>
                  </div>
                  <v-table v-else-if="admins.length > 0">
                    <thead>
                      <tr>
                        <th class="text-left">Email</th>
                        <th class="text-left">Role</th>
                        <th class="text-left">Created</th>
                        <th class="text-left">Last Sign In</th>
                        <th class="text-left" style="width: 280px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="admin in admins" :key="admin.id">
                        <td>
                          {{ admin.email }}
                          <v-chip v-if="admin.id === currentUserId" size="x-small" color="info" class="ml-2">You</v-chip>
                        </td>
                        <td>
                          <v-chip 
                            :color="admin.role === 'super_admin' ? 'purple' : 'blue'" 
                            size="small"
                            variant="elevated"
                          >
                            <v-icon left size="14">{{ admin.role === 'super_admin' ? 'mdi-shield-crown' : 'mdi-shield-account' }}</v-icon>
                            {{ admin.role === 'super_admin' ? 'Super Admin' : 'Admin' }}
                          </v-chip>
                        </td>
                        <td>{{ admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—' }}</td>
                        <td>{{ admin.last_sign_in_at ? new Date(admin.last_sign_in_at).toLocaleString() : 'Never' }}</td>
                        <td>
                          <v-btn 
                            color="primary" 
                            size="small" 
                            class="mr-1"
                            @click="openEditAdmin(admin)"
                            variant="elevated"
                          >
                            <v-icon size="16">mdi-pencil</v-icon>
                          </v-btn>
                          <v-btn 
                            color="warning" 
                            size="small" 
                            class="mr-1"
                            @click="confirmResetPassword(admin)"
                            variant="elevated"
                          >
                            <v-icon size="16">mdi-lock-reset</v-icon>
                          </v-btn>
                          <v-btn 
                            color="error" 
                            size="small"
                            :disabled="admin.id === currentUserId"
                            @click="confirmDeleteAdmin(admin)"
                            variant="elevated"
                          >
                            <v-icon size="16">mdi-delete</v-icon>
                          </v-btn>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="pa-8 text-center">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-account-off</v-icon>
                    <p class="text-h6 text-grey-darken-1">No admin accounts found</p>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Edit Admin Dialog -->
          <v-dialog v-model="editAdminDialog" max-width="500">
            <v-card>
              <v-card-title class="text-h6 font-weight-bold">Edit Admin Account</v-card-title>
              <v-card-text>
                <v-text-field
                  label="Email"
                  v-model="editAdminForm.email"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-email"
                />
                <v-select
                  label="Role"
                  v-model="editAdminForm.role"
                  :items="[
                    { title: 'Admin', value: 'admin' },
                    { title: 'Super Admin', value: 'super_admin' }
                  ]"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-shield-account"
                />
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="editAdminDialog = false">Cancel</v-btn>
                <v-btn color="primary" :loading="adminLoading" @click="saveAdminChanges" variant="elevated">
                  Save Changes
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <!-- Delete Admin Dialog -->
          <v-dialog v-model="deleteAdminDialog" max-width="500">
            <v-card>
              <v-card-title class="text-h6 font-weight-bold text-error">
                <v-icon color="error" class="mr-2">mdi-alert</v-icon>
                Delete Admin Account
              </v-card-title>
              <v-card-text>
                Are you sure you want to delete the admin account
                <strong v-if="adminToDelete">"{{ adminToDelete.email }}"</strong>?
                <br><br>
                <strong class="text-error">This action cannot be undone.</strong>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="deleteAdminDialog = false; adminToDelete = null">Cancel</v-btn>
                <v-btn color="error" :loading="adminLoading" @click="deleteAdmin" variant="elevated">
                  Delete Account
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <!-- Reset Password Dialog -->
          <v-dialog v-model="resetPasswordDialog" max-width="500">
            <v-card>
              <v-card-title class="text-h6 font-weight-bold">
                <v-icon color="warning" class="mr-2">mdi-lock-reset</v-icon>
                Reset Password
              </v-card-title>
              <v-card-text>
                Send a password reset email to
                <strong v-if="adminToResetPassword">"{{ adminToResetPassword.email }}"</strong>?
                <br><br>
                The admin will receive an email with instructions to reset their password.
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="resetPasswordDialog = false; adminToResetPassword = null">Cancel</v-btn>
                <v-btn color="warning" :loading="adminLoading" @click="sendPasswordReset" variant="elevated">
                  Send Reset Email
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
/* Professional Green, Blue & White Color Scheme */
.admin-main-bg {
  background: linear-gradient(135deg, #f8fbff 0%, #f0f7f4 50%, #f5f9fc 100%) !important;
  min-height: 100vh;
}

.admin-header {
  background: linear-gradient(135deg, #1565C0 0%, #0D47A1 50%, #1B5E20 100%) !important;
}

/* Metric Cards with Clean Colors */
.metric-card-blue {
  background: linear-gradient(145deg, #ffffff 0%, #E3F2FD 100%) !important;
  border-left: 4px solid #1565C0 !important;
}

.metric-card-green {
  background: linear-gradient(145deg, #ffffff 0%, #E8F5E9 100%) !important;
  border-left: 4px solid #2E7D32 !important;
}

.metric-card-teal {
  background: linear-gradient(145deg, #ffffff 0%, #E0F2F1 100%) !important;
  border-left: 4px solid #00796B !important;
}

.metric-value-blue {
  color: #1565C0 !important;
}

.metric-value-green {
  color: #2E7D32 !important;
}

.metric-value-teal {
  color: #00796B !important;
}

.recent-activity-card .text-green, .recent-activity-card .text-red {
  font-size: 1.0625rem; /* ~17px */
}
.recent-activity-card .pa-4, .recent-activity-card .pa-6 {
  font-size: 1rem; /* ~16px body text */
}

.visit-history-card .text-subtitle-1 {
  font-size: 1.05rem;
}
.visit-history-card table, .visit-history-card th, .visit-history-card td {
  font-size: 0.98rem; /* bump table text slightly */
}

.v-tabs .v-tab {
  text-transform: none;
  font-weight: 500;
  min-width: 160px;
}

.v-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  background: #ffffff;
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(21, 101, 192, 0.12) !important;
}

.v-btn {
  text-transform: none;
  font-weight: 500;
  border-radius: 8px;
}

.v-list-item {
  transition: all 0.2s ease;
}

.v-list-item:hover {
  background-color: rgba(21, 101, 192, 0.06) !important;
}

.metric-card {
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(21, 101, 192, 0.15) !important;
}

.book-card {
  transition: all 0.2s ease;
}

.book-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(46, 125, 50, 0.12) !important;
}

.shelf-card {
  min-height: 200px;
  transition: all 0.3s ease;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%) !important;
  border-top: 3px solid #1565C0 !important;
}

.shelf-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(21, 101, 192, 0.12) !important;
}

/* Custom scrollbar with blue-green theme */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f0f7f4;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #1565C0 0%, #2E7D32 100%);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #0D47A1 0%, #1B5E20 100%);
}

/* Animation for loading states */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.loading-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

/* Table header styling */
.v-table thead th {
  background: linear-gradient(135deg, #E3F2FD 0%, #E8F5E9 100%) !important;
  color: #1565C0 !important;
  font-weight: 600 !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .v-app-bar .v-tabs {
    display: none;
  }
  
  .metric-card {
    margin-bottom: 16px;
  }
  
  .shelf-card {
    margin-bottom: 16px;
  }
}
</style>
