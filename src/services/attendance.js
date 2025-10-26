import supabase from './supabaseClient'

export async function fetchRecentActivity(limit = 20, fromDate) {
  // Build events for both check-in and check-out so login isn't lost after logout
  const from = fromDate instanceof Date ? fromDate : new Date()
  from.setHours(0, 0, 0, 0)
  const fromIso = from.toISOString()

  const { data, error } = await supabase
    .from('attendance')
    .select('id, check_in, check_out, students ( name )')
    .gte('check_in', fromIso)
  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const events = []
  for (const r of rows) {
    const userName = r?.students?.name || ''
    if (r.check_in) {
      events.push({
        id: `${r.id}-in`,
        type: 'in',
        user: userName,
        action: 'Checked in',
        time: r.check_in,
        duration: null,
      })
    }
    if (r.check_out) {
      const seconds = Math.max(0, Math.floor((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 1000))
      events.push({
        id: `${r.id}-out`,
        type: 'out',
        user: userName,
        action: 'Checked out',
        time: r.check_out,
        duration: seconds,
      })
    }
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return events.slice(0, limit)
}

export async function fetchReportsSummary() {
  // Get today's date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStart = tomorrow.toISOString()

  // totalVisits: count of attendance rows for today only
  const { data: visitsAgg, error: visitsErr, count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('check_in', todayStart)
    .lt('check_in', tomorrowStart)
  if (visitsErr) throw visitsErr

  // activeUsers: rows with check_in not null and check_out null (for today)
  const { data: activeRows, error: activeErr } = await supabase
    .from('attendance')
    .select('id')
    .gte('check_in', todayStart)
    .lt('check_in', tomorrowStart)
    .is('check_out', null)
  if (activeErr) throw activeErr

  // avgStayTime: compute average for today's completed visits only
  const { data: todayAttendance, error: todayErr } = await supabase
    .from('attendance')
    .select('check_in, check_out')
    .gte('check_in', todayStart)
    .lt('check_in', tomorrowStart)
    .not('check_out', 'is', null)
  
  let avgSeconds = 0
  if (!todayErr && Array.isArray(todayAttendance)) {
    const durations = todayAttendance
      .map(a => {
        if (a.check_in && a.check_out) {
          return Math.max(0, (new Date(a.check_out) - new Date(a.check_in)) / 1000)
        }
        return 0
      })
      .filter(d => d > 0)
    
    if (durations.length > 0) {
      avgSeconds = durations.reduce((sum, d) => sum + d, 0) / durations.length
    }
  }

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

export async function getOpenAttendanceForStudent(studentId) {
  const { data: openRows, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId)
    .is('check_out', null)
    .order('check_in', { ascending: false })
    .limit(1)
  if (error) throw error
  return Array.isArray(openRows) && openRows[0] ? openRows[0] : null
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

export async function renewSessionByStudentId(studentId) {
  // Close any open session, then create a fresh check-in
  const open = await getOpenAttendanceForStudent(studentId)
  if (open) {
    const { error: updErr } = await supabase
      .from('attendance')
      .update({ check_out: new Date().toISOString() })
      .eq('id', open.id)
    if (updErr) throw updErr
  }
  return await checkInByStudentId(studentId)
}


