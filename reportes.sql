-- =============================================
-- TABLA: Reportes Ciudadanos
-- Geoportal - Amenaza por Lahar del Cotopaxi
-- =============================================

-- 1. Crear tabla de reportes con campo geom Point
CREATE TABLE IF NOT EXISTS reportes_ciudadanos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) DEFAULT 'Anonimo',
    categoria VARCHAR(60) NOT NULL,
    descripcion TEXT,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    estado VARCHAR(20) DEFAULT 'pendiente',
    fecha TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(Point, 4326)
);

-- 2. Trigger: auto-crear geom desde latitud/longitud
CREATE OR REPLACE FUNCTION fn_reportes_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitud IS NOT NULL AND NEW.longitud IS NOT NULL THEN
        NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitud, NEW.latitud), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reportes_geom ON reportes_ciudadanos;

CREATE TRIGGER trg_reportes_geom
    BEFORE INSERT OR UPDATE ON reportes_ciudadanos
    FOR EACH ROW
    EXECUTE FUNCTION fn_reportes_geom();

-- 3. Index espacial para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_reportes_geom
    ON reportes_ciudadanos USING GIST(geom);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE reportes_ciudadanos ENABLE ROW LEVEL SECURITY;

-- 5. Politica: cualquiera puede INSERTAR (ciudadanos)
CREATE POLICY "reportes_insert_public"
    ON reportes_ciudadanos
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 6. Politica: cualquiera puede LEER (para mostrar en mapa)
CREATE POLICY "reportes_select_public"
    ON reportes_ciudadanos
    FOR SELECT
    TO anon
    USING (true);

-- 7. Vista resumen para estadisticas
CREATE OR REPLACE VIEW vista_reportes_resumen AS
SELECT
    categoria,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE estado='pendiente') AS pendientes,
    COUNT(*) FILTER (WHERE estado='resuelto') AS resueltos
FROM reportes_ciudadanos
GROUP BY categoria
ORDER BY total DESC;

-- =============================================
-- CATEGORIAS SUGERIDAS:
--   Baches, Alumbrado, Basura, Agua,
--   Alcantarillado, Parques, Seguridad,
--   Animales, Inundacion, Otro
-- =============================================
