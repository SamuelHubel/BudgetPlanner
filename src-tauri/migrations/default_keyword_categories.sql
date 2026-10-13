INSERT INTO keyword_category_map (keyword, category_id)
SELECT rules.keyword, categories.id
FROM (
  SELECT 'mortgage' AS keyword, 'Housing' AS category_name
  UNION ALL SELECT 'rent', 'Housing'
  UNION ALL SELECT 'aldi', 'Groceries'
  UNION ALL SELECT 'albertsons', 'Groceries'
  UNION ALL SELECT 'heb', 'Groceries'
  UNION ALL SELECT 'kroger', 'Groceries'
  UNION ALL SELECT 'publix', 'Groceries'
  UNION ALL SELECT 'safeway', 'Groceries'
  UNION ALL SELECT 'trader joe', 'Groceries'
  UNION ALL SELECT 'whole foods', 'Groceries'
  UNION ALL SELECT 'adp payroll', 'Pay'
  UNION ALL SELECT 'direct deposit', 'Pay'
  UNION ALL SELECT 'payroll', 'Pay'
  UNION ALL SELECT 'chipotle', 'Dining Out'
  UNION ALL SELECT 'doordash', 'Dining Out'
  UNION ALL SELECT 'grubhub', 'Dining Out'
  UNION ALL SELECT 'mcdonald', 'Dining Out'
  UNION ALL SELECT 'panera', 'Dining Out'
  UNION ALL SELECT 'starbucks', 'Dining Out'
  UNION ALL SELECT 'taco bell', 'Dining Out'
  UNION ALL SELECT 'uber eats', 'Dining Out'
  UNION ALL SELECT 'wendy', 'Dining Out'
  UNION ALL SELECT 'chevron', 'Transportation'
  UNION ALL SELECT 'exxon', 'Transportation'
  UNION ALL SELECT 'lyft', 'Transportation'
  UNION ALL SELECT 'shell', 'Transportation'
  UNION ALL SELECT 'uber', 'Transportation'
  UNION ALL SELECT 'comcast', 'Utilities'
  UNION ALL SELECT 'con edison', 'Utilities'
  UNION ALL SELECT 'eversource', 'Utilities'
  UNION ALL SELECT 'pge', 'Utilities'
  UNION ALL SELECT 'verizon', 'Utilities'
  UNION ALL SELECT 'xfinity', 'Utilities'
  UNION ALL SELECT 'att', 'Utilities'
  UNION ALL SELECT 'cvs pharmacy', 'Healthcare'
  UNION ALL SELECT 'kaiser', 'Healthcare'
  UNION ALL SELECT 'walgreens', 'Healthcare'
  UNION ALL SELECT 'amazon prime video', 'Entertainment'
  UNION ALL SELECT 'disney+', 'Entertainment'
  UNION ALL SELECT 'hulu', 'Entertainment'
  UNION ALL SELECT 'netflix', 'Entertainment'
  UNION ALL SELECT 'spotify', 'Entertainment'
  UNION ALL SELECT 'great clips', 'Personal Care'
  UNION ALL SELECT 'supercuts', 'Personal Care'
) AS rules
JOIN categories ON categories.name = rules.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM keyword_category_map existing
  WHERE existing.keyword = rules.keyword
    AND existing.category_id = categories.id
);
