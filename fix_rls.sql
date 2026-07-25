-- FIX: Permisos RLS para reportes_ciudadanos
-- Ejecuta este script en Supabase SQL Editor

-- 1. Dar permisos al rol anon
GRANT INSERT ON reportes_ciudadanos TO anon;
GRANT SELECT ON reportes_ciudadanos TO anon;

-- 2. Recrear politicas mas permisivas
DROP POLICY IF EXISTS "reportes_insert_public" ON reportes_ciudadanos;
DROP POLICY IF EXISTS "reportes_select_public" ON reportes_ciudadanos;

CREATE POLICY "reportes_insert_public"
    ON reportes_ciudadanos
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "reportes_select_public"
    ON reportes_ciudadanos
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 3. Verificar que el trigger esta activo
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'reportes_ciudadanos';
