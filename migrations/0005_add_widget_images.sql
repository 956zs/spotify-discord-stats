-- Images uploaded on the admin page (currently only the Widget Top hero image, key
-- 'hero'). Served publicly at /widget/hero so Discord can fetch them.
CREATE TABLE IF NOT EXISTS widget_images (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
