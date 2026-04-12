
-- Crops table
CREATE TABLE public.crops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view crops" ON public.crops FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins/operators can insert crops" ON public.crops FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role));
CREATE POLICY "Admins/operators can update crops" ON public.crops FOR UPDATE TO authenticated USING (has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role));
CREATE POLICY "Admins can delete crops" ON public.crops FOR DELETE TO authenticated USING (has_role(auth.uid(), org_id, 'admin'::app_role));

CREATE TRIGGER update_crops_updated_at BEFORE UPDATE ON public.crops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crop stages table
CREATE TABLE public.crop_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_order INT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crop_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view crop stages" ON public.crop_stages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crops c WHERE c.id = crop_stages.crop_id AND is_org_member(auth.uid(), c.org_id)));
CREATE POLICY "Admins/operators can insert crop stages" ON public.crop_stages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crops c WHERE c.id = crop_stages.crop_id AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))));
CREATE POLICY "Admins/operators can update crop stages" ON public.crop_stages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crops c WHERE c.id = crop_stages.crop_id AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))));
CREATE POLICY "Admins can delete crop stages" ON public.crop_stages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.crops c WHERE c.id = crop_stages.crop_id AND has_role(auth.uid(), c.org_id, 'admin'::app_role)));

CREATE TRIGGER update_crop_stages_updated_at BEFORE UPDATE ON public.crop_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crop stage thresholds table
CREATE TABLE public.crop_stage_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_stage_id UUID NOT NULL REFERENCES public.crop_stages(id) ON DELETE CASCADE,
  sensor_type_id UUID NOT NULL REFERENCES public.sensor_types(id) ON DELETE CASCADE,
  min_value NUMERIC,
  max_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crop_stage_id, sensor_type_id)
);

ALTER TABLE public.crop_stage_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view thresholds" ON public.crop_stage_thresholds FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crop_stages cs JOIN public.crops c ON c.id = cs.crop_id WHERE cs.id = crop_stage_thresholds.crop_stage_id AND is_org_member(auth.uid(), c.org_id)));
CREATE POLICY "Admins/operators can insert thresholds" ON public.crop_stage_thresholds FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crop_stages cs JOIN public.crops c ON c.id = cs.crop_id WHERE cs.id = crop_stage_thresholds.crop_stage_id AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))));
CREATE POLICY "Admins/operators can update thresholds" ON public.crop_stage_thresholds FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crop_stages cs JOIN public.crops c ON c.id = cs.crop_id WHERE cs.id = crop_stage_thresholds.crop_stage_id AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))));
CREATE POLICY "Admins can delete thresholds" ON public.crop_stage_thresholds FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.crop_stages cs JOIN public.crops c ON c.id = cs.crop_id WHERE cs.id = crop_stage_thresholds.crop_stage_id AND has_role(auth.uid(), c.org_id, 'admin'::app_role)));

-- Add crop and crop_stage to zones
ALTER TABLE public.zones ADD COLUMN crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL;
ALTER TABLE public.zones ADD COLUMN crop_stage_id UUID REFERENCES public.crop_stages(id) ON DELETE SET NULL;
