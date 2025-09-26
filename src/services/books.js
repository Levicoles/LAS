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

export async function createBook(book) {
  const payload = {
    title: String(book.title || '').trim(),
    author: String(book.author || '').trim(),
    shelf: Number(book.shelf) || 1,
    available: Boolean(book.available),
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


