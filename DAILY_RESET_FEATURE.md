# Daily Reset Feature - Attendance Metrics

## Overview

Implemented daily reset functionality for Total Visits and Average Stay Time metrics. These metrics now automatically reset to show only today's data, displaying statistics for the current day only.

## Features Added

### 1. Daily Reset Logic
- **Total Visits**: Counts only check-ins that occurred today
- **Average Stay Time**: Calculates average only from today's completed visits (checked in and checked out today)
- **Automatic Reset**: Metrics automatically reset at midnight and show fresh data for each new day

### 2. Time-Based Filtering
- All queries now filter by today's date range (00:00:00 to 23:59:59)
- Uses server timezone to determine "today"
- Metrics update automatically as the day progresses

### 3. Active Users
- Still shows currently active users (those checked in but not checked out)
- This count persists across days if students haven't checked out

## Technical Implementation

### Files Modified

1. **src/services/attendance.js**
   - Updated `fetchReportsSummary()` function
   - Added date filtering to all queries
   - Changed from all-time statistics to daily statistics

### Key Changes

#### Total Visits
```javascript
// Only counts attendance records from today
.gte('check_in', todayStart)
.lt('check_in', tomorrowStart)
```

#### Average Stay Time
```javascript
// Only calculates average from today's completed visits
const todayAttendance = // Get today's attendance with check_out
const durations = todayAttendance.map(/* calculate durations */)
avgSeconds = durations.reduce((sum, d) => sum + d, 0) / durations.length
```

#### Active Users
- Counts users checked in today who haven't checked out yet
- Shows real-time active library users

## How It Works

### Daily Reset Cycle

1. **Start of Day (00:00:00)**
   - All metrics reset to 0
   - New check-ins start counting toward the day's total

2. **During the Day**
   - Metrics accumulate throughout the day
   - Total Visits increases with each check-in
   - Average Stay Time updates as students check out

3. **End of Day (23:59:59)**
   - Final statistics for the day are displayed
   - At midnight, metrics reset for the new day

### Example Timeline

```
Day 1:
- 08:00 AM: Student A checks in → Total Visits: 1
- 09:00 AM: Student B checks in → Total Visits: 2
- 10:00 AM: Student A checks out → Avg Stay: 2h
- 11:00 AM: Student C checks in → Total Visits: 3
- 12:00 PM: Student B checks out → Avg Stay: 2h 30m

Day 2 (Midnight Reset):
- 00:00 AM: Metrics reset → Total Visits: 0, Avg Stay: 0m
- 08:00 AM: New student checks in → Total Visits: 1
```

## Benefits

1. **Fresh Start Daily**: Easy to track daily library usage patterns
2. **Real-Time Accuracy**: Metrics reflect current day's activity
3. **Simplified Analysis**: No need to filter by date manually
4. **Performance**: More efficient queries by filtering data
5. **Better Insights**: Compare usage across different days

## Dashboard Display

The metrics displayed in the admin dashboard:

- **Total Visits**: Number of check-ins today
- **Active Users**: Currently in library (checked in today, not yet checked out)
- **Avg Stay Time**: Average duration of completed visits today

## Historical Data

- All historical attendance data remains in the database
- The export feature still includes historical data
- Only the dashboard metrics filter to today's data

## Export Reports

PDF and Excel exports include:
- Today's summary in the summary sheet
- All historical data in detailed sheets
- Date range information in generated reports

## Future Enhancements

1. **Date Range Selection**: Allow admins to view statistics for specific date ranges
2. **Weekly/Monthly Views**: Toggle between daily, weekly, and monthly statistics
3. **Comparison Mode**: Compare today's stats with previous days
4. **Trend Charts**: Visualize usage patterns over time
5. **Automated Reports**: Daily email reports with statistics

## Testing

To test the daily reset:

1. Check metrics at the start of the day
2. Perform several check-ins and check-outs
3. Verify metrics increase appropriately
4. At midnight, verify metrics reset to 0
5. Confirm new day's metrics start fresh

## Notes

- The reset happens automatically based on server time
- Timezone is determined by the application's timezone settings
- Historical data in the database is not deleted
- Active users who haven't checked out may persist across day boundaries
