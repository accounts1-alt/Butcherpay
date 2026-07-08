-- Standard payment methods described in CLAUDE.md, so a fresh environment
-- (local or newly provisioned) isn't unusable out of the box. Merchants
-- are deliberately not seeded here — add real ones via the Settings page.
insert into payment_methods (name, lifecycle_stages) values
  ('cash', array['banked']),
  ('bacs', array['banked']),
  ('card', array['taken', 'banked']),
  ('cheque', array['taken', 'posted', 'banked']),
  ('voucher', array['taken', 'posted', 'banked']);
