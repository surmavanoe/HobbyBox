GRANT SELECT ON public.media_items TO anon, authenticated;
GRANT ALL ON public.media_items TO service_role;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can browse media catalog" ON public.media_items FOR SELECT TO anon, authenticated USING (true);