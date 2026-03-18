-- =============================================
-- Migration v2: アバター・画像管理・性別対応
-- Supabaseの SQL Editor で実行してください
-- =============================================

-- 1. アバターテーブル作成
CREATE TABLE IF NOT EXISTS avatars (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  image_url text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. profiles に avatar_id カラム追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES avatars(id) ON DELETE SET NULL;

-- 3. roadmaps に background_image_url カラム追加
ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS background_image_url text;

-- 4. roadmap_days に stage_image_url カラム追加
ALTER TABLE roadmap_days ADD COLUMN IF NOT EXISTS stage_image_url text;

-- 5. avatars テーブルの RLS
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view avatars" ON avatars FOR SELECT USING (true);
CREATE POLICY "Admins can insert avatars" ON avatars FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can update avatars" ON avatars FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete avatars" ON avatars FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 6. トリガー関数更新（avatar_idをメタデータから取得）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_id)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    (new.raw_user_meta_data->>'avatar_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Supabase Storage バケットポリシー
-- ※ バケット 'avatars', 'roadmap-backgrounds', 'stage-images' は
--   Supabaseダッシュボード > Storage から手動で作成してください（Public bucket推奨）
--
-- 以下はストレージポリシーの例です:
--
-- CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Admin upload avatars" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'avatars' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
-- );
-- CREATE POLICY "Admin delete avatars" ON storage.objects FOR DELETE USING (
--   bucket_id = 'avatars' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
-- );
--
-- ※ roadmap-backgrounds, stage-images も同様のポリシーを設定してください
