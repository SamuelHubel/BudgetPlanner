INSERT INTO categories (name, type, color) VALUES
  ('Insurance', 'expense', '#0ea5e9'),
  ('Travel', 'expense', '#10b981'),
  ('Education', 'expense', '#6366f1'),
  ('Pets', 'expense', '#d97706'),
  ('Gifts & Donations', 'expense', '#f43f5e'),
  ('Fees & Charges', 'expense', '#78716c'),
  ('Other Income', 'income', '#84cc16');

CREATE TABLE subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  color TEXT CHECK (
    color IS NULL OR color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'
  ),
  UNIQUE (category_id, name)
);

CREATE INDEX idx_subcategories_category ON subcategories(category_id);

ALTER TABLE transactions
  ADD COLUMN subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL;
ALTER TABLE keyword_category_map
  ADD COLUMN subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_subcategory ON transactions(subcategory_id);

-- These triggers deliberately do not watch category_id. Deleting a category
-- nulls category_id before the subcategory cascade clears subcategory_id, so a
-- trigger on that column would abort the delete.
CREATE TRIGGER transactions_subcategory_parent_insert
BEFORE INSERT ON transactions
WHEN NEW.subcategory_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM subcategories
  WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'subcategory does not belong to the transaction category');
END;

CREATE TRIGGER transactions_subcategory_parent_update
BEFORE UPDATE OF subcategory_id ON transactions
WHEN NEW.subcategory_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM subcategories
  WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'subcategory does not belong to the transaction category');
END;

CREATE TRIGGER keyword_subcategory_parent_insert
BEFORE INSERT ON keyword_category_map
WHEN NEW.subcategory_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM subcategories
  WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'subcategory does not belong to the keyword category');
END;

CREATE TRIGGER keyword_subcategory_parent_update
BEFORE UPDATE OF subcategory_id ON keyword_category_map
WHEN NEW.subcategory_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM subcategories
  WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'subcategory does not belong to the keyword category');
END;

-- Subcategory names are unique across categories so CSV labels and the keyword
-- library in 0007 can refer to them by name alone.
WITH seed(category_name, name) AS (
  VALUES
    ('Housing', 'Rent'),
    ('Housing', 'Mortgage'),
    ('Housing', 'Home Maintenance'),
    ('Housing', 'HOA Dues'),
    ('Housing', 'Property Tax'),
    ('Groceries', 'Supermarkets'),
    ('Groceries', 'Warehouse Clubs'),
    ('Groceries', 'Specialty Food'),
    ('Groceries', 'Convenience Stores'),
    ('Pay', 'Paycheck'),
    ('Pay', 'Bonus'),
    ('Pay', 'Reimbursement'),
    ('Dining Out', 'Coffee'),
    ('Dining Out', 'Fast Food'),
    ('Dining Out', 'Restaurants'),
    ('Dining Out', 'Delivery'),
    ('Dining Out', 'Bars'),
    ('Transportation', 'Gas'),
    ('Transportation', 'Rideshare'),
    ('Transportation', 'Public Transit'),
    ('Transportation', 'Parking & Tolls'),
    ('Transportation', 'Car Maintenance'),
    ('Transportation', 'Car Payment'),
    ('Utilities', 'Electric & Gas'),
    ('Utilities', 'Water & Trash'),
    ('Utilities', 'Internet & Cable'),
    ('Utilities', 'Phone'),
    ('Healthcare', 'Pharmacy'),
    ('Healthcare', 'Doctor'),
    ('Healthcare', 'Dental'),
    ('Healthcare', 'Vision'),
    ('Shopping', 'Online Shopping'),
    ('Shopping', 'Department Stores'),
    ('Shopping', 'Clothing'),
    ('Shopping', 'Electronics'),
    ('Shopping', 'Home Goods'),
    ('Entertainment', 'Streaming'),
    ('Entertainment', 'Events'),
    ('Entertainment', 'Games'),
    ('Entertainment', 'Hobbies'),
    ('Personal Care', 'Hair'),
    ('Personal Care', 'Beauty'),
    ('Personal Care', 'Fitness'),
    ('Personal Care', 'Laundry'),
    ('Insurance', 'Auto Insurance'),
    ('Insurance', 'Health Insurance'),
    ('Insurance', 'Home Insurance'),
    ('Insurance', 'Life Insurance'),
    ('Travel', 'Flights'),
    ('Travel', 'Lodging'),
    ('Travel', 'Car Rental'),
    ('Education', 'Tuition'),
    ('Education', 'Student Loans'),
    ('Education', 'Books & Courses'),
    ('Pets', 'Pet Supplies'),
    ('Pets', 'Vet'),
    ('Gifts & Donations', 'Gifts'),
    ('Gifts & Donations', 'Charity'),
    ('Fees & Charges', 'Bank Fees'),
    ('Fees & Charges', 'Interest Charges'),
    ('Fees & Charges', 'Taxes'),
    ('Other Income', 'Interest Earned'),
    ('Other Income', 'Government Benefits'),
    ('Other Income', 'Refunds')
)
INSERT INTO subcategories (category_id, name)
SELECT categories.id, seed.name
FROM seed
JOIN categories ON categories.name = seed.category_name;

WITH rules(keyword, subcategory_name) AS (
  VALUES
    ('mortgage', 'Mortgage'),
    ('rent', 'Rent'),
    ('aldi', 'Supermarkets'),
    ('albertsons', 'Supermarkets'),
    ('heb', 'Supermarkets'),
    ('kroger', 'Supermarkets'),
    ('publix', 'Supermarkets'),
    ('safeway', 'Supermarkets'),
    ('trader joe', 'Supermarkets'),
    ('whole foods', 'Supermarkets'),
    ('adp payroll', 'Paycheck'),
    ('direct deposit', 'Paycheck'),
    ('payroll', 'Paycheck'),
    ('chipotle', 'Fast Food'),
    ('doordash', 'Delivery'),
    ('grubhub', 'Delivery'),
    ('mcdonald', 'Fast Food'),
    ('panera', 'Restaurants'),
    ('starbucks', 'Coffee'),
    ('taco bell', 'Fast Food'),
    ('uber eats', 'Delivery'),
    ('wendy', 'Fast Food'),
    ('chevron', 'Gas'),
    ('exxon', 'Gas'),
    ('lyft', 'Rideshare'),
    ('shell', 'Gas'),
    ('uber', 'Rideshare'),
    ('comcast', 'Internet & Cable'),
    ('con edison', 'Electric & Gas'),
    ('eversource', 'Electric & Gas'),
    ('pge', 'Electric & Gas'),
    ('verizon', 'Phone'),
    ('xfinity', 'Internet & Cable'),
    ('att', 'Phone'),
    ('cvs pharmacy', 'Pharmacy'),
    ('kaiser', 'Doctor'),
    ('walgreens', 'Pharmacy'),
    ('amazon prime video', 'Streaming'),
    ('disney+', 'Streaming'),
    ('hulu', 'Streaming'),
    ('netflix', 'Streaming'),
    ('spotify', 'Streaming'),
    ('great clips', 'Hair'),
    ('supercuts', 'Hair')
)
UPDATE keyword_category_map
SET subcategory_id = (
  SELECT subcategories.id
  FROM rules
  JOIN subcategories ON subcategories.name = rules.subcategory_name
  WHERE rules.keyword = keyword_category_map.keyword
    AND subcategories.category_id = keyword_category_map.category_id
);

INSERT INTO settings (setting_key, setting_value) VALUES
  ('import_use_subcategories', 'true'),
  ('show_subcategory_charts', 'true');
