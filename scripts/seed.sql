-- Demo seed for Karm Baba Mart local preview
BEGIN;

TRUNCATE reviews, rfq, products, suppliers, categories, users RESTART IDENTITY CASCADE;

INSERT INTO categories (name, slug, icon, description, product_count) VALUES
  ('Electronics', 'electronics', 'Cpu', 'Electronic components and devices', 0),
  ('Textiles', 'textiles', 'Shirt', 'Fabrics, garments and apparel', 0),
  ('Agriculture', 'agriculture', 'Leaf', 'Farm produce and agri inputs', 0),
  ('Machinery', 'machinery', 'Wrench', 'Industrial and CNC machinery', 0),
  ('Electrical', 'electrical', 'Zap', 'Lighting and electrical goods', 0),
  ('Home & Living', 'home-living', 'Home', 'Home furnishings and decor', 0),
  ('Automotive', 'automotive', 'Car', 'Auto parts and accessories', 0),
  ('Healthcare', 'healthcare', 'Activity', 'Medical supplies and PPE', 0);

INSERT INTO suppliers (
  company_name, description, location, country, verified,
  years_in_business, employee_count, main_products, certifications,
  rating, review_count, product_count, response_rate, response_time
) VALUES
  (
    'Gujarat Textile Mills',
    'Leading cotton and fabric manufacturer supplying bulk orders across India.',
    'Surat, Gujarat', 'India', true, 18, '201-500',
    ARRAY['Cotton Fabric','Polyester','Yarn'], ARRAY['ISO 9001','GOTS'],
    4.70, 128, 0, 96.00, '< 2h'
  ),
  (
    'BrightLite Electronics',
    'OEM LED lighting and electronic components manufacturer.',
    'Noida, Uttar Pradesh', 'India', true, 12, '51-200',
    ARRAY['LED Bulbs','Drivers','PCBs'], ARRAY['BIS','CE','RoHS'],
    4.60, 89, 0, 94.00, '< 4h'
  ),
  (
    'Punjab Agro Exports',
    'Premium basmati rice and agri commodity wholesaler.',
    'Amritsar, Punjab', 'India', true, 25, '101-250',
    ARRAY['Basmati Rice','Wheat','Pulses'], ARRAY['FSSAI','APEDA'],
    4.80, 210, 0, 98.00, '< 1h'
  ),
  (
    'Precision CNC Works',
    'Industrial CNC machines and spare parts for manufacturing units.',
    'Pune, Maharashtra', 'India', true, 15, '51-200',
    ARRAY['CNC Machines','Lathes','Tools'], ARRAY['ISO 9001','CE'],
    4.50, 64, 0, 91.00, '< 6h'
  ),
  (
    'MediSafe Supplies',
    'Medical gloves, PPE and hospital consumables at wholesale rates.',
    'Ahmedabad, Gujarat', 'India', true, 9, '51-200',
    ARRAY['Surgical Gloves','Masks','PPE Kits'], ARRAY['ISO 13485','CDSCO'],
    4.65, 142, 0, 97.00, '< 3h'
  );

INSERT INTO products (
  name, description, supplier_id, category_id,
  min_price, max_price, unit, min_order, image_url, images,
  in_stock, featured, rating, review_count, tags
) VALUES
  (
    'Premium Cotton Fabric Roll',
    '100% cotton fabric suitable for garments and home textiles.',
    1, 2, 180.00, 320.00, 'meter', 500,
    'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&q=80'],
    true, true, 4.70, 12, ARRAY['cotton','fabric','wholesale']
  ),
  (
    '9W LED Bulb Pack (50 pcs)',
    'Energy-efficient LED bulbs with warm white output.',
    2, 5, 45.00, 65.00, 'piece', 100,
    'https://images.unsplash.com/photo-1565814329452-7811bc438dfb?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1565814329452-7811bc438dfb?w=600&q=80'],
    true, true, 4.50, 18, ARRAY['led','lighting']
  ),
  (
    '1121 Basmati Rice',
    'Long-grain aged basmati rice for wholesale buyers.',
    3, 3, 85.00, 120.00, 'kg', 1000,
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80'],
    true, true, 4.90, 45, ARRAY['rice','basmati']
  ),
  (
    '3-Axis CNC Milling Machine',
    'Industrial CNC mill for precision metal fabrication.',
    4, 4, 450000.00, 780000.00, 'unit', 1,
    'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=600&q=80'],
    true, true, 4.60, 9, ARRAY['cnc','machine']
  ),
  (
    'Nitrile Surgical Gloves (Box of 100)',
    'Powder-free nitrile examination gloves.',
    5, 8, 220.00, 310.00, 'box', 50,
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80'],
    true, true, 4.80, 33, ARRAY['gloves','ppe']
  ),
  (
    'Polyester Blend Shirting Fabric',
    'Durable poly-cotton blend for commercial garment units.',
    1, 2, 95.00, 160.00, 'meter', 300,
    'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=600&q=80'],
    true, true, 4.40, 21, ARRAY['polyester','shirting']
  ),
  (
    'SMD LED Driver 12V',
    'Constant-voltage LED driver for commercial fixtures.',
    2, 1, 120.00, 210.00, 'piece', 200,
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80'],
    true, false, 4.30, 14, ARRAY['driver','smd']
  ),
  (
    'Disposable Face Masks (50 pcs)',
    '3-ply disposable masks for clinics and factories.',
    5, 8, 60.00, 95.00, 'pack', 100,
    'https://images.unsplash.com/photo-1584634731339-252c581abfc3?w=600&q=80',
    ARRAY['https://images.unsplash.com/photo-1584634731339-252c581abfc3?w=600&q=80'],
    true, false, 4.55, 27, ARRAY['mask','ppe']
  );

UPDATE categories c
SET product_count = (
  SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id
);

UPDATE suppliers s
SET product_count = (
  SELECT COUNT(*)::int FROM products p WHERE p.supplier_id = s.id
);

INSERT INTO users (name, email, password, role, company, supplier_id) VALUES
  ('Demo Buyer', 'buyer@demo.com', 'demo123', 'buyer', 'Acme Traders', NULL),
  ('Demo Seller', 'seller@demo.com', 'demo123', 'seller', 'Gujarat Textile Mills', '1'),
  ('Admin User', 'admin@karmbaba.com', 'admin123', 'admin', 'Karm Baba', NULL);

INSERT INTO reviews (supplier_id, product_id, reviewer_id, reviewer_name, rating, comment) VALUES
  (1, 1, 1, 'Demo Buyer', 5, 'Excellent fabric quality and on-time delivery.'),
  (2, 2, 1, 'Demo Buyer', 4, 'Good LEDs for the price. Will reorder.'),
  (3, 3, 1, 'Demo Buyer', 5, 'Premium basmati — customers loved it.');

COMMIT;
