
-- Create storage bucket for zone images
INSERT INTO storage.buckets (id, name, public) VALUES ('zone-images', 'zone-images', true);

-- Storage policies
CREATE POLICY "Anyone can view zone images" ON storage.objects FOR SELECT USING (bucket_id = 'zone-images');
CREATE POLICY "Authenticated users can upload zone images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'zone-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update zone images" ON storage.objects FOR UPDATE USING (bucket_id = 'zone-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete zone images" ON storage.objects FOR DELETE USING (bucket_id = 'zone-images' AND auth.uid() IS NOT NULL);

-- Add background image column to zones
ALTER TABLE public.zones ADD COLUMN background_image_url text;
