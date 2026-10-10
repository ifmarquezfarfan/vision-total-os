CREATE OR REPLACE FUNCTION private.create_complete_optical_sale(target_org uuid, target_branch uuid, target_client uuid, target_customer jsonb, target_record_prescription boolean, target_prescription jsonb, target_create_order boolean, target_order jsonb, target_lead uuid, target_payment_method text, target_paid numeric, target_discount numeric, target_responsible text, items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_customer jsonb := coalesce(target_customer, '{}'::jsonb);
  v_rx jsonb := coalesce(target_prescription, '{}'::jsonb);
  v_order jsonb := coalesce(target_order, '{}'::jsonb);
  v_client_id uuid := target_client;
  v_prescription_id uuid;
  v_sale_id uuid;
  v_order_id uuid;
  v_sale_code text;
  v_order_code text;
  v_sale_result json;
  v_full_name text;
  v_dni text;
  v_dni_digits text;
  v_phone text;
  v_phone_digits text;
  v_whatsapp text;
  v_whatsapp_digits text;
  v_email text;
  v_opt_in boolean;
  v_by_dni uuid;
  v_by_phone uuid;
  v_dni_count integer := 0;
  v_phone_count integer := 0;
  v_existing_dni text;
  v_client_status text;
  v_rx_type text;
  v_cylinder_notation text;
  v_od_axis numeric;
  v_os_axis numeric;
  v_pd numeric;
  v_od_near_axis numeric;
  v_os_near_axis numeric;
  v_order_frame_id uuid;
  v_order_lens_id uuid;
  v_product_id uuid;
  v_category text;
  v_item jsonb;
  v_treatments text;
  v_measurements jsonb;
begin
  if target_org is null or target_branch is null
    or not private.has_permission(target_org, target_branch, 'sales.create') then
    raise exception 'Not authorized';
  end if;

  if target_client is not null then
    select c.id
      into v_client_id
      from public.clients c
     where c.id = target_client
       and c.organization_id = target_org
       and c.branch_id = target_branch
       and c.status = 'active';
    if v_client_id is null then
      raise exception 'Client not found or inactive';
    end if;
  else
    v_full_name := btrim(coalesce(v_customer->>'full_name', ''));
    v_dni := btrim(coalesce(v_customer->>'dni', ''));
    v_dni_digits := regexp_replace(v_dni, '[^0-9]', '', 'g');
    v_phone := btrim(coalesce(v_customer->>'phone', ''));
    v_phone_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
    v_whatsapp := btrim(coalesce(v_customer->>'whatsapp', ''));
    v_whatsapp_digits := regexp_replace(v_whatsapp, '[^0-9]', '', 'g');
    v_email := nullif(btrim(coalesce(v_customer->>'email', '')), '');
    v_opt_in := coalesce((v_customer->>'marketing_opt_in')::boolean, false);

    if v_full_name = '' or v_phone_digits !~ '^[0-9]{7,15}$' then
      raise exception 'Client name and valid phone are required';
    end if;
    if v_dni <> '' and v_dni_digits !~ '^[0-9]{8}$' then
      raise exception 'Invalid DNI';
    end if;
    if v_whatsapp <> '' and v_whatsapp_digits !~ '^[0-9]{7,15}$' then
      raise exception 'Invalid WhatsApp phone';
    end if;

    if v_dni_digits <> '' then
      select count(distinct c.id),
             (array_agg(c.id order by c.created_at))[1]
        into v_dni_count, v_by_dni
        from public.clients c
       where c.organization_id = target_org
         and c.branch_id = target_branch
         and regexp_replace(coalesce(c.dni, ''), '[^0-9]', '', 'g') = v_dni_digits;
    end if;

    select count(distinct c.id),
           (array_agg(c.id order by c.created_at))[1]
      into v_phone_count, v_by_phone
      from public.clients c
     where c.organization_id = target_org
       and c.branch_id = target_branch
       and v_phone_digits <> ''
       and (
         regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
         or regexp_replace(coalesce(c.whatsapp, ''), '[^0-9]', '', 'g') = v_phone_digits
       );

    if v_dni_count > 1 or v_phone_count > 1 then
      raise exception 'Client identity is ambiguous';
    end if;
    if v_by_dni is not null and v_by_phone is not null and v_by_dni <> v_by_phone then
      raise exception 'Client identity conflict';
    end if;

    v_client_id := coalesce(v_by_dni, v_by_phone);

    if v_client_id is not null then
      select c.status, c.dni
        into v_client_status, v_existing_dni
        from public.clients c
       where c.id = v_client_id
         and c.organization_id = target_org
         and c.branch_id = target_branch
       for update;

      if v_client_status is distinct from 'active' then
        raise exception 'Client not found or inactive';
      end if;

      if v_by_phone = v_client_id
         and v_dni_digits <> ''
         and regexp_replace(coalesce(v_existing_dni, ''), '[^0-9]', '', 'g') not in ('', v_dni_digits) then
        raise exception 'Client identity conflict';
      end if;

      -- Only fill missing profile fields; a quick sale must not overwrite an established client record.
      update public.clients c
         set dni = coalesce(nullif(c.dni, ''), nullif(v_dni, '')),
             phone = coalesce(nullif(c.phone, ''), nullif(v_phone, '')),
             whatsapp = coalesce(nullif(c.whatsapp, ''), nullif(v_whatsapp, '')),
             email = coalesce(nullif(c.email, ''), v_email),
             marketing_opt_in = c.marketing_opt_in or v_opt_in,
             preferred_channel = coalesce(c.preferred_channel,
               case when coalesce(nullif(v_whatsapp, ''), nullif(c.whatsapp, '')) is not null then 'WhatsApp'
                    when coalesce(nullif(v_phone, ''), nullif(c.phone, '')) is not null then 'Llamada'
                    else null end),
             updated_at = now()
       where c.id = v_client_id
         and c.organization_id = target_org
         and c.branch_id = target_branch;
    else
      insert into public.clients (
        client_code, full_name, dni, phone, whatsapp, email, source, status, client_type,
        organization_id, branch_id, marketing_opt_in, preferred_channel
      ) values (
        '', v_full_name, nullif(v_dni, ''), nullif(v_phone, ''), nullif(v_whatsapp, ''),
        v_email, 'Venta integral', 'active', 'regular',
        target_org, target_branch, v_opt_in,
        case when nullif(v_whatsapp, '') is not null then 'WhatsApp'
             when nullif(v_phone, '') is not null then 'Llamada'
             else null end
      )
      returning id into v_client_id;
    end if;
  end if;

  if v_client_id is null then
    raise exception 'A client is required for an integrated optical sale';
  end if;

  if target_record_prescription then
    v_rx_type := nullif(btrim(coalesce(v_rx->>'rx_type', '')), '');
    v_cylinder_notation := coalesce(nullif(v_rx->>'cylinder_notation', ''), 'negative');

    if v_rx_type is null then
      raise exception 'Prescription type is required';
    end if;
    if v_cylinder_notation not in ('negative', 'positive') then
      raise exception 'Invalid cylinder notation';
    end if;

    if nullif(v_rx->>'od_sphere', '') is null
       and nullif(v_rx->>'od_cylinder', '') is null
       and nullif(v_rx->>'os_sphere', '') is null
       and nullif(v_rx->>'os_cylinder', '') is null
       and nullif(v_rx->>'od_add', '') is null
       and nullif(v_rx->>'os_add', '') is null then
      raise exception 'At least one prescription power is required';
    end if;

    v_od_axis := nullif(v_rx->>'od_axis', '')::numeric;
    v_os_axis := nullif(v_rx->>'os_axis', '')::numeric;
    v_od_near_axis := nullif(v_rx->>'od_near_axis', '')::numeric;
    v_os_near_axis := nullif(v_rx->>'os_near_axis', '')::numeric;
    v_pd := nullif(v_rx->>'pd', '')::numeric;

    if (v_od_axis is not null and (v_od_axis < 1 or v_od_axis > 180 or v_od_axis <> trunc(v_od_axis)))
       or (v_os_axis is not null and (v_os_axis < 1 or v_os_axis > 180 or v_os_axis <> trunc(v_os_axis)))
       or (v_od_near_axis is not null and (v_od_near_axis < 1 or v_od_near_axis > 180 or v_od_near_axis <> trunc(v_od_near_axis)))
       or (v_os_near_axis is not null and (v_os_near_axis < 1 or v_os_near_axis > 180 or v_os_near_axis <> trunc(v_os_near_axis))) then
      raise exception 'Axis must be between 1 and 180';
    end if;
    if v_pd is not null and (v_pd <= 0 or v_pd > 100) then
      raise exception 'Invalid pupillary distance';
    end if;

    insert into public.prescriptions (
      organization_id, branch_id, client_id, exam_at, expires_at,
      od_sphere, od_cylinder, od_axis, od_add,
      os_sphere, os_cylinder, os_axis, os_add,
      od_near_sphere, od_near_cylinder, od_near_axis,
      os_near_sphere, os_near_cylinder, os_near_axis,
      pd, notes, created_by, rx_type, cylinder_notation, prescriber_name, prescriber_license, rx_source
    ) values (
      target_org, target_branch, v_client_id,
      coalesce(nullif(v_rx->>'exam_at', '')::timestamptz, now()),
      nullif(v_rx->>'expires_at', '')::timestamptz,
      nullif(v_rx->>'od_sphere', '')::numeric,
      nullif(v_rx->>'od_cylinder', '')::numeric,
      v_od_axis,
      nullif(v_rx->>'od_add', '')::numeric,
      nullif(v_rx->>'os_sphere', '')::numeric,
      nullif(v_rx->>'os_cylinder', '')::numeric,
      v_os_axis,
      nullif(v_rx->>'os_add', '')::numeric,
      nullif(v_rx->>'od_near_sphere', '')::numeric,
      nullif(v_rx->>'od_near_cylinder', '')::numeric,
      v_od_near_axis,
      nullif(v_rx->>'os_near_sphere', '')::numeric,
      nullif(v_rx->>'os_near_cylinder', '')::numeric,
      v_os_near_axis,
      v_pd,
      nullif(btrim(coalesce(v_rx->>'prescription_notes', '')), ''),
      auth.uid(), v_rx_type, v_cylinder_notation,
      nullif(btrim(coalesce(v_rx->>'prescriber_name', '')), ''),
      nullif(btrim(coalesce(v_rx->>'prescriber_license', '')), ''),
      nullif(btrim(coalesce(v_rx->>'rx_source', '')), '')
    )
    returning id into v_prescription_id;
  end if;

  v_sale_result := private.create_sale_transaction(
    target_org, target_branch, v_client_id, target_lead,
    target_payment_method, target_paid, target_discount, target_responsible, items
  );
  v_sale_id := nullif(v_sale_result->>'sale_id', '')::uuid;
  v_sale_code := v_sale_result->>'sale_code';

  if v_sale_id is null or v_sale_code is null then
    raise exception 'Sale could not be created';
  end if;

  if coalesce(target_create_order, false) then
    if v_prescription_id is null then
      raise exception 'Prescription is required for an optical order';
    end if;
    if jsonb_typeof(items) <> 'array' or not exists (
      select 1 from jsonb_array_elements(items) item
       where item->>'component_type' in ('frame', 'lens')
    ) then
      raise exception 'An optical order needs a frame or lens component';
    end if;

    for v_item in select value from jsonb_array_elements(items)
    loop
      v_product_id := nullif(v_item->>'product_id', '')::uuid;
      if v_product_id is null then
        continue;
      end if;

      if v_item->>'component_type' = 'frame' and v_order_frame_id is null then
        select p.category into v_category
          from public.products p
         where p.id = v_product_id
           and p.organization_id = target_org
           and p.branch_id = target_branch
           and p.active = true;
        if v_category is distinct from 'Montura' then
          raise exception 'Frame product is invalid';
        end if;
        v_order_frame_id := v_product_id;
      elsif v_item->>'component_type' = 'lens' and v_order_lens_id is null then
        select p.category into v_category
          from public.products p
         where p.id = v_product_id
           and p.organization_id = target_org
           and p.branch_id = target_branch
           and p.active = true;
        if v_category is distinct from 'Lentes' then
          raise exception 'Lens product is invalid';
        end if;
        v_order_lens_id := v_product_id;
      end if;
    end loop;

    v_order_code := 'PED-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || '-' ||
                    substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_treatments := nullif(btrim(coalesce(v_order->>'treatments', '')), '');
    if v_treatments is null then
      select string_agg(nullif(btrim(coalesce(item->>'description', '')), ''), ' · ')
        into v_treatments
        from jsonb_array_elements(items) item
       where item->>'component_type' = 'treatment';
    end if;

    v_measurements := coalesce(v_order->'measurements', '{}'::jsonb) ||
      jsonb_build_object(
        'od_sphere', v_rx->>'od_sphere',
        'od_cylinder', v_rx->>'od_cylinder',
        'od_axis', v_rx->>'od_axis',
        'od_add', v_rx->>'od_add',
        'os_sphere', v_rx->>'os_sphere',
        'os_cylinder', v_rx->>'os_cylinder',
        'os_axis', v_rx->>'os_axis',
        'os_add', v_rx->>'os_add',
        'pd', v_rx->>'pd',
        'pd_od', v_rx->>'pd_od',
        'pd_os', v_rx->>'pd_os'
      );

    insert into public.optical_orders (
      order_code, sale_id, client_id, prescription_id, frame_product_id, lens_product_id,
      status, lab, lab_reference, lens_type, treatments, notes, organization_id, branch_id,
      lens_design, lens_material, lens_index, lens_brand, measurements, promised_at
    ) values (
      v_order_code, v_sale_id, v_client_id, v_prescription_id, v_order_frame_id, v_order_lens_id,
      'received',
      nullif(btrim(coalesce(v_order->>'lab', '')), ''),
      nullif(btrim(coalesce(v_order->>'lab_reference', '')), ''),
      nullif(btrim(coalesce(v_order->>'lens_type', '')), ''),
      v_treatments,
      nullif(btrim(coalesce(v_order->>'notes', '')), ''),
      target_org, target_branch,
      nullif(btrim(coalesce(v_order->>'lens_design', '')), ''),
      nullif(btrim(coalesce(v_order->>'lens_material', '')), ''),
      nullif(btrim(coalesce(v_order->>'lens_index', '')), ''),
      nullif(btrim(coalesce(v_order->>'lens_brand', '')), ''),
      v_measurements,
      nullif(v_order->>'promised_at', '')::timestamptz
    )
    returning id into v_order_id;
  end if;

  return coalesce(v_sale_result::jsonb, '{}'::jsonb) ||
    jsonb_build_object(
      'client_id', v_client_id,
      'prescription_id', v_prescription_id,
      'order_id', v_order_id,
      'order_code', v_order_code
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_complete_optical_sale(target_org uuid, target_branch uuid, target_client uuid, target_customer jsonb, target_record_prescription boolean, target_prescription jsonb, target_create_order boolean, target_order jsonb, target_lead uuid, target_payment_method text, target_paid numeric, target_discount numeric, target_responsible text, items jsonb)
 RETURNS json
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select private.create_complete_optical_sale(
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
  )::json;
$function$;

revoke all on function private.create_complete_optical_sale(uuid,uuid,uuid,jsonb,boolean,jsonb,boolean,jsonb,uuid,text,numeric,numeric,text,jsonb) from public;
grant execute on function private.create_complete_optical_sale(uuid,uuid,uuid,jsonb,boolean,jsonb,boolean,jsonb,uuid,text,numeric,numeric,text,jsonb) to authenticated;
revoke all on function public.create_complete_optical_sale(uuid,uuid,uuid,jsonb,boolean,jsonb,boolean,jsonb,uuid,text,numeric,numeric,text,jsonb) from public;
grant execute on function public.create_complete_optical_sale(uuid,uuid,uuid,jsonb,boolean,jsonb,boolean,jsonb,uuid,text,numeric,numeric,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
