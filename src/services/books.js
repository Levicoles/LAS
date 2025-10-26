import supabase from './supabaseClient'

export async function fetchBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('shelf', { ascending: true })
    .order('title', { ascending: true })
  if (error) throw error
  return data || []
}

export async function uploadBookPhoto(file, bookId) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${bookId}_${Date.now()}.${fileExt}`
  const filePath = `book-photos/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('book-photos')
    .upload(filePath, file, { cacheControl: '3600' })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('book-photos')
    .getPublicUrl(filePath)

  return data.publicUrl
}

export async function deleteBookPhoto(photoUrl) {
  if (!photoUrl) return
  try {
    // Extract file path from URL
    const urlParts = photoUrl.split('/')
    const fileName = urlParts[urlParts.length - 1]
    const filePath = `book-photos/${fileName}`
    
    const { error } = await supabase.storage
      .from('book-photos')
      .remove([filePath])
    
    if (error) console.error('Error deleting photo:', error)
  } catch (err) {
    console.error('Error deleting photo:', err)
  }
}

export async function createBook(book) {
  const payload = {
    title: String(book.title || '').trim(),
    author: String(book.author || '').trim(),
    shelf: Number(book.shelf) || 1,
    available: Boolean(book.available),
    photo_url: book.photo_url || null,
    description: book.description || null,
  }
  const { data, error } = await supabase
    .from('books')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteBookById(id) {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateBookPhoto(id, photoUrl) {
  const { data, error } = await supabase
    .from('books')
    .update({ photo_url: photoUrl })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function toggleAvailability(id) {
  // Fetch current value to toggle atomically
  const { data: book, error: fetchErr } = await supabase
    .from('books')
    .select('available')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { data, error } = await supabase
    .from('books')
    .update({ available: !book.available })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function searchBooks(query) {
  const q = String(query || '').trim()
  if (!q) return fetchBooks()
  // If query is a positive integer, search by exact shelf number
  if (/^\d+$/.test(q)) {
    const shelfNum = Number(q)
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('shelf', shelfNum)
      .order('title', { ascending: true })
    if (error) throw error
    return data || []
  }

  // Otherwise search by title/author substrings
  const ilike = `%${q}%`
  const or = `title.ilike.${ilike},author.ilike.${ilike}`
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .or(or)
    .order('shelf', { ascending: true })
    .order('title', { ascending: true })
  if (error) throw error
  return data || []
}


