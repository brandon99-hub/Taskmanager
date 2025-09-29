-- Add target column to marketing_users table
ALTER TABLE marketing_users 
ADD COLUMN target DECIMAL(12,2) DEFAULT 0;

-- Update existing users with some sample target values (you can modify these as needed)
UPDATE marketing_users 
SET target = CASE 
  WHEN role = 'admin' THEN 0
  WHEN role = 'business_development' THEN 100000000  -- 100M target for BD members
  WHEN role = 'marketer' THEN 50000000   -- 50M target for marketers
  ELSE 0
END
WHERE target IS NULL OR target = 0;
