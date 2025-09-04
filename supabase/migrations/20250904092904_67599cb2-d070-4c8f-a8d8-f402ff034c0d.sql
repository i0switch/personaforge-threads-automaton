-- 問題のある不正draft投稿を削除（設定がOFFなのにauto_schedule=trueの投稿）
DELETE FROM posts 
WHERE id IN (
  SELECT p.id
  FROM posts p
  LEFT JOIN auto_post_configs apc ON p.persona_id = apc.persona_id AND apc.is_active = true
  LEFT JOIN random_post_configs rpc ON p.persona_id = rpc.persona_id AND rpc.is_active = true
  WHERE p.auto_schedule = true
    AND p.status = 'draft'
    AND apc.id IS NULL  -- 自動投稿設定がない、またはOFF
    AND rpc.id IS NULL  -- ランダム投稿設定もない、またはOFF
);