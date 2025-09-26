import supabase from './supabaseClient'

export async function fetchRecentActivity(limit = 20, fromDate) {
  // Default to today's midnight in the project timezone (UTC by default)
  const from = fromDate instanceof Date ? fromDate : new Date()
  from.setHours(0, 0, 0, 0)
  const fromIso = from.toISOString()

  const { data, error } = await supabase
    .from('attendance_view')
    .select('*')
    .gte('time', fromIso)
    .order('time', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchReportsSummary() {
  // totalVisits: count of attendance rows
  const { data: visitsAgg, error: visitsErr, count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
  if (visitsErr) throw visitsErr

  // activeUsers: rows with check_in not null and check_out null
  const { data: activeRows, error: activeErr } = await supabase
    .from('attendance')
    .select('id')
    .is('check_out', null)
  if (activeErr) throw activeErr

  // avgStayTime: compute in DB via view or client-side as fallback
  const { data: durations, error: durErr } = await supabase
    .rpc('attendance_avg_stay_seconds')
  if (durErr && durErr.code !== '42883') {
    // function missing or other error; swallow only function-missing
    throw durErr
  }
  const avgSeconds = Array.isArray(durations) && durations.length > 0 && durations[0]?.avg_seconds
    ? Number(durations[0].avg_seconds)
    : 0

  return {
    totalVisits: typeof count === 'number' ? count : (visitsAgg?.length || 0),
    activeUsers: activeRows?.length || 0,
    avgStaySeconds: avgSeconds,
  }
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${String(sec).padStart(2, '0')}s`
}

export async function checkInByStudentId(studentId) {
  const { data, error } = await supabase
    .from('attendance')
    .insert({ student_id: studentId, check_in: new Date().toISOString(), check_out: null })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function checkOutLatestByStudentId(studentId) {
  // Get latest open attendance row for student
  const { data: openRows, error: fetchErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId)
    .is('check_out', null)
    .order('check_in', { ascending: false })
    .limit(1)
  if (fetchErr) throw fetchErr
  const open = Array.isArray(openRows) && openRows[0]
  if (!open) return null

  const { data, error } = await supabase
    .from('attendance')
    .update({ check_out: new Date().toISOString() })
    .eq('id', open.id)
    .select('*')
    .single()
  if (error) throw error
  return data
}


