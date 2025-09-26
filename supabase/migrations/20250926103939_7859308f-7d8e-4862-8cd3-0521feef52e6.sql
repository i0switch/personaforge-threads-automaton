-- Step 1: Remove duplicate queue items, keeping only the most recent ones
DELETE FROM post_queue 
WHERE id NOT IN (
  SELECT DISTINCT ON (post_id, status) id 
  FROM post_queue 
  ORDER BY post_id, status, created_at DESC
);

-- Step 2: Create unique constraint to prevent future duplicates
ALTER TABLE post_queue ADD CONSTRAINT unique_post_queue_per_post 
UNIQUE (post_id, status) 
DEFERRABLE INITIALLY DEFERRED;