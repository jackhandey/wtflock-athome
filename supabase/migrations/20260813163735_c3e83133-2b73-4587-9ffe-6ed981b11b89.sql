CREATE POLICY "snapshots_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "snapshots_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "snapshots_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);