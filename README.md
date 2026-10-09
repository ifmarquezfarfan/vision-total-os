# Visión Total OS

Sistema operativo comercial y de gestión para Óptica Visión Total.

## Stack

- Next.js
- React
- Supabase / PostgreSQL
- Vercel
- GitHub

## Estado

V0.1: autenticación, organización/sucursal inicial, dashboard y módulo real de clientes.

## Variables de entorno

Copia `.env.example` como `.env.local` y configura:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Nunca subas secretos al repositorio.

## Arquitectura

El sistema está pensado como una aplicación web centralizada. Los usuarios, sucursales y módulos trabajan sobre una base PostgreSQL común con RLS de Supabase.

El objetivo no es una maqueta: cada módulo se construirá sobre datos persistentes y relaciones reales.

## Optical customer journey

The primary route is `/atencion`: preliminary quote and client registration, external measurement, final optical configuration, then payment and internal receipt. `/cotizaciones` owns the initial and final quote documents. `/buscador-lunas` searches only the real branch-scoped lens catalog; populate the manufacturer's data before relying on power-range filters.
