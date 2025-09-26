<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchBooks, createBook, deleteBookById, toggleAvailability } from '@/services/books'
import { fetchStudents, createStudent, deleteStudentById } from '@/services/students'
import { fetchRecentActivity, fetchReportsSummary, formatDuration } from '@/services/attendance'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const router = useRouter()

// Active tab state
const activeTab = ref('reports')

// Library Reports Data - populated from Supabase
const totalVisits = ref(0)
const activeUsers = ref(0)
const avgStayTime = ref('0m 00s')
const recentActivity = ref([])

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
})

// Delete Book dialog state
const deleteDialog = ref(false)
const bookPendingDelete = ref(null)

// Simple validation rules
const required = v => (!!v && String(v).trim().length > 0) || 'Required'
const positiveInt = v => (Number.isInteger(Number(v)) && Number(v) > 0) || 'Must be a positive number'

// Students state
const students = ref([])
const studentFormValid = ref(false)
const newStudent = ref({
  lrn: '',
  name: '',
  year_level: '',
  section: '',
})

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

const requestDeleteStudent = (student) => {
  studentPendingDelete.value = student
  studentDeleteDialog.value = true
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

    const created = await createBook({
      title: newBook.value.title.trim(),
      author: newBook.value.author.trim(),
      shelf: shelfNumber,
      available: !!newBook.value.available,
    })
    books.value.push(created)

    // Update counters
    totalBooks.value = books.value.length
    availableBooks.value = books.value.filter(b => b.available).length
    if (shelfNumber > totalShelves.value) {
      totalShelves.value = shelfNumber
    }

    // Reset form and close dialog
    newBook.value = { title: '', author: '', shelf: 1, available: true }
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
    const activityRows = (recentActivity.value || []).map(a => [
      a.user || '',
      a.action || '',
      a.time || '',
      a.duration || '',
    ])
    const nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 24 : metricsY + 80
    doc.setFont('helvetica', 'bold')
    doc.text('Recent Activity (today)', marginX, nextY)
    doc.setFont('helvetica', 'normal')
    autoTable(doc, {
      startY: nextY + 8,
      head: [['User', 'Action', 'Time', 'Duration']],
      body: activityRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243] },
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
      ['User', 'Action', 'Time', 'Duration'],
      ...(recentActivity.value || []).map(a => [a.user || '', a.action || '', a.time || '', a.duration || '']),
    ]
    const wsActivity = XLSX.utils.aoa_to_sheet(activityData)
    XLSX.utils.book_append_sheet(wb, wsActivity, 'Recent Activity')

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
      duration: a.duration ? formatDuration(Math.floor((new Date(a.duration).getTime()) / 1000)) : null,
    }))
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

// Load data when component mounts
onMounted(() => {
  loadLibraryData()
  loadBooksData()
  loadStudentsData()
})
</script>

<template>
  <v-app>
    <!-- Header -->
    <v-app-bar color="primary" dark height="80" elevation="4">
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
              </v-list>
            </v-menu>
            <h1 class="text-h5 font-weight-bold d-inline">Library Admin Dashboard</h1>
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
    <v-main class="bg-grey-lighten-4">
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
              <v-card class="pa-4 text-center metric-card" elevation="3" color="blue-lighten-5">
                <v-icon size="36" color="blue" class="mb-2">mdi-account-group</v-icon>
                <div class="text-h3 font-weight-bold text-blue mb-1">{{ totalVisits }}</div>
                <div class="text-subtitle-2 text-grey-darken-1">Total Visits</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">All time visits</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card" elevation="3" color="green-lighten-5">
                <v-icon size="36" color="green" class="mb-2">mdi-account-check</v-icon>
                <div class="text-h3 font-weight-bold text-green mb-1">{{ activeUsers }}</div>
                <div class="text-subtitle-2 text-grey-darken-1">Active Users</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Currently in library</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card" elevation="3" color="orange-lighten-5">
                <v-icon size="36" color="orange" class="mb-2">mdi-clock-outline</v-icon>
                <div class="text-h3 font-weight-bold text-orange mb-1">{{ avgStayTime }}</div>
                <div class="text-subtitle-2 text-grey-darken-1">Avg Stay Time</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Average duration</div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Recent Activity -->
          <v-row>
            <v-col>
              <v-card elevation="3">
                <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-2">
                  <v-icon left color="primary">mdi-history</v-icon>
                  Recent Activity
                </v-card-title>
                <v-card-text class="pa-0">
                  <v-list v-if="!loading && recentActivity.length > 0" class="pa-0">
                    <v-list-item 
                      v-for="(activity, index) in recentActivity" 
                      :key="index"
                      class="px-6 py-3"
                      :class="{ 'bg-grey-lighten-5': index % 2 === 0 }"
                    >
                      <template v-slot:prepend>
                        <v-avatar 
                          :color="activity.type === 'in' ? 'green' : 'red'" 
                          size="40"
                          class="mr-4"
                        >
                          <v-icon color="white">
                            {{ activity.type === 'in' ? 'mdi-login' : 'mdi-logout' }}
                          </v-icon>
                        </v-avatar>
                      </template>
                      <v-list-item-title class="text-h6">
                        <span :class="activity.type === 'in' ? 'text-green' : 'text-red'">
                          {{ activity.user }}
                        </span>
                        <span class="text-grey-darken-1 ml-2">
                          {{ activity.action }} at {{ activity.time }}
                          <span v-if="activity.duration" class="text-caption">
                            (Duration: {{ activity.duration }})
                          </span>
                        </span>
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                  <div v-else-if="loading" class="pa-8 text-center">
                    <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
                    <p class="mt-4 text-h6 text-grey-darken-1">Loading recent activity...</p>
                  </div>
                  <div v-else class="pa-8 text-center">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-inbox-outline</v-icon>
                    <p class="text-h6 text-grey-darken-1">No recent activity found</p>
                    <p class="text-body-2 text-grey">Activity will appear here once users start using the library</p>
                  </div>
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
              <v-card class="pa-4 text-center metric-card" elevation="3" color="blue-lighten-5">
                <v-icon size="36" color="blue" class="mb-2">mdi-book-multiple</v-icon>
                <div class="text-h3 font-weight-bold text-blue mb-1">{{ totalBooks }}</div>
                <div class="text-subtitle-2 text-grey-darken-1">Total Books</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">In collection</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card" elevation="3" color="green-lighten-5">
                <v-icon size="36" color="green" class="mb-2">mdi-check-circle</v-icon>
                <div class="text-h3 font-weight-bold text-green mb-1">{{ availableBooks }}</div>
                <div class="text-subtitle-2 text-grey-darken-1">Available</div>
                <v-divider class="my-2"></v-divider>
                <div class="text-caption text-grey-darken-1">Ready to borrow</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="pa-4 text-center metric-card" elevation="3" color="orange-lighten-5">
                <v-icon size="36" color="orange" class="mb-2">mdi-bookshelf</v-icon>
                <div class="text-h3 font-weight-bold text-orange mb-1">{{ totalShelves }}</div>
                <div class="text-subtitle-2 text-grey-darken-1">Shelves</div>
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
                  <v-table v-if="students.length > 0">
                    <thead>
                      <tr>
                        <th class="text-left">LRN</th>
                        <th class="text-left">Name</th>
                        <th class="text-left">Year Level</th>
                        <th class="text-left">Section</th>
                        <th class="text-left" style="width: 120px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="s in students" :key="s.id">
                        <td>{{ s.lrn }}</td>
                        <td>{{ s.name }}</td>
                        <td>{{ s.year_level }}</td>
                        <td>{{ s.section }}</td>
                        <td>
                          <v-btn color="error" size="small" :loading="loading" @click="requestDeleteStudent(s)" variant="elevated">
                            <v-icon left size="16">mdi-delete</v-icon>
                            Delete
                          </v-btn>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="pa-8 text-center">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-account-off</v-icon>
                    <p class="text-h6 text-grey-darken-1">No students added</p>
                    <p class="text-body-2 text-grey">Use the form to add students</p>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.v-tabs .v-tab {
  text-transform: none;
  font-weight: 500;
  min-width: 160px;
}

.v-card {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
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
  background-color: rgba(0,0,0,0.04) !important;
}

.metric-card {
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(0,0,0,0.15) !important;
}

.book-card {
  transition: all 0.2s ease;
}

.book-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.1) !important;
}

.shelf-card {
  min-height: 200px;
  transition: all 0.3s ease;
}

.shelf-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.1) !important;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
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
