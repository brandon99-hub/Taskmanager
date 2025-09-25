-- Add must_change_password column to marketing_users table
ALTER TABLE marketing_users ADD COLUMN must_change_password BOOLEAN DEFAULT false NOT NULL;
