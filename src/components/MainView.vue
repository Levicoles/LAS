<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getStudentByLrn } from '@/services/students'
import { checkInByStudentId, checkOutLatestByStudentId } from '@/services/attendance'
import { searchBooks as searchBooksApi } from '@/services/books'

const router = useRouter()

// Student PIN in/out
const pin = ref('')
const pinError = ref('')
const isSubmitting = ref(false)
const isPinValid = computed(() => /^\d{4}$/.test(pin.value))

// In/Out history (from Supabase attendance), retained locally for 24h
const history = ref([])
const HISTORY_STORAGE_KEY = 'mainview_history'

const pruneAndPersistHistory = () => {
	const now = Date.now()
	const dayAgo = now - 24 * 60 * 60 * 1000
	history.value = (history.value || []).filter(h => {
		const ts = Number(h.ts || 0)
		return ts >= dayAgo
	})
	try {
		localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.value))
	} catch (_) {}
}

const loadHistoryFromStorage = () => {
	try {
		const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
		history.value = raw ? JSON.parse(raw) : []
	} catch (_) {
		history.value = []
	}
	pruneAndPersistHistory()
}

// Books (from Supabase)
const allBooks = ref([])

const searchText = ref('')
const isSearching = ref(false)

const filteredBooks = computed(() => {
	const q = searchText.value.trim()
	if (!q) return []
	// Backend already filtered, just return
	return allBooks.value
})

// Limit display to top 3 items
const displayedBooks = computed(() => filteredBooks.value.slice(0, 3))

const validatePin = () => {
	if (!isPinValid.value) {
		pinError.value = 'Enter a valid 4-digit PIN'
		return false
	}
	pinError.value = ''
	return true
}

const submitInOut = async (action) => {
	if (!validatePin()) return
	isSubmitting.value = true
	try {
		const student = await getStudentByLrn(pin.value)
		if (!student) throw new Error('Student not found')
		if (action === 'In') {
			await checkInByStudentId(student.id)
		} else {
			await checkOutLatestByStudentId(student.id)
		}
		const ts = Date.now()
		history.value.unshift({
			id: Date.now(),
			name: student.name,
			grade: `${student.year_level} - ${student.section}`,
			action,
			time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
			ts
		})
		pruneAndPersistHistory()
		pin.value = ''
 	} finally {
 		isSubmitting.value = false
 	}
}

const searchBooks = async () => {
	isSearching.value = true
 	try {
		const q = String(searchText.value || '').trim()
		if (!q) {
			allBooks.value = []
			return
		}
		const results = await searchBooksApi(q)
		allBooks.value = Array.isArray(results) ? results : []
 	} finally {
 		isSearching.value = false
 	}
}

onMounted(async () => {
	// Do not load all books initially; wait for a search
	allBooks.value = []
	loadHistoryFromStorage()
})
</script>

<template>
	<v-app>
        <v-app-bar elevation="0" class="modern-appbar">
          <v-container class="py-4">
            <div class="d-flex align-center">
              <div class="flex-grow-1 text-center">
                <h1 class="text-h5 text-white font-weight-bold">Lumbocan National High School Library System</h1>
              </div>
              <v-btn color="white" variant="text" prepend-icon="mdi-account-circle" size="large" @click="router.push('/login')">
              </v-btn>
            </div>
          </v-container>
        </v-app-bar>

		<v-main class="modern-bg">
          <v-container class="py-10">
				<v-row>
					<!-- Left: In/Out + Search + Books -->
					<v-col cols="12" lg="8">
						<v-card elevation="6" class="pa-5 mb-6 rounded-xl">
							<div class="d-flex align-center justify-space-between mb-3">
                    <h2 class="text-h5 font-weight-bold">Student In/Out</h2>
                    <v-chip color="primary" variant="tonal">PIN only</v-chip>
							</div>
            <v-text-field
								v-model="pin"
								label="Enter your 4-digit PIN"
							variant="solo-filled"
								hide-details
								:error-messages="pinError"
								maxlength="4"
              class="mb-5"
							inputmode="numeric"
							pattern="\\d*"
							type="tel"
								prepend-inner-icon="mdi-form-textbox-password"
              density="comfortable"
							/>
            <div class="d-flex" style="gap:16px">
								<v-btn 
									class="flex-grow-1" 
									color="success" 
									rounded 
									:loading="isSubmitting" 
									:disabled="!isPinValid || isSubmitting"
									prepend-icon="mdi-login" 
                size="large"
									@click="submitInOut('In')"
								>
									In
								</v-btn>
								<v-btn 
									class="flex-grow-1" 
									color="error" 
									rounded 
									:loading="isSubmitting" 
									:disabled="!isPinValid || isSubmitting"
									prepend-icon="mdi-logout" 
                size="large"
									@click="submitInOut('Out')"
								>
									Out
								</v-btn>
							</div>
						</v-card>

						<v-card elevation="6" class="pa-5 mb-5 rounded-xl">
							<div class="d-flex align-center justify-space-between mb-3">
              <h2 class="text-h5 font-weight-bold">Search Books</h2>
              <v-chip variant="text" class="text-grey">Title, Author, Shelf</v-chip>
							</div>
							<v-row>
								<v-col cols="12" md="8">
									<v-text-field
										v-model="searchText"
										label="Search the catalogue"
										variant="solo-filled"
										prepend-inner-icon="mdi-magnify"
										hide-details
                  density="comfortable"
									/>
								</v-col>
								<v-col cols="12" md="4" class="d-flex">
                <v-btn color="amber-darken-2" class="text-black" block :loading="isSearching" prepend-icon="mdi-magnify" size="large" @click="searchBooks">Search</v-btn>
								</v-col>
							</v-row>
						</v-card>

					<div v-if="filteredBooks.length" class="scroll-section">
						<v-row>
							<v-col v-for="b in displayedBooks" :key="b.id" cols="12" sm="6" md="4">
								<v-card class="pa-4 h-100 rounded-xl book-card-elev" elevation="3">
									<div class="text-subtitle-1 font-weight-bold mb-2">{{ b.title }}</div>
									<div class="text-body-2 text-grey-darken-1 mb-3">By {{ b.author }}</div>
									<div class="mb-2">
										<v-chip color="primary" variant="tonal" prepend-icon="mdi-bookshelf">Shelf: {{ b.shelf }}</v-chip>
									</div>
									<div>
										<v-chip :color="b.available ? 'green' : 'red'" class="text-white" prepend-icon="mdi-check-circle">
											{{ b.available ? 'Available' : 'Unavailable' }}
										</v-chip>
									</div>
								</v-card>
							</v-col>
						</v-row>
					</div>
						<v-card v-else class="pa-8 rounded-xl text-center" elevation="2">
							<v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-book-search-outline</v-icon>
							<p class="text-body-1 text-grey-darken-1 mb-1">No books to display</p>
							<p class="text-caption text-grey">Use the search to find books</p>
						</v-card>
					</v-col>

					<!-- Right: In/Out History -->
					<v-col cols="12" lg="4">
					<v-card elevation="6" class="pa-5 rounded-xl">
            <h2 class="text-h5 font-weight-bold mb-4">In/Out History</h2>
						<div v-if="history.length" class="scroll-section">
							<v-list lines="two">
								<v-list-item v-for="item in history" :key="item.id" class="mb-2 rounded">
									<v-list-item-title class="font-weight-medium">
										{{ item.name }}
									</v-list-item-title>
									<v-list-item-subtitle>
										<v-chip :color="item.action === 'In' ? 'green' : 'red'" class="mr-2 text-white" :prepend-icon="item.action==='In' ? 'mdi-login' : 'mdi-logout'">{{ item.action }}</v-chip>
										<span class="text-grey-darken-1 text-body-2">{{ item.time }}</span>
									</v-list-item-subtitle>
								</v-list-item>
							</v-list>
						</div>
							<div v-else class="text-center py-10">
								<v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-history</v-icon>
								<p class="text-body-1 text-grey-darken-1 mb-1">No activity yet</p>
								<p class="text-caption text-grey">Student in/out logs will appear here</p>
							</div>
						</v-card>
					</v-col>
				</v-row>
			</v-container>
		</v-main>
	</v-app>
</template>

<style scoped>
.modern-appbar {
  background: linear-gradient(90deg, #00bcd4, #26a69a);
}
.modern-bg {
  background: radial-gradient(1200px 400px at 50% -10%, rgba(38, 166, 154, 0.15), transparent),
              radial-gradient(900px 300px at 0% 0%, rgba(0, 188, 212, 0.12), transparent),
              #f5f7fb;
}
.book-card-elev:hover {
  transform: translateY(-2px);
  transition: transform .25s ease, box-shadow .25s ease;
  box-shadow: 0 12px 28px rgba(0,0,0,.12) !important;
}

.scroll-section {
  max-height: 420px;
  overflow-y: auto;
}
</style>