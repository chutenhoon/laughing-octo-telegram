CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_categories_group_sort ON categories(group_name, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_slug ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating);
CREATE INDEX IF NOT EXISTS idx_products_sold_count ON products(sold_count);
CREATE INDEX IF NOT EXISTS idx_products_is_hot ON products(is_hot);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_owner_user_id ON shops(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shops_public ON shops(is_public);
