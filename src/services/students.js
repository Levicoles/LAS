import supabase from './supabaseClient'

export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createStudent(student) {
  const payload = {
    lrn: String(student.lrn || '').trim(),
    name: String(student.name || '').trim(),
    year_level: String(student.year_level || '').trim(),
    section: String(student.section || '').trim(),
  }
  const { data, error } = await supabase
    .from('students')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteStudentById(id) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getStudentByLrn(lrn) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('lrn', String(lrn || '').trim())
    .single()
  if (error) throw error
  return data
}

export async function updateStudentById(id, student) {
  const payload = {
    lrn: String(student.lrn || '').trim(),
    name: String(student.name || '').trim(),
    year_level: String(student.year_level || '').trim(),
    section: String(student.section || '').trim(),
  }
  const { data, error } = await supabase
    .from('students')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}


