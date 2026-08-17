-- A staff member can't be assigned two shifts on the same date. Open shifts
-- (staff_id null) and public claims-by-name (status='claimed', staff_id
-- still null) are unaffected — this only constrains rows that actually
-- assign a real staff_id, which is exactly what "double-booked" means here.
-- Matches the day-level granularity the app's own pre-existing conflict
-- hint already used (OpenShifts.jsx: "You already have a shift this day").
create unique index shifts_staff_date_unique on shifts (staff_id, date) where staff_id is not null;
