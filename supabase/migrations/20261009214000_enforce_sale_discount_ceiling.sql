CREATE OR REPLACE FUNCTION private.create_sale_transaction(target_org uuid, target_branch uuid, target_client uuid, target_lead uuid, target_payment_method text, target_paid numeric, target_discount numeric, target_responsible text, items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    declare
      new_sale uuid;
      sale_code text;
      v_subtotal numeric(12,2):=0;
      v_total numeric(12,2):=0;
      v_paid numeric(12,2):=greatest(coalesce(target_paid,0),0);
      v_discount numeric(12,2):=greatest(coalesce(target_discount,0),0);
      v_lead public.leads%rowtype;
      item jsonb;
      product_row public.products%rowtype;
      qty numeric;
      v_unit_price numeric(12,2);
      v_unit_cost numeric(12,2);
      item_discount numeric(12,2);
      line_total numeric(12,2);
      stock_location uuid;
      new_client uuid;
      can_override boolean;
    begin
      if not private.has_permission(target_org,target_branch,'sales.create') then raise exception 'Not authorized'; end if;
      can_override := private.has_permission(target_org,target_branch,'sales.override_price');
      if v_paid>0 and nullif(trim(target_payment_method),'') is null then raise exception 'Payment method is required when recording a payment'; end if;
      if target_discount < 0 or v_paid < 0 then raise exception 'Invalid discount or payment amount'; end if;

      if target_client is not null and not exists(select 1 from public.clients where id=target_client and organization_id=target_org and branch_id=target_branch)
        then raise exception 'Client not found'; end if;

      if target_lead is not null then
        select * into v_lead from public.leads where id=target_lead and organization_id=target_org and branch_id=target_branch for update;
        if v_lead.id is null then raise exception 'Lead not found'; end if;
        if target_client is null and v_lead.client_id is not null then target_client:=v_lead.client_id; end if;
        if target_client is null then
          new_client:=gen_random_uuid();
          insert into public.clients(id,client_code,full_name,phone,source,status,client_type,organization_id,branch_id)
          values(new_client,'',v_lead.full_name,nullif(v_lead.phone,''),'Lead','active','regular',target_org,target_branch);
          target_client:=new_client;
          update public.leads set client_id=target_client,updated_at=now() where id=v_lead.id;
        end if;
      end if;

      if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one sale item is required'; end if;

      sale_code:='VTA-'||lpad((floor(random()*100000000))::bigint::text,8,'0');

      insert into public.sales(
        sale_code,client_id,lead_id,organization_id,branch_id,subtotal,discount,total,paid_amount,balance_due,
        payment_status,payment_method,responsible,seller_user_id,status
      ) values(
        sale_code,target_client,target_lead,target_org,target_branch,0,v_discount,0,0,0,'pending',
        nullif(trim(target_payment_method),''),nullif(trim(target_responsible),''),auth.uid(),'completed'
      ) returning id into new_sale;

      for item in select value from jsonb_array_elements(items)
      loop
        product_row:=null;
        qty:=coalesce((item->>'quantity')::numeric,1);
        v_unit_price:=coalesce((item->>'unit_price')::numeric,0);
        v_unit_cost:=coalesce((item->>'unit_cost')::numeric,0);
        item_discount:=greatest(coalesce((item->>'discount')::numeric,0),0);

        if qty<=0 or v_unit_price<0 or v_unit_cost<0 then raise exception 'Invalid sale item values'; end if;

        if nullif(item->>'product_id','') is not null then
          select * into product_row from public.products
          where id=(item->>'product_id')::uuid and organization_id=target_org and branch_id=target_branch and active=true
          for update;
          if product_row.id is null then raise exception 'Product not found'; end if;

          if product_row.inventory_mode='stock' then
            if qty<>trunc(qty) then raise exception 'Stock items require whole-number quantities'; end if;

            select l.id into stock_location
            from public.inventory_locations l
            where l.organization_id=target_org and l.branch_id=target_branch and l.active=true
              and exists(select 1 from public.inventory_stock s where s.location_id=l.id and s.product_id=product_row.id and s.quantity>=qty::integer)
            order by (l.location_type='display') desc,l.created_at limit 1;

            if stock_location is null then raise exception 'Insufficient stock for product %',product_row.product_code; end if;

            update public.inventory_stock set quantity=quantity-qty::integer,updated_at=now()
            where product_id=product_row.id and location_id=stock_location;

            update public.products set stock_qty=greatest(stock_qty-qty::integer,0),updated_at=now() where id=product_row.id;

            insert into public.inventory_movements(
              organization_id,branch_id,product_id,from_location_id,quantity,movement_type,reference_type,reference_id,created_by
            ) values(target_org,target_branch,product_row.id,stock_location,qty::integer,'sale','sale',new_sale,auth.uid());
          end if;

          if not can_override or v_unit_price=0 then v_unit_price:=product_row.sale_price; end if;
          v_unit_cost:=product_row.cost;
        end if;

        if item_discount > qty*v_unit_price then
          raise exception 'Item discount exceeds line subtotal';
        end if;

        line_total:=greatest(qty*v_unit_price-item_discount,0);
        v_subtotal:=v_subtotal+line_total;

        insert into public.sale_items(
          sale_id,product_id,description,component_type,quantity,unit_price,unit_cost,discount,line_total,metadata,organization_id,branch_id
        ) values(
          new_sale,nullif(item->>'product_id','')::uuid,
          coalesce(nullif(item->>'description',''),product_row.description,product_row.model,'Ítem'),
          coalesce(nullif(item->>'component_type',''),'other'),
          qty,v_unit_price,v_unit_cost,item_discount,line_total,coalesce(item->'metadata','{}'::jsonb),target_org,target_branch
        );
      end loop;

      if v_discount > v_subtotal then
        raise exception 'Discount exceeds sale subtotal';
      end if;

      v_total:=greatest(v_subtotal-v_discount,0);
      if v_paid > v_total then raise exception 'Payment exceeds sale total'; end if;

      update public.sales
      set subtotal=v_subtotal,discount=v_discount,total=v_total,paid_amount=v_paid,balance_due=greatest(v_total-v_paid,0),
          payment_status=case when v_paid>=v_total then 'paid' when v_paid>0 then 'partial' else 'pending' end
      where id=new_sale;

      if v_paid>0 then
        insert into public.sale_payments(organization_id,branch_id,sale_id,amount,payment_method,received_by,notes)
        values(target_org,target_branch,new_sale,v_paid,trim(target_payment_method),auth.uid(),'Pago registrado al crear la venta');
      end if;

      if target_client is not null then
        update public.clients set last_purchase_at=now(),updated_at=now() where id=target_client;
        insert into public.follow_ups(
          followup_code,client_id,lead_id,followup_type,channel,next_action,next_action_at,status,notes,organization_id,branch_id
        ) values(
          'SEG-'||lpad((floor(random()*100000000))::bigint::text,8,'0'),target_client,target_lead,'Postventa',
          case when exists(select 1 from public.clients c where c.id=target_client and c.whatsapp is not null and trim(c.whatsapp)<>'') then 'WhatsApp' else 'Llamada' end,
          'Contactar al cliente después de la compra',now()+interval '3 days','open',
          'Seguimiento automático generado por una venta.',target_org,target_branch
        );
      end if;

      if target_lead is not null then
        update public.leads set stage='won',last_contact_at=now(),next_action=null,next_action_at=null,result='Convertido en venta '||sale_code,updated_at=now() where id=target_lead;
      end if;

      return json_build_object('sale_id',new_sale,'sale_code',sale_code,'total',v_total,'client_id',target_client);
    end;
    $function$;
revoke all on function private.create_sale_transaction(uuid,uuid,uuid,uuid,text,numeric,numeric,text,jsonb) from public;
grant execute on function private.create_sale_transaction(uuid,uuid,uuid,uuid,text,numeric,numeric,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
