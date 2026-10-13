INSERT INTO categories (name, type, color)
SELECT 'Housing', 'expense', '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Housing');

INSERT INTO categories (name, type, color)
SELECT 'Groceries', 'expense', '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Groceries');

INSERT INTO categories (name, type, color)
SELECT 'Pay', 'income', '#14b8a6'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Pay');

INSERT INTO categories (name, type, color)
SELECT 'Dining Out', 'expense', '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Dining Out');

INSERT INTO categories (name, type, color)
SELECT 'Transportation', 'expense', '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transportation');

INSERT INTO categories (name, type, color)
SELECT 'Utilities', 'expense', '#eab308'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Utilities');

INSERT INTO categories (name, type, color)
SELECT 'Healthcare', 'expense', '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Healthcare');

INSERT INTO categories (name, type, color)
SELECT 'Shopping', 'expense', '#ec4899'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Shopping');

INSERT INTO categories (name, type, color)
SELECT 'Entertainment', 'expense', '#06b6d4'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Entertainment');

INSERT INTO categories (name, type, color)
SELECT 'Personal Care', 'expense', '#a855f7'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Personal Care');

INSERT INTO categories (name, type, color)
SELECT 'Other', 'expense', '#64748b'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Other');
