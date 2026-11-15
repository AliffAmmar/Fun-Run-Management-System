// Until when a buyer may edit runner names and shirt sizes after registering (CLAUDE.md §4.1):
// the event's kit preparation cutoff, or 7 days before the event when none is set.
const DEFAULT_DAYS_BEFORE = 7;

function editDeadline(event) {
  if (event.kit_cutoff_date) return new Date(event.kit_cutoff_date);
  return new Date(new Date(event.date).getTime() - DEFAULT_DAYS_BEFORE * 24 * 60 * 60 * 1000);
}

module.exports = { editDeadline, DEFAULT_DAYS_BEFORE };
